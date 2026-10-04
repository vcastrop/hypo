#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  install-chaos-mesh.sh
#  Installs Chaos Mesh on the mybookstore kind cluster via Helm.
#
#  Prerequisites:
#    - kind cluster "mybookstore" is running
#    - kubectl is configured to use that cluster
#    - Helm 3 is installed
#
#  Usage:
#    bash infra/demo-app/chaos-mesh/install-chaos-mesh.sh
# ---------------------------------------------------------------------------

set -euo pipefail

CHAOS_MESH_VERSION="${CHAOS_MESH_VERSION:-2.7.1}"
NAMESPACE="chaos-mesh"

echo "================================================================"
echo "  Installing Chaos Mesh v${CHAOS_MESH_VERSION}"
echo "  Target cluster: $(kubectl config current-context)"
echo "================================================================"

# ---- 1. Add / update the Helm repo ----
echo ""
echo ">>> Adding chaos-mesh Helm repository..."
helm repo add chaos-mesh https://charts.chaos-mesh.org 2>/dev/null || true
helm repo update

# ---- 2. Create namespace ----
echo ""
echo ">>> Creating namespace '${NAMESPACE}'..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# ---- 3. Install / upgrade the Helm release ----
echo ""
echo ">>> Installing Chaos Mesh Helm chart..."
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace "${NAMESPACE}" \
  --version "${CHAOS_MESH_VERSION}" \
  --set chaosDaemon.runtime=containerd \
  --set chaosDaemon.socketPath=/run/containerd/containerd.sock \
  --set dashboard.securityMode=false \
  --set controllerManager.replicaCount=1 \
  --set controllerManager.leaderElection.enabled=false \
  --wait \
  --timeout 15m

# ---- 4. Wait for pods ----
echo ""
echo ">>> Waiting for all Chaos Mesh pods to be ready..."
kubectl wait --for=condition=Ready pods --all \
  -n "${NAMESPACE}" \
  --timeout=120s

# ---- 5. Print status ----
echo ""
echo "================================================================"
echo "  Chaos Mesh installation complete!"
echo "================================================================"
echo ""
kubectl get pods -n "${NAMESPACE}"
echo ""
echo "Dashboard access:"
echo "  kubectl port-forward -n ${NAMESPACE} svc/chaos-dashboard 2333:2333"
echo "  Open: http://localhost:2333"
echo ""
