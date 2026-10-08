from app.core.errors import ResourceNotFoundError  # noqa: F401  (re-exported for callers)
from app.integrations.kubernetes import K8sClients, translate_k8s_errors
from app.modules.discovery.schemas import (
    NamespaceInfo,
    ServiceInfo,
    ServicePortInfo,
    WorkloadInfo,
)

# Design decision: hidden by default, because Hypo should not suggest
# running chaos against cluster infrastructure.
SYSTEM_NAMESPACES = frozenset(
    {"kube-system", "kube-public", "kube-node-lease", "local-path-storage", "chaos-mesh"}
)


def list_namespaces(clients: K8sClients, include_system: bool = False) -> list[NamespaceInfo]:
    with translate_k8s_errors():
        items = clients.core_v1.list_namespace().items
    result = [
        NamespaceInfo(name=ns.metadata.name, phase=ns.status.phase)
        for ns in items
        if include_system or ns.metadata.name not in SYSTEM_NAMESPACES
    ]
    return sorted(result, key=lambda n: n.name)


def _ensure_namespace(clients: K8sClients, namespace: str) -> None:
    # list_namespaced_* returns an empty list for a missing namespace instead of
    # a 404, so we check explicitly (read_namespace raises ApiException 404).
    with translate_k8s_errors():
        clients.core_v1.read_namespace(namespace)


def list_services(clients: K8sClients, namespace: str) -> list[ServiceInfo]:
    _ensure_namespace(clients, namespace)
    with translate_k8s_errors():
        items = clients.core_v1.list_namespaced_service(namespace).items
    result = [
        ServiceInfo(
            name=svc.metadata.name,
            namespace=namespace,
            type=svc.spec.type,
            cluster_ip=svc.spec.cluster_ip,
            selector=svc.spec.selector or {},
            ports=[
                ServicePortInfo(
                    name=p.name,
                    port=p.port,
                    target_port=None if p.target_port is None else str(p.target_port),
                    protocol=p.protocol or "TCP",
                )
                for p in (svc.spec.ports or [])
            ],
        )
        for svc in items
    ]
    return sorted(result, key=lambda s: s.name)


def _to_workload(obj, namespace: str, kind: str) -> WorkloadInfo:
    return WorkloadInfo(
        name=obj.metadata.name,
        namespace=namespace,
        kind=kind,
        replicas_desired=obj.spec.replicas if obj.spec.replicas is not None else 1,
        replicas_ready=obj.status.ready_replicas or 0,  # None when no pod is ready
        labels=obj.metadata.labels or {},
    )


def list_workloads(clients: K8sClients, namespace: str) -> list[WorkloadInfo]:
    _ensure_namespace(clients, namespace)
    with translate_k8s_errors():
        deployments = clients.apps_v1.list_namespaced_deployment(namespace).items
        statefulsets = clients.apps_v1.list_namespaced_stateful_set(namespace).items
    result = [_to_workload(d, namespace, "Deployment") for d in deployments]
    result += [_to_workload(s, namespace, "StatefulSet") for s in statefulsets]
    return sorted(result, key=lambda w: (w.kind, w.name))
