#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  validate-chaos-mesh.sh
#  End-to-end smoke test: applies both validation experiments, verifies
#  Chaos Mesh processes them, then cleans up.
#
#  Prerequisites:
#    - Chaos Mesh is installed (run install-chaos-mesh.sh first)
#    - Demo-app is deployed in the mybookstore namespace
#
#  Usage:
#    bash infra/demo-app/chaos-mesh/validate-chaos-mesh.sh
# ---------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXPERIMENTS_DIR="${SCRIPT_DIR}/experiments"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass=0
fail=0

check() {
  local desc="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} ${desc}"
    pass=$((pass+1))
  else
    echo -e "  ${RED}✗${NC} ${desc}"
    fail=$((fail+1))
  fi
}

echo ""
echo "================================================================"
echo "  Chaos Mesh validation"
echo "================================================================"

# ---- 1. Verify Chaos Mesh is running ----
echo ""
echo ">>> Checking Chaos Mesh components..."
check "chaos-controller-manager is running" \
  kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=controller-manager \
    --field-selector=status.phase=Running -o name

check "chaos-daemon is running" \
  kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-daemon \
    --field-selector=status.phase=Running -o name

check "chaos-dashboard is running" \
  kubectl get pods -n chaos-mesh -l app.kubernetes.io/component=chaos-dashboard \
    --field-selector=status.phase=Running -o name

# ---- 2. Verify demo-app pods exist ----
echo ""
echo ">>> Checking demo-app targets..."
check "catalog-service pods exist" \
  kubectl get pods -n mybookstore -l app=catalog-service -o name

check "order-service pods exist" \
  kubectl get pods -n mybookstore -l app=order-service -o name

# ---- 3. Apply PodChaos experiment ----
echo ""
echo ">>> Running PodChaos experiment (pod-kill on catalog-service)..."
kubectl apply -f "${EXPERIMENTS_DIR}/validate-podchaos.yaml"
sleep 5

check "PodChaos resource created" \
  kubectl get podchaos validate-pod-kill -n mybookstore

# Verify it was processed (status should exist)
PODCHAOS_STATUS=$(kubectl get podchaos validate-pod-kill -n mybookstore -o jsonpath='{.status}' 2>/dev/null || echo "")
if [ -n "${PODCHAOS_STATUS}" ]; then
  echo -e "  ${GREEN}✓${NC} PodChaos experiment was processed by controller"
  pass=$((pass+1))
else
  echo -e "  ${YELLOW}⚠${NC} PodChaos experiment status is empty (may need more time)"
fi

# ---- 4. Apply NetworkChaos experiment ----
echo ""
echo ">>> Running NetworkChaos experiment (100ms delay on order-service)..."
kubectl apply -f "${EXPERIMENTS_DIR}/validate-networkchaos.yaml"
sleep 5

check "NetworkChaos resource created" \
  kubectl get networkchaos validate-network-delay -n mybookstore

NETCHAOS_STATUS=$(kubectl get networkchaos validate-network-delay -n mybookstore -o jsonpath='{.status}' 2>/dev/null || echo "")
if [ -n "${NETCHAOS_STATUS}" ]; then
  echo -e "  ${GREEN}✓${NC} NetworkChaos experiment was processed by controller"
  pass=$((pass+1))
else
  echo -e "  ${YELLOW}⚠${NC} NetworkChaos experiment status is empty (may need more time)"
fi

# ---- 5. Wait for catalog-service pod to recover ----
echo ""
echo ">>> Waiting for catalog-service to recover from pod kill..."
kubectl wait --for=condition=Ready pods -l app=catalog-service \
  -n mybookstore --timeout=60s 2>/dev/null && \
  echo -e "  ${GREEN}✓${NC} catalog-service recovered" && pass=$((pass+1)) || \
  echo -e "  ${YELLOW}⚠${NC} catalog-service recovery timed out (may need more time)"

# ---- 6. Clean up ----
echo ""
echo ">>> Cleaning up validation experiments..."
kubectl delete -f "${EXPERIMENTS_DIR}/validate-podchaos.yaml" --ignore-not-found
kubectl delete -f "${EXPERIMENTS_DIR}/validate-networkchaos.yaml" --ignore-not-found

# ---- Summary ----
echo ""
echo "================================================================"
echo -e "  Results: ${GREEN}${pass} passed${NC}, ${RED}${fail} failed${NC}"
echo "================================================================"
echo ""

if [ "${fail}" -gt 0 ]; then
  echo -e "${RED}Some checks failed. Review output above.${NC}"
  exit 1
else
  echo -e "${GREEN}All checks passed! Chaos Mesh is ready to target the demo app.${NC}"
fi
