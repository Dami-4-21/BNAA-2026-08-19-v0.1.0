# Safety File

This file is the mandatory safety guardrail for all future work on BnaaSaaS.

## Rule Zero

Before any implementation, update, refactor, migration, or feature addition, check this file first.

If a planned change touches any locked item below, stop and ask the user for explicit approval before changing anything.

## Locked Items - Do Not Change Without Explicit User Approval

- Tech stack
- Roadmap and rebuild phase order
- System architecture
- Core rebuild strategy:
  - current root Next.js app remains the live product during migration
  - new `backend/` remains the rebuild lane
  - compatibility bridges remain the safe migration path
- MVP scope boundaries
- Deployment topology:
  - Docker-based server deployment
  - GitHub as source control
  - live server flow
- Multi-tenant direction
- Authentication direction and role model
- Primary module boundaries:
  - Site
  - Documents
  - Finance
  - Auth / Admin / Settings
- Database direction if it changes the agreed rebuild plan
- API contract direction if it changes the agreed rebuild plan

## Ask-First Changes

Ask for permission before changing any of the following:

- replacing a framework, library, or major dependency
- changing the rebuild phase order
- changing folder ownership in a way that alters the planned architecture
- changing the migration strategy between legacy and rebuild paths
- changing the live deployment model
- changing authentication/session strategy in a way that affects the agreed architecture
- changing project scope, role scope, or module scope
- removing a feature that already exists in the SaaS
- changing data flow in a way that can break existing working modules

## What Can Be Changed Safely Without Asking First

These are allowed as long as they do not violate the locked items above:

- bug fixes
- UX improvements
- safe refactors
- duplicate code cleanup
- route-level compatibility bridges
- backend hardening that stays inside the agreed architecture
- documentation updates
- tests
- validation improvements
- performance improvements
- clearer error states and loading states

## Approval Request Format

If a locked item is affected, ask the user before changing it and include:

1. what would change
2. why the change is needed
3. what risk exists if we do not change it
4. what parts of the SaaS are impacted
5. whether there is a safer alternative that keeps the current direction

Do not implement the change until the user approves it.

## Safety Principles

- Do not lose important existing SaaS features.
- Prefer additive and reversible changes.
- Prefer feature flags and compatibility bridges over big-bang rewrites.
- Clean duplicated code safely when possible.
- Keep GitHub and the server aligned after every approved change.

## Operating Reminder

Every new task should be evaluated in this order:

1. Check this safety file.
2. Confirm the task does not break locked items.
3. If it touches a locked item, ask for permission first.
4. If it is safe, implement it carefully.
5. Update the tracker when the task is completed.
