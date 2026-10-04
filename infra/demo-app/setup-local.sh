#!/usr/bin/env bash
set -euo pipefail

kind create cluster --config infra/demo-app/kind-config.yaml
kubectl config use-context kind-mybookstore

for s in catalog user cart order review wishlist; do
  docker build -t mybookstore/$s-service:dev workload/demo-app/microservices/$s-service
done
docker build --build-arg VITE_API_URL=/ -t mybookstore/frontend:dev workload/demo-app/frontend

kind load docker-image \
  mybookstore/{catalog,user,cart,order,review,wishlist}-service:dev \
  mybookstore/frontend:dev --name mybookstore

for f in namespace redis mongodb postgres-user postgres-order catalog-service \
         user-service review-service wishlist-service cart-service order-service \
         api-gateway-config api-gateway frontend prometheus \
         grafana-dashboard-configmap grafana; do
  kubectl apply -f infra/demo-app/$f.yaml
done

bash infra/demo-app/chaos-mesh/install-chaos-mesh.sh
