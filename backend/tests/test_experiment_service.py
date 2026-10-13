import pytest

from app.modules.experiments.schemas import (
    ExperimentDefinitionRequest,
    ExperimentTarget,
    FailureType,
)
from app.modules.experiments.service import (
    calculate_blast_radius,
    define_experiment,
)


def _target(replicas: int = 2) -> ExperimentTarget:
    return ExperimentTarget(
        name="catalog-service",
        namespace="mybookstore",
        kind="Deployment",
        replicas=replicas,
        labels={"app": "catalog-service"},
    )


def test_calculates_50_percent_blast_radius():
    assert calculate_blast_radius(1, 2) == 50.0


def test_calculates_40_percent_blast_radius():
    assert calculate_blast_radius(2, 5) == 40.0


def test_rejects_more_affected_replicas_than_exist():
    with pytest.raises(ValueError, match="cannot exceed total replicas"):
        calculate_blast_radius(3, 2)


def test_defines_pod_kill_experiment():
    request = ExperimentDefinitionRequest(
        target=_target(),
        failure_type=FailureType.POD_KILL,
        duration_seconds=60,
        affected_replicas=1,
    )

    experiment = define_experiment(request)

    assert experiment.target.name == "catalog-service"
    assert experiment.failure_type == FailureType.POD_KILL
    assert experiment.blast_radius_percentage == 50.0
    assert experiment.duration_seconds == 60
    assert "Kubernetes restores the desired replica count" in experiment.hypothesis


def test_defines_resource_stress_experiment():
    request = ExperimentDefinitionRequest(
        target=_target(replicas=4),
        failure_type=FailureType.RESOURCE_STRESS,
        duration_seconds=60,
        affected_replicas=1,
    )

    experiment = define_experiment(request)

    assert experiment.blast_radius_percentage == 25.0
    assert "CPU and memory pressure" in experiment.hypothesis


def test_defines_network_delay_experiment():
    request = ExperimentDefinitionRequest(
        target=_target(),
        failure_type=FailureType.NETWORK_DELAY,
        duration_seconds=60,
        affected_replicas=1,
    )

    experiment = define_experiment(request)

    assert experiment.blast_radius_percentage == 50.0
    assert "network delay" in experiment.hypothesis


def test_defines_network_loss_experiment():
    request = ExperimentDefinitionRequest(
        target=_target(),
        failure_type=FailureType.NETWORK_LOSS,
        duration_seconds=60,
        affected_replicas=1,
    )

    experiment = define_experiment(request)

    assert experiment.blast_radius_percentage == 50.0
    assert "packet loss" in experiment.hypothesis


def test_rejects_blast_radius_above_50_percent():
    request = ExperimentDefinitionRequest(
        target=_target(replicas=3),
        failure_type=FailureType.POD_KILL,
        duration_seconds=60,
        affected_replicas=2,
    )

    with pytest.raises(ValueError, match="exceeds the maximum allowed"):
        define_experiment(request)


# ── Chaos Mesh Manifest & YAML Generation ───────────────────────────


def test_generates_pod_kill_manifest_and_yaml():
    experiment = define_experiment(
        ExperimentDefinitionRequest(
            target=_target(),
            failure_type=FailureType.POD_KILL,
            duration_seconds=30,
            affected_replicas=1,
        )
    )

    from app.modules.experiments.service import (
        generate_chaos_mesh_manifest,
        generate_chaos_mesh_yaml,
    )

    manifest = generate_chaos_mesh_manifest(experiment)
    assert manifest["apiVersion"] == "chaos-mesh.org/v1alpha1"
    assert manifest["kind"] == "PodChaos"
    assert manifest["metadata"]["name"] == "catalog-service-pod-kill"
    assert manifest["metadata"]["namespace"] == "mybookstore"
    assert manifest["spec"]["action"] == "pod-kill"
    assert manifest["spec"]["mode"] == "one"
    assert manifest["spec"]["selector"]["namespaces"] == ["mybookstore"]
    assert manifest["spec"]["selector"]["labelSelectors"] == {"app": "catalog-service"}

    yaml_str = generate_chaos_mesh_yaml(experiment)
    assert "kind: PodChaos" in yaml_str
    assert "action: pod-kill" in yaml_str


def test_generates_resource_stress_manifest_and_yaml():
    experiment = define_experiment(
        ExperimentDefinitionRequest(
            target=_target(replicas=4),
            failure_type=FailureType.RESOURCE_STRESS,
            duration_seconds=45,
            affected_replicas=1,
        )
    )

    from app.modules.experiments.service import (
        generate_chaos_mesh_manifest,
        generate_chaos_mesh_yaml,
    )

    manifest = generate_chaos_mesh_manifest(experiment)
    assert manifest["kind"] == "StressChaos"
    assert manifest["spec"]["duration"] == "45s"
    assert manifest["spec"]["stressors"]["cpu"]["load"] == 80
    assert manifest["spec"]["stressors"]["memory"]["size"] == "128MiB"

    yaml_str = generate_chaos_mesh_yaml(manifest)
    assert "kind: StressChaos" in yaml_str
    assert "duration: 45s" in yaml_str


def test_generates_network_delay_manifest_and_yaml():
    experiment = define_experiment(
        ExperimentDefinitionRequest(
            target=_target(),
            failure_type=FailureType.NETWORK_DELAY,
            duration_seconds=60,
            affected_replicas=1,
        )
    )

    from app.modules.experiments.service import (
        generate_chaos_mesh_manifest,
        generate_chaos_mesh_yaml,
    )

    manifest = generate_chaos_mesh_manifest(experiment)
    assert manifest["kind"] == "NetworkChaos"
    assert manifest["spec"]["action"] == "delay"
    assert manifest["spec"]["delay"]["latency"] == "200ms"
    assert manifest["spec"]["duration"] == "60s"

    yaml_str = generate_chaos_mesh_yaml(manifest)
    assert "kind: NetworkChaos" in yaml_str
    assert "latency: 200ms" in yaml_str


def test_generates_network_loss_manifest_and_yaml():
    experiment = define_experiment(
        ExperimentDefinitionRequest(
            target=_target(),
            failure_type=FailureType.NETWORK_LOSS,
            duration_seconds=60,
            affected_replicas=1,
        )
    )

    from app.modules.experiments.service import (
        generate_chaos_mesh_manifest,
        generate_chaos_mesh_yaml,
    )

    manifest = generate_chaos_mesh_manifest(experiment)
    assert manifest["kind"] == "NetworkChaos"
    assert manifest["spec"]["action"] == "loss"
    assert manifest["spec"]["loss"]["loss"] == "30"
    assert manifest["spec"]["duration"] == "60s"

    yaml_str = generate_chaos_mesh_yaml(manifest)
    assert "loss: '30'" in yaml_str or 'loss: "30"' in yaml_str or "loss: 30" in yaml_str


# ── Abort Condition Evaluation ──────────────────────────────────────


def test_evaluates_abort_condition():
    from app.modules.experiments.schemas import AbortCondition
    from app.modules.experiments.service import check_abort_condition

    cond_gt = AbortCondition(metric="error_rate", threshold=10.0, operator=">")
    assert check_abort_condition(5.0, cond_gt) is False
    assert check_abort_condition(10.0, cond_gt) is False
    assert check_abort_condition(10.1, cond_gt) is True

    cond_lt = AbortCondition(metric="success_rate", threshold=50.0, operator="<")
    assert check_abort_condition(99.0, cond_lt) is False
    assert check_abort_condition(49.9, cond_lt) is True


# ── End-to-End Execution & Abort Monitoring ─────────────────────────


class FakeChaosClient:
    def __init__(self):
        self.applied = []
        self.deleted = []

    def apply_experiment(self, manifest):
        self.applied.append(manifest)
        return manifest

    def delete_experiment(self, kind, namespace, name):
        self.deleted.append((kind, namespace, name))

    def get_experiment(self, kind, namespace, name):
        return None


class FakePrometheusClient:
    def __init__(self, error_rate=0.0, success_rate=100.0):
        self.error_rate = error_rate
        self.success_rate = success_rate

    def get_error_rate(self, service_name, window="1m"):
        return self.error_rate

    def get_success_rate(self, service_name, window="1m"):
        return self.success_rate

    def query(self, query):
        return None


def test_executes_experiment_completed_normally():
    from app.modules.experiments.schemas import (
        AbortCondition,
        ExperimentRunRequest,
        ExperimentStatus,
    )
    from app.modules.experiments.service import execute_experiment

    experiment = define_experiment(
        ExperimentDefinitionRequest(
            target=_target(),
            failure_type=FailureType.POD_KILL,
            duration_seconds=1,
            affected_replicas=1,
        )
    )

    chaos_client = FakeChaosClient()
    prom_client = FakePrometheusClient(error_rate=0.5)

    request = ExperimentRunRequest(
        definition=experiment,
        abort_condition=AbortCondition(metric="error_rate", threshold=10.0, operator=">"),
        monitor_interval_seconds=0.01,
        max_duration_seconds=0.05,
    )

    result = execute_experiment(
        request=request,
        chaos_client=chaos_client,
        prometheus_client=prom_client,
    )

    assert result.status == ExperimentStatus.COMPLETED
    assert result.abort_triggered is False
    assert len(chaos_client.applied) == 1
    assert len(chaos_client.deleted) == 1
    assert chaos_client.deleted[0] == ("PodChaos", "mybookstore", "catalog-service-pod-kill")
    assert len(result.metrics_observed) > 0


def test_executes_experiment_aborts_on_threshold_breach():
    from app.modules.experiments.schemas import (
        AbortCondition,
        ExperimentRunRequest,
        ExperimentStatus,
    )
    from app.modules.experiments.service import execute_experiment

    experiment = define_experiment(
        ExperimentDefinitionRequest(
            target=_target(),
            failure_type=FailureType.NETWORK_DELAY,
            duration_seconds=60,
            affected_replicas=1,
        )
    )

    chaos_client = FakeChaosClient()
    # High error rate (25%) exceeding the 10% threshold!
    prom_client = FakePrometheusClient(error_rate=25.0)

    request = ExperimentRunRequest(
        definition=experiment,
        abort_condition=AbortCondition(metric="error_rate", threshold=10.0, operator=">"),
        monitor_interval_seconds=0.01,
        max_duration_seconds=5.0,
    )

    result = execute_experiment(
        request=request,
        chaos_client=chaos_client,
        prometheus_client=prom_client,
    )

    assert result.status == ExperimentStatus.ABORTED
    assert result.abort_triggered is True
    assert (
        "Abort condition triggered: error_rate (25.0%) > threshold (10.0%)" in result.abort_reason
    )
    # Ensured automatic deletion of chaos resource when aborted!
    assert len(chaos_client.applied) == 1
    assert len(chaos_client.deleted) == 1
    assert chaos_client.deleted[0] == (
        "NetworkChaos",
        "mybookstore",
        "catalog-service-network-delay",
    )
