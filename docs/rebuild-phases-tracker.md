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
- [x] Rework the dashboard into an action-first work queue by role.
- [x] Simplify the `Site` flow for field speed and mobile clarity.
- [x] Simplify the `Documents` flow into a guided publish/distribute/follow-up sequence.
- [x] Simplify the `Finance` flow into a clear statement -> validation -> payment sequence.
- [x] Improve project setup and admin usability without reducing current capabilities.
- [x] Improve notifications as an action queue with stronger triage.
- [x] Standardize UX state quality across the SaaS:
- [x] empty states
- [x] loading states
- [x] disabled-state reasons
- [x] inline validation
- [x] offline messaging
- [x] error recovery states
- [x] Improve accessibility and operational readability across primary flows.
- [x] Add shared formatting utilities:
- [x] `formatTND`
- [x] `formatDate`
- [x] `timeAgo`
- [x] `formatVersion`
- [x] Introduce Zustand for session/workspace/app-shell state.
- [x] Introduce TanStack Query for server reads and mutations.
- [x] Introduce React Hook Form + Zod on the first production flows.
- [x] Rebuild the shared app shell and role layouts on the new frontend stack.

### Phase 2 Exit Criteria

- The app shell and shared data layer follow the new stack.
- Rebuild-backed routes can be consumed cleanly without legacy fetch/state patterns.
- The current visual design is preserved while UX clarity, navigation, and feedback quality are materially improved.

## Phase 3 - Site / Chantier Rebuild

Goal: rebuild the `Site` domain on the new backend and frontend stack while preserving the working MVP flow.

### Backend Tasks

- [x] Create or finalize rebuild schema/models for:
- [x] daily reports
- [x] report incidents
- [x] site photos
- [x] non-conformities
- [x] non-conformity photos
- [x] Implement rebuild endpoints for:
- [x] create report
- [x] list reports
- [x] report detail
- [x] update report
- [x] prepare/sign report
- [x] create/list/update/close NCR
- [x] photo upload and metadata
- [x] Implement PDF generation on the rebuild backend for daily reports.
- [x] Implement report lifecycle enforcement:
- [x] draft
- [x] pending signature
- [x] signed
- [x] Implement GPS / EXIF / thumbnail handling as required by the spec.
- [x] Implement notifications and email triggers for report and NCR events.

### Frontend Tasks

- [x] Rebuild reports list against the rebuild API.
- [x] Rebuild the mobile report form with autosave and draft recovery.
- [x] Rebuild photo journal and task/zone association.
- [x] Rebuild the NCR board and detail flow.
- [x] Rebuild chantier dashboard metrics from the rebuild backend.
- [x] Connect the PDF and approval flow to rebuild APIs.

### Cutover Tasks

- [x] Add a feature-flagged compat bridge for `/api/projects/[projectId]/site`.
- [x] Hydrate the rebuild backend with canonical pilot chantier data and remove legacy merge behavior inside the site bridge.
- [x] Replace the legacy site route with rebuild-backed data once parity is validated.

### Phase 3 Exit Criteria

- The full `RJC -> PDF -> validation`, `photo`, and `NCR` workflows run from rebuild APIs.

## Phase 4 - Documents / GED Rebuild

Goal: rebuild the `Documents` domain as the **central BNAA project document hub** on the new backend and frontend stack.

Execution rule for this phase:

- keep the current BNAA visual design language from Phase 2
- preserve existing document workflows, role-based permissions, actions, loading states, and route contracts
- treat Module 6 as a **desktop-first document-control workspace**, not only a plans page
- keep the top KPI strip, but redesign the rest of the page into a 3-column document workspace
- if backend support is incomplete for some document categories, unblock the UX with derived adapters instead of blocking the rebuild

Reference: `docs/phase-4-document-hub-strategy.md`

### Backend Tasks

- [x] Finalize rebuild schema/models for the unified document hub:
- [x] documents
- [x] document versions
- [x] document distributions
- [x] document read acknowledgements
- [x] document attachments / parent-child links
- [x] document visibility scope
- [x] document priority
- [x] source module / source record references
- [x] zone-aware metadata where relevant
- [x] document search vector / indexes
- [x] Extend or adapt rebuild payloads to support a frontend-friendly document shape with:
- [x] `documentType`
- [x] `sourceModule`
- [x] `sourceRecordId`
- [x] `parentDocumentId`
- [x] `visibilityScope`
- [x] `attachments`
- [x] `relatedPhotos`
- [x] `distributionState`
- [x] `readState`
- [x] `offlineState`
- [x] Implement or adapt rebuild document ingestion rules for:
- [x] plan revisions as new versions under the same parent document
- [x] daily reports as report documents
- [x] report photos as attachments / photo evidence linked to the parent report
- [x] signed/generated report PDFs as attachments or generated-export versions
- [x] standalone field photos as standalone photo-evidence documents when no parent exists
- [x] NCR records as quality / NCR evidence documents
- [x] NCR proof photos/files as linked evidence attachments
- [x] finance statements / invoices / payment proofs as finance documents
- [x] generated exports / signed PDFs under the relevant parent document
- [x] Implement rebuild endpoints or adapters for:
- [x] list documents
- [x] document detail
- [x] publish version
- [x] mark obsolete
- [x] distribute
- [x] acknowledge read
- [x] full-text search
- [x] compare versions
- [x] offline preparation state
- [x] Implement controlled distribution and per-recipient read traceability.
- [x] Tighten document visibility so stored scopes, explicit sharing, and synthetic chantier evidence follow Phase 4 role rules more strictly.
- [x] Preserve current-version distribution traceability across re-diffusions instead of wiping recipient read history.
- [x] Implement current-version switching and obsolete-version rules.
- [x] Normalize the current-version shortcut so the main document download always resolves the effective current revision.
- [x] Implement role-aware visibility filtering by role, project context, document type, workflow relevance, and explicit sharing.
- [x] Prevent finance-role users from inheriting unrelated technical document visibility through project-wide explicit distributions.
- [x] Implement priority derivation so the rebuild payload can surface high/medium/low relevance per role.
- [x] Prepare the document hub file model so it is object-storage-ready now; actual MinIO/presigned cutover remains in Phase 6 shared services.
- [x] Implement PDF comparison support against rebuild version records.

### Frontend Tasks

- [x] Refactor Module 6 information architecture from a plans page into a unified document hub.
- [x] Keep the KPI strip at the top and make each KPI clickable as a filter/view switch.
- [x] Add a desktop action bar under the KPIs with:
- [x] global search
- [x] filter chips
- [x] sort dropdown
- [x] primary actions for revision publish, distribution, compare, and offline prep
- [x] Rebuild the page into a stable desktop 3-column workspace:
- [x] left navigation / smart views
- [x] center document library table
- [x] right contextual document panel
- [x] Merge the left navigation and the library into one shared workspace card with a collapsible sidebar control.
- [x] Tighten the shared workspace density with a more compact collapsed rail and smaller document typography.
- [x] Embed the right context rail inside the shared workspace card, add a library full-view toggle, and tighten button typography so labels fit cleanly.
- [x] Remove the internal dual-panel split so the left rail and library read as one continuous workspace card.
- [x] Rebalance the desktop workspace proportions with a wider left navigation rail and a slimmer right context rail.
- [x] Further slim the right context rail for denser desktop scanning while preserving the embedded panel workflow.
- [x] Reduce the right context rail once more to keep the center library as the dominant desktop workspace.
- [x] Trim the expanded left navigation rail to keep Module 6 balanced after the context rail reduction.
- [x] Replace the fixed selected-document rail with a popup context card triggered from the center library selection.
- [x] Recenter the selected-document popup as a wider rectangular modal and invert its palette for a lighter document-review experience.
- [x] Rebalance the centered document popup with tighter spacing, denser action groups, and a truer two-column internal layout so the rectangle feels less tall and more balanced.
- [x] Regroup the controlled-distribution drawer into clearer step cards so it stays readable when launched from the centered document popup.
- [x] Add the new left navigation model:
- [x] workflow views (`Tous les documents`, `Plans en vigueur`, `A diffuser`, `Diffusion en attente`, `Obsoletes`, `Offline chantier`, `Audit documentaire`)
- [x] content views (`Plans & revisions`, `Rapports chantier`, `Photos & preuves`, `Finance & justificatifs`, `Qualite / NCR`, `Exports & PDF signes`)
- [x] tree navigation by project / lot / phase / discipline
- [x] Rebuild the center library as a dense document table with scan-friendly columns for:
- [x] document type
- [x] code
- [x] title
- [x] type
- [x] source
- [x] lot
- [x] phase
- [x] discipline
- [x] revision
- [x] status
- [x] distribution
- [x] reading progress
- [x] offline state
- [x] last update
- [x] Rebuild the right document panel so the selected record surfaces:
- [x] document header and quick badges
- [x] quick actions
- [x] metadata
- [x] attachments & photos
- [x] versions timeline
- [x] distribution state
- [x] offline state
- [x] audit trail
- [x] Replace full-page action jumps with drawers/modals for:
- [x] publish revision
- [x] distribute
- [x] compare versions
- [x] prepare offline
- [x] Build a frontend adapter layer so reports, photos, finance proofs, quality evidence, and generated PDFs can be represented in the hub without waiting for every backend-native type to exist.
- [x] Preserve current search, filters, permissions, and mutations while improving their layout and readability.
- [x] Surface the 4 critical document answers instantly for each selected item:
- [x] is this the right/current version
- [x] has it been distributed
- [x] who has read it
- [x] is it available offline
- [x] Add the bottom bulk action bar for multi-select document actions.

### Cutover Tasks

- [x] Add a feature-flagged compat bridge for `/api/projects/[projectId]/documents`.
- [x] Keep the current `/api/projects/[projectId]/documents` route path and response contract stable while introducing the unified document hub model behind adapters.
- [x] Validate parity for plans, reports, photos/evidence, generated PDFs, and finance-linked documents inside the unified workspace.
- [x] Replace the legacy documents route with rebuild-backed data once parity is validated.
- [x] Remove silent legacy fallback from the live documents bridge once rebuild parity is validated.

### Phase 4 Exit Criteria

- [x] Module 6 uses a stable desktop 3-column document workspace.
- [x] The KPI strip remains at the top and is actionable.
- [x] The center area is a proper document library table, not a dashboard block layout.
- [x] The UI supports a broader document hub model beyond plan files.
- [x] Versions, distribution, offline state, attachments, and audit are surfaced through the selected-document panel.
- [x] Role-aware relevance and visibility are reflected in the workspace.
- [x] Finance-related roles surface only finance-relevant files/photos in the hub.
- [x] Reports and related photos can conceptually live inside the same document system.
- [x] Existing actions, permissions, and current workflows remain functional.
- [x] Document status, revision status, read progress, offline status, and source context are materially easier to scan.
- [x] The full `publish -> distribute -> acknowledge -> compare` flow runs from rebuild APIs.

## Phase 5 - Finance Rebuild

Goal: rebuild the `Finance` domain on the new backend and frontend stack while preserving the current operational invoice/payment flow.

### Backend Tasks

- [x] Create or finalize rebuild schema/models for:
- [x] statements
- [x] invoices
- [x] payments
- [x] finance-document links so statements, invoices, payment proofs, and generated PDFs can surface cleanly inside Module 6.
- [x] Keep the shared Prisma `tenant_template` finance schema aligned with the expanded invoice workflow statuses and finance workflow columns used by the rebuild backend.
- [x] Implement rebuild endpoints for:
- [x] create monthly statement
- [x] statement detail
- [x] create invoice
- [x] validate invoice
- [x] register payment
- [x] financial summary
- [x] cashflow
- [x] Implement statement calculation from chantier progress.
- [x] Implement invoice numbering rules from the specification.
- [x] Implement retention / advance deduction rules.
- [x] Implement payment reconciliation and overdue rules.
- [x] Implement finance notifications and email triggers.
- [x] Implement PDF generation on the rebuild backend for invoices.
- [x] Implement PDF generation on the rebuild backend for statements.
- [x] Add controlled manual invoice status updates for rebuild parity with the live finance workflow.

### Frontend Tasks

- [x] Align the live finance module to the finance-cockpit information architecture while preserving current route contracts and business actions during the rebuild bridge.
- [x] Consolidate the finance right rail widgets into one shared cockpit card for denser desktop scanning.
- [x] Tighten the finance cockpit desktop proportions so the billing surface stays dominant and the pilotage rail feels lighter above the fold.
- [x] Simplify the live finance cockpit hierarchy by promoting the billing queue, removing duplicate quick navigation, and reducing queue/rail repetition.
- [x] Polish the live finance action cards and billing queue density so the cockpit scans faster without changing structure or finance workflows.
- [x] Remove the live finance navigation side panel to free more horizontal space for the cockpit while preserving in-page focus actions and deep-link section behavior.
- [x] Stack the live monthly DM card under the action center so the cockpit reads top-to-bottom before the billing queue.
- [x] Fix finance section deep-link restore, visible queue filter parity, billing queue project-label clarity, and lightweight lower-section jump navigation without changing the cockpit layout.
- [x] Improve the live finance cockpit for finance confidence with exception-first queue ordering, clearer collection priority, stronger proof visibility, and more explicit blocked-state wording.
- [x] Tighten the live DM composer layout so period, lots, and the calculation summary read as one balanced finance block without changing the cockpit structure.
- [x] Consolidate the live DM setup area into one cleaner preparation card so the period and linked lots feel like a single finance setup surface.
- [x] Rebuild finance overview, statement, invoice, and payment screens on rebuild APIs.
- [x] Keep finance documents discoverable and traceable from the unified document hub without exposing unrelated technical/site files to finance roles.
- [x] Rebuild the finance step flow:
- [x] Preparer le decompte
- [x] Envoyer
- [x] Validation projet
- [x] Validation client
- [x] Paiement recu
- [x] Rebuild treasury and KPI summaries from rebuild APIs.

### Cutover Tasks

- [x] Add a feature-flagged compat bridge for `/api/projects/[projectId]/finance`.
- [x] Replace the legacy finance route with rebuild-backed data once parity is validated.

### Phase 5 Exit Criteria

- The full `statement -> invoice -> validation -> payment` flow runs from rebuild APIs.

## Phase 6 - Shared Services, QA, and Final Cutover

Goal: finish the MVP rebuild and retire the legacy internal backend path safely.

### Shared Services

- [ ] Move rebuild storage to the target object-storage flow (`MinIO` / compatible).
  - [x] Add a MinIO-compatible storage service with safe inline fallback for rebuild document versions and generated finance PDFs.
- [ ] Wire BullMQ / Redis jobs for emails, PDFs, reminders, and deferred work.
  - [x] Add a BullMQ-compatible queue foundation with named email, PDF, reminder, and deferred-work queues plus safe disabled fallback and queue-ready adapters in the rebuild mail/PDF services.
- [ ] Expand rebuild notifications to cover all module events from the spec.
  - [x] Add the remaining high-value MVP workflow events to rebuild notifications: invoice-generated alerts for `MO` recipients and read-acknowledgement alerts for controlled document distributions.
- [x] Expand rebuild search aggregation across the migrated domains.
  - [x] Rebuild the public `/api/search` wrapper so projects, reports, documents, invoices, and admin users resolve from rebuild-backed domains while preserving the existing search route contract and legacy fallback.
- [ ] Expand rebuild audit/activity feeds across the migrated domains.
- [ ] Finalize the cross-module document-hub ingestion layer so Site, Documents, and Finance outputs all resolve into one searchable project document system.

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
