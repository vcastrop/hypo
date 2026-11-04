"""Findings and executive summary generation from chaos experiment metrics."""

from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentStatus,
    MetricSample,
    WindowMetrics,
)


def _format_duration(seconds: float) -> str:
    """Format duration in seconds, e.g. 12.0 -> '12s', 12.5 -> '12.5s'."""
    if seconds.is_integer():
        return f"{int(seconds)}s"
    return f"{seconds:.1f}s"


def _format_percentage(pct: float) -> str:
    """Format percentage, e.g. 40.0 -> '40%', 40.5 -> '40.5%'."""
    if pct.is_integer():
        return f"{int(pct)}%"
    return f"{pct:.1f}%"


def _format_ms(ms: float) -> str:
    """Format milliseconds, e.g. 200.0 -> '200ms', 200.5 -> '200.5ms'."""
    if ms.is_integer():
        return f"{int(ms)}ms"
    return f"{ms:.1f}ms"


def generate_findings_summary(
    experiment: ExperimentDefinition | None,
    status: ExperimentStatus,
    before_metrics: WindowMetrics,
    during_metrics: WindowMetrics,
    after_metrics: WindowMetrics,
    recovery_time_seconds: float | None = None,
    abort_triggered: bool = False,
    abort_reason: str | None = None,
    metrics_observed: list[MetricSample] | None = None,
) -> str:
    """Interpret experiment metrics and generate a plain-language summary of observed behavior.

    Example output:
    "service X lost 40% availability during pod-kill, recovered in 12s"
    """
    if experiment is not None and experiment.target and experiment.target.name:
        target_name = experiment.target.name
    else:
        target_name = "target service"

    if experiment is not None and experiment.failure_type:
        failure_type = experiment.failure_type.value
    else:
        failure_type = "chaos injection"

    if target_name.lower().startswith("service "):
        subject = target_name
    else:
        subject = f"service {target_name}"

    # Handle abnormal terminal states
    if status == ExperimentStatus.FAILED:
        reason = abort_reason or "unexpected execution failure"
        return f"{subject} experiment failed during {failure_type}: {reason}"

    if abort_triggered or status == ExperimentStatus.ABORTED:
        reason = abort_reason or "safety abort condition triggered"
        if recovery_time_seconds is not None:
            rec_str = _format_duration(recovery_time_seconds)
            return (
                f"{subject} experiment was aborted during {failure_type} "
                f"({reason}), recovered in {rec_str}"
            )
        return f"{subject} experiment was aborted during {failure_type} ({reason})"

    # Calculate availability loss during chaos
    avail_loss: float | None = None

    if before_metrics.success_rate is not None and during_metrics.success_rate is not None:
        diff = before_metrics.success_rate - during_metrics.success_rate
        if diff > 0:
            avail_loss = round(diff, 2)
    elif during_metrics.success_rate is not None and during_metrics.success_rate < 100.0:
        avail_loss = round(100.0 - during_metrics.success_rate, 2)
    elif during_metrics.error_rate is not None:
        before_err = before_metrics.error_rate or 0.0
        err_diff = during_metrics.error_rate - before_err
        if err_diff > 0:
            avail_loss = round(err_diff, 2)
    elif metrics_observed:
        err_samples = [s.value for s in metrics_observed if s.metric == "error_rate"]
        if err_samples:
            max_err = max(err_samples)
            if max_err > 0:
                avail_loss = round(max_err, 2)
        else:
            succ_samples = [s.value for s in metrics_observed if s.metric == "success_rate"]
            if succ_samples:
                min_succ = min(succ_samples)
                if min_succ < 100.0:
                    avail_loss = round(100.0 - min_succ, 2)

    # Calculate latency degradation during chaos
    lat_increase: float | None = None
    if during_metrics.p95_latency_ms is not None:
        before_lat = before_metrics.p95_latency_ms or 0.0
        lat_diff = during_metrics.p95_latency_ms - before_lat
        # Consider latency increase notable if it exceeds normal measurement jitter
        # (10ms for latency-only experiments, 50ms when availability loss is also present)
        lat_threshold = 50.0 if (avail_loss is not None and avail_loss > 0) else 10.0
        if lat_diff >= lat_threshold:
            lat_increase = round(lat_diff, 2)

    # Build impact description
    has_metrics = (
        before_metrics.success_rate is not None
        or before_metrics.error_rate is not None
        or before_metrics.p95_latency_ms is not None
        or during_metrics.success_rate is not None
        or during_metrics.error_rate is not None
        or during_metrics.p95_latency_ms is not None
        or bool(metrics_observed)
    )

    if not has_metrics:
        return (
            f"{subject} completed {failure_type}, but insufficient "
            "metrics were observed to evaluate impact"
        )

    if avail_loss is not None and avail_loss > 0 and lat_increase is not None and lat_increase > 0:
        loss_str = _format_percentage(avail_loss)
        lat_str = _format_ms(lat_increase)
        impact = (
            f"lost {loss_str} availability and experienced a {lat_str} latency "
            f"increase during {failure_type}"
        )
    elif avail_loss is not None and avail_loss > 0:
        loss_str = _format_percentage(avail_loss)
        impact = f"lost {loss_str} availability during {failure_type}"
    elif lat_increase is not None and lat_increase > 0:
        lat_str = _format_ms(lat_increase)
        impact = f"experienced a {lat_str} latency increase during {failure_type}"
    else:
        impact = (
            f"maintained steady-state availability during {failure_type} "
            "with no observed degradation"
        )

    # Build recovery description
    if recovery_time_seconds is not None:
        rec_str = _format_duration(recovery_time_seconds)
        recovery = f", recovered in {rec_str}"
    else:
        after_healthy = (
            after_metrics.success_rate is not None and after_metrics.success_rate >= 99.0
        ) or (after_metrics.error_rate is not None and after_metrics.error_rate <= 1.0)
        after_unhealthy = (
            after_metrics.success_rate is not None and after_metrics.success_rate < 99.0
        ) or (after_metrics.error_rate is not None and after_metrics.error_rate > 1.0)
        if after_healthy and (avail_loss or lat_increase):
            recovery = ", recovered to steady-state after fault removal"
        elif after_unhealthy:
            recovery = ", and failed to recover to steady-state within the observation window"
        else:
            recovery = ""

    return f"{subject} {impact}{recovery}"
