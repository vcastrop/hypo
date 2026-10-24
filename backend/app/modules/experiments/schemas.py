from enum import StrEnum
from typing import Any, Literal

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
    affected_replicas: int = 1


class AbortCondition(BaseModel):
    metric: str = "error_rate"
    threshold: float = Field(
        default=10.0,
        description="Threshold percentage value (e.g. 10.0 for 10% error rate)",
    )
    operator: Literal[">", "<", ">=", "<="] = ">"


class ExperimentStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    ABORTED = "aborted"
    FAILED = "failed"


class MetricSample(BaseModel):
    timestamp: float
    metric: str
    value: float


class ExperimentVerdict(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"


class SuccessCriteria(BaseModel):
    max_error_rate_percentage: float = Field(
        default=1.0,
        description="Max acceptable error rate percentage (SLO: <= 1.0%)",
    )
    min_success_rate_percentage: float = Field(
        default=99.0,
        description="Min acceptable success rate percentage (SLO: >= 99.0%)",
    )
    max_p95_latency_ms: float | None = Field(
        default=100.0,
        description="Max acceptable P95 latency in ms (SLO: <= 100ms)",
    )
    max_recovery_time_seconds: float | None = Field(
        default=60.0,
        description="Max acceptable recovery time in seconds after chaos stops",
    )


class WindowMetrics(BaseModel):
    error_rate: float | None = None
    success_rate: float | None = None
    p95_latency_ms: float | None = None


class ExperimentEvaluation(BaseModel):
    verdict: ExperimentVerdict
    hypothesis_met: bool
    recovery_time_seconds: float | None = None
    before_metrics: WindowMetrics = Field(default_factory=WindowMetrics)
    during_metrics: WindowMetrics = Field(default_factory=WindowMetrics)
    after_metrics: WindowMetrics = Field(default_factory=WindowMetrics)
    details: list[str] = []


class ExperimentYamlResponse(BaseModel):
    yaml: str
    manifest: dict[str, Any]


class ExperimentRunRequest(BaseModel):
    definition: ExperimentDefinition | None = None
    definition_request: ExperimentDefinitionRequest | None = None
    abort_condition: AbortCondition = Field(
        default_factory=lambda: AbortCondition(metric="error_rate", threshold=10.0, operator=">")
    )
    success_criteria: SuccessCriteria = Field(default_factory=SuccessCriteria)
    monitor_interval_seconds: float = Field(default=1.0, gt=0)
    max_duration_seconds: float | None = Field(default=None, gt=0)


class ExperimentRunResult(BaseModel):
    id: str
    experiment: ExperimentDefinition
    chaos_yaml: str
    status: ExperimentStatus
    abort_triggered: bool = False
    abort_reason: str | None = None
    metrics_observed: list[MetricSample] = []
    started_at: str | None = None
    ended_at: str | None = None
    evaluation: ExperimentEvaluation | None = None
