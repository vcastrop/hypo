# Hypo backend

API of the **Hypo** guided chaos-engineering platform. This is not the MyBookstore demo app (`workload/demo-app`). Hypo observes and experiments on that workload; this service is the platform itself.

## Layout

```
backend/
├── app/
│   ├── api/            # HTTP routers (health, later /api/v1/*)
│   ├── core/           # settings and logging
│   ├── integrations/   # Kubernetes (and later Prometheus / Chaos Mesh)
│   ├── modules/        # discovery, experiments, reports, economics (empty until later PBs)
│   └── main.py
└── tests/
```

Layering: routers call module services; services receive clients as dependencies; only `app/integrations/` imports the Kubernetes library. Kubernetes config is loaded on first use of `get_k8s_clients()`, never at import or process startup.

## Setup

Requires Python 3.12+. From `backend/`:

```bash
python -m venv .venv
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -e ".[dev]"
```

Copy `.env.example` to `.env` and adjust. Environment variables use the `HYPO_` prefix. `HYPO_CORS_ORIGINS` must be a JSON list, for example `["http://localhost:3000"]`.

## Run

From `backend/` (so `app.*` imports resolve):

```bash
uvicorn app.main:app --reload --port 8000
```

- Liveness: `GET http://localhost:8000/health` → `{"status":"ok","service":"hypo-backend"}`
- OpenAPI: `http://localhost:8000/docs`

Port **8000** is reserved for this service so it does not collide with Grafana (3001), the demo frontend (3000), Prometheus (9090), or the traffic generator (8080).

## Tests and lint

```bash
pytest
ruff check .
ruff format --check .
```

Tests must pass without a cluster or kubeconfig. Future discovery tests should stub `get_k8s_clients` with `app.dependency_overrides`.

## Against a local kind cluster

The team’s local cluster is kind named `mybookstore` (see `infra/demo-app/`). Run the backend **on the host**, not inside Docker, so it can use your kubeconfig (`127.0.0.1` of the kind API server is reachable from the host).

```bash
kubectl config get-contexts   # expect kind-mybookstore
# .env:
# HYPO_K8S_MODE=auto
# HYPO_K8S_CONTEXT=kind-mybookstore
uvicorn app.main:app --reload --port 8000
```

`HYPO_K8S_MODE=auto` tries in-cluster config first and falls back to kubeconfig. On a laptop that fallback is expected.

A Docker container using the host kubeconfig cannot reach kind at `127.0.0.1`. The image is for in-cluster deploy (`HYPO_K8S_MODE=incluster`) in a later issue (`infra/hypo/`).

## Docker

Build context is `backend/`:

```bash
docker build -t hypo/backend:dev .
docker run --rm -p 8000:8000 hypo/backend:dev
curl http://localhost:8000/health
```

Do not bake kubeconfig, tokens, or `.env` into the image.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `HYPO_ENV` | `local` | `local` / `dev` / `prod` |
| `HYPO_LOG_LEVEL` | `INFO` | Log level |
| `HYPO_K8S_MODE` | `auto` | `auto` / `incluster` / `kubeconfig` |
| `HYPO_KUBECONFIG_PATH` | empty | Empty uses the default kubeconfig |
| `HYPO_K8S_CONTEXT` | empty | e.g. `kind-mybookstore` |
| `HYPO_PROMETHEUS_URL` | `http://localhost:9090` | Reserved for later PBs |
| `HYPO_CORS_ORIGINS` | `[]` | JSON list of allowed origins |

Discovery endpoints, experiment execution, and Kubernetes RBAC manifests are **not** in this skeleton. They land in PB-04 and later.

## Discovery endpoints

All discovery routes live under `/api/v1/discovery`. They require a reachable Kubernetes cluster (configured via the environment variables above).

### `GET /api/v1/discovery/namespaces`

List non-system namespaces visible to Hypo.

| Param | Type | Default | Description |
|---|---|---|---|
| `include_system` | query, bool | `false` | Include kube-system, chaos-mesh, etc. |

```bash
curl http://localhost:8000/api/v1/discovery/namespaces
```

```json
[
  { "name": "mybookstore", "phase": "Active" }
]
```

### `GET /api/v1/discovery/namespaces/{namespace}/services`

List Kubernetes services in the given namespace with port and selector metadata.

```bash
curl http://localhost:8000/api/v1/discovery/namespaces/mybookstore/services
```

```json
[
  {
    "name": "catalog-service",
    "namespace": "mybookstore",
    "type": "ClusterIP",
    "cluster_ip": "10.96.100.10",
    "selector": { "app": "catalog-service" },
    "ports": [
      { "name": "http", "port": 5001, "target_port": "5001", "protocol": "TCP" }
    ]
  }
]
```

### `GET /api/v1/discovery/namespaces/{namespace}/workloads`

List Deployments and StatefulSets with replica counts.

```bash
curl http://localhost:8000/api/v1/discovery/namespaces/mybookstore/workloads
```

```json
[
  {
    "name": "catalog-service",
    "namespace": "mybookstore",
    "kind": "Deployment",
    "replicas_desired": 2,
    "replicas_ready": 2,
    "labels": { "app": "catalog-service" }
  },
  {
    "name": "mongodb",
    "namespace": "mybookstore",
    "kind": "StatefulSet",
    "replicas_desired": 1,
    "replicas_ready": 1,
    "labels": { "app": "mongodb" }
  }
]
```

### Error responses

| HTTP Code | Meaning |
|---|---|
| `404` | Namespace not found |
| `403` | Cluster RBAC denied access |
| `503` | Cluster unreachable |
| `502` | Other Kubernetes API error |

## Experiment endpoints

All experiment routes live under `/api/v1/experiments`.

### `POST /api/v1/experiments/definitions`

Define a chaos experiment with blast radius validation (enforces the 50% safety limit) and hypothesis generation.

```bash
curl -X POST http://localhost:8000/api/v1/experiments/definitions \
  -H "Content-Type: application/json" \
  -d '{
    "target": {
      "name": "catalog-service",
      "namespace": "mybookstore",
      "kind": "Deployment",
      "replicas": 2,
      "labels": {"app": "catalog-service"}
    },
    "failure_type": "pod-kill",
    "duration_seconds": 60,
    "affected_replicas": 1
  }'
```

### `POST /api/v1/experiments/definitions/yaml`

Convert an experiment definition into a validated Chaos Mesh YAML manifest (`PodChaos`, `StressChaos`, or `NetworkChaos`) without applying it.

```bash
curl -X POST http://localhost:8000/api/v1/experiments/definitions/yaml \
  -H "Content-Type: application/json" \
  -d '{
    "target": {
      "name": "catalog-service",
      "namespace": "mybookstore",
      "kind": "Deployment",
      "replicas": 2,
      "labels": {"app": "catalog-service"}
    },
    "failure_type": "pod-kill",
    "duration_seconds": 60,
    "affected_replicas": 1
  }'
```

Sample output:
```json
{
  "yaml": "apiVersion: chaos-mesh.org/v1alpha1\nkind: PodChaos\nmetadata:\n  name: catalog-service-pod-kill\n  namespace: mybookstore\nspec:\n  action: pod-kill\n  mode: one\n  selector:\n    namespaces:\n    - mybookstore\n    labelSelectors:\n      app: catalog-service\n",
  "manifest": {
    "apiVersion": "chaos-mesh.org/v1alpha1",
    "kind": "PodChaos",
    "metadata": {
      "name": "catalog-service-pod-kill",
      "namespace": "mybookstore"
    },
    "spec": {
      "action": "pod-kill",
      "mode": "one",
      "selector": {
        "namespaces": ["mybookstore"],
        "labelSelectors": {"app": "catalog-service"}
      }
    }
  }
}
```

### `POST /api/v1/experiments/runs`

Execute an experiment end-to-end:
1. Converts definition into a valid Chaos Mesh YAML.
2. Applies the manifest automatically to the Kubernetes cluster.
3. Monitors abort condition in real time via Prometheus (e.g. error rate threshold).
4. If an abort threshold is breached, automatically deletes the Chaos Mesh resource immediately and marks the run as `aborted`.
5. If the experiment completes normally, cleans up the chaos resource and marks the run as `completed`.

```bash
curl -X POST http://localhost:8000/api/v1/experiments/runs \
  -H "Content-Type: application/json" \
  -d '{
    "definition_request": {
      "target": {
        "name": "catalog-service",
        "namespace": "mybookstore",
        "kind": "Deployment",
        "replicas": 2,
        "labels": {"app": "catalog-service"}
      },
      "failure_type": "network-delay",
      "duration_seconds": 60,
      "affected_replicas": 1
    },
    "abort_condition": {
      "metric": "error_rate",
      "threshold": 10.0,
      "operator": ">"
    }
  }'
```

Sample response:
```json
{
  "id": "run-a1b2c3d4",
  "experiment": {
    "target": {
      "name": "catalog-service",
      "namespace": "mybookstore",
      "kind": "Deployment",
      "replicas": 2,
      "labels": {"app": "catalog-service"}
    },
    "failure_type": "network-delay",
    "blast_radius_percentage": 50.0,
    "duration_seconds": 60,
    "hypothesis": "If network delay affects 1 of 2 replicas of catalog-service, the service should remain available, although latency may increase.",
    "affected_replicas": 1
  },
  "chaos_yaml": "apiVersion: chaos-mesh.org/v1alpha1\nkind: NetworkChaos\n...",
  "status": "completed",
  "abort_triggered": false,
  "abort_reason": null,
  "metrics_observed": [
    {"timestamp": 1728860000.1, "metric": "error_rate", "value": 0.0}
  ],
  "started_at": "2026-10-12T22:50:00.000000+00:00",
  "ended_at": "2026-10-12T22:51:00.000000+00:00"
}
```

### `GET /api/v1/experiments/runs`

List all recorded experiment runs and their outcomes.

### `GET /api/v1/experiments/runs/{run_id}`

Retrieve the full details of a specific experiment run by ID.


