# Phase 2 UX Strategy

This document defines the execution mode for Phase 2 of the BNAA rebuild.

Safety references:

- `docs/safety.md`
- `docs/rebuild-phases-tracker.md`
- `docs/technical-infrastructure-documentation.md`

## Decision

Phase 2 will **keep the current visual design and general UI look-and-feel**.

This phase will **not** be treated as a visual redesign or rebrand.

Instead, Phase 2 will focus on:

- UX clarity
- workflow simplification
- role-based navigation
- state feedback
- mobile usability
- accessibility and recovery states

## Core UX Problem Statement

The user needs to complete operational construction and finance tasks quickly in a field and office context, but too much workflow complexity, secondary information, and unclear state feedback gets in the way, which hurts speed, confidence, and daily adoption.

## Assumptions And Constraints

- keep the current BNAA visual identity already in the live SaaS
- keep the current page structure and routes unless future approved migration work changes internals safely
- do not redesign colors, layout language, or page chrome as the primary goal of Phase 2
- improve how users understand, navigate, decide, and complete work
- optimize for:
  - `CT` field speed
  - `BE` document control clarity
  - `CO` finance sequence clarity
  - `CP` and `MO` oversight and validation

## UX Goals

1. Make the next required action obvious on every important screen.
2. Reduce cognitive load by showing only what matters for the current role.
3. Turn complex workflows into step-by-step guided flows.
4. Improve mobile field speed without removing desktop detail.
5. Standardize feedback for loading, success, blocked, empty, offline, and error states.

## Workstreams

### 1. Role-Based Navigation

Goals:

- reduce unused navigation for each role
- make the primary work areas obvious
- preserve deep-link compatibility and route safety

Key tasks:

- simplify sidebar destinations by role
- simplify top-level labels into user language
- keep project context visible at all times
- keep hidden/internal routes accessible safely through deep links

### 2. Dashboard As Work Queue

Goals:

- make dashboards action-first, not summary-first
- show what needs attention today

Key tasks:

- surface pending validations
- surface unread document diffusions
- surface overdue invoices and blocked finance steps
- surface missing RJC / overdue NCR actions
- adapt dashboard priorities by role

### 3. Core Workflow Simplification

#### Site

- reduce taps for `RJC`, photo, and `NC`
- clarify readiness and blocked reasons
- support mobile-first field completion

#### Documents

- make the flow read as:
  - library
  - publish
  - distribute
  - follow-up
- clarify revision status and read acknowledgements

#### Finance

- make the flow read as:
  - prepare statement
  - send
  - project validation
  - client validation
  - payment received
- clarify why actions are blocked

### 4. Project Setup And Admin Usability

Goals:

- reduce misconfiguration
- guide project onboarding

Key tasks:

- make setup completeness visible
- guide lots, zones, phases, members, and workflow owners
- improve user and project management clarity

### 5. Notifications As Action Queue

Goals:

- help users triage quickly
- connect alerts to exact actions

Key tasks:

- group by urgency and action required
- prioritize unread and blocking items
- make jump-to-record behavior reliable

### 6. UX State Quality

Goals:

- create consistent feedback patterns across the SaaS

Key tasks:

- empty states
- loading states
- disabled-state reasons
- inline validation
- offline messaging
- recoverable error states

### 7. Accessibility And Operational Readability

Goals:

- make the SaaS usable in long work sessions and high-pressure contexts

Key tasks:

- maintain visible focus states
- ensure keyboard reachability where practical
- improve form labeling and validation clarity
- avoid icon-only ambiguity for critical actions

## Deliverables For Phase 2

- UX implementation backlog by workflow
- interaction and microcopy refinements in the live app
- role-based navigation and dashboard behavior improvements
- improved empty/loading/error/blocked/offline states
- better mobile field usability

## What Phase 2 Does Not Intend To Do

- no visual rebrand
- no design reset
- no large-scale layout reinvention
- no route/API contract redesign
- no removal of existing working SaaS features

## Suggested Implementation Order

1. role-based navigation simplification
2. dashboard as work queue
3. site flow simplification
4. documents flow simplification
5. finance flow simplification
6. admin/project setup usability
7. notifications refinement
8. cross-module state consistency and accessibility polish

## Phase 2 Exit Criteria

- users can identify their next action within 3 seconds on core screens
- each role sees only the most relevant primary destinations
- core flows require fewer decisions and less recall
- mobile chantier actions feel fast and obvious
- blocked actions explain themselves clearly
- notifications and dashboards behave like actionable queues, not passive summaries
