"""API endpoints for Economic Impact Estimation (PB-08a #24)."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.modules.economics.schemas import EconomicImpact
from app.modules.economics.service import calculate_economic_impact
from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentStatus,
    WindowMetrics,
)

router = APIRouter(prefix="/economics", tags=["economics"])


class EconomicEstimateRequest(BaseModel):
    experiment: ExperimentDefinition
    status: ExperimentStatus = ExperimentStatus.COMPLETED
    before_metrics: WindowMetrics = Field(default_factory=WindowMetrics)
    during_metrics: WindowMetrics = Field(default_factory=WindowMetrics)
    after_metrics: WindowMetrics = Field(default_factory=WindowMetrics)
    recovery_time_seconds: float | None = None
    cost_per_hour: float = Field(
        default=1000.0,
        gt=0,
        description="Configured business cost per hour of outage/degradation in USD",
    )
    abort_triggered: bool = False
    abort_reason: str | None = None


@router.post("/estimate", response_model=EconomicImpact)
def estimate_economic_impact_endpoint(request: EconomicEstimateRequest) -> EconomicImpact:
    """Calculate the estimated financial impact of a technical experiment finding."""
    return calculate_economic_impact(
        experiment=request.experiment,
        status=request.status,
        before_metrics=request.before_metrics,
        during_metrics=request.during_metrics,
        after_metrics=request.after_metrics,
        recovery_time_seconds=request.recovery_time_seconds,
        cost_per_hour=request.cost_per_hour,
        abort_triggered=request.abort_triggered,
        abort_reason=request.abort_reason,
    )
