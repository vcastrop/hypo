"""Regression tests for PB-06c experiment result evaluation."""

import pytest

from app.modules.experiments.schemas import (
    ExperimentStatus,
    ExperimentVerdict,
    SuccessCriteria,
    WindowMetrics,
)
from app.modules.experiments.service import evaluate_experiment


@pytest.fixture
def healthy_metrics():
    return WindowMetrics(
        error_rate=0.5,
        success_rate=99.5,
        p95_latency_ms=50.0,
    )


def evaluate(healthy_metrics, after_metrics, recovery_time=5.0):
    return evaluate_experiment(
        experiment=None,
        status=ExperimentStatus.COMPLETED,
        abort_triggered=False,
        abort_reason=None,
        criteria=SuccessCriteria(),
        before_metrics=healthy_metrics,
        during_metrics=healthy_metrics,
        after_metrics=after_metrics,
        recovery_time_seconds=recovery_time,
    )


def test_healthy_experiment_passes(healthy_metrics):
    result = evaluate(healthy_metrics, healthy_metrics)

    assert result.verdict == ExperimentVerdict.PASS
    assert result.hypothesis_met is True
    assert result.recovery_time_seconds == 5.0


def test_missing_metrics_cannot_pass(healthy_metrics):
    result = evaluate(
        healthy_metrics,
        WindowMetrics(),
    )

    assert result.verdict == ExperimentVerdict.FAIL
    assert result.hypothesis_met is False
    assert any("Insufficient" in detail for detail in result.details)


def test_excessive_error_rate_fails(healthy_metrics):
    result = evaluate(
        healthy_metrics,
        WindowMetrics(
            error_rate=5.0,
            success_rate=95.0,
            p95_latency_ms=50.0,
        ),
    )

    assert result.verdict == ExperimentVerdict.FAIL


def test_excessive_recovery_time_fails(healthy_metrics):
    result = evaluate(
        healthy_metrics,
        healthy_metrics,
        recovery_time=90.0,
    )

    assert result.verdict == ExperimentVerdict.FAIL
    assert result.recovery_time_seconds == 90.0


def test_missing_p95_fails_when_required(healthy_metrics):
    result = evaluate(
        healthy_metrics,
        WindowMetrics(
            error_rate=0.5,
            success_rate=99.5,
            p95_latency_ms=None,
        ),
    )

    assert result.verdict == ExperimentVerdict.FAIL


def test_missing_recovery_cannot_pass(healthy_metrics):
    """Missing recovery evidence must fail when recovery is required."""
    result = evaluate(
        healthy_metrics,
        healthy_metrics,
        recovery_time=None,
    )

    assert result.verdict == ExperimentVerdict.FAIL
    assert result.hypothesis_met is False
    assert result.recovery_time_seconds is None
    assert any(
        "recovery" in detail.lower()
        for detail in result.details
    )


def test_failed_experiment_cannot_pass(healthy_metrics):
    """A failed experiment must never receive a PASS verdict."""
    result = evaluate_experiment(
        experiment=None,
        status=ExperimentStatus.FAILED,
        abort_triggered=False,
        abort_reason="Chaos Mesh execution failed",
        criteria=SuccessCriteria(),
        before_metrics=healthy_metrics,
        during_metrics=healthy_metrics,
        after_metrics=healthy_metrics,
        recovery_time_seconds=5.0,
    )

    assert result.verdict == ExperimentVerdict.FAIL
    assert result.hypothesis_met is False
