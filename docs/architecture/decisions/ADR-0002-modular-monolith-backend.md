# ADR-0002: Modular monolith for the Hypo backend

## Context

The Sprint 0 proposal describes nine microservices behind Kong. The Sprint 2 and Sprint 3 GitHub backlog describes one backend: Kubernetes discovery, experiment execution, reporting, and economic impact. Splitting into nine services now would add operational cost without matching the current issues.

## Decision

Ship one FastAPI process with internal modules (`discovery`, `experiments`, `reports`, `economics`) and a strict layering rule:

- `api/` translates HTTP to service calls and does not import `kubernetes`.
- `modules/<x>/` holds business logic and does not import FastAPI.
- `integrations/` is the only layer that talks to Kubernetes, Prometheus, and Chaos Mesh.
- Shared types and helpers live in `core/`. Modules must not import each other in a cycle.

The HTTP business prefix is `/api/v1`. Liveness is `GET /health` at the root and does not depend on external systems.

## Consequences

- Local development and deployment stay simple (one process, one image).
- Module boundaries remain extractable later if the team splits services.
- Coupling risk is mitigated by the layering rules, not by network hops.
- This ADR does not introduce a database, authentication, or service mesh; those arrive with later backlog items.
