from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _payload(replicas: int = 2, affected_replicas: int = 1) -> dict:
    return {
        "target": {
            "name": "catalog-service",
            "namespace": "mybookstore",
            "kind": "Deployment",
            "replicas": replicas,
            "labels": {"app": "catalog-service"},
        },
        "failure_type": "pod-kill",
        "duration_seconds": 60,
        "affected_replicas": affected_replicas,
    }


def test_create_experiment_definition():
    response = client.post(
        "/api/v1/experiments/definitions",
        json=_payload(),
    )

    assert response.status_code == 201

    body = response.json()

    assert body["target"]["name"] == "catalog-service"
    assert body["failure_type"] == "pod-kill"
    assert body["blast_radius_percentage"] == 50.0
    assert body["duration_seconds"] == 60
    assert "Kubernetes restores the desired replica count" in body["hypothesis"]


def test_rejects_unsafe_blast_radius():
    response = client.post(
        "/api/v1/experiments/definitions",
        json=_payload(replicas=3, affected_replicas=2),
    )

    assert response.status_code == 422
    assert "exceeds the maximum allowed" in response.json()["detail"]


def test_rejects_invalid_failure_type():
    payload = _payload()
    payload["failure_type"] = "earthquake"

    response = client.post(
        "/api/v1/experiments/definitions",
        json=payload,
    )

    assert response.status_code == 422


def test_rejects_invalid_duration():
    payload = _payload()
    payload["duration_seconds"] = 0

    response = client.post(
        "/api/v1/experiments/definitions",
        json=payload,
    )

    assert response.status_code == 422


# ── POST /api/v1/experiments/definitions/yaml ───────────────────────


def test_generate_experiment_yaml_success():
    response = client.post(
        "/api/v1/experiments/definitions/yaml",
        json=_payload(),
    )

    assert response.status_code == 200
    body = response.json()
    assert "yaml" in body
    assert "manifest" in body
    assert body["manifest"]["kind"] == "PodChaos"
    assert "kind: PodChaos" in body["yaml"]
    assert "action: pod-kill" in body["yaml"]


def test_generate_experiment_yaml_invalid_blast_radius():
    response = client.post(
        "/api/v1/experiments/definitions/yaml",
        json=_payload(replicas=3, affected_replicas=2),
    )

    assert response.status_code == 422


# ── POST /api/v1/experiments/runs & GET /api/v1/experiments/runs ────


class FakeCustomObjectsApi:
    def __init__(self):
        self.created = []
        self.deleted = []

    def create_namespaced_custom_object(self, group, version, namespace, plural, body):
        self.created.append(body)
        return body

    def delete_namespaced_custom_object(self, group, version, namespace, plural, name):
        self.deleted.append((plural, namespace, name))
        return {}

    def get_namespaced_custom_object(self, group, version, namespace, plural, name):
        return {}


class FakePrometheus:
    def __init__(self, error_rate=0.0):
        self.error_rate = error_rate

    def get_error_rate(self, service_name, window="1m"):
        return self.error_rate

    def get_success_rate(self, service_name, window="1m"):
        return 100.0 - self.error_rate

    def query(self, query):
        return None


def test_run_experiment_completed_normally():
    from app.integrations.kubernetes import K8sClients, get_k8s_clients
    from app.integrations.prometheus import get_prometheus_client

    fake_k8s = K8sClients(core_v1=None, apps_v1=None, custom_objects=FakeCustomObjectsApi())
    fake_prom = FakePrometheus(error_rate=1.0)

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: fake_prom

    try:
        run_payload = {
            "definition_request": _payload(),
            "abort_condition": {
                "metric": "error_rate",
                "threshold": 10.0,
                "operator": ">",
            },
            "monitor_interval_seconds": 0.01,
            "max_duration_seconds": 0.05,
        }

        response = client.post("/api/v1/experiments/runs", json=run_payload)
        assert response.status_code == 201

        data = response.json()
        assert data["status"] == "completed"
        assert data["abort_triggered"] is False
        assert "kind: PodChaos" in data["chaos_yaml"]
        assert len(fake_k8s.custom_objects.created) == 1
        assert len(fake_k8s.custom_objects.deleted) == 1
        assert data["evaluation"] is not None
        assert data["evaluation"]["verdict"] in ["PASS", "FAIL"]

        run_id = data["id"]

        # Test GET /api/v1/experiments/runs/{id}
        get_resp = client.get(f"/api/v1/experiments/runs/{run_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["id"] == run_id

        # Test GET /api/v1/experiments/runs
        list_resp = client.get("/api/v1/experiments/runs")
        assert list_resp.status_code == 200
        ids = [r["id"] for r in list_resp.json()]
        assert run_id in ids
    finally:
        app.dependency_overrides.clear()


def test_run_experiment_triggers_abort_on_breach():
    from app.integrations.kubernetes import K8sClients, get_k8s_clients
    from app.integrations.prometheus import get_prometheus_client

    fake_k8s = K8sClients(core_v1=None, apps_v1=None, custom_objects=FakeCustomObjectsApi())
    # 20% error rate breaches the 10% threshold
    fake_prom = FakePrometheus(error_rate=20.0)

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: fake_prom

    try:
        run_payload = {
            "definition_request": _payload(),
            "abort_condition": {
                "metric": "error_rate",
                "threshold": 10.0,
                "operator": ">",
            },
            "monitor_interval_seconds": 0.01,
            "max_duration_seconds": 5.0,
        }

        response = client.post("/api/v1/experiments/runs", json=run_payload)
        assert response.status_code == 201

        data = response.json()
        assert data["status"] == "aborted"
        assert data["abort_triggered"] is True
        assert "threshold (10.0%)" in data["abort_reason"]
        # Ensured deletion on abort
        assert len(fake_k8s.custom_objects.deleted) == 1
    finally:
        app.dependency_overrides.clear()


def test_get_nonexistent_run_returns_404():
    response = client.get("/api/v1/experiments/runs/run-doesnotexist")
    assert response.status_code == 404

def test_async_run_endpoint_completes():
    import time

    from app.integrations.kubernetes import K8sClients, get_k8s_clients
    from app.integrations.prometheus import get_prometheus_client

    fake_k8s = K8sClients(
        core_v1=None,
        apps_v1=None,
        custom_objects=FakeCustomObjectsApi(),
    )
    fake_prom = FakePrometheus(error_rate=1.0)

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: fake_prom

    try:
        payload = {
            "definition_request": _payload(),
            "abort_condition": {
                "metric": "error_rate",
                "threshold": 10.0,
                "operator": ">",
            },
            "monitor_interval_seconds": 0.01,
            "max_duration_seconds": 0.05,
        }

        from unittest.mock import patch

        def fake_recovery(
            get_replica_status,
            timeout_seconds=60.0,
            poll_interval_seconds=1.0,
            stop_event=None,
            ready_event=None,
        ):
            if ready_event is not None:
                ready_event.set()
            return 0.25

        with patch(
            "app.modules.experiments.runner.measure_deployment_recovery",
            side_effect=fake_recovery,
        ):
            response = client.post(
                "/api/v1/experiments/runs/async",
                json=payload,
            )

            assert response.status_code == 202

        run_id = response.json()["id"]
        assert run_id.startswith("run-")

        deadline = time.monotonic() + 3

        while time.monotonic() < deadline:
            result = client.get(
                f"/api/v1/experiments/runs/{run_id}"
            )

            assert result.status_code == 200

            if result.json()["status"] in (
                "completed",
                "aborted",
                "failed",
            ):
                break

            time.sleep(0.01)
        else:
            raise AssertionError("Async experiment timed out")

        assert result.json()["status"] == "completed"
        assert len(fake_k8s.custom_objects.created) == 1
        assert len(fake_k8s.custom_objects.deleted) == 1

    finally:
        app.dependency_overrides.clear()


def test_async_stop_nonexistent_run_returns_404():
    response = client.post(
        "/api/v1/experiments/runs/run-doesnotexist/stop"
    )

    assert response.status_code == 404


def test_async_run_rejects_excessive_duration():
    from app.integrations.kubernetes import K8sClients, get_k8s_clients
    from app.integrations.prometheus import get_prometheus_client

    fake_k8s = K8sClients(
        core_v1=None,
        apps_v1=None,
        custom_objects=FakeCustomObjectsApi(),
    )

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: FakePrometheus()

    try:
        payload = {
            "definition_request": {
                **_payload(),
                "duration_seconds": 301,
            },
            "abort_condition": {
                "metric": "error_rate",
                "threshold": 10.0,
                "operator": ">",
            },
            "monitor_interval_seconds": 0.01,
        }

        response = client.post(
            "/api/v1/experiments/runs/async",
            json=payload,
        )

        assert response.status_code == 422
        assert "cannot exceed" in response.json()["detail"]

        assert len(fake_k8s.custom_objects.created) == 0

    finally:
        app.dependency_overrides.clear()

def test_async_stop_active_experiment():
    import time

    from app.integrations.kubernetes import K8sClients, get_k8s_clients
    from app.integrations.prometheus import get_prometheus_client

    fake_k8s = K8sClients(
        core_v1=None,
        apps_v1=None,
        custom_objects=FakeCustomObjectsApi(),
    )

    fake_prom = FakePrometheus(error_rate=1.0)

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: fake_prom

    try:
        payload = {
            "definition_request": _payload(),
            "abort_condition": {
                "metric": "error_rate",
                "threshold": 10.0,
                "operator": ">",
            },
            "monitor_interval_seconds": 0.01,
            "max_duration_seconds": 5.0,
        }

        # 1. Start the experiment.
        response = client.post(
            "/api/v1/experiments/runs/async",
            json=payload,
        )

        assert response.status_code == 202

        run_id = response.json()["id"]

        # 2. Wait until Chaos Mesh receives the resource.
        deadline = time.monotonic() + 3

        while time.monotonic() < deadline:
            if fake_k8s.custom_objects.created:
                break

            time.sleep(0.01)
        else:
            raise AssertionError("Chaos resource was not created")

        # 3. Request cancellation through HTTP.
        stop_response = client.post(
            f"/api/v1/experiments/runs/{run_id}/stop"
        )

        assert stop_response.status_code == 202

        # 4. Wait for the worker to finish cleanup.
        deadline = time.monotonic() + 3

        while time.monotonic() < deadline:
            result = client.get(
                f"/api/v1/experiments/runs/{run_id}"
            )

            assert result.status_code == 200

            if result.json()["status"] in (
                "completed",
                "aborted",
                "failed",
            ):
                break

            time.sleep(0.01)
        else:
            raise AssertionError("Cancellation timed out")

        # 5. Verify the final state and cleanup.
        assert result.json()["status"] == "aborted"
        assert len(fake_k8s.custom_objects.created) == 1
        assert len(fake_k8s.custom_objects.deleted) == 1

    finally:
        app.dependency_overrides.clear()