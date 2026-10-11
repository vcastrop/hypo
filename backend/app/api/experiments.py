from fastapi import APIRouter, HTTPException, status

from app.modules.experiments.schemas import (
    ExperimentDefinition,
    ExperimentDefinitionRequest,
)
from app.modules.experiments.service import define_experiment

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post(
    "/definitions",
    response_model=ExperimentDefinition,
    status_code=status.HTTP_201_CREATED,
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
