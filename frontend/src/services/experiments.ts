import type {
  ExperimentDefinition,
  ExperimentDefinitionRequest,
  ExperimentRunResult,
} from '../types/experiments';

const BASE_URL = '/api/v1/experiments';

export async function createExperimentDefinition(
  request: ExperimentDefinitionRequest
): Promise<ExperimentDefinition> {
  const response = await fetch(`${BASE_URL}/definitions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);

    const detail = error?.detail;

    const message =
      typeof detail === 'string'
        ? detail
        : `Error al validar el experimento (${response.status})`;

    throw new Error(message);
  }

  return response.json();
}

export async function fetchExperimentRuns(): Promise<ExperimentRunResult[]> {
  const response = await fetch(`${BASE_URL}/runs`);

  if (!response.ok) {
    throw new Error(
      `No fue posible consultar las ejecuciones (${response.status})`
    );
  }

  return response.json();
}
