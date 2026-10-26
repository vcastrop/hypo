import type {
  ExperimentEvaluation,
  WindowMetrics,
} from '../types/experiments';

interface ExperimentResultCardProps {
  evaluation: ExperimentEvaluation | null;
}

const metricRows: {
  key: keyof WindowMetrics;
  label: string;
  unit: string;
}[] = [
  { key: 'error_rate', label: 'Tasa de errores', unit: '%' },
  { key: 'success_rate', label: 'Tasa de éxito', unit: '%' },
  { key: 'p95_latency_ms', label: 'Latencia P95', unit: 'ms' },
];

function formatMetric(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) {
    return 'Sin datos';
  }

  return `${value.toFixed(2)} ${unit}`;
}

export function ExperimentResultCard({
  evaluation,
}: ExperimentResultCardProps) {
  if (!evaluation) {
    return (
      <div className="mt-5 rounded-lg border border-[#383838] bg-[#242424] p-4">
        <p className="text-sm font-semibold text-slate-300">
          Evaluación no disponible
        </p>
        <p className="mt-1 text-xs text-slate-400">
          No hay resultados suficientes para determinar PASS o FAIL.
        </p>
      </div>
    );
  }

  const passed = evaluation.verdict === 'PASS';

  return (
    <div className="mt-5 border-t border-[#333333] pt-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-semibold text-white">
            Resultado del experimento
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            Evaluación de la hipótesis y condiciones de resiliencia
          </p>
        </div>

        <span
          className={`rounded-lg border px-4 py-2 text-sm font-bold ${
            passed
              ? 'border-emerald-700 bg-emerald-950/40 text-emerald-400'
              : 'border-red-700 bg-red-950/40 text-red-400'
          }`}
        >
          {evaluation.verdict}
        </span>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-[#383838]">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-[#292929] text-slate-300">
            <tr>
              <th className="px-4 py-3 text-left">Métrica</th>
              <th className="px-4 py-3 text-right">Antes</th>
              <th className="px-4 py-3 text-right">Durante</th>
              <th className="px-4 py-3 text-right">Después</th>
            </tr>
          </thead>

          <tbody>
            {metricRows.map(({ key, label, unit }) => (
              <tr
                key={key}
                className="border-t border-[#383838] text-slate-200"
              >
                <td className="px-4 py-3 font-medium">{label}</td>

                <td className="px-4 py-3 text-right">
                  {formatMetric(evaluation.before_metrics[key], unit)}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatMetric(evaluation.during_metrics[key], unit)}
                </td>

                <td className="px-4 py-3 text-right">
                  {formatMetric(evaluation.after_metrics[key], unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg border border-[#383838] bg-[#242424] p-4">
        <p className="text-xs text-slate-400">Tiempo de recuperación</p>

        <p className="mt-1 text-xl font-semibold text-white">
          {evaluation.recovery_time_seconds === null
            ? 'No disponible'
            : `${evaluation.recovery_time_seconds.toFixed(2)} segundos`}
        </p>
      </div>

      {evaluation.details.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#383838] p-4">
          <h5 className="text-sm font-semibold text-white">
            Detalles de la evaluación
          </h5>

          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
            {evaluation.details.map((detail, index) => (
              <li key={`${index}-${detail}`}>{detail}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
