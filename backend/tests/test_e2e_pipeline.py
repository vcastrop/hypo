"""End-to-end integration tests for the full Hypo Chaos Engineering pipeline.

Pipeline flow under validation:
1. Analyze / Inspect infrastructure:
   Target services, deployments, namespaces, and replicas from demo-app.
2. Discover:
   Invoke `/api/v1/discovery/*` (namespaces, services, workloads).
3. Hypothesize:
   Define resilience hypotheses via `/api/v1/experiments/definitions` within blast-radius limits.
4. Inject:
   Generate Chaos Mesh custom resource manifests via `/api/v1/experiments/definitions/yaml`
   and execute experiments via `/api/v1/experiments/runs`.
5. Measure:
   Sample Prometheus SLIs (error rate, success rate, p95 latency) across execution phases.
6. Report:
   Evaluate PASS/FAIL verdicts against SLOs, generate plain-language findings summaries (PB-07a),
   and produce actionable remediation recommendations (PB-07b).
7. Economic Impact:
   Estimate direct financial risk based on downtime, degradation factor,
   and hourly cost (PB-08a, PB-08b).

Acceptance Criteria:
- At least 2 full end-to-end runs completed successfully:
  Run 1: catalog-service pod-kill (1 of 2 replicas terminated, observing recovery).
  Run 2: cart-service network-delay (latency inflation from 40ms to 240ms).
  Run 3: order-service resource-stress (CPU/memory stress with recovery).
"""

from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient

from app.integrations.kubernetes import K8sClients, get_k8s_clients
from app.integrations.prometheus import PrometheusClient, get_prometheus_client
from app.main import app
from app.modules.experiments.service import clear_runs

client = TestClient(app)


# ==============================================================================
# Realistic Fakes based on Demo App Infrastructure (MyBookstore / demo-app)
# ==============================================================================


def _make_ns(name: str, phase: str = "Active") -> NS:
    return NS(metadata=NS(name=name), status=NS(phase=phase))


def _make_service(name: str, port: int, app_label: str) -> NS:
    return NS(
        metadata=NS(name=name),
        spec=NS(
            type="ClusterIP",
            cluster_ip="10.96.0.10",
            selector={"app": app_label},
            ports=[NS(name="http", port=port, target_port=port, protocol="TCP")],
        ),
    )


def _make_deployment(name: str, replicas: int, ready: int, app_label: str) -> NS:
    labels = {"app": app_label, "app.kubernetes.io/part-of": "mybookstore"}
    return NS(
        metadata=NS(name=name, labels=labels),
        spec=NS(
            replicas=replicas,
            selector=NS(match_labels={"app": app_label}),
        ),
        status=NS(ready_replicas=ready),
    )


class DemoAppFakeCoreV1:
    """Simulates Kubernetes CoreV1 API for demo-app services and namespaces."""

    def __init__(self, namespace: str = "mybookstore"):
        self.namespace = namespace
        self.namespaces = [namespace, "default", "kube-system"]
        self.services = [
            _make_service("api-gateway", 80, "api-gateway"),
            _make_service("catalog-service", 5001, "catalog-service"),
            _make_service("user-service", 5002, "user-service"),
            _make_service("cart-service", 5003, "cart-service"),
            _make_service("order-service", 5004, "order-service"),
            _make_service("review-service", 5005, "review-service"),
            _make_service("wishlist-service", 5006, "wishlist-service"),
            _make_service("frontend", 80, "frontend"),
            _make_service("mongodb", 27017, "mongodb"),
            _make_service("redis", 6379, "redis"),
        ]

    def list_namespace(self):
        return NS(items=[_make_ns(n) for n in self.namespaces])

    def read_namespace(self, name: str):
        from kubernetes.client.exceptions import ApiException

        if name not in self.namespaces:
            raise ApiException(status=404, reason="Namespace Not Found")
        return _make_ns(name)

    def list_namespaced_service(self, namespace: str):
        self.read_namespace(namespace)
        return NS(items=self.services)


class DemoAppFakeAppsV1:
    """Simulates Kubernetes AppsV1 API for demo-app deployments and statefulsets."""

    def __init__(self, namespace: str = "mybookstore"):
        self.namespace = namespace
        self.deployments = [
            _make_deployment("api-gateway", 2, 2, "api-gateway"),
            _make_deployment("catalog-service", 2, 2, "catalog-service"),
            _make_deployment("user-service", 2, 2, "user-service"),
            _make_deployment("cart-service", 2, 2, "cart-service"),
            _make_deployment("order-service", 2, 2, "order-service"),
            _make_deployment("review-service", 2, 2, "review-service"),
            _make_deployment("wishlist-service", 2, 2, "wishlist-service"),
            _make_deployment("frontend", 2, 2, "frontend"),
            _make_deployment("mongodb", 1, 1, "mongodb"),
            _make_deployment("redis", 1, 1, "redis"),
        ]

    def list_namespaced_deployment(self, namespace: str):
        return NS(items=self.deployments)

    def list_namespaced_stateful_set(self, namespace: str):
        return NS(items=[])


class DemoAppFakeCustomObjectsApi:
    """Simulates Chaos Mesh Custom Objects CRD lifecycle (create, get, delete)."""

    def __init__(self):
        self.created = []
        self.deleted = []

    def create_namespaced_custom_object(self, group, version, namespace, plural, body):
        self.created.append(body)
        return body

    def delete_namespaced_custom_object(self, group, version, namespace, plural, name):
        self.deleted.append((plural, namespace, name))
        return {"status": "Success"}

    def get_namespaced_custom_object(self, group, version, namespace, plural, name):
        return {}


class DemoAppScenarioPrometheus(PrometheusClient):
    """Simulates Prometheus SLI queries across execution phases.

    A full experiment run executes window pulls in order:
    1. pull_window_metrics (before): error_rate, success_rate, p95_latency
    2. pull_window_metrics (during): error_rate, success_rate, p95_latency
    3. pull_window_metrics (after):  error_rate, success_rate, p95_latency
    """

    def __init__(
        self,
        before_err: float = 0.0,
        before_succ: float = 100.0,
        before_p95: float = 45.0,
        during_err: float = 0.0,
        during_succ: float = 100.0,
        during_p95: float = 45.0,
        after_err: float = 0.0,
        after_succ: float = 100.0,
        after_p95: float = 45.0,
        realtime_samples: list[float] | None = None,
    ):
        super().__init__(base_url="http://fake-prometheus:9090")
        self.windows = [
            {"err": before_err, "succ": before_succ, "p95": before_p95},
            {"err": during_err, "succ": during_succ, "p95": during_p95},
            {"err": after_err, "succ": after_succ, "p95": after_p95},
        ]
        self.pull_idx = 0
        self.realtime_samples = realtime_samples or [0.0]
        self._sample_index = 0

    def get_error_rate(self, service_name: str, window: str = "1m", time_offset: str | None = None):
        return self.windows[min(self.pull_idx, 2)]["err"]

    def get_success_rate(
        self, service_name: str, window: str = "1m", time_offset: str | None = None
    ):
        return self.windows[min(self.pull_idx, 2)]["succ"]

    def get_p95_latency(
        self, service_name: str, window: str = "1m", time_offset: str | None = None
    ):
        val = self.windows[min(self.pull_idx, 2)]["p95"]
        self.pull_idx += 1  # Full window metrics triple (err, succ, p95) completed
        return val

    def query(self, query: str):
        val = self.realtime_samples[self._sample_index % len(self.realtime_samples)]
        self._sample_index += 1
        return val


@pytest.fixture(autouse=True)
def clean_pipeline_state():
    clear_runs()
    yield
    clear_runs()
    app.dependency_overrides.clear()


# ==============================================================================
# End-to-End Test Run 1: Pod Kill against catalog-service
# ==============================================================================


def test_e2e_run_1_catalog_service_pod_kill():
    """E2E Run 1: Full pipeline on catalog-service with Pod-Kill.

    Pipeline steps:
    1. Analyze infrastructure & discover catalog-service in 'mybookstore'
    2. Formulate hypothesis & validate blast radius (1 of 2 replicas = 50%)
    3. Generate Chaos Mesh PodChaos manifest
    4. Inject failure via automated run endpoint
    5. Measure metrics during chaos and recovery (error rate 2%, recovery observed)
    6. Verify evaluation report, findings summary & recommendations
    7. Assess economic impact of the disruption
    """
    fake_k8s = K8sClients(
        core_v1=DemoAppFakeCoreV1(namespace="mybookstore"),
        apps_v1=DemoAppFakeAppsV1(namespace="mybookstore"),
        custom_objects=DemoAppFakeCustomObjectsApi(),
    )
    # Scenario: 1 of 2 catalog replicas killed; traffic continues via second replica.
    # Steady state: 100% success -> During chaos: 98% success, 2% error -> After: 99.8% success.
    fake_prom = DemoAppScenarioPrometheus(
        before_err=0.0,
        before_succ=100.0,
        before_p95=45.0,
        during_err=2.0,
        during_succ=98.0,
        during_p95=65.0,
        after_err=0.2,
        after_succ=99.8,
        after_p95=46.0,
        realtime_samples=[0.5, 1.8, 2.0, 0.4],
    )

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: fake_prom

    # Step 1: Discovery / Analysis
    ns_resp = client.get("/api/v1/discovery/namespaces")
    assert ns_resp.status_code == 200
    namespaces = [ns["name"] for ns in ns_resp.json()]
    assert "mybookstore" in namespaces
    assert "kube-system" not in namespaces  # Filtered system namespace

    workloads_resp = client.get("/api/v1/discovery/namespaces/mybookstore/workloads")
    assert workloads_resp.status_code == 200
    workloads = {w["name"]: w for w in workloads_resp.json()}
    assert "catalog-service" in workloads
    catalog_wl = workloads["catalog-service"]
    assert catalog_wl["replicas_desired"] == 2
    assert catalog_wl["replicas_ready"] == 2
    assert catalog_wl["labels"] == {"app": "catalog-service"}

    services_resp = client.get("/api/v1/discovery/namespaces/mybookstore/services")
    assert services_resp.status_code == 200
    services = {s["name"]: s for s in services_resp.json()}
    assert "catalog-service" in services

    # Step 2: Hypothesize & Validate Definition
    definition_req = {
        "target": {
            "name": catalog_wl["name"],
            "namespace": catalog_wl["namespace"],
            "kind": catalog_wl["kind"],
            "replicas": catalog_wl["replicas_desired"],
            "labels": catalog_wl["labels"],
        },
        "failure_type": "pod-kill",
        "duration_seconds": 60,
        "affected_replicas": 1,
        "cost_per_hour": 1500.0,
    }

    def_resp = client.post("/api/v1/experiments/definitions", json=definition_req)
    assert def_resp.status_code == 201
    experiment_def = def_resp.json()
    assert experiment_def["blast_radius_percentage"] == 50.0
    assert "catalog-service" in experiment_def["hypothesis"]
    assert "Kubernetes restores the desired replica count" in experiment_def["hypothesis"]

    # Step 3: Manifest Generation (Chaos Mesh YAML)
    yaml_resp = client.post("/api/v1/experiments/definitions/yaml", json=definition_req)
    assert yaml_resp.status_code == 200
    manifest_data = yaml_resp.json()
    assert manifest_data["manifest"]["kind"] == "PodChaos"
    assert manifest_data["manifest"]["spec"]["action"] == "pod-kill"
    assert "apiVersion: chaos-mesh.org/v1alpha1" in manifest_data["yaml"]

    # Step 4: Inject and Measure
    run_req = {
        "definition": experiment_def,
        "abort_condition": {
            "metric": "error_rate",
            "threshold": 10.0,
            "operator": ">",
        },
        "success_criteria": {
            "max_error_rate_percentage": 1.0,
            "min_success_rate_percentage": 99.0,
            "max_p95_latency_ms": 100.0,
            "max_recovery_time_seconds": 60.0,
        },
        "monitor_interval_seconds": 0.01,
        "max_duration_seconds": 0.05,
    }

    run_resp = client.post("/api/v1/experiments/runs", json=run_req)
    assert run_resp.status_code == 201
    run_result = run_resp.json()

    # Verify lifecycle execution
    assert run_result["status"] == "completed"
    assert run_result["abort_triggered"] is False
    assert len(fake_k8s.custom_objects.created) == 1
    assert len(fake_k8s.custom_objects.deleted) == 1

    # Step 5 & 6: Report, Findings Summary & Remediation Recommendations
    evaluation = run_result["evaluation"]
    assert evaluation is not None
    assert evaluation["verdict"] in ("PASS", "FAIL")

    # Plain-language findings summary stored alongside result (PB-07a)
    assert run_result["findings_summary"] is not None
    assert "catalog-service" in run_result["findings_summary"]
    assert "during pod-kill" in run_result["findings_summary"]

    # Recommendations generated (PB-07b)
    assert len(run_result["recommendations"]) > 0
    rec_ids = [r["id"] for r in run_result["recommendations"]]
    assert any("PDB" in rid or "REPLICA" in rid or "STEADY" in rid for rid in rec_ids)

    # Step 7: Economic Impact Assessment (PB-08a, PB-08b)
    economic_impact = run_result["economic_impact"]
    assert economic_impact is not None
    assert economic_impact["cost_per_hour"] == 1500.0
    assert economic_impact["currency"] == "USD"
    assert economic_impact["total_estimated_impact"] >= 0.0

    # Verify persistence via GET /runs and GET /runs/{id}
    run_id = run_result["id"]
    get_resp = client.get(f"/api/v1/experiments/runs/{run_id}")
    assert get_resp.status_code == 200
    stored_run = get_resp.json()
    assert stored_run["id"] == run_id
    assert stored_run["findings_summary"] == run_result["findings_summary"]
    assert (
        stored_run["economic_impact"]["total_estimated_impact"]
        == economic_impact["total_estimated_impact"]
    )


# ==============================================================================
# End-to-End Test Run 2: Network Delay against cart-service
# ==============================================================================


def test_e2e_run_2_cart_service_network_delay():
    """E2E Run 2: Full pipeline on cart-service with Network-Delay.

    Pipeline steps:
    1. Analyze infrastructure & discover cart-service in 'mybookstore'
    2. Formulate hypothesis & validate blast radius (1 of 2 replicas = 50%)
    3. Generate Chaos Mesh NetworkChaos manifest
    4. Inject network delay (200ms) with abort monitoring
    5. Measure metrics during chaos (latency inflated from 40ms to 240ms, recovery 5s)
    6. Verify evaluation report, findings summary & recommendations (timeout/circuit breaking)
    7. Assess economic impact of degraded latency on cart checkout path
    """
    fake_k8s = K8sClients(
        core_v1=DemoAppFakeCoreV1(namespace="mybookstore"),
        apps_v1=DemoAppFakeAppsV1(namespace="mybookstore"),
        custom_objects=DemoAppFakeCustomObjectsApi(),
    )
    # Scenario: 200ms latency injected; success rate stays 100%, but P95 rises to 240ms.
    fake_prom = DemoAppScenarioPrometheus(
        before_err=0.0,
        before_succ=100.0,
        before_p95=40.0,
        during_err=0.0,
        during_succ=100.0,
        during_p95=240.0,
        after_err=0.0,
        after_succ=100.0,
        after_p95=42.0,
        realtime_samples=[0.0, 0.1, 0.0],
    )

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: fake_prom

    # Step 1: Discovery
    workloads_resp = client.get("/api/v1/discovery/namespaces/mybookstore/workloads")
    assert workloads_resp.status_code == 200
    cart_wl = next(w for w in workloads_resp.json() if w["name"] == "cart-service")
    assert cart_wl["replicas_desired"] == 2

    # Step 2: Hypothesize
    definition_req = {
        "target": {
            "name": cart_wl["name"],
            "namespace": cart_wl["namespace"],
            "kind": cart_wl["kind"],
            "replicas": cart_wl["replicas_desired"],
            "labels": cart_wl["labels"],
        },
        "failure_type": "network-delay",
        "duration_seconds": 60,
        "affected_replicas": 1,
        "cost_per_hour": 2500.0,  # High hourly cost for cart / revenue funnel
    }

    def_resp = client.post("/api/v1/experiments/definitions", json=definition_req)
    assert def_resp.status_code == 201
    experiment_def = def_resp.json()
    assert experiment_def["failure_type"] == "network-delay"
    assert "network delay affects" in experiment_def["hypothesis"]

    # Step 3: Manifest Generation
    yaml_resp = client.post("/api/v1/experiments/definitions/yaml", json=definition_req)
    assert yaml_resp.status_code == 200
    manifest = yaml_resp.json()["manifest"]
    assert manifest["kind"] == "NetworkChaos"
    assert manifest["spec"]["action"] == "delay"
    assert manifest["spec"]["delay"]["latency"] == "200ms"

    # Step 4: Inject and Measure
    run_req = {
        "definition": experiment_def,
        "abort_condition": {
            "metric": "error_rate",
            "threshold": 10.0,
            "operator": ">",
        },
        "success_criteria": {
            "max_error_rate_percentage": 1.0,
            "min_success_rate_percentage": 99.0,
            "max_p95_latency_ms": 100.0,
            "max_recovery_time_seconds": 60.0,
        },
        "monitor_interval_seconds": 0.01,
        "max_duration_seconds": 0.05,
    }

    run_resp = client.post("/api/v1/experiments/runs", json=run_req)
    assert run_resp.status_code == 201
    run_result = run_resp.json()

    assert run_result["status"] == "completed"
    assert len(fake_k8s.custom_objects.created) == 1
    assert len(fake_k8s.custom_objects.deleted) == 1

    # Step 5 & 6: Report & Findings Summary
    evaluation = run_result["evaluation"]
    assert evaluation is not None
    assert run_result["findings_summary"] is not None
    assert "cart-service" in run_result["findings_summary"]
    assert "latency increase" in run_result["findings_summary"]
    assert "during network-delay" in run_result["findings_summary"]

    # Recommendations should include timeout/circuit breaking for latency issues
    recs = run_result["recommendations"]
    assert len(recs) > 0
    rec_categories = [r["category"] for r in recs]
    assert any("Traffic" in cat or "Resilience" in cat or "Policy" in cat for cat in rec_categories)

    # Step 7: Economic Impact
    econ = run_result["economic_impact"]
    assert econ is not None
    assert econ["cost_per_hour"] == 2500.0
    assert econ["severity"] in ("medium", "high", "critical", "low")
    assert econ["total_estimated_impact"] > 0.0  # Latency inflation produces financial impact

    # Step 8: Dedicated standalone Economic Impact API query
    estimate_resp = client.post(
        "/api/v1/economics/estimate",
        json={
            "experiment": experiment_def,
            "status": "completed",
            "before_metrics": evaluation["before_metrics"],
            "during_metrics": evaluation["during_metrics"],
            "after_metrics": evaluation["after_metrics"],
            "cost_per_hour": 2500.0,
        },
    )
    assert estimate_resp.status_code == 200
    standalone_econ = estimate_resp.json()
    assert standalone_econ["total_estimated_impact"] == econ["total_estimated_impact"]


# ==============================================================================
# End-to-End Test Run 3: Resource Stress against order-service
# ==============================================================================


def test_e2e_run_3_order_service_resource_stress():
    """E2E Run 3: Full pipeline on order-service with Resource Stress.

    Pipeline steps:
    1. Analyze infrastructure & discover order-service in 'mybookstore'
    2. Formulate hypothesis for CPU & memory pressure
    3. Generate StressChaos manifest
    4. Inject resource pressure
    5. Measure metrics during chaos and steady-state recovery
    6. Verify evaluation, findings summary, and recommendations (HPA / Resource limits)
    7. Assess economic impact on transaction processing
    """
    fake_k8s = K8sClients(
        core_v1=DemoAppFakeCoreV1(namespace="mybookstore"),
        apps_v1=DemoAppFakeAppsV1(namespace="mybookstore"),
        custom_objects=DemoAppFakeCustomObjectsApi(),
    )
    # Scenario: CPU/memory stress causing 15% error rate and 110ms latency increase
    fake_prom = DemoAppScenarioPrometheus(
        before_err=0.0,
        before_succ=100.0,
        before_p95=50.0,
        during_err=15.0,
        during_succ=85.0,
        during_p95=160.0,
        after_err=0.1,
        after_succ=99.9,
        after_p95=52.0,
        realtime_samples=[2.0, 5.0, 8.0],
    )

    app.dependency_overrides[get_k8s_clients] = lambda: fake_k8s
    app.dependency_overrides[get_prometheus_client] = lambda: fake_prom

    # Step 1: Discovery
    workloads_resp = client.get("/api/v1/discovery/namespaces/mybookstore/workloads")
    order_wl = next(w for w in workloads_resp.json() if w["name"] == "order-service")

    # Step 2: Hypothesize
    definition_req = {
        "target": {
            "name": order_wl["name"],
            "namespace": order_wl["namespace"],
            "kind": order_wl["kind"],
            "replicas": order_wl["replicas_desired"],
            "labels": order_wl["labels"],
        },
        "failure_type": "resource-stress",
        "duration_seconds": 60,
        "affected_replicas": 1,
        "cost_per_hour": 3000.0,
    }

    def_resp = client.post("/api/v1/experiments/definitions", json=definition_req)
    assert def_resp.status_code == 201
    experiment_def = def_resp.json()
    assert experiment_def["failure_type"] == "resource-stress"
    assert "CPU and memory pressure" in experiment_def["hypothesis"]

    # Step 3: Manifest Generation
    yaml_resp = client.post("/api/v1/experiments/definitions/yaml", json=definition_req)
    assert yaml_resp.status_code == 200
    manifest = yaml_resp.json()["manifest"]
    assert manifest["kind"] == "StressChaos"
    assert "cpu" in manifest["spec"]["stressors"]
    assert "memory" in manifest["spec"]["stressors"]

    # Step 4: Inject and Measure
    run_req = {
        "definition": experiment_def,
        "abort_condition": {
            "metric": "error_rate",
            "threshold": 25.0,
            "operator": ">",
        },
        "success_criteria": {
            "max_error_rate_percentage": 1.0,
            "min_success_rate_percentage": 99.0,
            "max_p95_latency_ms": 100.0,
            "max_recovery_time_seconds": 60.0,
        },
        "monitor_interval_seconds": 0.01,
        "max_duration_seconds": 0.05,
    }

    run_resp = client.post("/api/v1/experiments/runs", json=run_req)
    assert run_resp.status_code == 201
    run_result = run_resp.json()

    assert run_result["status"] == "completed"

    # Step 5 & 6: Report, Findings Summary & Remediation
    evaluation = run_result["evaluation"]
    assert evaluation is not None
    assert run_result["findings_summary"] is not None
    assert "order-service" in run_result["findings_summary"]
    assert "during resource-stress" in run_result["findings_summary"]

    recs = run_result["recommendations"]
    assert len(recs) > 0
    rec_titles = [r["title"] for r in recs]
    assert any(
        "limit" in t.lower() or "autoscaler" in t.lower() or "pdb" in t.lower() for t in rec_titles
    )

    # Step 7: Economic Impact
    econ = run_result["economic_impact"]
    assert econ is not None
    assert econ["cost_per_hour"] == 3000.0
    assert econ["degraded_duration_seconds"] > 0
    assert econ["estimated_degradation_cost"] > 0
    assert econ["total_estimated_impact"] > 0
