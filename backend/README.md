# BnaaSaaS Backend Foundation

This folder starts the `Phase 1` rebuild foundation from the May 2025 specification.

What is included in the current Phase 1 slice:

- NestJS backend workspace layout
- Prisma schema foundation for `public` and `tenant_template`
- Real database services for Prisma and tenant-schema SQL access
- Real tenant schema provisioning helpers
- Public auth foundation:
  - register
  - login
  - refresh
  - logout
  - forgot/reset password token flow
  - invite acceptance
  - 2FA setup / enable / disable
- Public users and projects APIs
- Auth, tenant, user, project, site, documents, finance, storage, PDF, notifications, and queue module structure
- Shared guards, decorators, filters, and utilities

What is intentionally not complete yet:

- Full runtime business logic for chantier, documents, and finance
- Real MinIO/Redis/Resend integration
- Full API route implementation

The current live SaaS remains served by the existing Next.js app at repo root while this backend
foundation is built in parallel.
