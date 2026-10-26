"""Chaos Mesh integration client for Kubernetes custom resources."""

import logging
from typing import Any

from kubernetes import client
from kubernetes.client.exceptions import ApiException

from app.core.errors import ClusterError
from app.integrations.kubernetes import K8sClients, get_k8s_clients, translate_k8s_errors

logger = logging.getLogger(__name__)

CHAOS_GROUP = "chaos-mesh.org"
CHAOS_VERSION = "v1alpha1"

KIND_TO_PLURAL = {
    "PodChaos": "podchaos",
    "StressChaos": "stresschaos",
    "NetworkChaos": "networkchaos",
}


class ChaosMeshClient:
    def __init__(self, custom_objects: client.CustomObjectsApi | None = None) -> None:
        self.custom_objects = custom_objects

    def apply_experiment(self, manifest: dict[str, Any]) -> dict[str, Any]:
        """Apply a Chaos Mesh custom resource (PodChaos, StressChaos, NetworkChaos).

        If the resource already exists, replaces it.
        """
        if self.custom_objects is None:
            raise ClusterError("Kubernetes CustomObjectsApi is not configured")

        kind = manifest.get("kind", "")
        plural = KIND_TO_PLURAL.get(kind)
        if not plural:
            raise ValueError(f"Unsupported Chaos Mesh resource kind: '{kind}'")

        metadata = manifest.get("metadata", {})
        namespace = metadata.get("namespace", "default")
        name = metadata.get("name")
        if not name:
            raise ValueError("Manifest metadata must include a 'name'")

        with translate_k8s_errors():
            try:
                result = self.custom_objects.create_namespaced_custom_object(
                    group=CHAOS_GROUP,
                    version=CHAOS_VERSION,
                    namespace=namespace,
                    plural=plural,
                    body=manifest,
                )
                logger.info("Created chaos resource %s/%s (%s)", namespace, name, kind)
                return result
            except ApiException as exc:
                if exc.status == 409:
                    logger.info("Chaos resource %s/%s already exists; replacing", namespace, name)
                    existing = self.custom_objects.get_namespaced_custom_object(
                        group=CHAOS_GROUP,
                        version=CHAOS_VERSION,
                        namespace=namespace,
                        plural=plural,
                        name=name,
                    )
                    resource_version = existing.get("metadata", {}).get("resourceVersion")
                    if resource_version:
                        manifest["metadata"]["resourceVersion"] = resource_version
                    return self.custom_objects.replace_namespaced_custom_object(
                        group=CHAOS_GROUP,
                        version=CHAOS_VERSION,
                        namespace=namespace,
                        plural=plural,
                        name=name,
                        body=manifest,
                    )
                raise

    def delete_experiment(self, kind: str, namespace: str, name: str) -> None:
        """Delete an active Chaos Mesh custom resource.

        Idempotent: if the resource does not exist (404), succeeds silently.
        """
        if self.custom_objects is None:
            raise ClusterError("Kubernetes CustomObjectsApi is not configured")

        plural = KIND_TO_PLURAL.get(kind)
        if not plural:
            raise ValueError(f"Unsupported Chaos Mesh resource kind: '{kind}'")

        with translate_k8s_errors():
            try:
                self.custom_objects.delete_namespaced_custom_object(
                    group=CHAOS_GROUP,
                    version=CHAOS_VERSION,
                    namespace=namespace,
                    plural=plural,
                    name=name,
                )
                logger.info("Deleted chaos resource %s/%s (%s)", namespace, name, kind)
            except ApiException as exc:
                if exc.status == 404:
                    return
                raise

    def get_experiment(self, kind: str, namespace: str, name: str) -> dict[str, Any] | None:
        """Fetch the Chaos Mesh custom resource, returning None if not found."""
        if self.custom_objects is None:
            return None

        plural = KIND_TO_PLURAL.get(kind)
        if not plural:
            raise ValueError(f"Unsupported Chaos Mesh resource kind: '{kind}'")

        with translate_k8s_errors():
            try:
                return self.custom_objects.get_namespaced_custom_object(
                    group=CHAOS_GROUP,
                    version=CHAOS_VERSION,
                    namespace=namespace,
                    plural=plural,
                    name=name,
                )
            except ApiException as exc:
                if exc.status == 404:
                    return None
                raise


def get_chaos_mesh_client(clients: K8sClients | None = None) -> ChaosMeshClient:
    """Dependency helper to create a ChaosMeshClient from K8sClients."""
    k8s = clients or get_k8s_clients()
    return ChaosMeshClient(custom_objects=k8s.custom_objects)
