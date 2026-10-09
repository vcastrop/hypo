"""Discovery endpoints – exposes Kubernetes service-discovery to the frontend."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.integrations.kubernetes import K8sClients, get_k8s_clients
from app.core.errors import (
    ClusterAccessDeniedError,
    ClusterError,
    ClusterUnreachableError,
    ResourceNotFoundError,
)
from app.modules.discovery import service
from app.modules.discovery.schemas import NamespaceInfo, ServiceInfo, WorkloadInfo

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/discovery", tags=["discovery"])


# ── helpers ─────────────────────────────────────────────────────────


def _handle_cluster_error(exc: ClusterError) -> HTTPException:
    """Map domain exceptions to HTTP status codes."""
    if isinstance(exc, ClusterUnreachableError):
        return HTTPException(status_code=503, detail=str(exc))
    if isinstance(exc, ClusterAccessDeniedError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, ResourceNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    return HTTPException(status_code=502, detail=str(exc))


# ── endpoints ───────────────────────────────────────────────────────


@router.get(
    "/namespaces",
    response_model=list[NamespaceInfo],
    summary="List namespaces visible to Hypo",
)
def list_namespaces(
    include_system: bool = Query(False, description="Include kube-system and similar namespaces"),
    clients: K8sClients = Depends(get_k8s_clients),
) -> list[NamespaceInfo]:
    """Return active Kubernetes namespaces.

    System namespaces (kube-system, chaos-mesh, …) are hidden by default
    because Hypo should not suggest chaos experiments against cluster
    infrastructure.
    """
    try:
        return service.list_namespaces(clients, include_system=include_system)
    except ClusterError as exc:
        raise _handle_cluster_error(exc) from exc


@router.get(
    "/namespaces/{namespace}/services",
    response_model=list[ServiceInfo],
    summary="List Kubernetes services in a namespace",
)
def list_services(
    namespace: str,
    clients: K8sClients = Depends(get_k8s_clients),
) -> list[ServiceInfo]:
    """Return services discovered inside *namespace* with port and selector
    metadata useful for experiment targeting.
    """
    try:
        return service.list_services(clients, namespace)
    except ClusterError as exc:
        raise _handle_cluster_error(exc) from exc


@router.get(
    "/namespaces/{namespace}/workloads",
    response_model=list[WorkloadInfo],
    summary="List workloads (Deployments and StatefulSets) in a namespace",
)
def list_workloads(
    namespace: str,
    clients: K8sClients = Depends(get_k8s_clients),
) -> list[WorkloadInfo]:
    """Return Deployments and StatefulSets with replica counts so the
    frontend can show readiness status and help users pick experiment targets.
    """
    try:
        return service.list_workloads(clients, namespace)
    except ClusterError as exc:
        raise _handle_cluster_error(exc) from exc
