# Chaos Mesh – MyBookstore Demo App

This directory contains everything needed to install [Chaos Mesh](https://chaos-mesh.org/) on the local kind cluster and validate it can target the MyBookstore demo-app services.

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| kind | 0.20+ |
| kubectl | 1.27+ |
| Helm | 3.12+ |

The **mybookstore** kind cluster must already be running with the demo app deployed. See the [parent README](../README.md) for setup instructions.

## Quick start

From the **repository root**:

```bash
# 1. Install Chaos Mesh
bash infra/demo-app/chaos-mesh/install-chaos-mesh.sh

# 2. Validate it can target the demo app
bash infra/demo-app/chaos-mesh/validate-chaos-mesh.sh
```

## What gets installed

The Helm chart deploys three components into the `chaos-mesh` namespace:

| Component | Purpose |
|-----------|---------|
| **chaos-controller-manager** | Watches ChaosExperiment CRDs and orchestrates fault injection |
| **chaos-daemon** | DaemonSet that runs on every node; performs the actual fault injection (kill, netem, etc.) |
| **chaos-dashboard** | Web UI for creating/monitoring experiments |

## Accessing the dashboard

```bash
kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333
```

Open: [http://localhost:2333](http://localhost:2333)

> Security mode is disabled for local development. Do **not** use this configuration in production.

## Validation experiments

Two sample experiments are provided in [`experiments/`](./experiments/):

### 1. PodChaos – Pod kill (`validate-podchaos.yaml`)

Kills one `catalog-service` pod to verify:
- Chaos Mesh can select pods via label `app: catalog-service` in namespace `mybookstore`
- Kubernetes self-heals by restarting the pod

### 2. NetworkChaos – Latency injection (`validate-networkchaos.yaml`)

Injects **100 ms** of network delay into all `order-service` pods for **30 seconds** to verify:
- Chaos Mesh can manipulate network conditions via `tc`/`netem`
- The experiment auto-recovers after the duration

### Running validation manually

```bash
# Apply an experiment
kubectl apply -f infra/demo-app/chaos-mesh/experiments/validate-podchaos.yaml

# Watch the experiment status
kubectl describe podchaos validate-pod-kill -n mybookstore

# Clean up
kubectl delete -f infra/demo-app/chaos-mesh/experiments/validate-podchaos.yaml
```

## Uninstall

```bash
bash infra/demo-app/chaos-mesh/uninstall-chaos-mesh.sh
```

This removes the Helm release, all Chaos Mesh CRDs, and the `chaos-mesh` namespace.

## Directory structure

```
chaos-mesh/
├── install-chaos-mesh.sh          # Helm-based installer
├── validate-chaos-mesh.sh         # End-to-end smoke test
├── uninstall-chaos-mesh.sh        # Clean removal
├── experiments/
│   ├── validate-podchaos.yaml     # Sample pod-kill experiment
│   └── validate-networkchaos.yaml # Sample network-delay experiment
└── README.md                      # This file
```
