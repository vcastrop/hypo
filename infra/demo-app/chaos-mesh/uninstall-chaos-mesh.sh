#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  uninstall-chaos-mesh.sh
#  Removes Chaos Mesh from the cluster.
# ---------------------------------------------------------------------------

set -euo pipefail

NAMESPACE="chaos-mesh"

echo ">>> Uninstalling Chaos Mesh Helm release..."
helm uninstall chaos-mesh -n "${NAMESPACE}" 2>/dev/null || true

echo ">>> Removing Chaos Mesh CRDs..."
kubectl get crd | grep chaos-mesh.org | awk '{print $1}' | \
  xargs -r kubectl delete crd 2>/dev/null || true

echo ">>> Deleting namespace '${NAMESPACE}'..."
kubectl delete namespace "${NAMESPACE}" --ignore-not-found

echo ""
echo "Chaos Mesh has been removed from the cluster."
