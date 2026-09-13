# MyBookstore Kubernetes Deployment

This folder contains the Kubernetes manifests used to run the MyBookstore demo app for Hypo.

The local setup uses kind with 1 control-plane, 2 worker nodes and the `mybookstore` namespace. Application services run with 2 replicas, while MongoDB, Redis and PostgreSQL run with 1.

## Create the cluster

From the repository root:

```bash
kind create cluster --config infra/demo-app/kind-config.yaml
```

## Build the images

```bash
docker build -t mybookstore/catalog-service:dev workload/demo-app/microservices/catalog-service
docker build -t mybookstore/user-service:dev workload/demo-app/microservices/user-service
docker build -t mybookstore/cart-service:dev workload/demo-app/microservices/cart-service
docker build -t mybookstore/order-service:dev workload/demo-app/microservices/order-service
docker build -t mybookstore/review-service:dev workload/demo-app/microservices/review-service
docker build -t mybookstore/wishlist-service:dev workload/demo-app/microservices/wishlist-service
docker build --build-arg VITE_API_URL=/ -t mybookstore/frontend:dev workload/demo-app/frontend
```

## Load the images into kind

```bash
kind load docker-image \
  mybookstore/catalog-service:dev \
  mybookstore/user-service:dev \
  mybookstore/cart-service:dev \
  mybookstore/order-service:dev \
  mybookstore/review-service:dev \
  mybookstore/wishlist-service:dev \
  mybookstore/frontend:dev \
  --name mybookstore
```

## Deploy the app

```bash
kubectl apply -f infra/demo-app/namespace.yaml
kubectl apply -f infra/demo-app/redis.yaml
kubectl apply -f infra/demo-app/mongodb.yaml
kubectl apply -f infra/demo-app/postgres-user.yaml
kubectl apply -f infra/demo-app/postgres-order.yaml
kubectl apply -f infra/demo-app/catalog-service.yaml
kubectl apply -f infra/demo-app/user-service.yaml
kubectl apply -f infra/demo-app/review-service.yaml
kubectl apply -f infra/demo-app/wishlist-service.yaml
kubectl apply -f infra/demo-app/cart-service.yaml
kubectl apply -f infra/demo-app/order-service.yaml
kubectl apply -f infra/demo-app/api-gateway-config.yaml
kubectl apply -f infra/demo-app/api-gateway.yaml
kubectl apply -f infra/demo-app/frontend.yaml
```

## Check the deployment

```bash
kubectl get pods -n mybookstore
kubectl get deployments -n mybookstore
kubectl get services -n mybookstore
```

## Open the app

```bash
kubectl port-forward -n mybookstore service/frontend 3000:80
```

Then open:

`http://localhost:3000`

## Delete the local cluster

```bash
kind delete cluster --name mybookstore
```

This deletes the local kind cluster and its temporary data.