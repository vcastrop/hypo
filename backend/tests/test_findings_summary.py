"""Tests for PB-07a: automated findings summary from experiment metrics."""

from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentStatus,
    ExperimentTarget,
    FailureType,
    MetricSample,
    SuccessCriteria,
    WindowMetrics,
)
from app.modules.experiments.service import (
    _RUN_HISTORY,
    evaluate_experiment,
)
from app.modules.reports.service import (
    _format_duration,
    _format_ms,
    _format_percentage,
    generate_findings_summary,
)


def make_definition(
    name: str = "X",
    failure_type: FailureType = FailureType.POD_KILL,
) -> ExperimentDefinition:
    return ExperimentDefinition(
        target=ExperimentTarget(
            name=name,
            namespace="mybookstore",
            kind="Deployment",
            replicas=2,
            labels={"app": name},
        ),
        failure_type=failure_type,
        blast_radius_percentage=50.0,
        duration_seconds=60,
        hypothesis="steady-state test",
        affected_replicas=1,
    )


def test_format_helpers():
    assert _format_duration(12.0) == "12s"
    assert _format_duration(12.5) == "12.5s"
    assert _format_percentage(40.0) == "40%"
    assert _format_percentage(40.5) == "40.5%"
    assert _format_ms(200.0) == "200ms"
    assert _format_ms(200.5) == "200.5ms"


def test_exact_prompt_example_service_x_lost_40_percent_recovered_in_12s():
    """Verify exact acceptance requirement:
    'service X lost 40% availability during pod-kill, recovered in 12s'
    """
    experiment = make_definition(name="X", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0, success_rate=100.0, p95_latency_ms=50.0),
        during_metrics=WindowMetrics(error_rate=40.0, success_rate=60.0, p95_latency_ms=55.0),
        after_metrics=WindowMetrics(error_rate=0.0, success_rate=100.0, p95_latency_ms=50.0),
        recovery_time_seconds=12.0,
    )

    assert summary == "service X lost 40% availability during pod-kill, recovered in 12s"


def test_service_already_prefixed_avoids_duplicate_word():
    """If target is 'service X', it shouldn't produce 'service service X'."""
    experiment = make_definition(name="service X", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=100.0),
        during_metrics=WindowMetrics(success_rate=60.0),
        after_metrics=WindowMetrics(success_rate=100.0),
        recovery_time_seconds=12.0,
    )

    assert summary == "service X lost 40% availability during pod-kill, recovered in 12s"


def test_summary_with_decimal_percentage_and_recovery():
    experiment = make_definition(name="catalog-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=99.5),
        during_metrics=WindowMetrics(success_rate=59.0),
        after_metrics=WindowMetrics(success_rate=99.5),
        recovery_time_seconds=12.5,
    )

    assert (
        summary
        == "service catalog-service lost 40.5% availability during pod-kill, recovered in 12.5s"
    )


def test_summary_network_delay_latency_increase():
    experiment = make_definition(name="cart-service", failure_type=FailureType.NETWORK_DELAY)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=100.0, p95_latency_ms=50.0),
        during_metrics=WindowMetrics(success_rate=100.0, p95_latency_ms=250.0),
        after_metrics=WindowMetrics(success_rate=100.0, p95_latency_ms=52.0),
        recovery_time_seconds=5.0,
    )

    assert summary == (
        "service cart-service experienced a 200ms latency increase "
        "during network-delay, recovered in 5s"
    )


def test_summary_combined_availability_loss_and_latency_increase():
    experiment = make_definition(name="order-service", failure_type=FailureType.RESOURCE_STRESS)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=100.0, p95_latency_ms=40.0),
        during_metrics=WindowMetrics(success_rate=75.0, p95_latency_ms=140.0),
        after_metrics=WindowMetrics(success_rate=100.0, p95_latency_ms=42.0),
        recovery_time_seconds=15.0,
    )

    assert summary == (
        "service order-service lost 25% availability and experienced a 100ms latency "
        "increase during resource-stress, recovered in 15s"
    )


def test_summary_availability_loss_derived_from_error_rate():
    experiment = make_definition(name="payment-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(error_rate=0.0),
        during_metrics=WindowMetrics(error_rate=30.0),
        after_metrics=WindowMetrics(error_rate=0.0),
        recovery_time_seconds=8.0,
    )

    assert (
        summary == "service payment-service lost 30% availability during pod-kill, recovered in 8s"
    )


def test_summary_steady_state_maintained_resilient():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0, p95_latency_ms=45.0),
        during_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0, p95_latency_ms=46.0),
        after_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0, p95_latency_ms=45.0),
        recovery_time_seconds=6.0,
    )

    assert summary == (
        "service cart-service maintained steady-state availability during pod-kill "
        "with no observed degradation, recovered in 6s"
    )


def test_summary_steady_state_without_explicit_recovery_timer():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=100.0),
        during_metrics=WindowMetrics(success_rate=100.0),
        after_metrics=WindowMetrics(success_rate=100.0),
        recovery_time_seconds=None,
    )

    assert summary == (
        "service cart-service maintained steady-state availability "
        "during pod-kill with no observed degradation"
    )


def test_summary_recovery_without_timer_recovered_to_steady_state():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=100.0),
        during_metrics=WindowMetrics(success_rate=60.0),
        after_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0),
        recovery_time_seconds=None,
    )

    assert summary == (
        "service cart-service lost 40% availability during pod-kill, "
        "recovered to steady-state after fault removal"
    )


def test_summary_failed_recovery_to_steady_state():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(success_rate=100.0),
        during_metrics=WindowMetrics(success_rate=60.0),
        after_metrics=WindowMetrics(success_rate=80.0, error_rate=20.0),
        recovery_time_seconds=None,
    )

    assert summary == (
        "service cart-service lost 40% availability during pod-kill, and failed "
        "to recover to steady-state within the observation window"
    )


def test_summary_aborted_experiment():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.ABORTED,
        before_metrics=WindowMetrics(success_rate=100.0),
        during_metrics=WindowMetrics(success_rate=50.0),
        after_metrics=WindowMetrics(),
        abort_triggered=True,
        abort_reason="Abort condition triggered: error_rate=25.0% > 10.0%",
        recovery_time_seconds=4.0,
    )

    assert summary == (
        "service cart-service experiment was aborted during pod-kill "
        "(Abort condition triggered: error_rate=25.0% > 10.0%), recovered in 4s"
    )


def test_summary_failed_experiment():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.FAILED,
        before_metrics=WindowMetrics(),
        during_metrics=WindowMetrics(),
        after_metrics=WindowMetrics(),
        abort_reason="Connection refused by Kubernetes API",
    )

    assert summary == (
        "service cart-service experiment failed during pod-kill: "
        "Connection refused by Kubernetes API"
    )


def test_summary_insufficient_metrics():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(),
        during_metrics=WindowMetrics(),
        after_metrics=WindowMetrics(),
    )

    assert summary == (
        "service cart-service completed pod-kill, but insufficient "
        "metrics were observed to evaluate impact"
    )


def test_summary_falls_back_to_observed_metric_samples():
    experiment = make_definition(name="cart-service", failure_type=FailureType.POD_KILL)

    samples = [
        MetricSample(timestamp=100.0, metric="error_rate", value=0.0),
        MetricSample(timestamp=105.0, metric="error_rate", value=35.0),
    ]

    summary = generate_findings_summary(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        before_metrics=WindowMetrics(),
        during_metrics=WindowMetrics(),
        after_metrics=WindowMetrics(),
        recovery_time_seconds=7.0,
        metrics_observed=samples,
    )

    assert summary == "service cart-service lost 35% availability during pod-kill, recovered in 7s"


def test_evaluate_experiment_attaches_findings_summary():
    experiment = make_definition(name="X", failure_type=FailureType.POD_KILL)

    eval_result = evaluate_experiment(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        abort_triggered=False,
        abort_reason=None,
        criteria=SuccessCriteria(),
        before_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0, p95_latency_ms=40.0),
        during_metrics=WindowMetrics(success_rate=60.0, error_rate=40.0, p95_latency_ms=45.0),
        after_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0, p95_latency_ms=40.0),
        recovery_time_seconds=12.0,
    )

    assert (
        eval_result.findings_summary
        == "service X lost 40% availability during pod-kill, recovered in 12s"
    )
    assert eval_result.summary == eval_result.findings_summary


def test_api_run_result_contains_findings_summary(client):
    """Verify that stored experiment run has findings_summary alongside the result."""
    from app.modules.experiments.schemas import ExperimentRunResult

    experiment = make_definition(name="X", failure_type=FailureType.POD_KILL)
    eval_result = evaluate_experiment(
        experiment=experiment,
        status=ExperimentStatus.COMPLETED,
        abort_triggered=False,
        abort_reason=None,
        criteria=SuccessCriteria(),
        before_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0, p95_latency_ms=40.0),
        during_metrics=WindowMetrics(success_rate=60.0, error_rate=40.0, p95_latency_ms=45.0),
        after_metrics=WindowMetrics(success_rate=100.0, error_rate=0.0, p95_latency_ms=40.0),
        recovery_time_seconds=12.0,
    )

    run_id = "run-test-pb07a"
    run_result = ExperimentRunResult(
        id=run_id,
        experiment=experiment,
        chaos_yaml="apiVersion: chaos-mesh.org/v1alpha1...",
        status=ExperimentStatus.COMPLETED,
        evaluation=eval_result,
        findings_summary=eval_result.findings_summary,
        summary=eval_result.summary,
    )
    _RUN_HISTORY[run_id] = run_result

    try:
        response = client.get(f"/api/v1/experiments/runs/{run_id}")
        assert response.status_code == 200
        data = response.json()
        assert (
            data["findings_summary"]
            == "service X lost 40% availability during pod-kill, recovered in 12s"
        )
        assert (
            data["summary"] == "service X lost 40% availability during pod-kill, recovered in 12s"
        )
        assert (
            data["evaluation"]["findings_summary"]
            == "service X lost 40% availability during pod-kill, recovered in 12s"
        )
    finally:
        _RUN_HISTORY.pop(run_id, None)
