import React, { useEffect, useState } from 'react';
import {
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  FlaskConical,
} from 'lucide-react';

import { fetchExperimentRuns } from '../services/experiments';
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
  pending: 'text-slate-300 bg-slate-700/30',
  running: 'text-blue-400 bg-blue-900/30',
  completed: 'text-emerald-400 bg-emerald-900/30',
  aborted: 'text-amber-400 bg-amber-900/30',
  failed: 'text-red-400 bg-red-900/30',
};

export const ExperimentRunsView: React.FC = () => {
  const [runs, setRuns] = useState<ExperimentRunResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchExperimentRuns();
      setRuns(data);
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

    fetchExperimentRuns()
        .then((data) => {
        if (!cancelled) {
            setRuns(data);
        }
        })
        .catch((err) => {
        if (!cancelled) {
            setError(
            err instanceof Error
                ? err.message
                : 'No fue posible consultar las ejecuciones.'
            );
        }
        })
        .finally(() => {
        if (!cancelled) {
            setLoading(false);
        }
        });

    return () => {
        cancelled = true;
    };
  }, []);

  return (
    <section className="max-w-7xl mx-auto px-8 pb-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-red-400" />

            <h2 className="text-2xl font-bold text-white">
              Historial de ejecuciones
            </h2>
          </div>

          <p className="text-slate-400 text-sm mt-2">
            Consulta los experimentos registrados en Hypo.
          </p>
        </div>

        <button
          onClick={() => void loadRuns()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#242424] border border-[#383838] text-sm text-slate-200 hover:bg-[#303030] disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          />
          Actualizar
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-800 bg-red-950/30 p-5 text-red-300 mb-5"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#333333] bg-[#1e1e1e] p-10 text-center">
          <RefreshCw className="w-7 h-7 animate-spin text-red-400 mx-auto mb-3" />
          <p className="text-slate-400">Cargando ejecuciones...</p>
        </div>
      ) : runs.length === 0 && !error ? (
        <div className="rounded-xl border border-[#333333] bg-[#1e1e1e] p-10 text-center">
          <FlaskConical className="w-10 h-10 text-slate-500 mx-auto mb-4" />

          <h3 className="text-lg font-semibold text-white">
            Todavía no hay experimentos ejecutados
          </h3>

          <p className="text-slate-400 mt-2 max-w-md mx-auto">
            Los experimentos aparecerán aquí después de ejecutarse.
            Puedes comenzar creando y validando una definición.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <article
              key={run.id}
              className="rounded-xl border border-[#333333] bg-[#1e1e1e] p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-slate-400">
                    {run.id}
                  </p>

                  <h3 className="text-lg font-semibold text-white mt-2">
                    {run.experiment.target.name}
                  </h3>

                  <p className="text-sm text-slate-400 mt-1">
                    {run.experiment.target.namespace}
                    {' · '}
                    {run.experiment.failure_type}
                  </p>
                </div>

                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[run.status]}`}
                >
                  {statusLabels[run.status]}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#333333]">
                <div>
                  <p className="text-xs text-slate-400">Blast radius</p>
                  <p className="font-semibold mt-1">
                    {run.experiment.blast_radius_percentage}%
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Duración configurada</p>
                  <p className="font-semibold mt-1">
                    {run.experiment.duration_seconds} segundos
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400">Inicio</p>
                  <p className="font-semibold mt-1">
                    {run.started_at
                      ? new Date(run.started_at).toLocaleString()
                      : 'No disponible'}
                  </p>
                </div>
              </div>

              {run.abort_triggered && (
                <div className="flex gap-2 mt-5 rounded-lg border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-300">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>
                    {run.abort_reason ?? 'Experimento abortado'}
                  </span>
                </div>
              )}

              {run.status === 'completed' && (
                <div className="flex items-center gap-2 mt-5 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Ejecución finalizada
                </div>
              )}

              {run.status === 'running' && (
                <div className="flex items-center gap-2 mt-5 text-sm text-blue-400">
                  <Clock className="w-4 h-4" />
                  Experimento en ejecución
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};