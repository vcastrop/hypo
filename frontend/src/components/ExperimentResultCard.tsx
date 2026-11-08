import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Info,
  Lightbulb,
} from 'lucide-react';

import type {
  EconomicImpact,
  ExperimentEvaluation,
  Recommendation,
  WindowMetrics,
} from '../types/experiments';

interface ExperimentResultCardProps {
  evaluation: ExperimentEvaluation | null;
  summary?: string | null;
  recommendations?: Recommendation[];
  economic_impact?: EconomicImpact | null;
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

const severityBadgeStyles: Record<Recommendation['severity'], string> = {
  critical: 'border-rose-800/60 bg-rose-950/40 text-rose-300',
  high: 'border-amber-800/60 bg-amber-950/40 text-amber-300',
  medium: 'border-blue-800/60 bg-blue-950/40 text-blue-300',
  low: 'border-emerald-800/60 bg-emerald-950/40 text-emerald-300',
};

const severityLabels: Record<Recommendation['severity'], string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

function formatMetric(value: number | null, unit: string): string {
  if (value === null || !Number.isFinite(value)) {
    return 'Sin datos';
  }

  return `${value.toFixed(2)} ${unit}`;
}

export function ExperimentResultCard({
  evaluation,
  summary,
  recommendations,
  economic_impact,
}: ExperimentResultCardProps) {
  const [showEconomicDetails, setShowEconomicDetails] = useState(false);

  const displaySummary = summary ?? evaluation?.findings_summary ?? evaluation?.summary;
  const displayRecs = recommendations ?? evaluation?.recommendations ?? [];
  const displayEcon = economic_impact ?? evaluation?.economic_impact;

  if (!evaluation) {
    return (
      <div className="mt-5 rounded-lg border border-[#383838] bg-[#242424] p-4">
        <p className="text-sm font-semibold text-slate-300">
          Evaluación no disponible
        </p>
        <p className="mt-1 text-xs text-slate-400">
          No hay resultados suficientes para determinar PASS o FAIL.
        </p>
        {displaySummary && (
          <div className="mt-3 border-t border-[#383838] pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">
              Resumen de hallazgos
            </p>
            <p className="mt-1 text-sm text-slate-200">{displaySummary}</p>
          </div>
        )}
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

      {displaySummary && (
        <div className="mt-4 rounded-lg border border-sky-800/40 bg-sky-950/20 p-4">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wider text-sky-300">
                Resumen de hallazgos
              </h5>
              <p className="mt-1 text-sm font-medium text-slate-200 leading-relaxed">
                {displaySummary}
              </p>
            </div>
          </div>
        </div>
      )}

      {displayEcon && (
        <div className="mt-5 rounded-lg border border-emerald-900/40 bg-[#16201a] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h5 className="text-sm font-semibold text-white">
                  Impacto económico estimado
                </h5>
                <p className="text-xs text-slate-400">
                  Estimación financiera proporcional al tiempo de caída y degradación
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                  severityBadgeStyles[displayEcon.severity] ?? severityBadgeStyles.low
                }`}
              >
                Riesgo {severityLabels[displayEcon.severity] ?? displayEcon.severity}
              </span>
              <span className="text-xl font-mono font-bold text-emerald-400">
                ${displayEcon.total_estimated_impact.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs text-emerald-300/80 font-normal">
                  {displayEcon.currency}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3">
            <div className="rounded-lg border border-[#2e3e34] bg-[#1a2620] p-3">
              <p className="text-[11px] text-slate-400 font-medium">
                Pérdida por caída total
              </p>
              <p className="text-base font-semibold text-white mt-1">
                ${displayEcon.estimated_downtime_cost.toFixed(2)}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({displayEcon.downtime_duration_seconds.toFixed(1)}s)
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-[#2e3e34] bg-[#1a2620] p-3">
              <p className="text-[11px] text-slate-400 font-medium">
                Pérdida por degradación
              </p>
              <p className="text-base font-semibold text-white mt-1">
                ${displayEcon.estimated_degradation_cost.toFixed(2)}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({displayEcon.degraded_duration_seconds.toFixed(1)}s)
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-[#2e3e34] bg-[#1a2620] p-3">
              <p className="text-[11px] text-slate-400 font-medium">
                Benchmark configurado
              </p>
              <p className="text-base font-semibold text-white mt-1">
                ${displayEcon.cost_per_hour.toLocaleString()}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  USD/hora
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEconomicDetails((prev) => !prev)}
            className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            <span>
              {showEconomicDetails
                ? 'Ocultar supuestos y fórmula'
                : 'Ver supuestos y fórmula de cálculo'}
            </span>
            {showEconomicDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showEconomicDetails && (
            <div className="mt-3 pt-3 border-t border-[#2e3e34] space-y-2">
              <div className="rounded bg-[#121a16] p-2.5 font-mono text-[11px] text-slate-300 border border-[#24332b]">
                <p className="text-emerald-400 font-semibold mb-1">Fórmula:</p>
                <p className="break-all">{displayEcon.formula}</p>
              </div>

              {displayEcon.assumptions && displayEcon.assumptions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Supuestos económicos:
                  </p>
                  <ul className="space-y-1 pl-1">
                    {displayEcon.assumptions.map((assumption, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-1.5 text-xs text-slate-300"
                      >
                        <Info className="w-3.5 h-3.5 text-emerald-400/80 shrink-0 mt-0.5" />
                        <span>{assumption}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {displayRecs.length > 0 && (
        <div className="mt-5 rounded-lg border border-[#383838] bg-[#1e1e1e] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h5 className="text-sm font-semibold text-white">
                Recomendaciones de remediación
              </h5>
              <p className="text-xs text-slate-400">
                Acciones sugeridas basadas en los patrones de fallo identificados
              </p>
            </div>
          </div>

          <div className="space-y-3 mt-3">
            {displayRecs.map((rec) => (
              <div
                key={rec.id}
                className="rounded-lg border border-[#2e2e2e] bg-[#242424] p-3.5 transition-colors hover:border-[#444]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white tracking-wide">
                      {rec.title}
                    </span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#333333] text-slate-300">
                      {rec.category}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                      severityBadgeStyles[rec.severity] ?? severityBadgeStyles.medium
                    }`}
                  >
                    Severidad {severityLabels[rec.severity] ?? rec.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mt-1">
                  {rec.description}
                </p>

                {rec.action_items && rec.action_items.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-[#333333]/80">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Acciones recomendadas:
                    </p>
                    <ul className="space-y-1.5">
                      {rec.action_items.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-slate-200"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
