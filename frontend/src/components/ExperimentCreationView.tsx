import React, { useEffect, useState } from 'react';
import { FlaskConical, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

import { fetchNamespaces, fetchWorkloads } from '../services/api';
import {
  createExperimentDefinition,
  startExperiment,
} from '../services/experiments';

import type { NamespaceInfo, WorkloadInfo } from '../types/discovery';
import type {
  ExperimentDefinition,
  ExperimentRunResult,
  FailureType,
} from '../types/experiments';

const failureTypes: { value: FailureType; label: string }[] = [
  { value: 'pod-kill', label: 'Pod Kill' },
  { value: 'resource-stress', label: 'Resource Stress' },
  { value: 'network-delay', label: 'Network Delay' },
  { value: 'network-loss', label: 'Network Loss' },
];

export const ExperimentCreationView: React.FC = () => {
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [namespace, setNamespace] = useState('mybookstore');

  const [workloads, setWorkloads] = useState<WorkloadInfo[]>([]);
  const [selectedWorkload, setSelectedWorkload] = useState('');

  const [failureType, setFailureType] = useState<FailureType>('pod-kill');
  const [duration, setDuration] = useState(60);
  const [affectedReplicas, setAffectedReplicas] = useState(1);

  const [loading, setLoading] = useState(false);
  const [loadingWorkloads, setLoadingWorkloads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [definition, setDefinition] = useState<ExperimentDefinition | null>(null);

  const [executing, setExecuting] = useState(false);

  const [activeRun, setActiveRun] =
    useState<ExperimentRunResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchNamespaces()
      .then((data) => {
        if (cancelled) return;

        setNamespaces(data);

        setNamespace((currentNamespace) =>
            data.some((item) => item.name === currentNamespace)
                ? currentNamespace
                : (data[0]?.name ?? '')
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError('No fue posible consultar los namespaces de Kubernetes.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!namespace) {
      return;
    }

    let cancelled = false;

    fetchWorkloads(namespace)
      .then((data) => {
        if (cancelled) return;

        setWorkloads(
            data.filter(
                (item) => item.is_ready && item.replicas >= 2
            )
        );

        setSelectedWorkload((previous) =>
            data.some(
                (item) =>
                item.name === previous &&
                item.is_ready &&
                item.replicas >= 2
            )
                ? previous
                : ''
        );
      })
      .catch(() => {
        if (!cancelled) {
          setWorkloads([]);
          setSelectedWorkload('');
          setError('No fue posible consultar los deployments.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWorkloads(false);
      });

    return () => {
      cancelled = true;
    };
  }, [namespace]);

  const target = workloads.find((item) => item.name === selectedWorkload);

  const blastRadius = target
    ? (affectedReplicas / target.replicas) * 100
    : 0;

  const isValid =
    Boolean(target) &&
    Number.isInteger(duration) &&
    duration > 0 &&
    Number.isInteger(affectedReplicas) &&
    affectedReplicas > 0 &&
    affectedReplicas <= (target?.replicas ?? 0) &&
    blastRadius <= 50;

  const handleValidate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!target || !isValid) return;

    setLoading(true);
    setError(null);
    setDefinition(null);

    try {
      const result = await createExperimentDefinition({
        target: {
          name: target.name,
          namespace: target.namespace,
          kind: target.kind,
          replicas: target.replicas,
          labels: target.labels,
        },
        failure_type: failureType,
        duration_seconds: duration,
        affected_replicas: affectedReplicas,
      });

      setDefinition(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No fue posible validar el experimento.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRunExperiment = async () => {
    if (!definition || executing || activeRun) return;

    setExecuting(true);
    setError(null);

    try {
        const result = await startExperiment({
        definition,
        abort_condition: {
            metric: 'error_rate',
            threshold: 10,
            operator: '>',
        },
        monitor_interval_seconds: 2,
        max_duration_seconds: Math.min(
            definition.duration_seconds,
            300
        ),
        });

        setActiveRun(result);
    } catch (err) {
        setError(
        err instanceof Error
            ? err.message
            : 'No fue posible iniciar el experimento.'
        );
    } finally {
        setExecuting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-mono text-red-400 mb-2">
          CHAOS ENGINEERING / EXPERIMENTS
        </p>

        <h1 className="text-3xl font-extrabold text-white">
          Experimentos de Resiliencia
        </h1>

        <p className="text-slate-400 mt-3">
          Configura y valida experimentos de caos sobre Kubernetes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleValidate}
          className="lg:col-span-2 rounded-xl border border-[#333333] bg-[#1e1e1e] p-6 space-y-6"
        >
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-semibold">Crear experimento</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Namespace</span>

              <select
                value={namespace}
                onChange={(event) => {
                  setNamespace(event.target.value);
                  setSelectedWorkload('');
                  setDefinition(null);
                  setLoadingWorkloads(true);
                  setError(null);
                }}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white"
              >
                {namespaces.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Deployment objetivo</span>

              <select
                value={selectedWorkload}
                onChange={(event) => {
                  setSelectedWorkload(event.target.value);
                  setAffectedReplicas(1);
                  setDefinition(null);
                }}
                disabled={loadingWorkloads}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white"
              >
                <option value="">Seleccionar deployment</option>

                {workloads.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.name} ({item.ready_replicas}/{item.replicas} pods)
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Tipo de fallo</span>

              <select
                value={failureType}
                onChange={(event) => {
                  setFailureType(event.target.value as FailureType);
                  setDefinition(null);
                }}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white"
              >
                {failureTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Duración (segundos)</span>

              <input
                type="number"
                min={1}
                step={1}
                value={duration}
                onChange={(event) => {
                  setDuration(Number(event.target.value));
                  setDefinition(null);
                }}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Réplicas afectadas</span>

              <input
                type="number"
                min={1}
                max={target ? Math.floor(target.replicas / 2) : 1}
                step={1}
                value={affectedReplicas}
                onChange={(event) => {
                  setAffectedReplicas(Number(event.target.value));
                  setDefinition(null);
                }}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white"
              />
            </label>
          </div>

          <div className="rounded-lg bg-[#151515] border border-[#333333] p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-300">Blast radius</span>

              <span
                className={`font-mono font-bold ${
                  blastRadius > 50 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {blastRadius.toFixed(1)}%
              </span>
            </div>

            <div className="h-2 bg-[#333333] rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  blastRadius > 50 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(blastRadius, 100)}%` }}
              />
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Hypo permite afectar como máximo el 50% de las réplicas.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full flex justify-center items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 transition-colors cursor-pointer"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}

            {loading ? 'Validando...' : 'Validar experimento'}
          </button>
        </form>

        <aside className="rounded-xl border border-[#333333] bg-[#1e1e1e] p-6 h-fit">
          <h2 className="text-lg font-semibold mb-4">Resumen</h2>
            <p className="text-xs text-slate-400">
                Blast radius validado: {definition?.blast_radius_percentage ?? 0}%
            </p>

            <button
            type="button"
            onClick={() => void handleRunExperiment()}
            disabled={executing || activeRun !== null}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors cursor-pointer"
            >
            {executing ? (
                <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Iniciando experimento...
                </>
            ) : activeRun ? (
                'Experimento iniciado'
            ) : (
                <>
                <FlaskConical className="w-4 h-4" />
                Run Experiment
                </>
            )}
            </button>

            {activeRun && (
            <div className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-4">
                <p className="text-sm font-semibold text-blue-300">
                Solicitud de ejecución aceptada
                </p>

                <p className="text-xs text-slate-400 mt-2">
                ID de ejecución:
                </p>

                <p className="text-xs font-mono text-white break-all mt-1">
                {activeRun.id}
                </p>

                <p className="text-xs text-slate-400 mt-3">
                Estado inicial: {activeRun.status}
                </p>
            </div>
            )}

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-400">Objetivo</p>
              <p className="font-mono text-white mt-1">
                {target?.name ?? 'Sin seleccionar'}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Tipo de fallo</p>
              <p className="text-white mt-1">{failureType}</p>
            </div>

            <div>
              <p className="text-slate-400">Duración</p>
              <p className="text-white mt-1">{duration} segundos</p>
            </div>

            <div>
              <p className="text-slate-400">Blast radius</p>
              <p className="text-white mt-1">{blastRadius.toFixed(1)}%</p>
            </div>
          </div>

          <div className="mt-6 border-t border-[#333333] pt-5">
            {definition ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <ShieldCheck className="w-5 h-5" />
                  Definición validada
                </div>

                <p className="text-sm text-slate-300 leading-relaxed">
                  {definition.hypothesis}
                </p>

                <p className="text-xs text-slate-400">
                  Blast radius validado: {definition.blast_radius_percentage}%
                </p>
              </div>
            ) : (
              <div className="flex gap-2 text-amber-400 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  El experimento debe validarse antes de ejecutarse.
                </span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};