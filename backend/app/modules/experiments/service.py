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
    ExperimentRunRequest,
    ExperimentRunResult,
    ExperimentStatus,
    FailureType,
    MetricSample,
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
        # 3. Always clean up / remove the chaos injection from the cluster
        logger.info("Cleaning up chaos resource %s/%s (%s)", namespace, name, kind)
        chaos_client.delete_experiment(kind=kind, namespace=namespace, name=name)

    status = ExperimentStatus.ABORTED if abort_triggered else ExperimentStatus.COMPLETED
    ended_at = datetime.now(UTC).isoformat()

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
    )

    _RUN_HISTORY[run_id] = result
    return result


def get_run(run_id: str) -> ExperimentRunResult | None:
    return _RUN_HISTORY.get(run_id)


def list_runs() -> list[ExperimentRunResult]:
    return list(_RUN_HISTORY.values())


def clear_runs() -> None:
    _RUN_HISTORY.clear()
