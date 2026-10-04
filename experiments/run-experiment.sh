#!/usr/bin/env bash
# Uso: bash experiments/run-experiment.sh <carpeta> <yaml> <nombre-chaos>
set -euo pipefail

[ "$(kubectl config current-context)" = "kind-mybookstore" ] || { echo "Contexto incorrecto"; exit 1; }

EXP=$1; YAML=$2; CHAOS=$3
mkdir -p "$EXP"

q() { curl -s localhost:9090/api/v1/query --data-urlencode "query=$1"; }

snap() {
  for i in $(seq 1 20); do
    curl -s -o /dev/null -m 2 -w "%{http_code} %{time_total}\n" http://localhost:8081/api/books/
  done > "$EXP/$1-client-latency.txt"
  kubectl get pods -n mybookstore -l app=catalog-service -o wide > "$EXP/$1-pods.txt"
  q 'sum(rate(http_requests_total{job="catalog-service"}[1m]))' > "$EXP/$1-request-rate.json"
  q '100*sum(rate(http_requests_total{job="catalog-service",status=~"2..|3.."}[1m]))/sum(rate(http_requests_total{job="catalog-service"}[1m]))' > "$EXP/$1-success-rate.json"
  q 'histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket{job="catalog-service"}[1m])) by (le))' > "$EXP/$1-p95.json"
  q 'sum(up{job="catalog-service"})/count(up{job="catalog-service"})*100' > "$EXP/$1-availability.json"
}

echo ">>> BEFORE"
snap before
kubectl get networkchaos -n mybookstore > "$EXP/before-chaos.txt" 2>&1 || true
echo "START $(date '+%Y-%m-%d %H:%M:%S %z')" > "$EXP/timestamps.txt"

echo ">>> INYECTANDO $CHAOS"
SECONDS=0
kubectl apply -f "$YAML"

sleep 30
echo ">>> DURING"
snap during
kubectl get networkchaos "$CHAOS" -n mybookstore -o yaml > "$EXP/during-chaos.yaml"

while [ $SECONDS -lt 120 ]; do sleep 2; done
echo ">>> AFTER"
snap after
kubectl get networkchaos "$CHAOS" -n mybookstore -o yaml > "$EXP/after-chaos.yaml"
echo "END $(date '+%Y-%m-%d %H:%M:%S %z')" >> "$EXP/timestamps.txt"

kubectl delete -f "$YAML" --ignore-not-found
echo ">>> Listo. Evidencia en $EXP"
