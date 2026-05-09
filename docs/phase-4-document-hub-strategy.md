# Phase 4 - Document Hub Strategy

Reference files:

- `docs/safety.md`
- `docs/rebuild-phases-tracker.md`
- `docs/technical-infrastructure-documentation.md`

## Context

Phase 4 is no longer a simple GED refresh.

Module 6 must evolve into the **central BNAA project document hub**:

- all important project files should be represented here
- not every file is visible to every role
- the workspace must be role-aware, workflow-aware, and context-aware
- plans, reports, photos, generated PDFs, finance proofs, quality evidence, and audit-ready files should all feel part of one system

This is primarily a **frontend/UI/UX and information architecture rebuild**.

The visual design language from the current BNAA SaaS remains in place.

## UX Problem Statement

The user needs to find, verify, distribute, and audit the right project document in a construction context, but the current Module 6 experience still feels too much like a specialized plans page, which hurts scanability, trust, and operational speed.

## Core User Questions

For any selected document, the workspace must let the user answer these 4 questions instantly:

1. Is this the right/current version?
2. Has it been distributed?
3. Who has read it?
4. Is it available offline?

## Primary User Roles

### ADMIN / Super Admin

- sees everything
- needs auditability, control, and cross-role troubleshooting

### BE / Bureau d'etudes

- focused on plans, revisions, technical comparisons, and controlled issue-linked evidence
- should not browse unrelated finance files

### CP / Chef de projet

- focused on operational document control across plans, reports, evidence, quality, and selective finance proof

### CT / Conducteur de travaux

- focused on current plans, chantier reports, field photos, offline access, and assigned quality evidence
- should not browse unrelated finance files

### CO / Comptable

- focused on statements, invoices, payment proofs, signed reports, and finance-linked supporting documents
- should not browse the full technical/site library

### MO / Maitre d'ouvrage

- focused on approved/shared documents and audit-ready documentation
- should not see internal-only operational material unless shared

## Product Direction

Module 6 becomes the central document workspace for:

- `Plan / Technical document`
- `Report / Daily report`
- `Photo evidence`
- `Signed PDF / Generated export`
- `Finance document`
- `Quality / NCR evidence`
- `Shared audit document`

The hub should treat records as one of:

- a document
- a document version
- an attachment or photo linked to a parent document

## Frontend-Friendly Document Shape

Phase 4 should prepare or consume a document shape that supports:

- `documentType`
- `sourceModule`
- `sourceRecordId`
- `parentDocumentId`
- `title`
- `code`
- `project`
- `lot`
- `phase`
- `discipline`
- `zone`
- `createdBy`
- `createdAt`
- `currentVersion`
- `status`
- `priority`
- `visibilityScope`
- `attachments`
- `relatedPhotos`
- `distributionState`
- `readState`
- `offlineState`

If the rebuild backend does not provide all of these natively yet, Phase 4 should derive them through adapters instead of blocking the redesign.

## Priority Model

The workspace should surface documents by operational relevance.

### High priority

- current execution plans
- reports submitted today
- unread required distributions
- blocking NCR evidence
- finance proofs waiting for validation

### Medium priority

- recent reports
- linked site photos
- recent generated PDFs

### Low priority

- archives
- obsolete versions
- historical references

## Automatic Entry Rules

The document hub should reflect these product rules:

- BE publishes a new plan revision -> new version under the existing plan document
- CP or CT submits a daily report -> create a report document
- related report photos -> become attachments / photo evidence
- generated signed report PDF -> becomes an attachment or generated export
- site photo without parent workflow -> becomes a standalone photo evidence document
- NCR creation -> creates a quality / NCR evidence document
- finance statement / invoice / payment proof -> creates a finance document
- system-generated export / signed PDF -> becomes an attachment or version under the relevant parent document

## Target Page Structure

### 1. Header

- title stays `Module 6 — GED & Plans`
- subtitle should clearly communicate that this is the central project document hub

### 2. KPI Strip

Keep and make interactive:

- `Volume documentaire`
- `Taux de lecture < 48h`
- `Versions actives`
- `Documents non diffusés > 5 jours`

Each KPI must apply a meaningful view/filter when clicked.

### 3. Action Bar

- global search
- filter chips
- sort dropdown
- primary actions:
  - `Publier une revision`
  - `Distribuer`
  - `Comparer`
  - `Preparer offline`

### 4. Main Desktop Workspace

Three-column layout:

- left navigation / smart views
- center document library
- right contextual detail panel

### 5. Bottom Bulk Action Bar

- visible only when one or more documents are selected

## Left Navigation Model

### Workflow views

- `Tous les documents`
- `Plans en vigueur`
- `A diffuser`
- `Diffusion en attente`
- `Obsoletes`
- `Offline chantier`
- `Audit documentaire`

### Content views

- `Plans & revisions`
- `Rapports chantier`
- `Photos & preuves`
- `Finance & justificatifs`
- `Qualite / NCR`
- `Exports & PDF signes`

### Tree navigation

- project
- lot
- phase
- discipline

## Center Library Model

The main center area must become a dense, scan-friendly table instead of a dashboard block layout.

Recommended columns:

- selection checkbox
- document type icon
- code
- title
- type
- source
- lot
- phase
- discipline
- revision
- status
- distribution
- reading progress
- offline
- last updated

Every row should expose without opening details:

- current revision state
- current or obsolete status
- source module
- distribution progress
- read progress
- offline status
- update metadata

## Right Context Panel Model

When one document is selected, the panel should surface:

- document header
- quick badges
- quick actions
- metadata
- attachments & photos
- versions timeline
- distribution state
- offline state
- audit trail

Important quick badges:

- `Version en vigueur`
- `x/y lus`
- `Offline sur cet appareil`
- `Obsolete`
- `Finance lie`
- `Rapport du jour`

## Interaction Model

Do not navigate away for key document actions.

Use drawers or modal panels for:

- publish revision
- distribute
- compare versions
- prepare offline

## Microcopy Direction

Prefer simple operational French labels:

- `Version en vigueur`
- `A diffuser`
- `Diffusion en cours`
- `Lecture incomplete`
- `Disponible hors connexion`
- `Non synchronise`
- `Plan obsolete - ne plus utiliser sur chantier`
- `Relancer les non-lus`
- `Publier une nouvelle revision`
- `Rapport du jour`
- `Pieces jointes`
- `Preuves liees`
- `Justificatifs finance`

## Technical Guardrails

Phase 4 must not:

- remove existing actions
- break current permissions
- change public route contracts
- block on backend completeness when a safe adapter can preserve the UX plan

Phase 4 may:

- extract smaller presentational components
- add document adapters and grouping helpers
- redesign layout and hierarchy
- improve readability and scanning density

## Cross-Phase Dependencies

Phase 4 introduces these dependencies beyond the module itself:

### Phase 5

Finance outputs must remain visible and traceable inside the unified document hub:

- statements
- invoices
- payment proofs
- finance-linked signed PDFs

### Phase 6

Shared services must finalize one searchable project document system across:

- Site
- Documents
- Finance

## Acceptance Criteria

- stable desktop 3-column document workspace
- KPI strip remains visible and actionable
- center area is a real document library table
- broader document-hub model is visible, not only plan files
- selected-document panel surfaces versions, distribution, offline, attachments, and audit
- role-aware visibility is reflected in the workspace
- finance users see only finance-relevant documents/photos
- reports and related photos can live conceptually inside the hub
- existing actions and permissions remain working
- status, revision, read progress, offline state, and source context are easier to scan
- result feels premium, focused, and operationally useful

## Implementation Order

1. inspect current Module 6 data shape and handlers
2. define the unified document adapter layer
3. redesign the information architecture
4. build the desktop 3-column layout
5. move current actions into drawers / contextual surfaces
6. keep existing mutations and permissions intact
7. validate role-aware visibility and workflow relevance
8. document remaining gaps between current backend support and target UX
