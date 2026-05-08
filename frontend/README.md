# Frontend Workspace Scaffold

This directory is the target home for the BNAA frontend after the live root Next.js app is moved out of the repository root.

Current rule:

- The root Next.js app remains the live product during Phase 1.
- This `frontend/` directory is an additive scaffold only.
- No runtime code is executed from this directory yet.

Target structure from the BNAA specification:

```text
frontend/
  app/
  components/
  lib/
  public/
  store/
  types/
```

Planned move map:

| Current live path | Target path |
|---|---|
| `src/app` | `frontend/app` |
| `src/components` | `frontend/components` |
| `src/lib` | `frontend/lib` |
| `src/store` | `frontend/store` |
| `src/types` | `frontend/types` |
| `public` | `frontend/public` |

Operational guardrails:

- Do not move runtime files here until the tracker explicitly schedules the cutover step.
- Do not change live API routes or route contracts as part of this scaffold.
- Keep the root app buildable until the frontend cutover is approved and validated.

See:

- `docs/rebuild-phases-tracker.md`
- `docs/safety.md`
- `docs/frontend-split-plan.md`
