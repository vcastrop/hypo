"""Tests for PB-07b: Generate recommendations based on findings (#23)."""

from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentStatus,
    ExperimentTarget,
    FailureType,
    WindowMetrics,
)
from app.modules.experiments.service import evaluate_experiment
from app.modules.reports.service import generate_recommendations


def make_definition(
    name: str = "order-service",
    failure_type: FailureType = FailureType.POD_KILL,
    replicas: int = 2,
) -> ExperimentDefinition:
    return ExperimentDefinition(
        target=ExperimentTarget(
            name=name,
            namespace="mybookstore",
            kind="Deployment",
            replicas=replicas,
            labels={"app": name},
        ),
        failure_type=failure_type,
        blast_radius_percentage=50.0,
        duration_seconds=60,
        hypothesis="System remains resilient under failure injection",
        affected_replicas=1,
    )


def test_rule_single_replica_triggers_recommendation():
    """Rule 1: Single replica targets get scaling recommendation."""
    exp = make_definition(name="catalog-service", replicas=1)
    recs = generate_recommendations(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=20.0),
        during_metrics=WindowMetrics(error_rate=50.0, p95_latency_ms=200.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=20.0),
        recovery_time_seconds=15.0,
    )
    ids = [r.id for r in recs]
    assert "REC-REPLICA-COUNT" in ids
    rec = next(r for r in recs if r.id == "REC-REPLICA-COUNT")
    assert rec.severity == "critical"
    assert "catalog-service" in rec.title
    assert any("Scale" in item for item in rec.action_items)


def test_rule_pod_kill_disruption_budget():
    """Rule 2: Pod kill with availability drop triggers PodDisruptionBudget recommendation."""
    exp = make_definition(name="payment-service", failure_type=FailureType.POD_KILL, replicas=3)
    recs = generate_recommendations(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=30.0),
        during_metrics=WindowMetrics(error_rate=15.0, p95_latency_ms=100.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=30.0),
        recovery_time_seconds=8.0,
    )
    ids = [r.id for r in recs]
    assert "REC-PDB-DISRUPTION" in ids
    rec = next(r for r in recs if r.id == "REC-PDB-DISRUPTION")
    assert rec.category == "Cluster Policy & Scheduling"
    assert "payment-service" in rec.description


def test_rule_network_degradation_circuit_breaker():
    """Rule 3: Network delay/loss triggers timeout & circuit breaker recommendation."""
    exp = make_definition(
        name="inventory-api",
        failure_type=FailureType.NETWORK_DELAY,
        replicas=2,
    )
    recs = generate_recommendations(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=40.0),
        during_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=1200.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=45.0),
        recovery_time_seconds=5.0,
    )
    ids = [r.id for r in recs]
    assert "REC-CIRCUIT-BREAKER" in ids
    rec = next(r for r in recs if r.id == "REC-CIRCUIT-BREAKER")
    assert rec.category == "Network Resilience"
    assert any("circuit breaking" in item.lower() for item in rec.action_items)


def test_rule_slow_recovery_probe_tuning():
    """Rule 4: Slow recovery (> 30s) triggers probe tuning recommendation."""
    exp = make_definition(name="auth-service", failure_type=FailureType.POD_KILL, replicas=2)
    recs = generate_recommendations(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=50.0),
        during_metrics=WindowMetrics(error_rate=2.0, p95_latency_ms=80.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=50.0),
        recovery_time_seconds=45.0,
    )
    ids = [r.id for r in recs]
    assert "REC-PROBE-TUNING" in ids
    rec = next(r for r in recs if r.id == "REC-PROBE-TUNING")
    assert rec.category == "Health Checks & Recovery"
    assert any("readinessProbe" in item for item in rec.action_items)


def test_rule_resource_stress_autoscaling_hpa():
    """Rule 5: Resource stress failure triggers HPA & resource limits recommendation."""
    exp = make_definition(
        name="search-indexer",
        failure_type=FailureType.RESOURCE_STRESS,
        replicas=2,
    )
    recs = generate_recommendations(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=50.0),
        during_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=800.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=50.0),
        recovery_time_seconds=10.0,
    )
    ids = [r.id for r in recs]
    assert "REC-HPA-AUTOSCALING" in ids
    rec = next(r for r in recs if r.id == "REC-HPA-AUTOSCALING")
    assert rec.category == "Scalability & Resource Management"
    assert any("HorizontalPodAutoscaler" in item for item in rec.action_items)


def test_rule_steady_state_maintenance():
    """Rule 6: Perfectly resilient experiments get steady-state reinforcement."""
    exp = make_definition(name="gateway", failure_type=FailureType.POD_KILL, replicas=3)
    recs = generate_recommendations(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=25.0),
        during_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=26.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=25.0),
        recovery_time_seconds=2.0,
    )
    ids = [r.id for r in recs]
    assert "REC-STEADY-MAINTAIN" in ids
    rec = next(r for r in recs if r.id == "REC-STEADY-MAINTAIN")
    assert rec.severity == "low"


def test_evaluate_experiment_attaches_recommendations():
    """Verify evaluate_experiment attaches recommendations to ExperimentEvaluation."""
    from app.modules.experiments.schemas import SuccessCriteria

    exp = make_definition(name="cart-service", replicas=1)
    eval_result = evaluate_experiment(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        abort_triggered=False,
        abort_reason=None,
        criteria=SuccessCriteria(
            max_error_rate_percentage=1.0,
            max_p95_latency_ms=500.0,
            max_recovery_time_seconds=60.0,
        ),
        before_metrics=WindowMetrics(error_rate=0.0, success_rate=100.0, p95_latency_ms=30.0),
        during_metrics=WindowMetrics(error_rate=10.0, success_rate=90.0, p95_latency_ms=250.0),
        after_metrics=WindowMetrics(error_rate=0.0, success_rate=100.0, p95_latency_ms=30.0),
        recovery_time_seconds=12.0,
    )
    assert len(eval_result.recommendations) >= 1
    ids = [r.id for r in eval_result.recommendations]
    assert "REC-REPLICA-COUNT" in ids
