"""Findings and executive summary generation from chaos experiment metrics."""

from app.modules.economics.schemas import EconomicImpact
from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentStatus,
    FailureType,
    MetricSample,
    Recommendation,
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

    # Total replica termination guaranteed 100% loss during pod termination window
    if (
        experiment is not None
        and experiment.failure_type == FailureType.POD_KILL
        and experiment.target
        and experiment.affected_replicas >= experiment.target.replicas
    ):
        avail_loss = 100.0
    elif before_metrics.success_rate is not None and during_metrics.success_rate is not None:
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


def generate_recommendations(
    experiment: ExperimentDefinition | None,
    status: ExperimentStatus,
    before_metrics: WindowMetrics,
    during_metrics: WindowMetrics,
    after_metrics: WindowMetrics,
    recovery_time_seconds: float | None = None,
    abort_triggered: bool = False,
    abort_reason: str | None = None,
) -> list[Recommendation]:
    """Map common failure patterns to concrete remediation recommendations.

    Implements at least 5 rule-based remediation recommendations:
    1. Single-replica / insufficient replica redundancy pattern
    2. Missing PodDisruptionBudget (PDB) pattern on pod disruptions
    3. Missing / insufficient Circuit Breaking & Client Timeouts pattern
    4. Slow recovery / unconfigured Readiness/Liveness Probes pattern
    5. Resource saturation / Missing HorizontalPodAutoscaler (HPA) or limits pattern
    """
    recs: list[Recommendation] = []
    target_name = (
        experiment.target.name
        if (experiment and experiment.target and experiment.target.name)
        else "the service"
    )
    total_replicas = experiment.target.replicas if (experiment and experiment.target) else 1
    failure_type = experiment.failure_type if experiment else None

    # Calculate metrics differences
    avail_loss: float | None = None
    if before_metrics.success_rate is not None and during_metrics.success_rate is not None:
        avail_loss = round(before_metrics.success_rate - during_metrics.success_rate, 2)
    elif during_metrics.error_rate is not None and before_metrics.error_rate is not None:
        avail_loss = round(during_metrics.error_rate - before_metrics.error_rate, 2)
    elif during_metrics.error_rate is not None and during_metrics.error_rate > 1.0:
        avail_loss = round(during_metrics.error_rate, 2)

    lat_increase: float | None = None
    if during_metrics.p95_latency_ms is not None and before_metrics.p95_latency_ms is not None:
        lat_increase = round(during_metrics.p95_latency_ms - before_metrics.p95_latency_ms, 2)
    elif during_metrics.p95_latency_ms is not None and during_metrics.p95_latency_ms > 100.0:
        lat_increase = round(during_metrics.p95_latency_ms, 2)

    has_availability_issue = (avail_loss is not None and avail_loss > 1.0) or abort_triggered
    has_latency_issue = (lat_increase is not None and lat_increase > 50.0) or (
        during_metrics.p95_latency_ms is not None and during_metrics.p95_latency_ms > 150.0
    )
    has_slow_recovery = recovery_time_seconds is not None and recovery_time_seconds > 15.0

    # Rule 1: Single-replica redundancy pattern
    if total_replicas <= 1:
        recs.append(
            Recommendation(
                id="REC-REPLICA-COUNT",
                title=f"Increase minimum replica count for {target_name}",
                category="Redundancy & Availability",
                severity="critical" if has_availability_issue else "high",
                description=(
                    f"{target_name} is currently configured with only {total_replicas} replica(s). "
                    "A single replica represents a single point of failure (SPOF) in Kubernetes."
                ),
                action_items=[
                    f"Scale Deployment/{target_name} to minimum 2 (recommended 3) replicas.",
                    "Ensure anti-affinity rules distribute pods across distinct cluster nodes.",
                ],
            )
        )

    # Rule 2: Missing PodDisruptionBudget (PDB) on pod failures
    if failure_type == FailureType.POD_KILL and has_availability_issue:
        recs.append(
            Recommendation(
                id="REC-PDB-DISRUPTION",
                title=f"Configure PodDisruptionBudget (PDB) for {target_name}",
                category="Cluster Policy & Scheduling",
                severity="high",
                description=(
                    f"Availability dropped when pods of {target_name} were terminated. Without a "
                    "PodDisruptionBudget, node drains or voluntary evictions can cause downtime."
                ),
                action_items=[
                    f"Create PodDisruptionBudget with minAvailable: 1 for {target_name}.",
                    "Ensure rolling update strategy sets maxUnavailable: 0.",
                ],
            )
        )

    # Rule 3: Network timeouts / Circuit breaking on network latency or packet loss
    if failure_type in (FailureType.NETWORK_DELAY, FailureType.NETWORK_LOSS) and (
        has_latency_issue or has_availability_issue
    ):
        recs.append(
            Recommendation(
                id="REC-CIRCUIT-BREAKER",
                title="Implement client-side timeouts, retries and circuit breaker",
                category="Network Resilience",
                severity="high" if has_availability_issue else "medium",
                description=(
                    f"Network degradation against {target_name} caused severe latency or errors. "
                    "Upstream clients and API Gateways must isolate downstream slowdowns."
                ),
                action_items=[
                    "Configure aggressive HTTP/gRPC timeouts with backoff and jitter.",
                    "Deploy circuit breaking (e.g. Istio DestinationRule or Envoy ratelimit).",
                ],
            )
        )

    # Rule 4: Slow recovery / Probes tuning
    if has_slow_recovery or (
        after_metrics.error_rate is not None and after_metrics.error_rate > 1.0
    ):
        recs.append(
            Recommendation(
                id="REC-PROBE-TUNING",
                title=f"Tune Readiness and Liveness probes on {target_name}",
                category="Health Checks & Recovery",
                severity="medium",
                description=(
                    f"{target_name} had slow recovery ({recovery_time_seconds or 'unhealthy'}s). "
                    "Traffic may route to newly spawned pods before full initialization."
                ),
                action_items=[
                    "Configure a lightweight readinessProbe (e.g. HTTP /health).",
                    "Adjust failureThreshold to detach unhealthy pods faster from endpoints.",
                ],
            )
        )

    # Rule 5: Resource stress & Autoscaling (HPA)
    if failure_type == FailureType.RESOURCE_STRESS or has_latency_issue:
        recs.append(
            Recommendation(
                id="REC-HPA-AUTOSCALING",
                title=f"Configure HPA and resource limits for {target_name}",
                category="Scalability & Resource Management",
                severity="high" if has_availability_issue else "medium",
                description=(
                    f"High load or resource pressure impacts response times of {target_name}. "
                    "Dynamic autoscaling prevents service saturation during traffic spikes."
                ),
                action_items=[
                    f"Define CPU/Memory resource requests and limits in {target_name}.",
                    "Configure HorizontalPodAutoscaler (HPA) targeting 70% CPU utilization.",
                ],
            )
        )

    # Rule 6: Steady state maintenance (positive reinforcement)
    if not recs and not has_availability_issue and not has_latency_issue:
        recs.append(
            Recommendation(
                id="REC-STEADY-MAINTAIN",
                title=f"Maintain current resilience guardrails for {target_name}",
                category="Best Practices",
                severity="low",
                description=(
                    f"{target_name} maintained steady-state SLIs during the fault injection. "
                    "Its current multi-replica architecture satisfies target SLOs."
                ),
                action_items=[
                    "Continue running automated periodic chaos validation in staging environments.",
                    "Expand failure injection to multi-service cascading fault experiments.",
                ],
            )
        )

    return recs


def format_economic_impact_summary(impact: EconomicImpact) -> str:
    """Format a human-readable economic impact statement for executive reports."""
    if impact.total_estimated_impact <= 0:
        return f"No financial losses estimated (benchmark: ${impact.cost_per_hour:,.2f}/h)."

    breakdown_parts: list[str] = []
    if impact.downtime_duration_seconds > 0:
        breakdown_parts.append(
            f"${impact.estimated_downtime_cost:,.2f} downtime "
            f"({impact.downtime_duration_seconds:.1f}s)"
        )
    if impact.degraded_duration_seconds > 0:
        breakdown_parts.append(
            f"${impact.estimated_degradation_cost:,.2f} degradation "
            f"({impact.degraded_duration_seconds:.1f}s)"
        )

    breakdown_text = (
        " + ".join(breakdown_parts) if breakdown_parts else f"${impact.total_estimated_impact:,.2f}"
    )
    return (
        f"Estimated financial impact: ${impact.total_estimated_impact:,.2f} {impact.currency} "
        f"({breakdown_text} at ${impact.cost_per_hour:,.2f}/h)."
    )
