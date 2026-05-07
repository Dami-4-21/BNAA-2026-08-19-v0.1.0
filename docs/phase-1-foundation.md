# Phase 1 Foundation Rebuild

This document tracks the first rebuild slice against the May 2025 specification.

## Goal

Build the new technical foundation in parallel to the current live SaaS so the product can
transition safely instead of breaking the running MVP.

## What exists now

- Current live product remains the root Next.js app
- New backend workspace exists in `backend/`
- Initial Prisma multi-schema foundation exists in `backend/prisma/`
- Backend dependencies are installed and Prisma client generation works
- Public-schema auth foundation is now real:
  - tenant registration
  - login
  - refresh rotation
  - logout
  - invite acceptance
  - password reset token flow
  - 2FA setup / enable / disable
  - authenticated `/auth/me` bootstrap endpoint
- Tenant schema provisioning is now real for the first runtime slice:
  - creates `tenant_{tenantId}`
  - clones template tables
  - restores the document search trigger
  - rolls schema back cleanly if registration provisioning fails
- Auth email delivery is now wired for:
  - invite emails
  - reset-password emails
  - debug fallback when `RESEND_API_KEY` is not configured
- Users API is now real for:
  - list
  - me
  - invite
  - role change
  - deactivate
- Projects API is now real for:
  - list
  - create
  - detail
  - members
  - add member
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
- Docker now has a parallel rebuild lane:
  - `postgres`
  - `api`
  - existing `web`
- The current app has its first opt-in bridge to the rebuild API:
  - session bootstrap can read from the new backend when explicitly enabled

## What Phase 1 still needs

1. Harden tenant provisioning with real migrations and a fully cloned schema contract.
2. Decide and execute the first full live module cutover behind a feature flag.
3. Start moving frontend state toward the spec stack:
   - Zustand
   - TanStack Query
   - React Hook Form + Zod
4. Plan the repo split so the current root Next app can become `frontend/`.
5. Continue replacing the current internal backend with the new Nest API module by module.

## Transition rule

Until backend routes are real, the current root app remains the source of truth for the live
Docker deployment.
