"""Integration tests for the /api/v1/discovery/* endpoints.

All tests run without a real cluster: `get_k8s_clients` is overridden via
FastAPI's `dependency_overrides` with fakes that return canned data.
"""

from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient

from app.integrations.kubernetes import K8sClients, get_k8s_clients
from app.main import app

# ── fakes ───────────────────────────────────────────────────────────


def _ns(name, phase="Active"):
    return NS(metadata=NS(name=name), status=NS(phase=phase))


def _workload(name, replicas, ready, kind="Deployment"):
    return NS(
        metadata=NS(name=name, labels={"app": name}),
        spec=NS(replicas=replicas),
        status=NS(ready_replicas=ready),
    )


class FakeCore:
    def __init__(self, namespaces=("mybookstore",)):
        self.namespaces = namespaces

    def list_namespace(self):
        return NS(items=[_ns(n) for n in self.namespaces])

    def read_namespace(self, name):
        from kubernetes.client.exceptions import ApiException

        if name not in self.namespaces:
            raise ApiException(status=404, reason="Not Found")

    def list_namespaced_service(self, namespace):
        port = NS(name="http", port=5001, target_port=5001, protocol="TCP")
        svc = NS(
            metadata=NS(name="catalog-service"),
            spec=NS(
                type="ClusterIP",
                cluster_ip="10.0.0.1",
                selector={"app": "catalog"},
                ports=[port],
            ),
        )
        return NS(items=[svc])


class FakeApps:
    def list_namespaced_deployment(self, namespace):
        return NS(
            items=[
                _workload("catalog-service", 2, 2),
                _workload("cart-service", 2, 1),
            ]
        )

    def list_namespaced_stateful_set(self, namespace):
        return NS(items=[_workload("mongodb", 1, 1)])


def _fake_clients():
    return K8sClients(core_v1=FakeCore(), apps_v1=FakeApps())


def _fake_clients_with_system():
    return K8sClients(
        core_v1=FakeCore(namespaces=("kube-system", "mybookstore")),
        apps_v1=FakeApps(),
    )


# ── fixtures ────────────────────────────────────────────────────────


@pytest.fixture()
def client():
    """Provide a TestClient with get_k8s_clients overridden."""
    app.dependency_overrides[get_k8s_clients] = _fake_clients
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture()
def client_with_system_ns():
    """Provide a TestClient whose fake cluster exposes kube-system."""
    app.dependency_overrides[get_k8s_clients] = _fake_clients_with_system
    yield TestClient(app)
    app.dependency_overrides.clear()


# ── GET /api/v1/discovery/namespaces ────────────────────────────────


class TestListNamespaces:
    def test_returns_200_with_namespace_list(self, client):
        resp = client.get("/api/v1/discovery/namespaces")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "mybookstore"

    def test_hides_system_namespaces_by_default(self, client_with_system_ns):
        resp = client_with_system_ns.get("/api/v1/discovery/namespaces")
        names = [ns["name"] for ns in resp.json()]
        assert "kube-system" not in names
        assert "mybookstore" in names

    def test_include_system_param_shows_all(self, client_with_system_ns):
        resp = client_with_system_ns.get(
            "/api/v1/discovery/namespaces", params={"include_system": True}
        )
        names = [ns["name"] for ns in resp.json()]
        assert "kube-system" in names
        assert "mybookstore" in names


# ── GET /api/v1/discovery/namespaces/{ns}/services ──────────────────


class TestListServices:
    def test_returns_200_with_service_list(self, client):
        resp = client.get("/api/v1/discovery/namespaces/mybookstore/services")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        svc = data[0]
        assert svc["name"] == "catalog-service"
        assert svc["namespace"] == "mybookstore"
        assert svc["type"] == "ClusterIP"
        assert svc["selector"] == {"app": "catalog"}
        assert svc["ports"][0]["port"] == 5001

    def test_unknown_namespace_returns_404(self, client):
        resp = client.get("/api/v1/discovery/namespaces/nonexistent/services")
        assert resp.status_code == 404


# ── GET /api/v1/discovery/namespaces/{ns}/workloads ─────────────────


class TestListWorkloads:
    def test_returns_200_with_workloads(self, client):
        resp = client.get("/api/v1/discovery/namespaces/mybookstore/workloads")
        assert resp.status_code == 200
        data = resp.json()
        by_name = {w["name"]: w for w in data}
        assert "catalog-service" in by_name
        assert "cart-service" in by_name
        assert "mongodb" in by_name

    def test_workload_fields_present(self, client):
        resp = client.get("/api/v1/discovery/namespaces/mybookstore/workloads")
        workload = resp.json()[0]
        for field in ("name", "namespace", "kind", "replicas_desired", "replicas_ready"):
            assert field in workload, f"Missing field: {field}"

    def test_statefulset_kind_correct(self, client):
        resp = client.get("/api/v1/discovery/namespaces/mybookstore/workloads")
        data = resp.json()
        mongo = next(w for w in data if w["name"] == "mongodb")
        assert mongo["kind"] == "StatefulSet"

    def test_handles_partially_ready_replicas(self, client):
        resp = client.get("/api/v1/discovery/namespaces/mybookstore/workloads")
        data = resp.json()
        cart = next(w for w in data if w["name"] == "cart-service")
        assert cart["replicas_desired"] == 2
        assert cart["replicas_ready"] == 1

    def test_unknown_namespace_returns_404(self, client):
        resp = client.get("/api/v1/discovery/namespaces/nonexistent/workloads")
        assert resp.status_code == 404
