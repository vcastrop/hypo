"""Lifecycle management for asynchronous chaos experiments."""

import logging
import threading
import time
import uuid
from datetime import UTC, datetime

import yaml

from app.integrations.chaos_mesh import ChaosMeshClient
from app.integrations.prometheus import PrometheusClient
from app.modules.experiments.schemas import (
    ExperimentDefinitionRequest,
    ExperimentRunRequest,
    ExperimentRunResult,
    ExperimentStatus,
    MetricSample,
)
from app.modules.experiments.service import (
    _RUN_HISTORY,
    check_abort_condition,
    define_experiment,
    evaluate_experiment,
    generate_chaos_mesh_manifest,
    generate_chaos_mesh_yaml,
    pull_window_metrics,
    sample_metric,
)

logger = logging.getLogger(__name__)

MAX_EXPERIMENT_DURATION_SECONDS = 300
class ExperimentRunner:
    """Manage experiment registrations and cancellation requests."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._cancel_events: dict[str, threading.Event] = {}
        self._active_targets: dict[tuple[str, str], str] = {}

    def register(self, request: ExperimentRunRequest) -> ExperimentRunResult:
        """Validate and register an experiment without executing it."""

        if request.definition_request is not None:
            experiment = define_experiment(request.definition_request)
        elif request.definition is not None:
            experiment = request.definition
        else:
            raise ValueError(
                "Either 'definition' or 'definition_request' must be provided"
            )

        # Revalidate supplied definitions instead of trusting client values.
        from app.modules.experiments.schemas import ExperimentDefinitionRequest

        experiment = define_experiment(
            ExperimentDefinitionRequest(
                target=experiment.target,
                failure_type=experiment.failure_type,
                duration_seconds=experiment.duration_seconds,
                affected_replicas=experiment.affected_replicas,
            )
        )

        if experiment.duration_seconds > MAX_EXPERIMENT_DURATION_SECONDS:
            raise ValueError(
                "Experiment duration cannot exceed "
                f"{MAX_EXPERIMENT_DURATION_SECONDS} seconds"
            )

        if (
            request.max_duration_seconds is not None
            and request.max_duration_seconds > experiment.duration_seconds
        ):
            raise ValueError(
                "Maximum execution duration cannot exceed "
                "the experiment definition duration"
            )

        run_id = f"run-{uuid.uuid4().hex}"

        manifest = generate_chaos_mesh_manifest(experiment)

        # Give every execution its own Kubernetes resource.
        manifest["metadata"]["name"] = f"hypo-{run_id.removeprefix('run-')[:12]}"

        # Keep the run identifier in the resource metadata.
        manifest["metadata"].setdefault("labels", {})
        manifest["metadata"]["labels"]["app.kubernetes.io/managed-by"] = "hypo"

        manifest["metadata"].setdefault("annotations", {})
        manifest["metadata"]["annotations"]["hypo/run-id"] = run_id

        chaos_yaml = generate_chaos_mesh_yaml(manifest)

        target_key = (
            experiment.target.namespace,
            experiment.target.name,
        )

        with self._lock:
            if target_key in self._active_targets:
                raise ValueError(
                    f"An experiment is already active for "
                    f"{experiment.target.namespace}/{experiment.target.name}"
                )

            result = ExperimentRunResult(
                id=run_id,
                experiment=experiment,
                chaos_yaml=chaos_yaml,
                status=ExperimentStatus.PENDING,
                started_at=None,
                ended_at=None,
            )

            self._cancel_events[run_id] = threading.Event()
            self._active_targets[target_key] = run_id
            _RUN_HISTORY[run_id] = result

            return result.model_copy(deep=True)

    def start(
        self,
        request: ExperimentRunRequest,
        chaos_client: ChaosMeshClient,
        prometheus_client: PrometheusClient | None = None,
    ) -> ExperimentRunResult:
        """Register an experiment and start its background worker."""

        result = self.register(request)

        worker = threading.Thread(
            target=self._execute,
            args=(result.id, request, chaos_client, prometheus_client),
            daemon=True,
            name=f"experiment-{result.id}",
        )

        try:
            worker.start()
        except Exception:
            self.finish(
                result.id,
                ExperimentStatus.FAILED,
                "Could not start experiment worker",
            )
            raise

        return result

    def _execute(
        self,
        run_id: str,
        request: ExperimentRunRequest,
        chaos_client: ChaosMeshClient,
        prometheus_client: PrometheusClient | None,
    ) -> None:
        """Execute, monitor and clean up an experiment in a worker thread."""

        with self._lock:
            result = _RUN_HISTORY[run_id]
            experiment = result.experiment
            manifest = yaml.safe_load(result.chaos_yaml)
            cancel_event = self._cancel_events[run_id]

            result.status = ExperimentStatus.RUNNING
            result.started_at = datetime.now(UTC).isoformat()

        kind = manifest["kind"]
        namespace = manifest["metadata"]["namespace"]
        name = manifest["metadata"]["name"]

        duration = min(
            request.max_duration_seconds
            if request.max_duration_seconds is not None
            else experiment.duration_seconds,
            experiment.duration_seconds,
            MAX_EXPERIMENT_DURATION_SECONDS,
        )

        interval = max(0.01, request.monitor_interval_seconds)

        if "duration" in manifest["spec"]:
            manifest["spec"]["duration"] = f"{duration:g}s"

        metrics_observed = []
        before_metrics = None
        during_metrics = None
        after_metrics = None

        final_status = ExperimentStatus.COMPLETED
        abort_reason = None
        abort_triggered = False
        cleanup_error = None

        try:
            if cancel_event.is_set():
                final_status = ExperimentStatus.ABORTED
                abort_reason = "Experiment cancelled before execution"
                return

            before_metrics = pull_window_metrics(
                experiment.target.name,
                prometheus_client,
            )

            if cancel_event.is_set():
                final_status = ExperimentStatus.ABORTED
                abort_reason = "Experiment cancelled before injection"
                return

            logger.info("Applying experiment %s", run_id)

            # Attempt cleanup even if the apply operation raises.
            chaos_client.apply_experiment(manifest)

            deadline = time.monotonic() + duration

            while time.monotonic() < deadline:
                if cancel_event.is_set():
                    final_status = ExperimentStatus.ABORTED
                    abort_reason = "Experiment manually stopped"
                    abort_triggered = True
                    break

                value = sample_metric(
                    request.abort_condition.metric,
                    experiment.target.name,
                    prometheus_client,
                )

                if value is not None:
                    metrics_observed.append(
                        MetricSample(
                            timestamp=time.time(),
                            metric=request.abort_condition.metric,
                            value=value,
                        )
                    )

                    if check_abort_condition(
                        value,
                        request.abort_condition,
                    ):
                        final_status = ExperimentStatus.ABORTED
                        abort_triggered = True
                        abort_reason = (
                            f"Abort condition triggered: "
                            f"{request.abort_condition.metric}={value}"
                        )
                        break

                remaining = max(0.0, deadline - time.monotonic())
                cancel_event.wait(min(interval, remaining))

        except Exception as exc:
            logger.exception("Experiment %s failed", run_id)
            final_status = ExperimentStatus.FAILED
            abort_reason = str(exc)

        finally:
            # Cleanup takes priority over metric collection.
            try:
                chaos_client.delete_experiment(
                    kind=kind,
                    namespace=namespace,
                    name=name,
                )
            except Exception as exc:
                logger.exception("Cleanup failed for %s", run_id)
                cleanup_error = str(exc)
                final_status = ExperimentStatus.FAILED
                abort_reason = f"Chaos cleanup failed: {exc}"

            try:
                during_metrics = pull_window_metrics(
                    experiment.target.name,
                    prometheus_client,
                )
                after_metrics = pull_window_metrics(
                    experiment.target.name,
                    prometheus_client,
                )
            except Exception:
                logger.exception("Could not collect final metrics for %s", run_id)

            evaluation = None

            if (
                before_metrics is not None
                and during_metrics is not None
                and after_metrics is not None
                and cleanup_error is None
            ):
                try:
                    evaluation = evaluate_experiment(
                        experiment=experiment,
                        status=final_status,
                        abort_triggered=abort_triggered,
                        abort_reason=abort_reason,
                        criteria=request.success_criteria,
                        before_metrics=before_metrics,
                        during_metrics=during_metrics,
                        after_metrics=after_metrics,
                    )
                except Exception:
                    logger.exception("Evaluation failed for %s", run_id)

            with self._lock:
                result = _RUN_HISTORY[run_id]
                result.metrics_observed = metrics_observed
                result.abort_triggered = abort_triggered
                result.evaluation = evaluation

            self.finish(
                run_id,
                status=final_status,
                reason=abort_reason,
                release_target=cleanup_error is None,
            )

    def get(self, run_id: str) -> ExperimentRunResult | None:
        """Return a snapshot of the current run."""

        with self._lock:
            result = _RUN_HISTORY.get(run_id)
            return result.model_copy(deep=True) if result else None

    def request_stop(self, run_id: str) -> ExperimentRunResult | None:
        """Request cancellation without blocking the HTTP request."""

        with self._lock:
            result = _RUN_HISTORY.get(run_id)

            if result is None:
                return None

            if result.status in (
                ExperimentStatus.COMPLETED,
                ExperimentStatus.ABORTED,
                ExperimentStatus.FAILED,
            ):
                return result.model_copy(deep=True)

            event = self._cancel_events.get(run_id)

            if event is not None:
                event.set()

            return result.model_copy(deep=True)

    def cancellation_requested(self, run_id: str) -> bool:
        """Check whether cancellation has been requested."""

        with self._lock:
            event = self._cancel_events.get(run_id)
            return event.is_set() if event else False

    def finish(
        self,
        run_id: str,
        status: ExperimentStatus,
        reason: str | None = None,
        release_target: bool = True,
    ) -> ExperimentRunResult:
        """Finish a run and optionally retain its target lock."""

        with self._lock:
            result = _RUN_HISTORY[run_id]

            result.status = status
            result.ended_at = datetime.now(UTC).isoformat()

            if reason is not None:
                result.abort_reason = reason

            target_key = (
                result.experiment.target.namespace,
                result.experiment.target.name,
            )

            if release_target:
                if self._active_targets.get(target_key) == run_id:
                    del self._active_targets[target_key]

            self._cancel_events.pop(run_id, None)

            return result.model_copy(deep=True)

experiment_runner = ExperimentRunner()