# BnaaSaaS Backend Foundation

This folder starts the `Phase 1` rebuild foundation from the May 2025 specification.

What is included in this first scaffold:

- NestJS backend workspace layout
- Prisma schema foundation for `public` and `tenant_template`
- Auth, tenant, user, project, site, documents, finance, storage, PDF, notifications, and queue module skeletons
- Shared guards, decorators, filters, and utility placeholders

What is intentionally not complete yet:

- Runtime business logic
- Real Prisma service wiring
- Real JWT/2FA flows
- Real MinIO/Redis/Resend integration
- Full API route implementation

The current live SaaS remains served by the existing Next.js app at repo root while this backend
foundation is built in parallel.
