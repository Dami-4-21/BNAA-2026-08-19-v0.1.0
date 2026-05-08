# BnaaSaaS Rebuild Phases Tracker

This file is the canonical tracker for the SaaS rebuild based on the May 2025 specification.

Safety reference: `docs/safety.md`

## Update Rule

- Mark a task with `[x]` only when it is implemented in the rebuild lane or in the live compatibility bridge.
- Keep a task as `[ ]` if the feature only exists in the legacy in-app backend and has not been migrated yet.
- Update this file every time a rebuild task is completed so the implementation order stays accurate.

## Implementation Order

1. Phase 1 - Foundation and Safe Migration
2. Phase 2 - Frontend Core and Design System Reset
3. Phase 3 - Site / Chantier Rebuild
4. Phase 4 - Documents / GED Rebuild
5. Phase 5 - Finance Rebuild
6. Phase 6 - Shared Services, QA, and Final Cutover

## Current Rule of Operation

- The current root Next.js app remains the live product.
- The new `backend/` service is the rebuild lane.
- Compatibility bridges are the safe path to move the live SaaS route by route.

## Phase 1 - Foundation and Safe Migration

Goal: build the new backend foundation in parallel and start cutting over access paths safely behind feature flags.

### Completed

- [x] Create the new NestJS backend workspace in `backend/`.
- [x] Add the Prisma multi-schema foundation in `backend/prisma/`.
- [x] Add the backend module tree for `auth`, `tenants`, `users`, `projects`, `site-reports`, `documents`, `finance`, `storage`, `pdf`, `notifications`, and `queue`.
- [x] Add the parallel Docker lane for `postgres`, `api`, and the current `web`.
- [x] Implement tenant registration and tenant schema provisioning.
- [x] Add tenant provisioning rollback so partial tenant setup is cleaned if provisioning fails.
- [x] Add bootstrapped pilot tenant, users, projects, and memberships for compatibility migration.
- [x] Implement auth foundation in the rebuild backend:
- [x] Login
- [x] Refresh
- [x] Logout
- [x] Invite acceptance
- [x] Reset-password token flow
- [x] 2FA setup / enable / disable
- [x] `/api/v1/auth/me`
- [x] Wire invite and reset email delivery with safe fallback when `RESEND_API_KEY` is not configured.
- [x] Implement rebuild `users` API basics:
- [x] List
- [x] Me
- [x] Invite
- [x] Role change
- [x] Deactivate
- [x] Implement rebuild `projects` API basics:
- [x] List
- [x] Create
- [x] Detail
- [x] Members
- [x] Add member
- [x] Add server feature flags for rebuild auth and rebuild projects bridges.
- [x] Bridge current login/session to the rebuild API behind a flag.
- [x] Bridge `/api/workspace` and the project selector to rebuild project scope.
- [x] Bridge `/api/projects` to rebuild project scope and rebuild member counts.
- [x] Bridge `/api/search` to rebuild project scope.
- [x] Bridge `/api/projects/[projectId]/dashboard` access to rebuild project scope.
- [x] Bridge `/api/notifications` scope and notification actions to rebuild project scope.
- [x] Clean duplicate bridge logic by centralizing shared rebuild helpers in `src/lib/rebuild-auth.ts`.
- [x] Clean duplicate notification alert logic by extracting shared helpers into `src/lib/backend/notification-utils.ts`.

### Remaining

- [x] Harden tenant provisioning with a real migration-driven schema contract instead of relying on template cloning only.
- [x] Bridge the `admin` read path to the rebuild tenant/project scope.
- [x] Complete the first full live domain cutover so one area is served by rebuild data, not only rebuild access rules.
- [x] Start the frontend data-layer migration to the spec stack:
- [x] Zustand
- [x] TanStack Query
- [x] React Hook Form
- [x] Zod
- [x] Remove frontend dependence on static seeded credentials and demo login shortcuts.
- [x] Replace name-only rebuild compatibility matching with canonical pilot compatibility records and stable backend-ID-first fallback mapping.
- [x] Replace the fixed legacy service clock with runtime date helpers.
- [x] Decouple shared live payload types from `mock-data` runtime inference.
- [x] Choose one canonical pilot seed source and make both the legacy web seed and the rebuild bootstrap consume it.
- [x] Prepare the repo split so the current root Next app can become `frontend/`.
- [x] Define and implement the shared compat bridge pattern for the next route families so future cutovers stay consistent.

### Phase 1 Exit Criteria

- Auth/session is rebuild-backed behind flags.
- Workspace/project access is rebuild-backed behind flags.
- One real live domain is served by the rebuild backend, not just access-filtered through compatibility helpers.

## Phase 2 - Frontend UX and Interaction Refinement

Goal: move the live frontend toward the spec stack and UX model from the spec without changing the current visual design language of the SaaS.

Execution rule for this phase:

- keep the current BNAA visual design and general UI look-and-feel
- improve UX, interaction clarity, navigation, feedback states, and accessibility
- do not treat this phase as a visual redesign

Reference: `docs/phase-2-ux-strategy.md`

### Tasks

- [x] Create the target `frontend/` structure and plan the move out of the current repo root.
- [x] Define the Phase 2 UX strategy while preserving the current visual design.
- [x] Simplify role-based navigation without changing route contracts.
- [ ] Rework the dashboard into an action-first work queue by role.
- [ ] Simplify the `Site` flow for field speed and mobile clarity.
- [ ] Simplify the `Documents` flow into a guided publish/distribute/follow-up sequence.
- [ ] Simplify the `Finance` flow into a clear statement -> validation -> payment sequence.
- [ ] Improve project setup and admin usability without reducing current capabilities.
- [ ] Improve notifications as an action queue with stronger triage.
- [ ] Standardize UX state quality across the SaaS:
- [ ] empty states
- [ ] loading states
- [ ] disabled-state reasons
- [ ] inline validation
- [ ] offline messaging
- [ ] error recovery states
- [ ] Improve accessibility and operational readability across primary flows.
- [ ] Add shared formatting utilities:
- [ ] `formatTND`
- [ ] `formatDate`
- [ ] `timeAgo`
- [ ] `formatVersion`
- [ ] Introduce Zustand for session/workspace/app-shell state.
- [ ] Introduce TanStack Query for server reads and mutations.
- [ ] Introduce React Hook Form + Zod on the first production flows.
- [ ] Rebuild the shared app shell and role layouts on the new frontend stack.

### Phase 2 Exit Criteria

- The app shell and shared data layer follow the new stack.
- Rebuild-backed routes can be consumed cleanly without legacy fetch/state patterns.
- The current visual design is preserved while UX clarity, navigation, and feedback quality are materially improved.

## Phase 3 - Site / Chantier Rebuild

Goal: rebuild the `Site` domain on the new backend and frontend stack while preserving the working MVP flow.

### Backend Tasks

- [ ] Create or finalize rebuild schema/models for:
- [ ] daily reports
- [ ] report incidents
- [ ] site photos
- [ ] non-conformities
- [ ] non-conformity photos
- [ ] Implement rebuild endpoints for:
- [ ] create report
- [ ] list reports
- [ ] report detail
- [ ] update report
- [ ] prepare/sign report
- [ ] create/list/update/close NCR
- [ ] photo upload and metadata
- [ ] Implement PDF generation on the rebuild backend for daily reports.
- [ ] Implement report lifecycle enforcement:
- [ ] draft
- [ ] pending signature
- [ ] signed
- [ ] Implement GPS / EXIF / thumbnail handling as required by the spec.
- [ ] Implement notifications and email triggers for report and NCR events.

### Frontend Tasks

- [ ] Rebuild reports list against the rebuild API.
- [ ] Rebuild the mobile report form with autosave and draft recovery.
- [ ] Rebuild photo journal and task/zone association.
- [ ] Rebuild the NCR board and detail flow.
- [ ] Rebuild chantier dashboard metrics from the rebuild backend.
- [ ] Connect the PDF and approval flow to rebuild APIs.

### Cutover Tasks

- [ ] Add a feature-flagged compat bridge for `/api/projects/[projectId]/site`.
- [ ] Replace the legacy site route with rebuild-backed data once parity is validated.

### Phase 3 Exit Criteria

- The full `RJC -> PDF -> validation`, `photo`, and `NCR` workflows run from rebuild APIs.

## Phase 4 - Documents / GED Rebuild

Goal: rebuild the `Documents` domain on the new backend and frontend stack while preserving the current working GED experience.

### Backend Tasks

- [ ] Create or finalize rebuild schema/models for:
- [ ] documents
- [ ] document versions
- [ ] document distributions
- [ ] document read acknowledgements
- [ ] document search vector / indexes
- [ ] Implement rebuild endpoints for:
- [ ] list documents
- [ ] document detail
- [ ] publish version
- [ ] mark obsolete
- [ ] distribute
- [ ] acknowledge read
- [ ] full-text search
- [ ] Implement controlled distribution and per-recipient read traceability.
- [ ] Implement current-version switching and obsolete-version rules.
- [ ] Implement presigned/object-storage-ready file flow.
- [ ] Implement PDF comparison support against rebuild version records.

### Frontend Tasks

- [ ] Rebuild the document library on rebuild APIs.
- [ ] Rebuild publish / version history / diffusion / read follow-up screens.
- [ ] Rebuild version comparison against rebuild file/version records.
- [ ] Rebuild offline plan preparation against rebuild storage flow.

### Cutover Tasks

- [ ] Add a feature-flagged compat bridge for `/api/projects/[projectId]/documents`.
- [ ] Replace the legacy documents route with rebuild-backed data once parity is validated.

### Phase 4 Exit Criteria

- The full `publish -> distribute -> acknowledge -> compare` flow runs from rebuild APIs.

## Phase 5 - Finance Rebuild

Goal: rebuild the `Finance` domain on the new backend and frontend stack while preserving the current operational invoice/payment flow.

### Backend Tasks

- [ ] Create or finalize rebuild schema/models for:
- [ ] statements
- [ ] invoices
- [ ] payments
- [ ] Implement rebuild endpoints for:
- [ ] create monthly statement
- [ ] statement detail
- [ ] create invoice
- [ ] validate invoice
- [ ] register payment
- [ ] financial summary
- [ ] cashflow
- [ ] Implement statement calculation from chantier progress.
- [ ] Implement invoice numbering rules from the specification.
- [ ] Implement retention / advance deduction rules.
- [ ] Implement payment reconciliation and overdue rules.
- [ ] Implement finance notifications and email triggers.
- [ ] Implement PDF generation on the rebuild backend for invoices/statements.

### Frontend Tasks

- [ ] Rebuild finance overview, statement, invoice, and payment screens on rebuild APIs.
- [ ] Rebuild the finance step flow:
- [ ] Preparer le decompte
- [ ] Envoyer
- [ ] Validation projet
- [ ] Validation client
- [ ] Paiement recu
- [ ] Rebuild treasury and KPI summaries from rebuild APIs.

### Cutover Tasks

- [ ] Add a feature-flagged compat bridge for `/api/projects/[projectId]/finance`.
- [ ] Replace the legacy finance route with rebuild-backed data once parity is validated.

### Phase 5 Exit Criteria

- The full `statement -> invoice -> validation -> payment` flow runs from rebuild APIs.

## Phase 6 - Shared Services, QA, and Final Cutover

Goal: finish the MVP rebuild and retire the legacy internal backend path safely.

### Shared Services

- [ ] Move rebuild storage to the target object-storage flow (`MinIO` / compatible).
- [ ] Wire BullMQ / Redis jobs for emails, PDFs, reminders, and deferred work.
- [ ] Expand rebuild notifications to cover all module events from the spec.
- [ ] Expand rebuild search aggregation across the migrated domains.
- [ ] Expand rebuild audit/activity feeds across the migrated domains.

### QA and Cutover

- [ ] Run role-by-role QA on rebuild-backed flows:
- [ ] Conducteur
- [ ] Bureau d'etudes
- [ ] Comptable
- [ ] Maitre d'ouvrage
- [ ] Super Admin
- [ ] Remove remaining route dependencies on the legacy in-app backend for MVP scope.
- [ ] Switch live feature flags so MVP modules run on rebuild APIs by default.
- [ ] Freeze and document rollback steps for the cutover.
- [ ] Update Docker/Nginx/env/runbook documentation for the final topology.

### Phase 6 Exit Criteria

- MVP scope (`Auth`, `Site`, `Documents`, `Finance`, `Settings/Admin`) runs on the rebuild architecture.
- The legacy internal backend is no longer the source of truth for MVP routes.
