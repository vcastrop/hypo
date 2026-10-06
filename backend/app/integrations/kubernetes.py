import logging
from dataclasses import dataclass
from functools import lru_cache

from kubernetes import client, config
from kubernetes.config.config_exception import ConfigException

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class KubernetesConnectionError(RuntimeError):
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
