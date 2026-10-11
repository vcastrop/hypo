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
