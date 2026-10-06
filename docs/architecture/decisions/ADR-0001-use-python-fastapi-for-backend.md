# ADR-0001: Use Python + FastAPI for the Hypo backend

## Context

Hypo needs a backend that talks to the Kubernetes API, later to Prometheus and Chaos Mesh, and that can host a Python-based IaC analyzer ("Trivy + Python Engine" in the Sprint 0 proposal). The proposal does not pin a language or framework. The traffic generator already uses Spring Boot, which would introduce a second language inside the Hypo platform itself if the API followed that stack.

## Decision

Implement the Hypo backend as a single Python 3.12 service using FastAPI and Uvicorn. Configuration uses Pydantic v2 and pydantic-settings. The official `kubernetes` Python client is the Kubernetes integration.

## Consequences

- Backend and the future analyzer share one language.
- FastAPI provides OpenAPI docs at `/docs` with little extra work.
- The official Kubernetes client is mature, but it is synchronous. Endpoints that call it must be regular `def` functions so FastAPI runs them in a thread pool.
- Spring Boot was considered and rejected to avoid splitting Hypo's own code between Java and Python.
