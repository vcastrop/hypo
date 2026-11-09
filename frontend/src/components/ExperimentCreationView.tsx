import React, { useEffect, useState } from 'react';
import {
  FlaskConical,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Flame,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

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

interface ArchitectureRecommendation {
  id: string;
  targetName: string;
  failureType: FailureType;
  duration: number;
  affectedReplicas: number;
  title: string;
  architecturalReason: string;
  expectedRisk: string;
  tag: string;
}

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
  const [duration, setDuration] = useState(30);
  const [affectedReplicas, setAffectedReplicas] = useState(1);
  const [costPerHour, setCostPerHour] = useState(1000);

  const [loading, setLoading] = useState(false);
  const [loadingWorkloads, setLoadingWorkloads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [definition, setDefinition] = useState<ExperimentDefinition | null>(null);

  const [executing, setExecuting] = useState(false);
  const [activeRun, setActiveRun] = useState<ExperimentRunResult | null>(null);

  // Modal de advertencia para 100% de réplicas
  const [showOutageWarningModal, setShowOutageWarningModal] = useState(false);
  const [outageConfirmed, setOutageConfirmed] = useState(false);

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
            (item) => item.is_ready && item.replicas >= 1
          )
        );

        setSelectedWorkload((previous) =>
          data.some(
            (item) =>
              item.name === previous &&
              item.is_ready &&
              item.replicas >= 1
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

  const isFullOutage = Boolean(
    target && affectedReplicas >= target.replicas && target.replicas > 0
  );

  const isValid =
    Boolean(target) &&
    Number.isInteger(duration) &&
    duration > 0 &&
    Number.isInteger(affectedReplicas) &&
    affectedReplicas > 0 &&
    affectedReplicas <= (target?.replicas ?? 0) &&
    blastRadius <= 100 &&
    Number.isFinite(costPerHour) &&
    costPerHour > 0;

  // Motor adaptativo de recomendaciones basado en la topología real descubierta en Kubernetes
  // Complejidad: O(W) tiempo y O(W) espacio sobre los workloads descubiertos.
  const getArchitectureRecommendations = (): ArchitectureRecommendation[] => {
    const observabilityNames = /^(prometheus|grafana|jaeger|zipkin|otel|kiali|loki)$/i;
    const candidates = workloads.filter((w) => !observabilityNames.test(w.name));
    const list: ArchitectureRecommendation[] = [];

    for (const w of candidates) {
      const lower = w.name.toLowerCase();
      const labelStr = Object.entries(w.labels ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      const halfReplicas = Math.max(1, Math.floor(w.replicas / 2));

      // 1. Perímetro / Gateway / Proxy / Ingress
      if (/(gateway|ingress|proxy|nginx|envoy|router|edge|bff)/.test(lower)) {
        list.push({
          id: `rec-gw-${w.name}`,
          targetName: w.name,
          failureType: 'network-loss',
          duration: 30,
          affectedReplicas: halfReplicas,
          title: `Pérdida de Paquetes en Perímetro (${w.name})`,
          architecturalReason: `${w.kind} de entrada con ${w.replicas} réplica(s) [${labelStr || 'app=' + w.name}]. Comprueba si la pérdida parcial de paquetes satura los reintentos TCP entre el cliente y los servicios internos.`,
          expectedRisk: 'Respuestas 502/504 en cascada si no hay circuit-breaking ni timeouts cortos.',
          tag: 'Perímetro & Red',
        });
        continue;
      }

      // 2. Flujo Transaccional / Pagos / Pedidos / Checkout
      if (/(order|pay|checkout|billing|invoice|transaction|purchase|booking)/.test(lower)) {
        list.push({
          id: `rec-tx-${w.name}`,
          targetName: w.name,
          failureType: 'network-delay',
          duration: 30,
          affectedReplicas: w.replicas,
          title: `Latencia Crítica en Flujo Transaccional (${w.name})`,
          architecturalReason: `${w.kind} transaccional con ${w.replicas} réplica(s). Inyectar latencia en el 100% de sus pods mide la tolerancia de timeouts río arriba y la tasa real de abandono de compra.`,
          expectedRisk: 'Abandono acelerado de sesiones de pago (>20% pérdida de conversión).',
          tag: 'Financiero & SLA',
        });
        continue;
      }

      // 3. Estado de Sesión / Carrito / Autenticación
      if (/(cart|session|auth|login|token|basket|user)/.test(lower)) {
        list.push({
          id: `rec-session-${w.name}`,
          targetName: w.name,
          failureType: 'pod-kill',
          duration: 30,
          affectedReplicas: halfReplicas,
          title: `Reconvergencia de Balanceador en Servicio de Sesión (${w.name})`,
          architecturalReason: `${w.kind} con ${w.replicas} réplica(s) activas. Matar ${halfReplicas}/${w.replicas} pod(s) evalúa cuántos segundos tarda kube-proxy en drenar conexiones sin perder sesiones en vuelo.`,
          expectedRisk: 'Peticiones 502 durante la ventana de reconvergencia (~5s) o pérdida de estado.',
          tag: 'Alta Disponibilidad',
        });
        continue;
      }

      // 4. Punto Único de Falla (SPOF): cualquier workload con 1 sola réplica (bases de datos o servicios sin redundancia)
      if (w.replicas === 1) {
        const isDb = /(postgres|mongo|mysql|mariadb|redis|elastic|opensearch|db|database|cache|kafka|rabbit)/.test(lower);
        list.push({
          id: `rec-spof-${w.name}`,
          targetName: w.name,
          failureType: isDb ? 'network-delay' : 'pod-kill',
          duration: 30,
          affectedReplicas: 1,
          title: isDb
            ? `Degradación de Dependencia de Datos SPOF (${w.name})`
            : `Punto Único de Falla Sin Redundancia (${w.name})`,
          architecturalReason: `${w.kind} detectado con solo 1 réplica (0% redundancia). ${
            isDb
              ? 'Al ser instancia única de datos, una latencia de red impacta a todos los microservicios dependientes.'
              : 'Terminar su único pod causará caída total hasta que Kubernetes reprograme el contenedor.'
          }`,
          expectedRisk: 'Interrupción del 100% del componente por falta de réplicas de respaldo.',
          tag: 'SPOF (1 Réplica)',
        });
        continue;
      }

      // 5. Servicios de Lectura / Catálogo / Búsqueda / Contenido o cualquier otro multi-réplica genérico
      if (/(catalog|search|product|inventory|feed|review|wishlist|content)/.test(lower)) {
        list.push({
          id: `rec-stress-${w.name}`,
          targetName: w.name,
          failureType: 'resource-stress',
          duration: 30,
          affectedReplicas: halfReplicas,
          title: `Saturación de CPU/Memoria en Servicio de Lectura (${w.name})`,
          architecturalReason: `${w.kind} con ${w.replicas} réplicas. Someter ${halfReplicas} pod(s) a estrés de CPU/RAM valida si el balanceador reparte la carga sin degradar el percentil P95 global.`,
          expectedRisk: 'Throttling de CPU y aumento del tiempo de respuesta P95.',
          tag: 'Capacidad & Tráfico',
        });
        continue;
      }

      // 6. Regla genérica adaptativa para cualquier otro workload arbitrario del cluster
      list.push({
        id: `rec-generic-${w.name}`,
        targetName: w.name,
        failureType: w.replicas >= 2 ? 'pod-kill' : 'network-delay',
        duration: 30,
        affectedReplicas: halfReplicas,
        title: `Prueba de Resiliencia de Réplicas (${w.name})`,
        architecturalReason: `${w.kind} descubierto en el namespace "${w.namespace}" con ${w.replicas} réplica(s) listas [${labelStr || 'sin labels'}]. Evalúa la tolerancia a fallos y el tiempo de recuperación automática.`,
        expectedRisk: `Degradación parcial (${Math.round((halfReplicas / w.replicas) * 100)}% blast radius) durante el reemplazo de pods.`,
        tag: `${w.kind} (${w.replicas} pods)`,
      });
    }

    return list.slice(0, 6);
  };

  const applyRecommendation = (rec: ArchitectureRecommendation) => {
    setSelectedWorkload(rec.targetName);
    setFailureType(rec.failureType);
    setDuration(rec.duration);
    setAffectedReplicas(rec.affectedReplicas);
    setDefinition(null);
    setOutageConfirmed(false);

    // Scroll hacia el formulario
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const executeValidation = async () => {
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
        cost_per_hour: costPerHour,
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

  const handleValidate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!target || !isValid) return;

    if (isFullOutage && !outageConfirmed) {
      setShowOutageWarningModal(true);
      return;
    }

    await executeValidation();
  };

  const handleConfirmOutageAndValidate = async () => {
    setOutageConfirmed(true);
    setShowOutageWarningModal(false);
    await executeValidation();
  };

  const handleCancelOutage = () => {
    setShowOutageWarningModal(false);
  };

  const handleReduceReplicasToSafe = () => {
    if (target && target.replicas > 1) {
      setAffectedReplicas(Math.max(1, Math.floor(target.replicas / 2)));
    }
    setOutageConfirmed(false);
    setShowOutageWarningModal(false);
    setDefinition(null);
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

  const archRecs = getArchitectureRecommendations();

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">
      {/* TÍTULO PRINCIPAL */}
      <div>
        <p className="text-xs font-mono text-red-400 mb-2">
          CHAOS ENGINEERING / EXPERIMENTS
        </p>

        <h1 className="text-3xl font-extrabold text-white">
          Experimentos de Resiliencia
        </h1>

        <p className="text-slate-400 mt-2 text-sm max-w-2xl">
          Configura y ejecuta fallas controladas con telemetría en tiempo real,
          análisis de reconvergencia en Kubernetes y cálculo económico empírico.
        </p>
      </div>

      {/* SECCIÓN NUEVA: RECOMENDACIONES DE FALLAS SEGÚN LA ARQUITECTURA DETECTADA */}
      {archRecs.length > 0 && (
        <section className="rounded-2xl border border-rose-900/40 bg-gradient-to-b from-[#1c1417] to-[#161618] p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-800/60 text-rose-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Fallas Recomendadas para tu Arquitectura
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#2b2b2b] text-slate-300 font-normal">
                    {namespace}
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  Basado en la topología de microservicios descubierta, réplicas activas y dependencias de base de datos.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {archRecs.map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-[#333333] bg-[#1a1a1c] p-4 flex flex-col justify-between space-y-3 hover:border-rose-700/60 transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/50 text-rose-300">
                      {rec.tag}
                    </span>
                    <span className="text-xs font-mono text-slate-400 uppercase">
                      {rec.failureType}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white group-hover:text-rose-300 transition-colors">
                    {rec.title}
                  </h3>

                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {rec.architecturalReason}
                  </p>

                  <p className="text-[11px] text-amber-400/90 mt-2 font-medium">
                    ⚠️ {rec.expectedRisk}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#2a2a2a]">
                  <span className="text-[11px] font-mono text-slate-400">
                    {rec.affectedReplicas} pod(s) · {rec.duration}s
                  </span>

                  <button
                    type="button"
                    onClick={() => applyRecommendation(rec)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-xs font-bold text-white transition-colors cursor-pointer shadow-md"
                  >
                    <span>Configurar este experimento</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FORMULARIO Y RESUMEN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleValidate}
          className="lg:col-span-2 rounded-xl border border-[#333333] bg-[#1e1e1e] p-6 space-y-6"
        >
          <div className="flex items-center gap-3">
            <FlaskConical className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-semibold text-white">Parámetros del Experimento</h2>
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
                  setOutageConfirmed(false);
                }}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
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
                  setOutageConfirmed(false);
                }}
                disabled={loadingWorkloads}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
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
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
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
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
              />
            </label>

            <label className="block space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Réplicas afectadas</span>
                {isFullOutage && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-950/80 border border-rose-700/60 text-rose-300">
                    100% de pods
                  </span>
                )}
              </div>

              <input
                type="number"
                min={1}
                max={target ? target.replicas : 1}
                step={1}
                value={affectedReplicas}
                onChange={(event) => {
                  const val = Number(event.target.value);
                  setAffectedReplicas(val);
                  setDefinition(null);
                  if (target && val < target.replicas) {
                    setOutageConfirmed(false);
                  }
                }}
                className={`w-full bg-[#121212] border rounded-lg p-3 text-white focus:outline-none ${
                  isFullOutage
                    ? 'border-rose-500 ring-1 ring-rose-500/50'
                    : 'border-[#3a3a3a] focus:border-red-500'
                }`}
              />
              <p className="text-[11px] text-slate-400">
                {target ? `Total disponible: ${target.replicas} pods.` : 'Selecciona un deployment.'}
              </p>
            </label>

            <label className="block space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Costo por hora ($ USD)</span>
                <span className="text-xs text-slate-500">Benchmark comercial</span>
              </div>

              <input
                type="number"
                min={1}
                step={50}
                value={costPerHour}
                onChange={(event) => {
                  setCostPerHour(Number(event.target.value));
                  setDefinition(null);
                }}
                className="w-full bg-[#121212] border border-[#3a3a3a] rounded-lg p-3 text-white focus:border-red-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400">
                Pérdida por hora si este servicio se interrumpe (ventas u operación).
              </p>
            </label>
          </div>

          <div className="rounded-lg bg-[#151515] border border-[#333333] p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-300">Blast radius</span>

              <div className="flex items-center gap-2">
                {isFullOutage && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-rose-950/80 border border-rose-700/60 text-rose-300 animate-pulse">
                    <Flame className="w-3 h-3 text-rose-400" />
                    CAÍDA TOTAL (OUTAGE)
                  </span>
                )}
                <span
                  className={`font-mono font-bold ${
                    blastRadius >= 100
                      ? 'text-rose-400'
                      : blastRadius > 50
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {blastRadius.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="h-2.5 bg-[#333333] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  blastRadius >= 100
                    ? 'bg-rose-500'
                    : blastRadius > 50
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(blastRadius, 100)}%` }}
              />
            </div>

            <p className="text-xs text-slate-400 mt-3">
              {blastRadius >= 100 ? (
                <span className="text-rose-400 font-medium">
                  ⚠️ Afectación del 100%: Matará todos los pods. El servicio quedará completamente caído hasta su reconstrucción.
                </span>
              ) : blastRadius > 50 ? (
                <span className="text-amber-400 font-medium">
                  Afectación alta (&gt; 50% de réplicas): Degradación severa de capacidad de tráfico.
                </span>
              ) : (
                <span className="text-emerald-400/90">
                  Redundancia preservada (&le; 50% de réplicas): Los pods restantes absorberán el balanceo.
                </span>
              )}
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
            className="w-full flex justify-center items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-3 transition-colors cursor-pointer shadow-lg shadow-red-950/40"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}

            {loading ? 'Validando...' : 'Validar experimento'}
          </button>
        </form>

        <aside className="rounded-xl border border-[#333333] bg-[#1e1e1e] p-6 h-fit space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Resumen</h2>
            <p className="text-xs text-slate-400">
              Blast radius configurado: {blastRadius.toFixed(1)}%
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <p className="text-slate-400">Objetivo</p>
              <p className="font-mono text-white mt-1">
                {target?.name ?? 'Sin seleccionar'}
              </p>
            </div>

            <div>
              <p className="text-slate-400">Tipo de fallo</p>
              <p className="text-white mt-1 capitalize">{failureType}</p>
            </div>

            <div>
              <p className="text-slate-400">Duración</p>
              <p className="text-white mt-1">{duration} segundos</p>
            </div>

            <div>
              <p className="text-slate-400">Blast radius</p>
              <p
                className={`font-semibold mt-1 ${
                  blastRadius >= 100
                    ? 'text-rose-400'
                    : blastRadius > 50
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {blastRadius.toFixed(1)}% ({affectedReplicas} de {target?.replicas ?? 0} pods)
              </p>
            </div>

            <div>
              <p className="text-slate-400">Benchmark financiero</p>
              <p className="text-white mt-1 font-mono">${costPerHour.toLocaleString()} USD/h</p>
            </div>
          </div>

          <div className="border-t border-[#333333] pt-5">
            {definition ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                  <CheckCircle2 className="w-5 h-5" />
                  Definición validada
                </div>

                <p className="text-sm text-slate-300 leading-relaxed bg-[#141414] p-3 rounded-lg border border-[#2a2a2a]">
                  {definition.hypothesis}
                </p>

                <button
                  type="button"
                  onClick={() => void handleRunExperiment()}
                  disabled={executing || activeRun !== null}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-semibold text-white transition-colors cursor-pointer shadow-lg shadow-emerald-950/40"
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
              </div>
            ) : (
              <div className="flex gap-2 text-amber-400 text-sm bg-amber-950/20 border border-amber-900/40 p-3 rounded-lg">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  El experimento debe validarse antes de ejecutarse.
                </span>
              </div>
            )}

            {activeRun && (
              <div className="mt-4 rounded-lg border border-blue-800/50 bg-blue-950/20 p-4">
                <p className="text-sm font-semibold text-blue-300">
                  Solicitud de ejecución aceptada
                </p>

                <p className="text-xs text-slate-400 mt-2">ID de ejecución:</p>
                <p className="text-xs font-mono text-white break-all mt-1">{activeRun.id}</p>

                <p className="text-xs text-slate-400 mt-3">Estado inicial: {activeRun.status}</p>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRun(null);
                    setDefinition(null);
                  }}
                  className="mt-3 w-full rounded-md border border-slate-700 bg-slate-800/80 hover:bg-slate-700 py-1.5 px-3 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
                >
                  + Configurar otro experimento
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* MODAL DE ADVERTENCIA PARA CAÍDA DEL 100% */}
      {showOutageWarningModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outage-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl border border-rose-800/80 bg-[#161618] p-6 text-white shadow-2xl shadow-rose-950/60 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400 shrink-0">
                  <Flame className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
                    PELIGRO DE DISPONIBILIDAD
                  </span>
                  <h3
                    id="outage-dialog-title"
                    className="text-lg font-bold text-white leading-tight"
                  >
                    Caída Total del Servicio (100% Outage)
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelOutage}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60 transition-colors cursor-pointer"
                aria-label="Cerrar advertencia"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl bg-rose-950/30 border border-rose-900/50 p-4 text-sm text-rose-200 space-y-2">
              <p className="font-semibold text-rose-300">
                Vas a terminar el 100% de los pods ({affectedReplicas} de {target?.replicas ?? 0} réplicas) en el servicio <span className="font-mono underline">{target?.name}</span>.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-rose-200/90">
                <li>
                  <strong>Outage completo garantizado:</strong> No habrá pods listos para responder solicitudes. Los usuarios recibirán errores 502/503 o timeouts.
                </li>
                <li>
                  <strong>Pérdida de peticiones y ventas:</strong> Todas las transacciones en vuelo en esta ventana serán rechazadas.
                </li>
                <li>
                  <strong>Impacto económico real:</strong> Se aplicará una penalización de indisponibilidad total al 100% sobre ${costPerHour.toLocaleString()} USD/h.
                </li>
              </ul>
            </div>

            <p className="text-xs text-slate-400">
              ¿Deseas confirmar la destrucción del 100% del servicio o prefieres reducir el impacto para mantener redundancia?
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleReduceReplicasToSafe}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
              >
                Reducir réplicas (Seguro)
              </button>

              <button
                type="button"
                onClick={handleConfirmOutageAndValidate}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors cursor-pointer shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2"
              >
                <Flame className="w-4 h-4" />
                Confirmar y proceder con 100%
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
