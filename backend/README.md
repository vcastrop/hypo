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

