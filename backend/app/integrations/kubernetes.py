import logging
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache

import urllib3
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException
from kubernetes.config.config_exception import ConfigException

from app.core.config import Settings, get_settings
from app.core.errors import (
    ClusterAccessDeniedError,
    ClusterError,
    ClusterUnreachableError,
    ResourceNotFoundError,
)

logger = logging.getLogger(__name__)


class KubernetesConnectionError(ClusterUnreachableError):
    """Raised when no valid Kubernetes configuration can be loaded."""


@dataclass(frozen=True)
class K8sClients:
    core_v1: client.CoreV1Api  # namespaces, services, pods
    apps_v1: client.AppsV1Api  # deployments, statefulsets


def _load_config(settings: Settings) -> None:
    def from_kubeconfig() -> None:
        config.load_kube_config(
            config_file=settings.kubeconfig_path,
            context=settings.k8s_context,
        )

    try:
        if settings.k8s_mode == "incluster":
            config.load_incluster_config()
        elif settings.k8s_mode == "kubeconfig":
            from_kubeconfig()
        else:  # auto
            try:
                config.load_incluster_config()
            except ConfigException:
                from_kubeconfig()
    except (ConfigException, OSError) as exc:
        raise KubernetesConnectionError(
            f"Could not load Kubernetes configuration (mode={settings.k8s_mode})"
        ) from exc


@lru_cache  # exceptions are not cached, so a later call can retry
def _build_clients() -> K8sClients:
    settings = get_settings()
    _load_config(settings)
    logger.debug("Kubernetes configuration loaded (mode=%s)", settings.k8s_mode)
    return K8sClients(core_v1=client.CoreV1Api(), apps_v1=client.AppsV1Api())


def get_k8s_clients() -> K8sClients:
    """FastAPI dependency. Lazy: nothing is loaded at import or app startup."""
    return _build_clients()


@contextmanager
def translate_k8s_errors() -> Iterator[None]:
    """Convert kubernetes/network exceptions into app.core.errors types."""
    try:
        yield
    except ApiException as exc:
        if exc.status in (401, 403):
            raise ClusterAccessDeniedError(exc.reason or "access denied") from exc
        if exc.status == 404:
            raise ResourceNotFoundError(exc.reason or "not found") from exc
        raise ClusterError(f"Kubernetes API error {exc.status}: {exc.reason}") from exc
    except (urllib3.exceptions.HTTPError, OSError) as exc:
        raise ClusterUnreachableError("Kubernetes API is unreachable") from exc
