# Hypo Project – Full Setup Guide

This guide shows how to set up **Hypo** (the chaos‑engineering management platform) from a clean machine, run the demo application, and verify the end‑to‑end pipeline.

---

## 1. Prerequisites

| Tool | Minimum version | Install command / link |
|------|----------------|-----------------------|
| **Git** | 2.40+ | <https://git-scm.com/downloads> |
| **Python** | 3.12+ (3.14 used in CI) | `choco install python --version=3.14` (Windows) |
| **Poetry** | 1.8+ | `pip install poetry` |
| **Node.js** | 20.x LTS | <https://nodejs.org/en/download/> |
| **npm** (bundled with Node) | 10.x | – |
| **Docker Desktop** (includes **kubectl**) | 26.0+ | <https://www.docker.com/products/docker-desktop> |
| **Kind** (Kubernetes in Docker) | 0.20+ | `go install sigs.k8s.io/kind@latest` |
| **Helm** | 3.14+ | `choco install kubernetes-helm` |
| **kubectl** | 1.28+ | Comes with Docker Desktop; verify with `kubectl version --client` |
| **Chaos Mesh** | v2.6+ | See *Install Chaos Mesh* section |
| **Prometheus Operator** (for metrics) | v0.71+ | Helm chart `prometheus-community/kube-prometheus-stack` |
| **Httpie** (optional for API testing) | 3.2+ | `pip install httpie` |

> **NOTE**: All commands below assume a PowerShell prompt on Windows.

---

## 2. Clone the repository

```powershell
git clone https://github.com/vcastrop/hypo.git
cd hypo
```

The repository layout (relevant parts):

- `backend/` – FastAPI server, chaos‑mesh client, Prometheus client, business logic.
- `frontend/` – React/Next.js UI.
- `infra/demo-app/` – Kubernetes manifests for the sample e‑commerce app used in demos.
- `workload/demo-app/` – Alternative location for the same manifests (the code references both).
- `backend/tests/` – Unit, integration, and end‑to‑end test suite.

---

## 3. Set up a local Kubernetes cluster

```powershell
# Create a Kind cluster named hypo
kind create cluster --name hypo --config=infra/kind-config.yaml
```

> **TIP**: The `kind-config.yaml` file (in the repo) configures two worker nodes and enables the `Ingress` add‑on.

Verify the cluster:

```powershell
kubectl cluster-info
kubectl get nodes
```

---

## 4. Deploy the demo application

The demo app consists of several micro‑services (catalog, cart, order, api‑gateway) and a PostgreSQL DB.

```powershell
# Change to the manifests directory
cd infra/demo-app
# Apply all manifests
kubectl apply -k .
```

Wait for all pods to become Ready:

```powershell
kubectl wait --for=condition=Ready pod --all --timeout=180s
```

You can verify the services:

```powershell
kubectl get svc -n demo-app
```

---

## 5. Install Chaos Mesh

```powershell
helm repo add chaos-mesh https://charts.chaos-mesh.org
helm repo update
helm install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace chaos-mesh --create-namespace \
  --set controllerManager.targetNamespace=demo-app \
  --set dashboard.enabled=true
```

Expose the Chaos Mesh dashboard (optional):

```powershell
kubectl port-forward -n chaos-mesh svc/chaos-mesh-dashboard 2333:2333
# Then open http://localhost:2333 in a browser
```

---

## 6. Install Prometheus (for metrics collection)

```powershell
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

Expose Prometheus for local queries (optional):

```powershell
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090
```

---

## 7. Backend – Python environment

```powershell
# From the repository root
cd backend
poetry install   # creates a virtual env and installs dependencies
# Activate the venv (PowerShell)
poetry shell
```

Run database migrations (if any) – the project currently uses an in‑memory SQLite DB for tests, so no migration step is required for the demo.

### 7.1. Start the FastAPI server

```powershell
# The server reads config from env vars; the defaults work for the local cluster.
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The API is now reachable at `http://localhost:8000`. You can explore the OpenAPI UI at `http://localhost:8000/docs`.

---

## 8. Frontend – Node environment

```powershell
cd ..\frontend
npm install
npm run dev   # starts the dev server on http://localhost:3000
```

To create a production build (optional for demo):

```powershell
npm run build
npm run start   # serves the built assets
```

---

## 9. Verify the full pipeline manually (optional)

You can use **httpie** (or `curl`) to trigger a full experiment, e.g., a pod‑kill on `catalog-service`:

```powershell
# 1️⃣ Discover services (optional, just to see they are registered)
http GET http://localhost:8000/api/v1/discovery/services

# 2️⃣ Create an experiment definition (YAML) – the API can generate it for you
http POST http://localhost:8000/api/v1/experiments/definitions/yaml \
  service=catalog-service \
  type=pod-kill \
  parameters:='{"replicas":1}' > catalog-podkill.yaml

# 3️⃣ Run the experiment
http POST http://localhost:8000/api/v1/experiments/runs \
  yaml@catalog-podkill.yaml
```

After the experiment finishes you can fetch the result:

```powershell
http GET http://localhost:8000/api/v1/experiments/runs/<run-id>
```

The JSON payload contains:
- `findings_summary` – plain‑language description (PB‑07a).
- `recommendations` – remediation actions (PB‑07b).
- `economic_impact` – cost estimation (PB‑08a/b).

---

## 10. Run the automated test suite

### 10.1. Backend tests (including the end‑to‑end pipeline)

```powershell
cd ..\backend
poetry run pytest -vv
```

You should see **122 passed** and a summary like:
```
======================= 122 passed, 1 warning in 5.22s =======================
```

The three end‑to‑end tests (`test_e2e_pipeline.py`) each execute the full pipeline against the demo app running in the Kind cluster.

### 10.2. Frontend lint & build

```powershell
cd ..\frontend
npm run lint   # ensure TypeScript & ESLint pass
npm run build   # confirm production bundle builds without errors
```

---

## 11. Clean‑up

When you are finished:

```powershell
# Delete the Kind cluster
kind delete cluster --name hypo
# (Optional) Remove Helm releases
helm uninstall chaos-mesh -n chaos-mesh
helm uninstall prometheus -n monitoring
```

---

## 12. Quick‑reference cheat‑sheet

| Step | Command | Purpose |
|------|---------|----------|
| **Create cluster** | `kind create cluster --name hypo --config=infra/kind-config.yaml` | Spin up a local k8s environment |
| **Deploy demo** | `kubectl apply -k infra/demo-app` | Install the sample e‑commerce app |
| **Chaos Mesh** | `helm install chaos-mesh chaos-mesh/chaos-mesh …` | Enable chaos‑injection capabilities |
| **Prometheus** | `helm install prometheus prometheus-community/kube-prometheus-stack …` | Collect SLIs for measurement |
| **Backend** | `cd backend && poetry install && uvicorn app.main:app` | Start the API server |
| **Frontend** | `cd frontend && npm install && npm run dev` | Launch UI |
| **Run tests** | `cd backend && poetry run pytest -vv` | Verify end‑to‑end pipeline |

---

## 13. Frequently asked questions

* **Do I need a cloud provider?** – No. All components run locally with Kind/Docker.
* **What if I get “Failed to pull image” errors?** – Ensure Docker Desktop is using the default Linux containers engine and that the images built by the backend (`hypo-backend`) are present (`docker images`). The `poetry install` step builds the required image via the `docker-compose.yml` helper.
* **Can I use Minikube instead of Kind?** – Yes, replace the Kind commands with the equivalent `minikube start` and apply the manifests; the rest of the workflow is identical.
* **Where are the generated findings summaries stored?** – In the experiment result model (`backend/app/modules/experiments/models.py`), persisted in the SQLite DB at `backend/data/hypo.db` (path configurable via `HYPO_DB_URL`).

---

### Ready to present!
Follow the steps above on a fresh machine, and you will have a fully functional Hypo platform, the demo app, and a verified end‑to‑end chaos‑engineering workflow ready for live demonstration.

---

*If you need a diagram of the architecture or a visual walkthrough, let me know and I can generate a mermaid chart.*
