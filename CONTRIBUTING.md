# Contributing to Hypo

This document defines how the team collaborates on this repository: branching strategy, commit conventions, issue workflow, and code review expectations.

## Branching strategy

- `main` — protected branch. Always deployable/stable. No direct pushes.
- `feature/<short-description>` — for new features or backlog items (e.g. `feature/iac-analyzer`, `feature/chaos-engine-podkill`)
- `fix/<short-description>` — for bug fixes (e.g. `fix/prometheus-scrape-config`)
- `docs/<short-description>` — for documentation-only changes (e.g. `docs/update-architecture-diagram`)

Every change to `main` goes through a Pull Request. At least one other team member must review and approve before merging.

## Commit conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description>
```

Common types:

- `feat:` — a new feature (e.g. `feat(analyzer): add rule for missing PodDisruptionBudget`)
- `fix:` — a bug fix (e.g. `fix(backend): correct namespace filter in service discovery`)
- `docs:` — documentation changes (e.g. `docs: update README with architecture diagram`)
- `chore:` — maintenance tasks, dependency bumps, config changes
- `test:` — adding or updating tests
- `refactor:` — code change that neither fixes a bug nor adds a feature

Examples:

```
feat(chaos-engine): implement pod-kill experiment runner
fix(frontend): fix experiment status not updating in real time
docs(adr): add ADR-0002 for single-cluster scope decision
```

## Issue workflow

1. Every piece of work starts as a GitHub Issue, linked to its corresponding backlog item (PB-XX) and assigned to a milestone (Sprint 0, Sprint 1, Sprint 2, Final Sprint).
2. Move the issue across the project board columns: `Backlog` → `In Progress` → `In Review` → `Done`.
3. Reference the issue number in your branch and PR (e.g. `feature/pb-03-chaos-experiments`, PR description includes `Closes #12`).
4. Keep issues scoped: if a task grows too large, split it into sub-issues.

## Pull requests

- Keep PRs focused and reasonably small — easier to review, easier to trace.
- Include a short description of what changed and why.
- Link the related issue (`Closes #<issue-number>`).
- Make sure CI passes before requesting review.
- At least one approval required before merging into `main`.

## Experiment evidence

Any Chaos Engineering experiment run (manual or automated) must be documented under `experiments/<date>-<experiment-name>/` following the team's experiment template (objective, steady state, hypothesis, target, failure, blast radius, metrics, abort condition, duration, result, economic impact, recommendations). This is required evidence for the course rubric — don't skip it even for "quick" manual tests.

## Architecture Decision Records (ADRs)

Significant technical decisions (e.g. choosing Chaos Mesh as the fault-injection engine, single-cluster scope, comparison design for experiments) must be recorded as an ADR under `docs/architecture/decisions/`. Use a simple format: context, decision, consequences.

## Code style

- Keep functions and modules small and single-purpose.
- Add comments where the "why" isn't obvious from the code.
- Write tests for backend/analyzer logic where feasible given the semester timeline.

## Communication

- Use GitHub Issues/PRs for anything that should be traceable.
- Use team chat for quick coordination, but decisions that affect scope or architecture should end up written down (ADR, issue, or README update).