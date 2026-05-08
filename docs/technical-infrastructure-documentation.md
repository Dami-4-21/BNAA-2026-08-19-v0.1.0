# BnaaSaaS Technical Infrastructure Documentation

## Document Purpose

This file is the BNAA-specific technical infrastructure reference for the BnaaSaaS MVP rebuild.

It is based on:

- `BnaaSaaS_Codex_Spec.md.pdf`
- version `2.0`
- date `May 2025`

This document replaces a generic SaaS template and describes the technical blueprint that applies to **BnaaSaaS specifically**:

- system structure
- module boundaries
- data architecture
- API and integration rules
- deployment topology
- security posture
- internal documentation structure

Its purpose is to let a developer or internal team understand **how BnaaSaaS is designed and operated** without having to read the entire source code first.

---

## Scope

This document covers the **MVP only**.

In scope:

- `Auth / Admin / Settings`
- `Module 5 - Site Monitoring`
- `Module 6 - Document Management`
- `Module 9 - Billing & Finance`
- shared services required by those modules

Out of scope for MVP:

- Study & Design
- Tenders
- Contracts
- Gantt planning
- Procurement & stock
- HR / payroll
- QSE / reception
- BI reporting
- public ERP/API integrations
- native mobile app

This scope matches the BNAA specification and must not be expanded in this document.

---

## Product Context

BnaaSaaS is a multi-tenant SaaS product for the Tunisian civil engineering market.

Its role in the MVP is to replace:

- WhatsApp coordination
- Excel-based tracking
- paper document circulation

The MVP focuses on three operational flows:

1. `RJC / chantier execution`
2. `plan and document control`
3. `monthly statements, invoices, and payments`

Primary roles:

| Code | Role | Primary responsibility |
|---|---|---|
| `ADMIN` | Super Admin | Tenant and platform administration |
| `MO` | Maître d'ouvrage | Validation and project oversight |
| `BE` | Bureau d'études | Document and revision control |
| `CP` | Chef de projet | Project supervision and validation |
| `CT` | Conducteur de travaux | Field reporting and site input |
| `CO` | Comptable | Statements, invoices, payments |

---

## Architecture Principles

The BNAA specification defines these architecture principles:

- strict separation of `frontend` and `backend`
- `REST/JSON` API with `Socket.io` for real-time notifications only
- schema-per-tenant multi-tenancy in PostgreSQL
- direct file upload through presigned URLs, never streamed through the API
- Docker-based deployment
- dark-only industrial design system
- French-first interface and formatting rules
- MVP limited to `M5 + M6 + M9 + Auth`

### Current Migration Note

Because the live SaaS is being rebuilt safely, the current operational rule is:

- the root `Next.js` app remains the live product during migration
- the new `backend/` service is the rebuild lane
- compatibility bridges are used to move live routes safely without breaking working features

This migration rule is an implementation safeguard.  
The target architecture described below remains the source-of-truth direction from the BNAA spec.

---

## Target Technical Stack

### Backend

| Area | BNAA Spec |
|---|---|
| Runtime | `Node.js 20 LTS` |
| Framework | `NestJS` with strict TypeScript |
| API | `REST/JSON` + `Socket.io` notifications |
| Auth | `JWT access token (15 min)` + `refresh token (30 days, httpOnly cookie)` |
| 2FA | `otplib` with TOTP |
| ORM | `Prisma` |
| Database | `PostgreSQL 15` |
| Multi-tenancy | `schema-per-tenant` with `SET search_path` per request |
| File storage | `MinIO` S3-compatible |
| Upload strategy | `Presigned URLs only` |
| Queue | `BullMQ + Redis 7` |
| PDF | `Puppeteer / Chromium` |
| Email | `Resend SDK` |
| Validation | `class-validator + class-transformer` |

### Frontend

| Area | BNAA Spec |
|---|---|
| Framework | `Next.js 14` App Router |
| Styling | `Tailwind CSS 3` |
| Global state | `Zustand` |
| Server state | `TanStack Query v5` |
| Forms | `React Hook Form + Zod` |
| Charts | `Chart.js 4` + `react-chartjs-2` |
| PDF preview | `react-pdf` |
| Offline | `next-pwa` + `idb-keyval` |
| HTTP | `Axios` with refresh interceptor |
| Icons | `Lucide React` |
| Motion | `Framer Motion` |

### Infrastructure

| Area | BNAA Spec |
|---|---|
| Containers | `Docker Compose` |
| Reverse proxy | `Nginx` |
| SSL | `Let's Encrypt` |
| Hosting target | `OVH VPS` or `Hetzner` |

---

## System Context

```mermaid
flowchart LR
  Users["Users<br/>ADMIN / MO / BE / CP / CT / CO"] --> Frontend["BnaaSaaS Frontend"]
  Frontend --> Api["BnaaSaaS API"]
  Api --> Db["PostgreSQL 15"]
  Api --> Redis["Redis 7 / BullMQ"]
  Api --> Storage["MinIO Object Storage"]
  Api --> Email["Resend"]
  Api --> Pdf["Puppeteer / Chromium"]
  Api --> Weather["Weather Provider"]
```

### External Systems

The MVP depends on these external or infrastructure services:

- PostgreSQL
- Redis
- MinIO
- Resend
- Chromium / Puppeteer runtime
- weather provider
- Nginx and TLS termination

---

## Container / Deployment Architecture

```mermaid
flowchart TB
  Browser["Browser / PWA Client"] --> Nginx["Nginx"]
  Nginx --> Frontend["Next.js Frontend"]
  Nginx --> Api["NestJS API"]
  Api --> Postgres["PostgreSQL"]
  Api --> Redis["Redis / BullMQ"]
  Api --> Minio["MinIO"]
  Api --> Mail["Resend"]
  Api --> Chromium["Puppeteer"]
```

### Expected Container Set

According to the BNAA spec, the target Docker Compose stack includes:

| Service | Responsibility |
|---|---|
| `postgres` | relational data store |
| `redis` | queue and deferred jobs |
| `minio` | file/object storage |
| `api` | NestJS backend |
| `frontend` | Next.js frontend |
| `nginx` | public entrypoint, SSL, reverse proxy |

### Persistent Volumes

Required volumes in target topology:

- `postgres_data`
- `redis_data`
- `minio_data`
- `certbot_certs`

---

## Frontend Architecture

The BNAA specification defines a dedicated frontend structure under `frontend/`.

### Frontend Route Model

```text
frontend/app/
  (auth)/
    login/
    2fa/
    forgot-password/
    reset-password/[token]/
    accept-invite/
  (app)/
    dashboard/
    projects/new/
    projects/[projectId]/
      site/
      site/new/
      site/[reportId]/
      site/photos/
      site/ncr/
      documents/
      documents/upload/
      documents/[docId]/
      finance/
      finance/statements/new/
      finance/statements/[id]/
      finance/invoices/[id]/
    settings/
```

### Frontend Component Domains

The spec expects component grouping by business domain:

- `ui/`
- `layout/`
- `site/`
- `documents/`
- `finance/`

### Frontend Shared Libraries

Required shared frontend infrastructure:

- `lib/api.ts`
- `lib/auth.ts`
- `lib/format.ts`
- `lib/offline.ts`
- `lib/queries/*`
- `store/app.store.ts`
- `types/index.ts`

---

## Backend Architecture

The BNAA specification defines a dedicated backend structure under `backend/`.

### Backend Module Tree

```text
backend/src/
  common/
    decorators/
    guards/
    interceptors/
    filters/
    utils/
  auth/
  tenants/
  users/
  projects/
  site-reports/
  documents/
  finance/
  storage/
  pdf/
  notifications/
  queue/
```

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `auth` | login, refresh, 2FA, invite, reset password |
| `tenants` | tenant provisioning and schema management |
| `users` | user lifecycle and role administration |
| `projects` | project registry and memberships |
| `site-reports` | daily reports, photos, NCR |
| `documents` | records, versions, upload, distribution |
| `finance` | statements, invoices, payments, summaries |
| `storage` | MinIO integration and presigned URLs |
| `pdf` | report and invoice PDFs |
| `notifications` | in-app notification events |
| `queue` | background workers for PDF/email jobs |

---

## Multi-Tenancy and Data Architecture

### Tenant Isolation Model

The BNAA spec defines a strict schema-per-tenant model:

- `public` schema stores only shared tenant and user tables
- each tenant gets `tenant_{tenantId}`
- tenant project data lives only inside that tenant schema
- each request must run `SET search_path = tenant_{tenantId}`
- tenant isolation must come from the database schema, not from `WHERE tenant_id = ...` filters

### Core Schema Split

| Schema | Contents |
|---|---|
| `public` | `tenants`, `users` |
| `tenant_{tenantId}` | `projects`, memberships, site data, document data, finance data, notifications |

### Core Domain Entities

#### Shared

- `tenants`
- `users`
- `projects`
- `project_members`
- `notifications`

#### Site

- `daily_reports`
- `photos`
- `ncr`
- `ncr_photos`

#### Documents

- `documents`
- `document_versions`
- `document_distributions`

#### Finance

- `statements`
- `invoices`
- `payments`

### Data Rules From Spec

- one report per `(project, date)` enforced by DB
- signed reports are immutable
- document current version must switch transactionally
- invoice numbers are unique
- amounts always use three-decimal precision
- notifications are per-user and project-aware

---

## File Storage Architecture

The BNAA specification is explicit:

- large files must **not** pass through the API
- uploads use `presigned URLs`
- MinIO is the storage backend

### Upload Flow

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as Backend API
  participant DB as PostgreSQL
  participant S3 as MinIO

  FE->>API: POST upload request metadata
  API->>DB: create pending version record
  API-->>FE: versionId + presigned PUT URL
  FE->>S3: PUT file binary
  FE->>API: confirm upload complete
  API->>DB: set version current / finalize record
```

### Storage Rules

- object storage stores binary files
- PostgreSQL stores metadata and version state
- photo thumbnails are generated server-side
- soft delete is preferred where required by the spec

---

## Authentication and Session Architecture

### Auth Flow

According to the BNAA spec:

1. `POST /api/v1/auth/login`
2. if `totp_enabled`, return `requires2fa + tempToken`
3. otherwise return `accessToken` and set refresh cookie
4. `POST /api/v1/auth/2fa/verify` finalizes login
5. `POST /api/v1/auth/refresh` issues a new access token from the refresh cookie
6. `POST /api/v1/auth/logout` clears server-side refresh state and cookie

### Token Storage Rules

- access token: frontend memory only
- refresh token: `httpOnly` cookie only
- never use `localStorage`
- never use `sessionStorage`

### JWT Payload

The BNAA spec defines:

```ts
interface JwtPayload {
  sub: string;
  tenantId: string;
  role: "MO" | "BE" | "CP" | "CT" | "CO" | "ADMIN";
  email: string;
  iat: number;
  exp: number;
}
```

### Security-Critical Auth Rules

- password verification with `bcrypt`
- refresh token hash stored in DB
- TOTP verification via `otplib`
- role guards enforced on backend routes
- frontend boot must refresh session before rendering app state

---

## API Architecture

### Global Rules

- all public routes are prefixed with `/api/v1`
- all routes require `Authorization: Bearer <token>` except `/auth/*`
- request DTOs are validated server-side
- route authorization is role-based

### Route Families

| Family | Purpose |
|---|---|
| `/auth/*` | register, login, refresh, logout, 2FA, invite, reset |
| `/users/*` | tenant user lifecycle |
| `/projects/*` | project registry and memberships |
| `/reports`, `/photos`, `/ncr` | site operations |
| `/documents`, `/document-versions` | document lifecycle |
| `/statements`, `/invoices`, `/payments` | finance lifecycle |
| `/notifications` | in-app notifications |

### Route-Level Notes From Spec

- document file upload must return a presigned URL
- document download returns a presigned URL
- report PDF streams from backend
- invoice PDF streams from backend
- cashflow and finance summary are dedicated read endpoints

### Rate Limits

The BNAA MVP specification does **not** define endpoint-level rate limits yet.

This means:

- route contracts should document auth and role requirements now
- explicit rate-limit policy should be added later in deployment and API reference docs when implemented

---

## Business Workflow Infrastructure

The technical documentation must support these three core BNAA workflows.

### 1. Site Monitoring

Flow:

- create daily report
- update report
- submit for signature
- notify `CP + MO`
- sign report
- generate queued PDF
- notify `CT`

Supporting infrastructure:

- PostgreSQL lifecycle state
- photo upload and metadata capture
- PDF worker
- email + in-app notifications

### 2. Document Management

Flow:

- create document record
- upload version via presigned URL
- confirm upload
- switch current version
- distribute to recipients
- track read acknowledgment

Supporting infrastructure:

- MinIO
- document metadata tables
- version records
- distribution tables
- full-text search trigger

### 3. Finance

Flow:

- create monthly statement
- submit for validation
- validate or reject
- generate invoice
- record payment
- compute summaries and cashflow

Supporting infrastructure:

- statement tables
- invoice numbering utility
- payment reconciliation
- PDF generation
- overdue notifications

---

## Notification and Email Architecture

### In-App Notifications

BNAA MVP requires a `notifications` table with:

- `user_id`
- `project_id`
- `type`
- `title`
- `body`
- `link`
- `is_read`
- `created_at`

### Email Triggers Required By Spec

| Trigger | Recipients |
|---|---|
| user invited | invitee |
| RJC submitted | all `CP + MO` on project |
| RJC signed | report creator `CT` |
| NCR created | assigned user |
| NCR closed | NCR creator |
| document distributed | each recipient |
| statement submitted | all `CP + MO` on project |
| statement validated | creator `CO` |
| statement rejected | creator `CO` |
| invoice generated | `MO` on project |
| invoice overdue | `CO + CP` |
| password reset | user |

### Email Template Rules

Per BNAA spec:

- text wordmark header
- one-line action statement
- context block with project / amount / details
- one CTA button using the BNAA accent color
- footer with no-reply note

---

## Deployment Topology

### Target Production Environment

The specification targets:

- `Docker Compose`
- `Nginx`
- `Let's Encrypt`
- VPS hosting on `OVH` or `Hetzner`

### Required Environment Variables

From the BNAA spec:

```bash
DATABASE_URL=postgresql://user:pass@postgres:5432/bnaasaas
REDIS_URL=redis://redis:6379
JWT_SECRET=<64-char random string>
JWT_REFRESH_SECRET=<different 64-char random string>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=<key>
MINIO_SECRET_KEY=<secret>
MINIO_BUCKET=bnaasaas
RESEND_API_KEY=<key>
EMAIL_FROM=noreply@bnaasaas.tn
APP_URL=https://app.bnaasaas.tn
NODE_ENV=production
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### Compose Topology From Spec

```mermaid
flowchart LR
  Internet["Client traffic"] --> Nginx["nginx"]
  Nginx --> Frontend["frontend"]
  Nginx --> Api["api"]
  Api --> Postgres["postgres"]
  Api --> Redis["redis"]
  Api --> Minio["minio"]
```

### Deployment Requirements

- public ports exposed only through `nginx`
- backend and database remain internal services
- TLS certificates mounted into `nginx`
- persistent data kept in named volumes
- all services restart `unless-stopped`

### Scaling and Failover

The MVP spec does not define advanced HA/failover infrastructure.

This means the documentation should state clearly:

- deployment is single-stack containerized VPS topology
- stateful services require backup and recovery plans
- horizontal scaling is not the initial MVP operating mode

---

## Security Posture

### Core Security Model

The BNAA MVP security posture is based on:

- JWT access tokens
- refresh token cookies
- TOTP 2FA
- backend role guards
- tenant isolation via PostgreSQL schema separation
- presigned object-storage uploads

### Security Requirements To Document

#### Identity

- login
- refresh
- logout
- password reset
- invite acceptance
- 2FA enrollment and verification

#### Access Control

- role enforcement on backend routes
- project membership enforcement
- tenant schema enforcement
- admin-only user lifecycle actions

#### Data Protection

- refresh token hashes stored in DB
- no access token persistence in browser storage
- object storage access mediated by presigned URLs
- immutable signed report state
- irreversible obsolete document state

#### Audit and Incident Support

Infrastructure docs should also include:

- service restart commands
- container health check commands
- log locations
- queue inspection steps
- mail and PDF troubleshooting path
- backup / restore procedures

### Security Gaps To Track Separately

If hardening items are not yet implemented in code, document them as operational backlog rather than silently assuming they exist.

This document should describe:

- target posture from the BNAA spec
- current implementation posture
- any gaps that still remain before full production hardening

---

## Internal Documentation Repository

The BNAA technical documentation should live beside the code in `docs/` and be split into two families.

### Software Architecture Documents

```text
docs/software-architecture/
  system-context.md
  container-architecture.md
  frontend-architecture.md
  backend-architecture.md
  data-model.md
  integrations.md
  deployment-topology.md
  security-posture.md
```

### Internal / Operating Documentation

```text
docs/internal/
  onboarding.md
  environments.md
  deployment-runbook.md
  backup-and-restore.md
  incident-response.md
  support-workflows.md
  release-checklist.md
```

### Minimum Internal Knowledge Base Topics

- local setup
- Docker stack startup
- seed/bootstrap behavior
- tenant provisioning
- deployment procedure
- rollback procedure
- log inspection
- PDF worker troubleshooting
- email troubleshooting
- object storage troubleshooting
- project access debugging

---

## Documentation Governance

To keep BNAA documentation synchronized with the codebase:

- architecture docs must be updated in the same change set as architecture changes
- API docs must be updated when endpoint contracts change
- deployment docs must be updated when Docker, Nginx, env, or topology changes
- security docs must be updated when auth/session/role or storage behavior changes
- diagrams must stay version-controlled in the repo

This is especially important because the BNAA rebuild is being migrated safely in phases, so documentation must distinguish between:

- `target architecture from the specification`
- `current migration state in the live SaaS`

---

## Do Not Build / Explicit Constraints

The infrastructure documentation must also preserve BNAA MVP constraints.

Do not document or imply support for:

- non-MVP modules
- WhatsApp or SMS integration
- DWG-to-PDF conversion
- IFC 3D viewer
- ERP or public API integrations
- Excel import
- TVA declaration export file
- native mobile app
- advanced analytics exports
- light mode or Arabic support

These items are explicitly excluded by the BNAA specification and should not appear as active architecture commitments.

---

## Immediate Documentation Follow-Up Files

This master BNAA document should be followed by:

1. `docs/software-architecture/system-context.md`
2. `docs/software-architecture/container-architecture.md`
3. `docs/software-architecture/frontend-architecture.md`
4. `docs/software-architecture/backend-architecture.md`
5. `docs/software-architecture/data-model.md`
6. `docs/software-architecture/integrations.md`
7. `docs/software-architecture/deployment-topology.md`
8. `docs/software-architecture/security-posture.md`
9. `docs/internal/deployment-runbook.md`
10. `docs/internal/incident-response.md`

---

## Summary

This document is the BNAA-specific infrastructure reference for the MVP rebuild.

It defines:

- the target stack
- the module architecture
- the data and tenant model
- the integration and API rules
- the deployment topology
- the security posture
- the internal documentation repository expected around the SaaS

It should be maintained as a live technical blueprint during the rebuild so the team can understand both:

- where the BNAA MVP is going
- how the live system is being migrated safely toward that target
