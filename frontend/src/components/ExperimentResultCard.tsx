import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Info,
  Lightbulb,
  Activity,
  ShieldAlert,
} from 'lucide-react';

import type {
  EconomicImpact,
  ExperimentEvaluation,
  Recommendation,
  PerformanceTimelinePoint,
} from '../types/experiments';

interface ExperimentResultCardProps {
  evaluation: ExperimentEvaluation | null;
  summary?: string | null;
  recommendations?: Recommendation[];
  economic_impact?: EconomicImpact | null;
  failure_type?: string;
  target_name?: string;
}

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

function formatMetric(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'Sin datos';
  }
  return `${value.toFixed(2)} ${unit}`;
}

export function ExperimentResultCard({
  evaluation,
  summary,
  recommendations,
  economic_impact,
  failure_type,
  target_name,
}: ExperimentResultCardProps) {
  const [showEconomicDetails, setShowEconomicDetails] = useState(false);
  const [chartMetric, setChartMetric] = useState<'latency' | 'rps'>('latency');

  const displaySummary = summary ?? evaluation?.findings_summary ?? evaluation?.summary;
  const displayRecs = recommendations ?? evaluation?.recommendations ?? [];
  const displayEcon = economic_impact ?? evaluation?.economic_impact;
  const timeline = evaluation?.performance_timeline ?? [];

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

  // Métricas calculadas para la gráfica SVG
  const maxLatency = Math.max(
    ...timeline.map((p) => p.latency_ms),
    evaluation.during_metrics?.p95_latency_ms ?? 100,
    150
  );
  const maxRps = Math.max(
    ...timeline.map((p) => p.rps),
    160
  );

  const chartWidth = 650;
  const chartHeight = 170;
  const paddingX = 45;
  const paddingY = 25;

  const minTime = timeline.length > 0 ? timeline[0].time_offset_seconds : -10;
  const maxTime = timeline.length > 0 ? timeline[timeline.length - 1].time_offset_seconds : 45;
  const timeRange = Math.max(1, maxTime - minTime);

  const getCoordinates = (p: PerformanceTimelinePoint, metric: 'latency' | 'rps') => {
    const x = paddingX + ((p.time_offset_seconds - minTime) / timeRange) * (chartWidth - paddingX * 2);
    const val = metric === 'latency' ? p.latency_ms : p.rps;
    const maxVal = metric === 'latency' ? maxLatency : maxRps;
    const y = chartHeight - paddingY - (val / (maxVal * 1.15)) * (chartHeight - paddingY * 2);
    return { x, y };
  };

  const polylinePoints = timeline
    .map((p) => {
      const { x, y } = getCoordinates(p, chartMetric);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Encontrar coordenadas de la zona de caos (phase === 'during')
  const duringPoints = timeline.filter((p) => p.phase === 'during');
  const chaosStartX = duringPoints.length > 0
    ? paddingX + ((duringPoints[0].time_offset_seconds - minTime) / timeRange) * (chartWidth - paddingX * 2)
    : paddingX + (10 / timeRange) * (chartWidth - paddingX * 2);
  const chaosEndX = duringPoints.length > 0
    ? paddingX + ((duringPoints[duringPoints.length - 1].time_offset_seconds - minTime) / timeRange) * (chartWidth - paddingX * 2)
    : paddingX + (40 / timeRange) * (chartWidth - paddingX * 2);

  return (
    <div className="mt-5 border-t border-[#333333] pt-5 space-y-5">
      {/* CABECERA DE EVALUACIÓN */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            Resultado del experimento
            <span className="text-xs font-normal text-slate-400">
              ({target_name ?? 'servicio'} · {failure_type ?? 'caos'})
            </span>
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            Evaluación de hipótesis, condiciones de resiliencia y telemetría de rendimiento.
          </p>
        </div>

        <span
          className={`rounded-lg border px-4 py-1.5 text-sm font-extrabold flex items-center gap-1.5 ${
            passed
              ? 'border-emerald-700 bg-emerald-950/50 text-emerald-400'
              : 'border-red-700 bg-red-950/50 text-red-400'
          }`}
        >
          {passed ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <ShieldAlert className="w-4 h-4" />
          )}
          {evaluation.verdict}
        </span>
      </div>

      {/* RESUMEN DE HALLAZGOS */}
      {displaySummary && (
        <div className="rounded-lg border border-sky-800/40 bg-sky-950/20 p-4">
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

      {/* GRÁFICA DE RENDIMIENTO TEMPORAL */}
      <div className="rounded-xl border border-[#333333] bg-[#171717] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-red-400" />
            <h5 className="text-sm font-bold text-white">
              Curva de Rendimiento en Tiempo Real
            </h5>
            <span className="text-[11px] text-slate-400">
              (Antes, Durante Inyección de Caos y Recuperación)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-[#222222] p-1 rounded-lg border border-[#3a3a3a]">
            <button
              type="button"
              onClick={() => setChartMetric('latency')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                chartMetric === 'latency'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Latencia P95 (ms)
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('rps')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                chartMetric === 'rps'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Throughput (RPS)
            </button>
          </div>
        </div>

        {/* CONTENEDOR SVG DE LA GRÁFICA */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-44 select-none"
          >
            {/* Gradientes SVG */}
            <defs>
              <linearGradient id="chaosAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Zona sombreada de Caos */}
            <rect
              x={chaosStartX}
              y={paddingY}
              width={Math.max(10, chaosEndX - chaosStartX)}
              height={chartHeight - paddingY * 2}
              fill="url(#chaosAreaGrad)"
              stroke="#ef4444"
              strokeDasharray="4 4"
              strokeWidth="0.8"
              opacity="0.8"
            />
            <text
              x={(chaosStartX + chaosEndX) / 2}
              y={paddingY - 6}
              textAnchor="middle"
              className="text-[9px] fill-rose-400 font-bold uppercase tracking-wider"
            >
              ⚡ Zona de Falla Inyectada
            </text>

            {/* Líneas horizontales de guía */}
            {[0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
              const y = chartHeight - paddingY - ratio * (chartHeight - paddingY * 2);
              const val = chartMetric === 'latency'
                ? Math.round(maxLatency * ratio)
                : Math.round(maxRps * ratio);
              return (
                <g key={idx}>
                  <line
                    x1={paddingX}
                    y1={y}
                    x2={chartWidth - paddingX}
                    y2={y}
                    stroke="#2e2e2e"
                    strokeDasharray="2 2"
                  />
                  <text
                    x={paddingX - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[9px] fill-slate-500 font-mono"
                  >
                    {val}
                    {chartMetric === 'latency' ? 'ms' : ' rps'}
                  </text>
                </g>
              );
            })}

            {/* Línea de la serie temporal */}
            {timeline.length > 1 && (
              <>
                <polyline
                  fill="none"
                  stroke={chartMetric === 'latency' ? '#ef4444' : '#38bdf8'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylinePoints}
                />
                {timeline.map((p, idx) => {
                  const { x, y } = getCoordinates(p, chartMetric);
                  const isPeak = p.phase === 'during';
                  return (
                    <g key={idx} className="group cursor-pointer">
                      <circle
                        cx={x}
                        cy={y}
                        r={isPeak ? 4 : 2.5}
                        fill={isPeak ? '#ef4444' : '#38bdf8'}
                        stroke="#121212"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </>
            )}

            {/* Marcas de tiempo en el eje X */}
            <text x={paddingX} y={chartHeight - 6} className="text-[9px] fill-slate-500 font-mono">
              -10s (Baseline)
            </text>
            <text x={chaosStartX} y={chartHeight - 6} textAnchor="middle" className="text-[9px] fill-rose-400 font-mono font-bold">
              0s (Inyección)
            </text>
            <text x={chaosEndX} y={chartHeight - 6} textAnchor="middle" className="text-[9px] fill-amber-400 font-mono font-bold">
              Fin de Caos
            </text>
            <text x={chartWidth - paddingX} y={chartHeight - 6} textAnchor="end" className="text-[9px] fill-slate-500 font-mono">
              +15s (Recuperado)
            </text>
          </svg>
        </div>

        {/* TARJETAS RESUMEN DE LA FALLA INYECTADA */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-3 border-t border-[#2a2a2a]">
          <div className="rounded-lg bg-[#111111] border border-[#2b2b2b] p-2.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Baseline Normal
            </span>
            <span className="text-sm font-mono font-bold text-slate-200 mt-0.5 block">
              {formatMetric(evaluation.before_metrics?.p95_latency_ms, 'ms')}
            </span>
          </div>

          <div className="rounded-lg bg-rose-950/20 border border-rose-900/40 p-2.5">
            <span className="text-[10px] text-rose-300 uppercase tracking-wider block font-semibold">
              Pico Durante Caos
            </span>
            <span className="text-sm font-mono font-bold text-rose-400 mt-0.5 block">
              {formatMetric(evaluation.during_metrics?.p95_latency_ms, 'ms')}
            </span>
          </div>

          <div className="rounded-lg bg-[#111111] border border-[#2b2b2b] p-2.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Tasa de Error Caos
            </span>
            <span
              className={`text-sm font-mono font-bold mt-0.5 block ${
                (evaluation.during_metrics?.error_rate ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {formatMetric(evaluation.during_metrics?.error_rate, '%')}
            </span>
          </div>

          <div className="rounded-lg bg-[#111111] border border-[#2b2b2b] p-2.5">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Estado Posterior
            </span>
            <span className="text-sm font-mono font-bold text-emerald-400 mt-0.5 block">
              {formatMetric(evaluation.after_metrics?.p95_latency_ms, 'ms')}
            </span>
          </div>
        </div>
      </div>

      {/* IMPACTO ECONÓMICO ESTIMADO */}
      {displayEcon && (
        <div className="rounded-lg border border-emerald-900/50 bg-[#141d18] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <h5 className="text-sm font-semibold text-white">
                  Impacto económico estimado
                </h5>
                <p className="text-xs text-slate-400">
                  Estimación financiera proporcional al tiempo de caída, degradación y abandono de clientes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`text-xs px-2.5 py-0.5 rounded border font-semibold uppercase ${
                  severityBadgeStyles[displayEcon.severity] ?? severityBadgeStyles.low
                }`}
              >
                Riesgo {severityLabels[displayEcon.severity] ?? displayEcon.severity}
              </span>
              <span
                className={`text-xl font-mono font-bold ${
                  displayEcon.total_estimated_impact > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                ${displayEcon.total_estimated_impact.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                <span className="text-xs font-normal text-slate-400">
                  {displayEcon.currency}
                </span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3">
            <div className="rounded-lg border border-[#26372d] bg-[#111a15] p-3">
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

            <div className="rounded-lg border border-[#26372d] bg-[#111a15] p-3">
              <p className="text-[11px] text-slate-400 font-medium">
                Pérdida por degradación y latencia
              </p>
              <p className="text-base font-semibold text-white mt-1">
                ${displayEcon.estimated_degradation_cost.toFixed(2)}{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({displayEcon.degraded_duration_seconds.toFixed(1)}s)
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-[#26372d] bg-[#111a15] p-3">
              <p className="text-[11px] text-slate-400 font-medium">
                Benchmark comercial
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
                ? 'Ocultar supuestos y desglose de ventas'
                : 'Ver supuestos, fórmula y ventas estimadas perdidas'}
            </span>
            {showEconomicDetails ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showEconomicDetails && (
            <div className="mt-3 pt-3 border-t border-[#26372d] space-y-2">
              <div className="rounded bg-[#0c130f] p-2.5 font-mono text-[11px] text-slate-300 border border-[#1b2b20]">
                <p className="text-emerald-400 font-semibold mb-1">Fórmula aplicada:</p>
                <p className="break-all">{displayEcon.formula}</p>
              </div>

              {displayEcon.assumptions && displayEcon.assumptions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Supuestos y métricas de negocio afectadas:
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

      {/* DETALLES DE LA EVALUACIÓN */}
      {evaluation.details && evaluation.details.length > 0 && (
        <div className="rounded-lg border border-[#333333] bg-[#1a1a1a] p-4">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Detalles de la evaluación
          </h5>
          <ul className="space-y-1 text-xs text-slate-300">
            {evaluation.details.map((detail, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-slate-500">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* RECOMENDACIONES TÉCNICAS */}
      {displayRecs && displayRecs.length > 0 && (
        <div className="rounded-lg border border-[#333333] bg-[#1a1a1a] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h5 className="text-sm font-semibold text-white">
              Recomendaciones de Resiliencia
            </h5>
          </div>

          <div className="space-y-2">
            {displayRecs.map((rec) => (
              <div
                key={rec.id}
                className="rounded-lg border border-[#2b2b2b] bg-[#141414] p-3 text-xs"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-semibold text-slate-200">
                    {rec.title}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      severityBadgeStyles[rec.severity] ?? severityBadgeStyles.low
                    }`}
                  >
                    {severityLabels[rec.severity]}
                  </span>
                </div>
                <p className="text-slate-400 mt-1 leading-relaxed">
                  {rec.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
