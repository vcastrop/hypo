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
