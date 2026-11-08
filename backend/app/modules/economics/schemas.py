"""Pydantic schemas for Economic Impact Estimation (PB-08a #24)."""

from typing import Literal

from pydantic import BaseModel, Field


class EconomicImpactRequest(BaseModel):
    cost_per_hour: float = Field(
        default=1000.0,
        gt=0,
        description="Configured business cost per hour of outage/degradation in USD",
    )


class EconomicImpact(BaseModel):
    currency: str = "USD"
    cost_per_hour: float = Field(
        ...,
        description="Configured hourly cost benchmark for the target service",
    )
    downtime_duration_seconds: float = Field(
        ...,
        description="Observed or estimated complete downtime duration in seconds",
    )
    degraded_duration_seconds: float = Field(
        ...,
        description="Duration in seconds where service was degraded (slow or partial errors)",
    )
    estimated_downtime_cost: float = Field(
        ...,
        description="Financial loss attributed to complete service downtime",
    )
    estimated_degradation_cost: float = Field(
        ...,
        description="Financial loss attributed to partial errors and latency inflation",
    )
    total_estimated_impact: float = Field(
        ...,
        description="Combined estimated financial loss in USD",
    )
    formula: str = Field(
        ...,
        description="Documented formula used to calculate financial impact",
    )
    assumptions: list[str] = Field(
        default_factory=list,
        description="Documented business and operational assumptions used in estimation",
    )
    severity: Literal["low", "medium", "high", "critical"] = Field(
        default="low",
        description="Financial severity classification",
    )
