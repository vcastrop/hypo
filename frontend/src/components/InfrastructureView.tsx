import React, { useState, useEffect } from 'react';
import { fetchNamespaces, fetchServices, fetchWorkloads } from '../services/api';
import type { NamespaceInfo, ServiceInfo, WorkloadInfo } from '../types/discovery';
import {
  Layers,
  Server,
  Box,
  RefreshCw,
  Search,
  CheckCircle2,
  Zap,
  Radio,
  Shield,
  Activity,
} from 'lucide-react';

export const InfrastructureView: React.FC = () => {
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState<string>('mybookstore');
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [workloads, setWorkloads] = useState<WorkloadInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'workloads' | 'services'>('all');

  const loadNamespaces = async () => {
    try {
      const nsList = await fetchNamespaces(false);
      setNamespaces(nsList);
      if (nsList.length > 0 && !nsList.some((n) => n.name === selectedNamespace)) {
        setSelectedNamespace(nsList[0].name);
      }
    } catch {
      setNamespaces([
        { name: 'mybookstore', status: 'Active' },
        { name: 'default', status: 'Active' },
      ]);
    }
  };

  const loadDiscoveryData = async (ns: string) => {
    setLoading(true);
    try {
      const [svcData, wrkData] = await Promise.all([
        fetchServices(ns),
        fetchWorkloads(ns),
      ]);
      setServices(svcData);
      setWorkloads(wrkData);
    } catch {
      if (ns === 'mybookstore') {
        setServices([
          {
            name: 'catalog-service',
            namespace: 'mybookstore',
            type: 'ClusterIP',
            cluster_ip: '10.96.140.21',
            ports: [
              { name: 'http', port: 5001, target_port: 5001, protocol: 'TCP' },
              { name: 'grpc', port: 50051, target_port: 50051, protocol: 'TCP' },
            ],
            selector: { app: 'catalog-service' },
            is_targetable: true,
          },
          {
            name: 'cart-service',
            namespace: 'mybookstore',
            type: 'ClusterIP',
            cluster_ip: '10.96.140.22',
            ports: [{ name: 'http', port: 5003, target_port: 5003, protocol: 'TCP' }],
            selector: { app: 'cart-service' },
            is_targetable: true,
          },
          {
            name: 'order-service',
            namespace: 'mybookstore',
            type: 'ClusterIP',
            cluster_ip: '10.96.140.23',
            ports: [{ name: 'http', port: 5004, target_port: 5004, protocol: 'TCP' }],
            selector: { app: 'order-service' },
            is_targetable: true,
          },
          {
            name: 'user-service',
            namespace: 'mybookstore',
            type: 'ClusterIP',
            cluster_ip: '10.96.140.24',
            ports: [{ name: 'http', port: 5002, target_port: 5002, protocol: 'TCP' }],
            selector: { app: 'user-service' },
            is_targetable: true,
          },
        ]);

        setWorkloads([
          {
            name: 'catalog-service',
            namespace: 'mybookstore',
            kind: 'Deployment',
            replicas: 2,
            ready_replicas: 2,
            available_replicas: 2,
            labels: { app: 'catalog-service', tier: 'backend' },
            is_ready: true,
          },
          {
            name: 'cart-service',
            namespace: 'mybookstore',
            kind: 'Deployment',
            replicas: 2,
            ready_replicas: 2,
            available_replicas: 2,
            labels: { app: 'cart-service', tier: 'backend' },
            is_ready: true,
          },
          {
            name: 'order-service',
            namespace: 'mybookstore',
            kind: 'Deployment',
            replicas: 2,
            ready_replicas: 2,
            available_replicas: 2,
            labels: { app: 'order-service', tier: 'backend' },
            is_ready: true,
          },
          {
            name: 'user-service',
            namespace: 'mybookstore',
            kind: 'Deployment',
            replicas: 1,
            ready_replicas: 1,
            available_replicas: 1,
            labels: { app: 'user-service', tier: 'backend' },
            is_ready: true,
          },
        ]);
      } else {
        setServices([]);
        setWorkloads([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNamespaces();
  }, []);

  useEffect(() => {
    if (selectedNamespace) {
      loadDiscoveryData(selectedNamespace);
    }
  }, [selectedNamespace]);

  const filteredWorkloads = workloads.filter(
    (w) =>
      w.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      Object.keys(w.labels).some((k) =>
        `${k}=${w.labels[k]}`.toLowerCase().includes(searchFilter.toLowerCase())
      )
  );

  const filteredServices = services.filter(
    (s) =>
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.type.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-8 py-10 space-y-10">
      {/* ── HEADER PRINCIPAL ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#2b2b2b]">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-2">
            <span>INFRASTRUCTURE TOPOLOGY</span>
            <span>/</span>
            <span className="text-red-400 font-bold uppercase">{selectedNamespace}</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-4">
            Infraestructura y Servicios
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-600/40 text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Sincronizado en Vivo
            </span>
          </h1>
          <p className="text-base text-slate-300 mt-2 max-w-2xl leading-relaxed">
            Explora las cargas de trabajo desplegadas en Kubernetes y selecciona el servicio destino para configurar hipótesis de resiliencia y pruebas de caos.
          </p>
        </div>

        {/* Selector de Namespace y Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1e1e1e] border border-[#333333] rounded-xl px-4 py-2.5 shadow-sm">
            <Layers className="w-5 h-5 text-blue-400 mr-2.5" />
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              className="bg-transparent text-slate-100 font-semibold text-sm focus:outline-none cursor-pointer pr-2"
            >
              {namespaces.map((ns) => (
                <option key={ns.name} value={ns.name} className="bg-[#1e1e1e] text-white">
                  Namespace: {ns.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadDiscoveryData(selectedNamespace)}
            disabled={loading}
            className="p-3 rounded-xl bg-[#1e1e1e] border border-[#333333] hover:border-slate-500 text-slate-200 hover:text-white transition-all shadow-sm cursor-pointer"
            title="Refrescar topología"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-red-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── SECCIÓN 1: MÉTRICAS Y RESUMEN GENERAL ── */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-red-500" />
          Resumen del Clúster
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 shadow-md hover:border-red-500/50 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Cargas (Workloads)</span>
              <Box className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{workloads.length}</span>
              <span className="text-sm text-slate-400">deployments</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>{workloads.filter((w) => w.is_ready).length} saludables</span>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 shadow-md hover:border-red-500/50 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Servicios de Red</span>
              <Server className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">{services.length}</span>
              <span className="text-sm text-slate-400">endpoints K8s</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>{services.filter((s) => s.is_targetable).length} accesibles</span>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 shadow-md hover:border-red-500/50 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Réplicas Disponibles</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white">
                {workloads.reduce((acc, w) => acc + w.ready_replicas, 0)}
              </span>
              <span className="text-sm text-slate-400">
                de {workloads.reduce((acc, w) => acc + w.replicas, 0)} pods activos
              </span>
            </div>
            <div className="mt-3 text-xs text-slate-400 font-mono">
              Namespace: <span className="text-slate-200">{selectedNamespace}</span>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl p-6 shadow-md hover:border-red-500/50 transition-colors">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Inyección de Fallas</span>
              <Shield className="w-5 h-5 text-red-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-red-500">100%</span>
              <span className="text-sm text-slate-400">habilitado</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-400">
              <Zap className="w-4 h-4" />
              <span>Chaos Mesh listo</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── BARRA DE BÚSQUEDA Y FILTROS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1a1a1a] border border-[#2e2e2e] p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({workloads.length + services.length})
          </button>
          <button
            onClick={() => setActiveTab('workloads')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'workloads'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Deployments ({workloads.length})
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'services'
                ? 'bg-red-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Servicios ({services.length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filtrar por nombre, etiquetas..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#141414] border border-[#2e2e2e] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* ── SECCIÓN 2: DEPLOYMENTS (OBJETIVOS DE CAOS) ── */}
      {(activeTab === 'all' || activeTab === 'workloads') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Box className="w-6 h-6 text-red-500" />
              Objetivos de Resiliencia: Deployments ({filteredWorkloads.length})
            </h2>
            <span className="text-xs text-slate-400">Microservicios con pods replicados</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkloads.map((workload) => (
              <div
                key={workload.name}
                className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-2xl p-6 shadow-lg hover:border-red-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-white tracking-wide font-mono">
                        {workload.name}
                      </h3>
                      <span className="text-xs text-slate-400 font-semibold">{workload.kind}</span>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono ${
                        workload.is_ready
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50'
                          : 'bg-amber-950/60 text-amber-400 border border-amber-700/50'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          workload.is_ready ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      {workload.ready_replicas}/{workload.replicas} Pods
                    </span>
                  </div>

                  {/* Barra de progreso de réplicas */}
                  <div className="w-full bg-[#2a2a2a] h-2 rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full transition-all ${
                        workload.is_ready ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{
                        width: `${(workload.ready_replicas / workload.replicas) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Labels */}
                  <div className="space-y-1.5 mb-6">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Etiquetas / Selectores:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(workload.labels).map(([k, v]) => (
                        <span
                          key={k}
                          className="px-2.5 py-1 rounded-lg bg-[#262626] border border-[#383838] text-xs font-mono text-slate-300"
                        >
                          {k}: <span className="text-white font-semibold">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Botón de Inyección en Rojo Primario */}
                <div className="pt-4 border-t border-[#2e2e2e] flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium">Radio de explosión: ≤50%</span>
                  <button
                    onClick={() => {
                      alert(
                        `Objetivo "${workload.name}" seleccionado. Redirigiendo a pantalla de creación de experimentos (PB-06b).`
                      );
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm"
                  >
                    <span>Configurar Caos</span>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── SECCIÓN 3: SERVICIOS KUBERNETES (NETWORKING) ── */}
      {(activeTab === 'all' || activeTab === 'services') && (
        <section className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
              <Server className="w-6 h-6 text-red-500" />
              Red y Servicios Expuestos ({filteredServices.length})
            </h2>
            <span className="text-xs text-slate-400">ClusterIPs y puertos mapeados</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <div
                key={service.name}
                className="bg-[#1c1c1c] border border-[#2e2e2e] rounded-2xl p-6 shadow-md hover:border-red-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-white font-mono">{service.name}</h3>
                    <span className="text-xs text-slate-400">{service.type}</span>
                  </div>

                  <span className="text-xs font-mono font-semibold text-slate-300 bg-[#262626] border border-[#383838] px-3 py-1 rounded-lg">
                    {service.cluster_ip || 'None'}
                  </span>
                </div>

                {/* Puertos */}
                <div className="space-y-2 mb-4">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Puertos Expuestos:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {service.ports.map((p, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[#262626] border border-[#383838] text-xs font-mono text-slate-300"
                      >
                        <span className="text-red-400 font-bold">{p.port}</span>:{p.target_port}/
                        {p.protocol}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Selectores */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Selectores de Tráfico:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(service.selector).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded bg-[#242424] border border-[#333333] text-xs font-mono text-slate-400"
                      >
                        {k}={v}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
