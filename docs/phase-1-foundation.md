# Phase 1 Foundation Rebuild

This document tracks the first rebuild slice against the May 2025 specification.

## Goal

Build the new technical foundation in parallel to the current live SaaS so the product can
transition safely instead of breaking the running MVP.

## What exists now

- Current live product remains the root Next.js app
- New backend workspace exists in `backend/`
- Initial Prisma multi-schema foundation exists in `backend/prisma/`
- NestJS-style module tree exists for:
  - auth
  - tenants
  - users
  - projects
  - site-reports
  - documents
  - finance
  - storage
  - pdf
  - notifications
  - queue

## What Phase 1 still needs

1. Install backend dependencies and lock versions.
2. Add a real Prisma service and database connection layer.
3. Implement tenant provisioning from `tenant_template` into `tenant_{tenantId}`.
4. Replace scaffold auth methods with real JWT + refresh + 2FA flows.
5. Add real controllers/services for users and projects.
6. Start moving frontend state toward the spec stack:
   - Zustand
   - TanStack Query
   - React Hook Form + Zod
7. Plan the repo split so the current root Next app can become `frontend/`.

## Transition rule

Until backend routes are real, the current root app remains the source of truth for the live
Docker deployment.
