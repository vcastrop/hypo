from enum import StrEnum

from pydantic import BaseModel, Field


class FailureType(StrEnum):
    POD_KILL = "pod-kill"
    RESOURCE_STRESS = "resource-stress"
    NETWORK_DELAY = "network-delay"
    NETWORK_LOSS = "network-loss"


class ExperimentTarget(BaseModel):
    name: str
    namespace: str
    kind: str
    replicas: int = Field(gt=0)
    labels: dict[str, str] = {}


class ExperimentDefinitionRequest(BaseModel):
    target: ExperimentTarget
    failure_type: FailureType
    duration_seconds: int = Field(default=60, gt=0)
    affected_replicas: int = Field(default=1, gt=0)


class ExperimentDefinition(BaseModel):
    target: ExperimentTarget
    failure_type: FailureType
    blast_radius_percentage: float
    duration_seconds: int
    hypothesis: str
