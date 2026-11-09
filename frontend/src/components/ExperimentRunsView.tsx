import React, { useEffect, useState } from 'react';
import {
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  FlaskConical,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  DollarSign,
} from 'lucide-react';

import { ExperimentResultCard } from './ExperimentResultCard';
import {
  fetchExperimentRuns,
  stopExperiment,
} from '../services/experiments';

import type {
  ExperimentRunResult,
  ExperimentStatus,
} from '../types/experiments';

const statusLabels: Record<ExperimentStatus, string> = {
  pending: 'Pendiente',
  running: 'En ejecución',
  completed: 'Completado',
  aborted: 'Abortado',
  failed: 'Fallido',
};

const statusColors: Record<ExperimentStatus, string> = {
  pending: 'text-slate-300 bg-slate-700/30 border-slate-600',
  running: 'text-blue-400 bg-blue-900/30 border-blue-700',
  completed: 'text-emerald-400 bg-emerald-900/30 border-emerald-700',
  aborted: 'text-amber-400 bg-amber-900/30 border-amber-700',
  failed: 'text-red-400 bg-red-900/30 border-red-700',
};

export const ExperimentRunsView: React.FC = () => {
  const [runs, setRuns] = useState<ExperimentRunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stoppingRunId, setStoppingRunId] = useState<string | null>(null);

  // Diccionario de IDs de experimentos expandidos/colapsados
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  const toggleRun = (runId: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    runs.forEach((r) => {
      allExpanded[r.id] = true;
    });
    setExpandedMap(allExpanded);
  };

  const collapseAll = () => {
    setExpandedMap({});
  };

  const loadRuns = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchExperimentRuns();
      setRuns(data);

      // Por defecto expandir el primero si no había estado
      setExpandedMap((prev) => {
        if (data.length > 0 && Object.keys(prev).length === 0) {
          return { [data[0].id]: true };
        }
        return prev;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible consultar las ejecuciones.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const refreshRuns = async () => {
      try {
        const data = await fetchExperimentRuns();

        if (!cancelled) {
          setRuns(data);
          setError(null);

          // Si llega una nueva ejecución y no está en expandedMap, expandirla por defecto
          setExpandedMap((prev) => {
            if (data.length > 0 && Object.keys(prev).length === 0) {
              return { [data[0].id]: true };
            }
            return prev;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'No fue posible consultar las ejecuciones.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void refreshRuns();

    const interval = window.setInterval(() => {
      void refreshRuns();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleStopExperiment = async (runId: string) => {
    if (stoppingRunId) return;

    const confirmed = window.confirm(
      '¿Deseas detener este experimento? Se solicitará la eliminación del fallo inyectado.'
    );

    if (!confirmed) return;

    setStoppingRunId(runId);
    setError(null);

    try {
      await stopExperiment(runId);
      const updatedRuns = await fetchExperimentRuns();
      setRuns(updatedRuns);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No fue posible detener el experimento.'
      );
    } finally {
      setStoppingRunId(null);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-red-400" />
            <h2 className="text-2xl font-bold text-white">
              Historial de ejecuciones
            </h2>
          </div>

          <p className="text-slate-400 text-sm mt-1">
            Consulta y despliega los informes de resiliencia con telemetría e impacto financiero.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {runs.length > 1 && (
            <div className="flex items-center gap-1 bg-[#202020] p-1 rounded-lg border border-[#383838]">
              <button
                type="button"
                onClick={expandAll}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white rounded hover:bg-[#2c2c2c] transition-colors cursor-pointer"
                title="Expandir todos los informes"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Expandir todos
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-slate-300 hover:text-white rounded hover:bg-[#2c2c2c] transition-colors cursor-pointer"
                title="Minimizar todos los informes"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Colapsar todos
              </button>
            </div>
          )}

          <button
            onClick={() => void loadRuns()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#242424] border border-[#383838] text-xs font-semibold text-slate-200 hover:bg-[#303030] disabled:opacity-50 cursor-pointer transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-800 bg-red-950/30 p-4 text-red-300 mb-5 text-sm flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && runs.length === 0 ? (
        <div className="rounded-xl border border-[#333333] bg-[#1e1e1e] p-10 text-center">
          <RefreshCw className="w-7 h-7 animate-spin text-red-400 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Cargando ejecuciones...</p>
        </div>
      ) : runs.length === 0 && !error ? (
        <div className="rounded-xl border border-[#333333] bg-[#1e1e1e] p-10 text-center">
          <FlaskConical className="w-10 h-10 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white">
            Todavía no hay experimentos ejecutados
          </h3>
          <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
            Configura y ejecuta un experimento para ver aquí su curva de rendimiento,
            análisis de Kubernetes e impacto económico.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => {
            const isExpanded = Boolean(expandedMap[run.id]);
            const displayEcon = run.economic_impact ?? run.evaluation?.economic_impact;
            const hasLoss = displayEcon && displayEcon.total_estimated_impact > 0;
            const verdict = run.evaluation?.verdict;

            return (
              <article
                key={run.id}
                className={`rounded-xl border transition-all duration-200 bg-[#1e1e1e] overflow-hidden ${
                  isExpanded ? 'border-red-900/50 shadow-xl' : 'border-[#333333] hover:border-[#444444]'
                }`}
              >
                {/* BARRA COMPACTA / CABECERA DEL ACORDEÓN */}
                <div
                  onClick={() => toggleRun(run.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-[#252525] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label={isExpanded ? 'Colapsar reporte' : 'Desplegar reporte'}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#333333] transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-red-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white uppercase tracking-tight">
                          {run.experiment.failure_type} · {run.experiment.target.name}
                        </span>

                        {verdict && (
                          <span
                            className={`text-[11px] font-extrabold px-2 py-0.5 rounded border ${
                              verdict === 'PASS'
                                ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-400'
                                : 'bg-red-950/60 border-red-700/80 text-red-400'
                            }`}
                          >
                            {verdict}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2 font-mono">
                        <span>{run.experiment.target.namespace}</span>
                        <span>•</span>
                        <span>{run.experiment.blast_radius_percentage}% réplicas</span>
                        <span>•</span>
                        <span>{run.experiment.duration_seconds}s</span>
                        {run.started_at && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500">
                              {new Date(run.started_at).toLocaleTimeString()}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* INDICADORES LATERALES DE LA FILA COMPACTA */}
                  <div className="flex items-center gap-3">
                    {displayEcon && (
                      <span
                        className={`text-xs font-mono font-bold px-2.5 py-1 rounded border flex items-center gap-1 ${
                          hasLoss
                            ? 'bg-rose-950/50 border-rose-700/60 text-rose-300'
                            : 'bg-emerald-950/40 border-emerald-700/50 text-emerald-400'
                        }`}
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        {hasLoss
                          ? `-$${displayEcon.total_estimated_impact.toFixed(2)} USD`
                          : `$0.00 USD`}
                      </span>
                    )}

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColors[run.status]}`}
                    >
                      {statusLabels[run.status]}
                    </span>
                  </div>
                </div>

                {/* CONTENIDO DESPLEGABLE COMPLETO */}
                {isExpanded && (
                  <div className="p-6 pt-0 border-t border-[#2e2e2e] animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-b border-[#2e2e2e] pb-4">
                      <div>
                        <p className="text-xs text-slate-400">ID de ejecución</p>
                        <p className="font-mono text-xs text-slate-300 mt-1 break-all">
                          {run.id}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Duración inyectada</p>
                        <p className="font-semibold text-white mt-1">
                          {run.experiment.duration_seconds} segundos
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Inicio de experimento</p>
                        <p className="font-semibold text-white mt-1">
                          {run.started_at
                            ? new Date(run.started_at).toLocaleString()
                            : 'No disponible'}
                        </p>
                      </div>
                    </div>

                    {/* TARJETA DE RESULTADO CON GRÁFICA Y TELEMETRÍA */}
                    {['completed', 'aborted', 'failed'].includes(run.status) && (
                      <ExperimentResultCard
                        evaluation={run.evaluation}
                        summary={run.findings_summary ?? run.summary}
                        recommendations={run.recommendations ?? run.evaluation?.recommendations}
                        economic_impact={run.economic_impact ?? run.evaluation?.economic_impact}
                        failure_type={run.experiment.failure_type}
                        target_name={run.experiment.target.name}
                      />
                    )}

                    {run.abort_triggered && (
                      <div className="flex gap-2 mt-4 rounded-lg border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-300">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{run.abort_reason ?? 'Experimento abortado'}</span>
                      </div>
                    )}

                    {run.status === 'completed' && (
                      <div className="flex items-center gap-2 mt-4 text-xs text-emerald-400 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Ejecución finalizada satisfactoriamente.
                      </div>
                    )}

                    {run.status === 'running' && (
                      <div className="flex items-center gap-2 mt-4 text-xs text-blue-400 font-medium">
                        <Clock className="w-4 h-4 animate-spin" />
                        Experimento en ejecución activa sobre el cluster.
                      </div>
                    )}

                    {(run.status === 'pending' || run.status === 'running') && (
                      <div className="mt-4 pt-3 border-t border-[#333333]">
                        <button
                          type="button"
                          onClick={() => void handleStopExperiment(run.id)}
                          disabled={stoppingRunId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-700 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          {stoppingRunId === run.id ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Solicitando cancelación...
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-4 h-4" />
                              Stop Experiment
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
