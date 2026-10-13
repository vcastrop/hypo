from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.errors import (
    ClusterAccessDeniedError,
    ClusterError,
    ClusterUnreachableError,
    ResourceNotFoundError,
)
from app.integrations.chaos_mesh import get_chaos_mesh_client
from app.integrations.kubernetes import K8sClients, get_k8s_clients
from app.integrations.prometheus import PrometheusClient, get_prometheus_client
from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentDefinitionRequest,
    ExperimentRunRequest,
    ExperimentRunResult,
    ExperimentYamlResponse,
)
from app.modules.experiments.service import (
    define_experiment,
    execute_experiment,
    generate_chaos_mesh_manifest,
    generate_chaos_mesh_yaml,
    get_run,
    list_runs,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])


def _handle_cluster_error(exc: ClusterError) -> HTTPException:
    """Map domain cluster exceptions to appropriate HTTP status codes."""
    if isinstance(exc, ClusterUnreachableError):
        return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc))
    if isinstance(exc, ClusterAccessDeniedError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    if isinstance(exc, ResourceNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))


@router.post(
    "/definitions",
    response_model=ExperimentDefinition,
    status_code=status.HTTP_201_CREATED,
    summary="Define an experiment and hypothesis",
)
def create_experiment_definition(
    request: ExperimentDefinitionRequest,
) -> ExperimentDefinition:
    try:
        return define_experiment(request)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post(
    "/definitions/yaml",
    response_model=ExperimentYamlResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate Chaos Mesh YAML without executing",
)
def generate_experiment_yaml(
    request: ExperimentDefinitionRequest,
) -> ExperimentYamlResponse:
    """Convert an experiment definition request into valid Chaos Mesh YAML and JSON manifest."""
    try:
        definition = define_experiment(request)
        manifest = generate_chaos_mesh_manifest(definition)
        yaml_content = generate_chaos_mesh_yaml(manifest)
        return ExperimentYamlResponse(yaml=yaml_content, manifest=manifest)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc


@router.post(
    "/runs",
    response_model=ExperimentRunResult,
    status_code=status.HTTP_201_CREATED,
    summary="Execute experiment automatically with abort monitoring",
)
def run_experiment(
    request: ExperimentRunRequest,
    clients: Annotated[K8sClients, Depends(get_k8s_clients)],
    prometheus_client: Annotated[PrometheusClient, Depends(get_prometheus_client)],
) -> ExperimentRunResult:
    """Execute a chaos experiment end-to-end:

    1. Converts definition to Chaos Mesh YAML
    2. Applies YAML to Kubernetes cluster automatically
    3. Monitors abort condition in real time
    4. Automatically stops / deletes chaos resource upon completion or threshold breach
    """
    chaos_client = get_chaos_mesh_client(clients)
    try:
        return execute_experiment(
            request=request,
            chaos_client=chaos_client,
            prometheus_client=prometheus_client,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(exc),
        ) from exc
    except ClusterError as exc:
        raise _handle_cluster_error(exc) from exc


@router.get(
    "/runs",
    response_model=list[ExperimentRunResult],
    summary="List all executed experiment runs",
)
def get_experiment_runs() -> list[ExperimentRunResult]:
    return list_runs()


@router.get(
    "/runs/{run_id}",
    response_model=ExperimentRunResult,
    summary="Get details of a specific experiment run",
)
def get_experiment_run(run_id: str) -> ExperimentRunResult:
    run = get_run(run_id)
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment run '{run_id}' not found",
        )
    return run
