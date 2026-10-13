import pytest
from kubernetes.client.exceptions import ApiException

from app.core.errors import ClusterError
from app.integrations.chaos_mesh import ChaosMeshClient


class FakeCustomObjects:
    def __init__(self, raise_on_create=None, raise_on_delete=None):
        self.raise_on_create = raise_on_create
        self.raise_on_delete = raise_on_delete
        self.created = []
        self.replaced = []
        self.deleted = []

    def create_namespaced_custom_object(self, group, version, namespace, plural, body):
        if self.raise_on_create:
            raise self.raise_on_create
        self.created.append(body)
        return body

    def get_namespaced_custom_object(self, group, version, namespace, plural, name):
        return {"metadata": {"name": name, "resourceVersion": "12345"}}

    def replace_namespaced_custom_object(self, group, version, namespace, plural, name, body):
        self.replaced.append(body)
        return body

    def delete_namespaced_custom_object(self, group, version, namespace, plural, name):
        if self.raise_on_delete:
            raise self.raise_on_delete
        self.deleted.append((plural, namespace, name))
        return {}


def test_chaos_mesh_client_requires_custom_objects():
    client = ChaosMeshClient(custom_objects=None)
    with pytest.raises(ClusterError, match="not configured"):
        client.apply_experiment({"kind": "PodChaos", "metadata": {"name": "test"}})


def test_chaos_mesh_client_rejects_unsupported_kind():
    client = ChaosMeshClient(custom_objects=FakeCustomObjects())
    with pytest.raises(ValueError, match="Unsupported Chaos Mesh resource kind"):
        client.apply_experiment({"kind": "UnknownChaos", "metadata": {"name": "test"}})


def test_chaos_mesh_client_rejects_missing_name():
    client = ChaosMeshClient(custom_objects=FakeCustomObjects())
    with pytest.raises(ValueError, match="must include a 'name'"):
        client.apply_experiment({"kind": "PodChaos", "metadata": {}})


def test_chaos_mesh_client_replaces_on_409_conflict():
    fake = FakeCustomObjects(raise_on_create=ApiException(status=409, reason="Conflict"))
    client = ChaosMeshClient(custom_objects=fake)

    manifest = {
        "kind": "PodChaos",
        "metadata": {"name": "test-chaos", "namespace": "mybookstore"},
    }

    result = client.apply_experiment(manifest)
    assert len(fake.replaced) == 1
    assert result["metadata"]["resourceVersion"] == "12345"


def test_chaos_mesh_client_delete_ignores_404():
    fake = FakeCustomObjects(raise_on_delete=ApiException(status=404, reason="Not Found"))
    client = ChaosMeshClient(custom_objects=fake)

    # Should not raise
    client.delete_experiment("PodChaos", "mybookstore", "test-chaos")


def test_chaos_mesh_client_get_returns_none_on_404():
    class Fake404:
        def get_namespaced_custom_object(self, *args, **kwargs):
            raise ApiException(status=404, reason="Not Found")

    client = ChaosMeshClient(custom_objects=Fake404())
    assert client.get_experiment("PodChaos", "mybookstore", "test-chaos") is None
