"""Economic impact estimation module (PB-08a #24)."""

from app.modules.economics.schemas import EconomicImpact, EconomicImpactRequest
from app.modules.economics.service import (
    DEFAULT_COST_PER_HOUR,
    calculate_economic_impact,
)

__all__ = [
    "EconomicImpact",
    "EconomicImpactRequest",
    "calculate_economic_impact",
    "DEFAULT_COST_PER_HOUR",
]
