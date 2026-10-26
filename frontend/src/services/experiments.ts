import type {
  ExperimentDefinition,
  ExperimentDefinitionRequest,
  ExperimentRunRequest,
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

async function parseExperimentResponse(
  response: Response,
  fallbackMessage: string
): Promise<ExperimentRunResult> {
  if (!response.ok) {
    const error = await response.json().catch(() => null);

    const detail = error?.detail;

    const message =
      typeof detail === 'string'
        ? detail
        : `${fallbackMessage} (${response.status})`;

    throw new Error(message);
  }

  return response.json();
}

/**
 * Inicia un experimento de caos de manera asíncrona.
 *
 * El backend responde HTTP 202 con el identificador
 * de la ejecución.
 */
export async function startExperiment(
  request: ExperimentRunRequest
): Promise<ExperimentRunResult> {
  const response = await fetch(`${BASE_URL}/runs/async`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return parseExperimentResponse(
    response,
    'No fue posible iniciar el experimento'
  );
}

/**
 * Consulta el estado actual de una ejecución.
 *
 * Se utilizará para actualizar la interfaz mientras
 * el experimento esté activo.
 */
export async function getExperimentRun(
  runId: string
): Promise<ExperimentRunResult> {
  const response = await fetch(
    `${BASE_URL}/runs/${encodeURIComponent(runId)}`
  );

  return parseExperimentResponse(
    response,
    'No fue posible consultar el experimento'
  );
}

/**
 * Solicita la cancelación de un experimento activo.
 *
 * La respuesta HTTP 202 confirma que el backend recibió
 * la solicitud, no que la limpieza haya finalizado.
 */
export async function stopExperiment(
  runId: string
): Promise<ExperimentRunResult> {
  const response = await fetch(
    `${BASE_URL}/runs/${encodeURIComponent(runId)}/stop`,
    {
      method: 'POST',
    }
  );

  return parseExperimentResponse(
    response,
    'No fue posible detener el experimento'
  );
}