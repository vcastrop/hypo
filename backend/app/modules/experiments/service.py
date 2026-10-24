import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

import yaml

from app.integrations.chaos_mesh import ChaosMeshClient
from app.integrations.prometheus import PrometheusClient
from app.modules.experiments.schemas import (
    AbortCondition,
    ExperimentDefinition,
    ExperimentDefinitionRequest,
    ExperimentEvaluation,
    ExperimentRunRequest,
    ExperimentRunResult,
    ExperimentStatus,
    ExperimentVerdict,
    FailureType,
    MetricSample,
    SuccessCriteria,
    WindowMetrics,
)

logger = logging.getLogger(__name__)

MAX_BLAST_RADIUS_PERCENTAGE = 50.0

# In-memory storage for run records
_RUN_HISTORY: dict[str, ExperimentRunResult] = {}


def calculate_blast_radius(affected_replicas: int, total_replicas: int) -> float:
    if affected_replicas > total_replicas:
        raise ValueError("Affected replicas cannot exceed total replicas")

    return (affected_replicas / total_replicas) * 100


def build_hypothesis(
    failure_type: FailureType,
    target_name: str,
    affected_replicas: int,
    total_replicas: int,
) -> str:
    if failure_type == FailureType.POD_KILL:
        return (
            f"If {affected_replicas} of {total_replicas} replicas of {target_name} "
            "are terminated, the service should continue serving requests while "
            "Kubernetes restores the desired replica count."
        )

    if failure_type == FailureType.RESOURCE_STRESS:
        return (
            f"If {affected_replicas} of {total_replicas} replicas of {target_name} "
            "experience CPU and memory pressure, the service should maintain its "
            "defined steady-state conditions."
        )

    if failure_type == FailureType.NETWORK_DELAY:
        return (
            f"If network delay affects {affected_replicas} of {total_replicas} replicas "
            f"of {target_name}, the service should remain available, although latency "
            "may increase."
        )

    return (
        f"If packet loss affects {affected_replicas} of {total_replicas} replicas "
        f"of {target_name}, the service should maintain its defined steady-state conditions."
    )


def define_experiment(request: ExperimentDefinitionRequest) -> ExperimentDefinition:
    blast_radius = calculate_blast_radius(
        request.affected_replicas,
        request.target.replicas,
    )

    if blast_radius > MAX_BLAST_RADIUS_PERCENTAGE:
        raise ValueError(
            f"Blast radius {blast_radius:.1f}% exceeds the maximum allowed "
            f"{MAX_BLAST_RADIUS_PERCENTAGE:.1f}%"
        )

    hypothesis = build_hypothesis(
        request.failure_type,
        request.target.name,
        request.affected_replicas,
        request.target.replicas,
    )

    return ExperimentDefinition(
        target=request.target,
        failure_type=request.failure_type,
        blast_radius_percentage=blast_radius,
        duration_seconds=request.duration_seconds,
        hypothesis=hypothesis,
        affected_replicas=request.affected_replicas,
    )


def generate_chaos_mesh_manifest(experiment: ExperimentDefinition) -> dict[str, Any]:
    """Convert an ExperimentDefinition into a Chaos Mesh custom resource specification."""
    target_name = experiment.target.name
    namespace = experiment.target.namespace
    labels = experiment.target.labels or {"app": target_name}
    affected = getattr(experiment, "affected_replicas", 1)
    mode = "one" if affected <= 1 else "fixed"
    duration_str = f"{experiment.duration_seconds}s"

    if experiment.failure_type == FailureType.POD_KILL:
        spec: dict[str, Any] = {
            "action": "pod-kill",
            "mode": mode,
            "selector": {
                "namespaces": [namespace],
                "labelSelectors": labels,
            },
        }
        if mode == "fixed":
            spec["value"] = str(affected)

        return {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "PodChaos",
            "metadata": {
                "name": f"{target_name}-pod-kill",
                "namespace": namespace,
            },
            "spec": spec,
        }

    if experiment.failure_type == FailureType.RESOURCE_STRESS:
        spec = {
            "mode": mode,
            "duration": duration_str,
            "selector": {
                "namespaces": [namespace],
                "labelSelectors": labels,
            },
            "stressors": {
                "cpu": {
                    "workers": 1,
                    "load": 80,
                },
                "memory": {
                    "workers": 1,
                    "size": "128MiB",
                },
            },
        }
        if mode == "fixed":
            spec["value"] = str(affected)

        return {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "StressChaos",
            "metadata": {
                "name": f"{target_name}-resource-stress",
                "namespace": namespace,
            },
            "spec": spec,
        }

    if experiment.failure_type == FailureType.NETWORK_DELAY:
        spec = {
            "action": "delay",
            "mode": mode,
            "selector": {
                "namespaces": [namespace],
                "labelSelectors": labels,
            },
            "delay": {
                "latency": "200ms",
                "jitter": "0ms",
                "correlation": "100",
            },
            "duration": duration_str,
        }
        if mode == "fixed":
            spec["value"] = str(affected)

        return {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "NetworkChaos",
            "metadata": {
                "name": f"{target_name}-network-delay",
                "namespace": namespace,
            },
            "spec": spec,
        }

    if experiment.failure_type == FailureType.NETWORK_LOSS:
        spec = {
            "action": "loss",
            "mode": mode,
            "selector": {
                "namespaces": [namespace],
                "labelSelectors": labels,
            },
            "loss": {
                "loss": "30",
                "correlation": "100",
            },
            "duration": duration_str,
        }
        if mode == "fixed":
            spec["value"] = str(affected)

        return {
            "apiVersion": "chaos-mesh.org/v1alpha1",
            "kind": "NetworkChaos",
            "metadata": {
                "name": f"{target_name}-network-loss",
                "namespace": namespace,
            },
            "spec": spec,
        }

    raise ValueError(f"Unsupported failure type: {experiment.failure_type}")


def generate_chaos_mesh_yaml(
    experiment_or_manifest: ExperimentDefinition | dict[str, Any],
) -> str:
    """Serialize the Chaos Mesh manifest into standard YAML format."""
    if isinstance(experiment_or_manifest, dict):
        manifest = experiment_or_manifest
    else:
        manifest = generate_chaos_mesh_manifest(experiment_or_manifest)
    return yaml.safe_dump(manifest, sort_keys=False)


def check_abort_condition(current_value: float, condition: AbortCondition) -> bool:
    """Evaluate whether an observed metric value breaches the safety abort condition."""
    op = condition.operator
    threshold = condition.threshold

    if op == ">":
        return current_value > threshold
    if op == ">=":
        return current_value >= threshold
    if op == "<":
        return current_value < threshold
    if op == "<=":
        return current_value <= threshold

    return False


def sample_metric(
    metric_name: str,
    target_name: str,
    prometheus_client: PrometheusClient | None,
) -> float | None:
    """Fetch metric value from Prometheus."""
    if prometheus_client is None:
        return None

    if metric_name == "error_rate":
        return prometheus_client.get_error_rate(target_name)
    if metric_name == "success_rate":
        return prometheus_client.get_success_rate(target_name)

    return prometheus_client.query(metric_name)


def pull_window_metrics(
    target_name: str,
    prometheus_client: PrometheusClient | None,
    window: str = "1m",
) -> WindowMetrics:
    """Pull snapshot of SLI metrics (error rate, success rate, p95 latency) for a given window."""
    if prometheus_client is None:
        return WindowMetrics()

    err = (
        prometheus_client.get_error_rate(target_name, window=window)
        if hasattr(prometheus_client, "get_error_rate")
        else None
    )
    succ = (
        prometheus_client.get_success_rate(target_name, window=window)
        if hasattr(prometheus_client, "get_success_rate")
        else None
    )
    p95 = (
        prometheus_client.get_p95_latency(target_name, window=window)
        if hasattr(prometheus_client, "get_p95_latency")
        else None
    )

    return WindowMetrics(
        error_rate=err,
        success_rate=succ,
        p95_latency_ms=p95,
    )


def compute_recovery_time(
    metrics_observed: list[MetricSample],
    start_recovery_time: float,
    threshold: float,
) -> float | None:
    """Compute seconds it took for metric to recover under threshold after chaos ended."""
    if not metrics_observed:
        return None

    post_chaos_samples = [s for s in metrics_observed if s.timestamp >= start_recovery_time]
    if not post_chaos_samples:
        return None

    for sample in post_chaos_samples:
        if sample.value <= threshold:
            return round(max(0.0, sample.timestamp - start_recovery_time), 2)

    return None


def evaluate_experiment(
    experiment: ExperimentDefinition,
    status: ExperimentStatus,
    abort_triggered: bool,
    abort_reason: str | None,
    criteria: SuccessCriteria,
    before_metrics: WindowMetrics,
    during_metrics: WindowMetrics,
    after_metrics: WindowMetrics,
    recovery_time_seconds: float | None = None,
) -> ExperimentEvaluation:
    """Evaluate experiment results against defined success criteria (SLOs) and hypothesis."""
    details: list[str] = []
    passed = True

    if abort_triggered or status == ExperimentStatus.ABORTED:
        passed = False
        details.append(f"Experiment aborted prematurely due to safety condition: {abort_reason}")

    # Evaluate after metrics (steady state recovery)
    if after_metrics.error_rate is not None:
        if after_metrics.error_rate > criteria.max_error_rate_percentage:
            passed = False
            details.append(
                f"Post-chaos error rate ({after_metrics.error_rate:.2f}%) "
                f"exceeded threshold ({criteria.max_error_rate_percentage:.2f}%)"
            )
        else:
            details.append(
                f"Post-chaos error rate ({after_metrics.error_rate:.2f}%) "
                f"met SLO threshold (<={criteria.max_error_rate_percentage:.2f}%)"
            )

    if after_metrics.success_rate is not None:
        if after_metrics.success_rate < criteria.min_success_rate_percentage:
            passed = False
            details.append(
                f"Post-chaos success rate ({after_metrics.success_rate:.2f}%) "
                f"below threshold ({criteria.min_success_rate_percentage:.2f}%)"
            )
        else:
            details.append(
                f"Post-chaos success rate ({after_metrics.success_rate:.2f}%) "
                f"met SLO threshold (>={criteria.min_success_rate_percentage:.2f}%)"
            )

    if criteria.max_p95_latency_ms is not None and after_metrics.p95_latency_ms is not None:
        if after_metrics.p95_latency_ms > criteria.max_p95_latency_ms:
            passed = False
            details.append(
                f"Post-chaos P95 latency ({after_metrics.p95_latency_ms:.1f}ms) "
                f"exceeded threshold ({criteria.max_p95_latency_ms:.1f}ms)"
            )
        else:
            details.append(
                f"Post-chaos P95 latency ({after_metrics.p95_latency_ms:.1f}ms) "
                f"met SLO threshold (<={criteria.max_p95_latency_ms:.1f}ms)"
            )

    if criteria.max_recovery_time_seconds is not None and recovery_time_seconds is not None:
        if recovery_time_seconds > criteria.max_recovery_time_seconds:
            passed = False
            details.append(
                f"Recovery time ({recovery_time_seconds:.1f}s) "
                f"exceeded allowed time ({criteria.max_recovery_time_seconds:.1f}s)"
            )
        else:
            details.append(
                f"Recovery time ({recovery_time_seconds:.1f}s) "
                f"within threshold (<={criteria.max_recovery_time_seconds:.1f}s)"
            )

    verdict = ExperimentVerdict.PASS if passed else ExperimentVerdict.FAIL

    return ExperimentEvaluation(
        verdict=verdict,
        hypothesis_met=passed,
        recovery_time_seconds=recovery_time_seconds,
        before_metrics=before_metrics,
        during_metrics=during_metrics,
        after_metrics=after_metrics,
        details=details,
    )


def execute_experiment(
    request: ExperimentRunRequest,
    chaos_client: ChaosMeshClient,
    prometheus_client: PrometheusClient | None = None,
) -> ExperimentRunResult:
    """Execute an experiment end-to-end:

    1. Resolve experiment definition
    2. Convert to Chaos Mesh YAML manifest
    3. Apply to Kubernetes automatically
    4. Monitor abort conditions in real time (stops on threshold breach)
    5. Clean up chaos resource upon completion or abort
    """
    if request.definition is not None:
        experiment = request.definition
    elif request.definition_request is not None:
        experiment = define_experiment(request.definition_request)
    else:
        raise ValueError("Either 'definition' or 'definition_request' must be provided")

    manifest = generate_chaos_mesh_manifest(experiment)
    chaos_yaml = generate_chaos_mesh_yaml(manifest)

    kind = manifest["kind"]
    name = manifest["metadata"]["name"]
    namespace = manifest["metadata"]["namespace"]

    run_id = f"run-{uuid.uuid4().hex[:8]}"
    started_at = datetime.now(UTC).isoformat()
    metrics_observed: list[MetricSample] = []
    abort_triggered = False
    abort_reason: str | None = None

    # Determine monitoring duration
    duration = (
        request.max_duration_seconds
        if request.max_duration_seconds is not None
        else experiment.duration_seconds
    )
    interval = max(0.01, request.monitor_interval_seconds)

    logger.info(
        "Applying chaos experiment %s (%s) on %s for %ss",
        name,
        kind,
        experiment.target.name,
        duration,
    )

    # 0. Pull before-metrics baseline
    before_metrics = pull_window_metrics(experiment.target.name, prometheus_client)

    # 1. Apply automatically to Kubernetes
    chaos_client.apply_experiment(manifest)

    # 2. Monitor abort conditions
    try:
        start_time = time.time()
        end_time = start_time + duration

        while time.time() < end_time:
            now = time.time()
            if prometheus_client is not None and request.abort_condition:
                val = sample_metric(
                    request.abort_condition.metric,
                    experiment.target.name,
                    prometheus_client,
                )
                if val is not None:
                    sample = MetricSample(
                        timestamp=now,
                        metric=request.abort_condition.metric,
                        value=val,
                    )
                    metrics_observed.append(sample)

                    if check_abort_condition(val, request.abort_condition):
                        abort_triggered = True
                        abort_reason = (
                            f"Abort condition triggered: {request.abort_condition.metric} "
                            f"({val:.1f}%) {request.abort_condition.operator} threshold "
                            f"({request.abort_condition.threshold:.1f}%)"
                        )
                        logger.warning(
                            "Safety abort triggered for %s: %s",
                            run_id,
                            abort_reason,
                        )
                        break

            sleep_duration = min(interval, max(0.0, end_time - time.time()))
            if sleep_duration > 0:
                time.sleep(sleep_duration)

    finally:
        # Snapshot during metrics right before cleanup
        during_metrics = pull_window_metrics(experiment.target.name, prometheus_client)
        post_chaos_start = time.time()

        # 3. Always clean up / remove the chaos injection from the cluster
        logger.info("Cleaning up chaos resource %s/%s (%s)", namespace, name, kind)
        chaos_client.delete_experiment(kind=kind, namespace=namespace, name=name)

    # Sample immediate post-chaos metric to verify recovery
    if prometheus_client is not None and request.abort_condition:
        post_val = sample_metric(
            request.abort_condition.metric,
            experiment.target.name,
            prometheus_client,
        )
        if post_val is not None:
            metrics_observed.append(
                MetricSample(
                    timestamp=time.time(),
                    metric=request.abort_condition.metric,
                    value=post_val,
                )
            )

    # 4. Pull after-metrics snapshot
    after_metrics = pull_window_metrics(experiment.target.name, prometheus_client)

    # 5. Compute recovery time
    recovery_time = compute_recovery_time(
        metrics_observed=metrics_observed,
        start_recovery_time=post_chaos_start,
        threshold=request.success_criteria.max_error_rate_percentage,
    )

    status = ExperimentStatus.ABORTED if abort_triggered else ExperimentStatus.COMPLETED
    ended_at = datetime.now(UTC).isoformat()

    # 6. Evaluate experiment results against success criteria and SLOs
    evaluation = evaluate_experiment(
        experiment=experiment,
        status=status,
        abort_triggered=abort_triggered,
        abort_reason=abort_reason,
        criteria=request.success_criteria,
        before_metrics=before_metrics,
        during_metrics=during_metrics,
        after_metrics=after_metrics,
        recovery_time_seconds=recovery_time,
    )

    result = ExperimentRunResult(
        id=run_id,
        experiment=experiment,
        chaos_yaml=chaos_yaml,
        status=status,
        abort_triggered=abort_triggered,
        abort_reason=abort_reason,
        metrics_observed=metrics_observed,
        started_at=started_at,
        ended_at=ended_at,
        evaluation=evaluation,
    )

    _RUN_HISTORY[run_id] = result
    return result


def get_run(run_id: str) -> ExperimentRunResult | None:
    return _RUN_HISTORY.get(run_id)


def list_runs() -> list[ExperimentRunResult]:
    return list(_RUN_HISTORY.values())


def clear_runs() -> None:
    _RUN_HISTORY.clear()
