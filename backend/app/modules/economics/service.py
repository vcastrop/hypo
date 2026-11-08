"""Economic impact estimation logic (PB-08a #24).

Declares financial risk modeling for chaos experiment findings based on
downtime, degradation windows, and configurable hourly cost benchmarks.

Complexity:
    - Time Complexity: O(1)
    - Space Complexity: O(1)
    - Data Structures: Float scalar math, deterministic rule mapping
    - Algorithm Family: Proportional financial loss modeling
"""

from typing import Literal

from app.modules.economics.schemas import EconomicImpact
from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentStatus,
    WindowMetrics,
)

DEFAULT_COST_PER_HOUR = 1000.0


def calculate_economic_impact(
    experiment: ExperimentDefinition | None = None,
    status: ExperimentStatus = ExperimentStatus.COMPLETED,
    before_metrics: WindowMetrics | None = None,
    during_metrics: WindowMetrics | None = None,
    after_metrics: WindowMetrics | None = None,
    recovery_time_seconds: float | None = None,
    cost_per_hour: float = DEFAULT_COST_PER_HOUR,
    abort_triggered: bool = False,
    abort_reason: str | None = None,
) -> EconomicImpact:
    """Calculate the estimated economic impact of a chaos experiment finding.

    Formula:
        Total Impact = Downtime Cost + Degradation Cost
        Where:
            Downtime Cost = (downtime_seconds / 3600) * cost_per_hour
            Degradation Cost = (degraded_seconds / 3600) * cost_per_hour * degradation_factor
            degradation_factor = min(1.0, (error_rate / 100) + latency_penalty)

    Assumptions:
        1. Hourly business cost (cost_per_hour) represents gross revenue loss,
           idle user/developer productivity, and SLA breach penalties.
        2. Full downtime occurs when the service has an error rate >= 50%, or fails
           completely during fault injection or abort.
        3. Recovery time contributes to downtime if the service was non-responsive
           until reconciliation finished.
        4. Partial degradation (error rate < 50% or latency inflation > 100% of baseline)
           causes proportional customer drop-off and conversion losses.
    """
    safe_cost_per_hour = max(0.0, float(cost_per_hour))
    duration_seconds = max(1.0, float(experiment.duration_seconds)) if experiment else 60.0
    target_name = experiment.target.name if experiment and experiment.target else "target-service"
    recovery_seconds = max(0.0, float(recovery_time_seconds or 0.0))

    before = before_metrics or WindowMetrics()
    during = during_metrics or WindowMetrics()

    during_err = during.error_rate if during.error_rate is not None else 0.0
    during_p95 = during.p95_latency_ms or 0.0
    before_p95 = before.p95_latency_ms or (during_p95 if during_p95 > 0 else 50.0)

    # 1. Determine downtime duration
    downtime_seconds = 0.0
    degraded_seconds = 0.0

    if status in (ExperimentStatus.ABORTED, ExperimentStatus.FAILED) or abort_triggered:
        # Critical failure: Entire injected window + recovery counts as downtime
        downtime_seconds = duration_seconds + recovery_seconds
    elif during_err >= 50.0:
        # Massive disruption: Treated as full downtime during chaos + recovery
        downtime_seconds = duration_seconds + recovery_seconds
    elif during_err > 1.0 or (before_p95 > 0 and during_p95 > (before_p95 * 1.5)):
        # Partial degradation: Fault window is degraded, recovery counts if non-zero
        degraded_seconds = duration_seconds
        if recovery_seconds > 0:
            degraded_seconds += recovery_seconds
    elif recovery_seconds > 10.0:
        # Slow reconciliation without heavy errors during chaos
        degraded_seconds = recovery_seconds

    # 2. Compute degradation penalty factor (0.0 to 1.0)
    error_penalty = min(1.0, during_err / 100.0)

    latency_penalty = 0.0
    if before_p95 > 0 and during_p95 > before_p95:
        # Industry standard: ~1% revenue drop per 100ms inflation over baseline
        latency_inflation_ms = during_p95 - before_p95
        latency_penalty = min(0.5, (latency_inflation_ms / 100.0) * 0.01)

    degradation_factor = min(1.0, error_penalty + latency_penalty)

    # 3. Calculate financial impacts
    downtime_cost = (downtime_seconds / 3600.0) * safe_cost_per_hour
    degradation_cost = (degraded_seconds / 3600.0) * safe_cost_per_hour * degradation_factor
    total_impact = round(downtime_cost + degradation_cost, 2)
    downtime_cost = round(downtime_cost, 2)
    degradation_cost = round(degradation_cost, 2)

    # 4. Determine financial severity
    severity: Literal["low", "medium", "high", "critical"]
    if total_impact >= safe_cost_per_hour or downtime_seconds >= 60.0:
        severity = "critical"
    elif total_impact >= (safe_cost_per_hour * 0.25) or downtime_seconds > 0.0:
        severity = "high"
    elif total_impact > 0.0:
        severity = "medium"
    else:
        severity = "low"

    formula_doc = (
        "Total Impact = (Downtime Seconds / 3600 * Cost Per Hour) + "
        "(Degraded Seconds / 3600 * Cost Per Hour * Degradation Factor)"
    )

    assumptions = [
        f"Hourly cost benchmark is ${safe_cost_per_hour:,.2f}/h for {target_name}.",
        (
            f"Downtime calculated at {downtime_seconds:.1f}s "
            f"(${downtime_cost:,.2f}) based on outages or error rate >= 50%."
        ),
        (
            f"Degradation calculated at {degraded_seconds:.1f}s "
            f"(${degradation_cost:,.2f}) with penalty factor of {degradation_factor * 100:.1f}%."
        ),
        (
            f"Recovery latency of {recovery_seconds:.1f}s incorporated into resilience penalty."
            if recovery_seconds > 0
            else "No post-chaos recovery delay detected."
        ),
    ]

    return EconomicImpact(
        currency="USD",
        cost_per_hour=safe_cost_per_hour,
        downtime_duration_seconds=round(downtime_seconds, 2),
        degraded_duration_seconds=round(degraded_seconds, 2),
        estimated_downtime_cost=downtime_cost,
        estimated_degradation_cost=degradation_cost,
        total_estimated_impact=total_impact,
        formula=formula_doc,
        assumptions=assumptions,
        severity=severity,
    )
