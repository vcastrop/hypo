"""Tests for PB-08a: Economic impact estimation logic (#24)."""

from fastapi.testclient import TestClient

from app.api.economics import EconomicEstimateRequest
from app.main import app
from app.modules.economics.service import calculate_economic_impact
from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentStatus,
    ExperimentTarget,
    FailureType,
    SuccessCriteria,
    WindowMetrics,
)
from app.modules.experiments.service import evaluate_experiment

client = TestClient(app)


def make_experiment(
    name: str = "order-service",
    duration_seconds: int = 60,
    cost_per_hour: float = 1200.0,
) -> ExperimentDefinition:
    return ExperimentDefinition(
        target=ExperimentTarget(
            name=name,
            namespace="mybookstore",
            kind="Deployment",
            replicas=2,
            labels={"app": name},
        ),
        failure_type=FailureType.POD_KILL,
        blast_radius_percentage=50.0,
        duration_seconds=duration_seconds,
        hypothesis="System remains resilient under failure injection",
        affected_replicas=1,
        cost_per_hour=cost_per_hour,
    )


def test_economic_impact_steady_state_low_impact():
    """Steady-state execution with no degradation outputs near-zero impact."""
    exp = make_experiment(cost_per_hour=1800.0)
    impact = calculate_economic_impact(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=25.0),
        during_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=25.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=25.0),
        recovery_time_seconds=0.0,
        cost_per_hour=1800.0,
    )

    assert impact.total_estimated_impact == 0.0
    assert impact.downtime_duration_seconds == 0.0
    assert impact.degraded_duration_seconds == 0.0
    assert impact.severity == "low"
    assert impact.cost_per_hour == 1800.0
    assert impact.currency == "USD"
    assert len(impact.assumptions) >= 3
    assert "Total Impact =" in impact.formula


def test_economic_impact_full_downtime():
    """Critical failure (aborted/failed or >=50% error rate) calculates direct downtime cost."""
    # 60s fault + 60s recovery = 120s downtime. At $3,600/hr, 120s is exactly $120.00.
    exp = make_experiment(duration_seconds=60, cost_per_hour=3600.0)
    impact = calculate_economic_impact(
        experiment=exp,
        status=ExperimentStatus.ABORTED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=30.0),
        during_metrics=WindowMetrics(error_rate=100.0, p95_latency_ms=5000.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=30.0),
        recovery_time_seconds=60.0,
        cost_per_hour=3600.0,
        abort_triggered=True,
        abort_reason="Error rate breached safety threshold",
    )

    assert impact.downtime_duration_seconds == 120.0
    assert impact.estimated_downtime_cost == 120.0
    assert impact.total_estimated_impact == 120.0
    assert impact.severity in ("high", "critical")
    assert any("Downtime calculated at 120.0s" in a for a in impact.assumptions)


def test_economic_impact_partial_degradation_and_latency():
    """Partial error rate and latency penalty scale the estimated financial loss."""
    # 60s fault with 10% error rate. At $3,600/hr, 60s base = $60. With 10% factor = $6.00.
    exp = make_experiment(duration_seconds=60, cost_per_hour=3600.0)
    impact = calculate_economic_impact(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=40.0),
        during_metrics=WindowMetrics(error_rate=10.0, p95_latency_ms=40.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=40.0),
        recovery_time_seconds=0.0,
        cost_per_hour=3600.0,
    )

    assert impact.downtime_duration_seconds == 0.0
    assert impact.degraded_duration_seconds == 60.0
    assert impact.estimated_degradation_cost == 6.0
    assert impact.total_estimated_impact == 6.0
    assert impact.severity == "medium"


def test_economic_impact_configurable_cost_per_hour():
    """Estimated impact scales proportionally when cost_per_hour changes."""
    exp1 = make_experiment(duration_seconds=360, cost_per_hour=1000.0)
    impact1 = calculate_economic_impact(
        experiment=exp1,
        status=ExperimentStatus.ABORTED,
        before_metrics=WindowMetrics(error_rate=0.0),
        during_metrics=WindowMetrics(error_rate=80.0),
        after_metrics=WindowMetrics(error_rate=0.0),
        cost_per_hour=1000.0,
        abort_triggered=True,
    )

    impact2 = calculate_economic_impact(
        experiment=exp1,
        status=ExperimentStatus.ABORTED,
        before_metrics=WindowMetrics(error_rate=0.0),
        during_metrics=WindowMetrics(error_rate=80.0),
        after_metrics=WindowMetrics(error_rate=0.0),
        cost_per_hour=5000.0,
        abort_triggered=True,
    )

    # 360s is 0.1 hr: at $1000/hr = $100.00; at $5000/hr = $500.00 (5x)
    assert impact1.total_estimated_impact == 100.0
    assert impact2.total_estimated_impact == 500.0


def test_evaluate_experiment_includes_economic_impact():
    """evaluate_experiment automatically computes and attaches economic_impact."""
    exp = make_experiment(cost_per_hour=2400.0)
    eval_result = evaluate_experiment(
        experiment=exp,
        status=ExperimentStatus.COMPLETED,
        abort_triggered=False,
        abort_reason=None,
        criteria=SuccessCriteria(
            max_error_rate_percentage=1.0,
            max_p95_latency_ms=500.0,
        ),
        before_metrics=WindowMetrics(error_rate=0.0, success_rate=100.0, p95_latency_ms=30.0),
        during_metrics=WindowMetrics(error_rate=20.0, success_rate=80.0, p95_latency_ms=300.0),
        after_metrics=WindowMetrics(error_rate=0.0, success_rate=100.0, p95_latency_ms=30.0),
        recovery_time_seconds=10.0,
    )

    assert eval_result.economic_impact is not None
    assert eval_result.economic_impact.cost_per_hour == 2400.0
    assert eval_result.economic_impact.total_estimated_impact > 0.0
    assert len(eval_result.economic_impact.assumptions) > 0


def test_api_estimate_endpoint():
    """POST /api/v1/economics/estimate returns calculated economic impact."""
    exp = make_experiment(duration_seconds=60, cost_per_hour=3600.0)
    payload = EconomicEstimateRequest(
        experiment=exp,
        status=ExperimentStatus.ABORTED,
        before_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=20.0),
        during_metrics=WindowMetrics(error_rate=90.0, p95_latency_ms=1000.0),
        after_metrics=WindowMetrics(error_rate=0.0, p95_latency_ms=20.0),
        recovery_time_seconds=30.0,
        cost_per_hour=3600.0,
        abort_triggered=True,
    ).model_dump()

    response = client.post("/api/v1/economics/estimate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["currency"] == "USD"
    assert data["cost_per_hour"] == 3600.0
    assert data["downtime_duration_seconds"] == 90.0
    assert data["estimated_downtime_cost"] == 90.0
    assert data["total_estimated_impact"] == 90.0
    assert "formula" in data
    assert len(data["assumptions"]) >= 3
