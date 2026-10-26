export type FailureType =
  | 'pod-kill'
  | 'resource-stress'
  | 'network-delay'
  | 'network-loss';

export interface ExperimentTarget {
  name: string;
  namespace: string;
  kind: string;
  replicas: number;
  labels: Record<string, string>;
}

export interface ExperimentDefinitionRequest {
  target: ExperimentTarget;
  failure_type: FailureType;
  duration_seconds: number;
  affected_replicas: number;
}

export interface ExperimentDefinition {
  target: ExperimentTarget;
  failure_type: FailureType;
  blast_radius_percentage: number;
  duration_seconds: number;
  hypothesis: string;
  affected_replicas: number;
}

export type ExperimentStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'aborted'
  | 'failed';

export interface MetricSample {
  timestamp: number;
  metric: string;
  value: number;
}

export interface WindowMetrics {
  error_rate: number | null;
  success_rate: number | null;
  p95_latency_ms: number | null;
}

export interface ExperimentEvaluation {
  verdict: 'PASS' | 'FAIL';
  hypothesis_met: boolean;
  recovery_time_seconds: number | null;
  before_metrics: WindowMetrics;
  during_metrics: WindowMetrics;
  after_metrics: WindowMetrics;
  details: string[];
}

export interface ExperimentRunResult {
  id: string;
  experiment: ExperimentDefinition;
  chaos_yaml: string;
  status: ExperimentStatus;
  abort_triggered: boolean;
  abort_reason: string | null;
  metrics_observed: MetricSample[];
  started_at: string | null;
  ended_at: string | null;
  evaluation: ExperimentEvaluation | null;
}

export interface AbortCondition {
  metric: 'error_rate' | 'success_rate';
  threshold: number;
  operator: '>' | '>=' | '<' | '<=';
}

export interface ExperimentRunRequest {
  definition?: ExperimentDefinition;
  definition_request?: ExperimentDefinitionRequest;
  abort_condition: AbortCondition;
  monitor_interval_seconds: number;
  max_duration_seconds?: number;
}