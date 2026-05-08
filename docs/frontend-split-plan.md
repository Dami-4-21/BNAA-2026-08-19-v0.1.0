# Frontend Split Plan

This file documents the safe preparation for moving the live root Next.js app into `frontend/` without breaking the running SaaS.

Safety references:

- `docs/safety.md`
- `docs/rebuild-phases-tracker.md`
- `docs/technical-infrastructure-documentation.md`

## Objective

Prepare the repository so the current root Next.js application can become the dedicated `frontend/` workspace at the right phase of the rebuild.

This preparation must remain:

- additive
- reversible
- non-breaking for the live Docker deployment

## Current State

The live frontend still runs from the repository root with:

- `src/app`
- `src/components`
- `src/lib`
- `src/store`
- `src/types`
- `public`

The live runtime, Docker image, and deployment topology remain unchanged in Phase 1.

## Target State

The target frontend workspace from the BNAA specification is:

```text
frontend/
  app/
  components/
  lib/
  public/
  store/
  types/
```

## Planned Move Map

| Current path | Target path | Notes |
|---|---|---|
| `src/app` | `frontend/app` | includes auth, workspace, API route handlers only when frontend cutover is approved |
| `src/components` | `frontend/components` | shared UI and domain components |
| `src/lib` | `frontend/lib` | client helpers, compat bridges, frontend-side utilities |
| `src/store` | `frontend/store` | Zustand stores |
| `src/types` | `frontend/types` | frontend-only shared types |
| `public` | `frontend/public` | static files, service worker, icons |

## What This Preparation Includes

- create the target `frontend/` directory
- create the target top-level folders
- document the move map
- keep the live root app untouched

## What This Preparation Does Not Do

- it does not move runtime files
- it does not change the Docker build
- it does not change API routes or public contracts
- it does not change the live Next.js entrypoint
- it does not remove any existing root application file

## Cutover Preconditions

Before runtime code is moved to `frontend/`, the following must already be true:

1. shared frontend data layer is stable
2. rebuild route bridges are consistent
3. deployment scripts are updated to build from `frontend/`
4. root import aliases and config files are adjusted in one controlled step
5. Docker build can be validated without touching API contracts

## Validation Rules For The Future Cutover

When the actual move happens later:

- `npm run lint` must pass
- `npm run build` must pass
- Docker `web` rebuild must pass
- the live app must return `200 OK`
- no API route path or contract may change
- feature parity must be preserved

## Reason This Exists In Phase 1

The rebuild tracker explicitly calls for repo split preparation before the real frontend cutover. This file exists so the team can prepare the target workspace safely without making the big move too early.
