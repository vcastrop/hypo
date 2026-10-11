from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentDefinitionRequest,
    FailureType,
)

MAX_BLAST_RADIUS_PERCENTAGE = 50.0


def calculate_blast_radius(affected_replicas: int, total_replicas: int) -> float:
    if affected_replicas > total_replicas:
        raise ValueError("Affected replicas cannot exceed total replicas")

    return (affected_replicas / total_replicas) * 100


def build_hypothesis(
    failure_type: FailureType,
    target_name: str,
    affected_replicas: int,
    total_replicas: int,
) -> str:
    if failure_type == FailureType.POD_KILL:
        return (
            f"If {affected_replicas} of {total_replicas} replicas of {target_name} "
            "are terminated, the service should continue serving requests while "
            "Kubernetes restores the desired replica count."
        )

    if failure_type == FailureType.RESOURCE_STRESS:
        return (
            f"If {affected_replicas} of {total_replicas} replicas of {target_name} "
            "experience CPU and memory pressure, the service should maintain its "
            "defined steady-state conditions."
        )

    if failure_type == FailureType.NETWORK_DELAY:
        return (
            f"If network delay affects {affected_replicas} of {total_replicas} replicas "
            f"of {target_name}, the service should remain available, although latency "
            "may increase."
        )

    return (
        f"If packet loss affects {affected_replicas} of {total_replicas} replicas "
        f"of {target_name}, the service should maintain its defined steady-state conditions."
    )


def define_experiment(request: ExperimentDefinitionRequest) -> ExperimentDefinition:
    blast_radius = calculate_blast_radius(
        request.affected_replicas,
        request.target.replicas,
    )

    if blast_radius > MAX_BLAST_RADIUS_PERCENTAGE:
        raise ValueError(
            f"Blast radius {blast_radius:.1f}% exceeds the maximum allowed "
            f"{MAX_BLAST_RADIUS_PERCENTAGE:.1f}%"
        )

    hypothesis = build_hypothesis(
        request.failure_type,
        request.target.name,
        request.affected_replicas,
        request.target.replicas,
    )

    return ExperimentDefinition(
        target=request.target,
        failure_type=request.failure_type,
        blast_radius_percentage=blast_radius,
        duration_seconds=request.duration_seconds,
        hypothesis=hypothesis,
    )
