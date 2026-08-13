# MiniHR — Software Requirements Specification & Technical Architecture

**Multi-module SRS.** Each numbered file is a self-contained module. This index is the entry point — read it first, then follow the module list below in order (or jump directly to the module relevant to the task at hand).

This SRS is written to be handed to a developer or an AI coding assistant (e.g. Claude Code) as the working specification for building **MiniHR**, a lightweight HR management system for small teams. The guiding constraint across every module: **do not over-engineer this**. It is intentionally a small modular monolith, not an enterprise platform.

## How to Use This SRS

- **Starting fresh?** Read `01` → `02` → `03` in order, then `05`/`06` before writing any code.
- **Implementing a specific phase?** See `16-development-phases.md` for the recommended build order and jump to the modules it references for that phase.
- **Working on the database or RLS?** `07-database-schema.md` and `08-authorization-rls.md` are the source of truth — keep them in sync with any schema changes made during implementation.
- **Unsure whether something belongs in the MVP?** Check `17-mvp-vs-future.md` before building it.

## Module List

| # | File | Covers |
|---|---|---|
| 01 | [01-project-overview.md](./01-project-overview.md) | Product concept, objectives, priorities, non-goals |
| 02 | [02-user-roles-and-permissions.md](./02-user-roles-and-permissions.md) | Supervisor / Assistant / Employee roles, permission matrix |
| 03 | [03-functional-requirements.md](./03-functional-requirements.md) | Auth, employee mgmt, scheduling, attendance, leave, requests, notifications (testable `FR-*` requirements) |
| 04 | [04-non-functional-requirements.md](./04-non-functional-requirements.md) | Performance, security, scalability, availability, accessibility, responsiveness |
| 05 | [05-technical-stack.md](./05-technical-stack.md) | The full preferred stack and rationale for each choice |
| 06 | [06-architecture.md](./06-architecture.md) | Modular monolith architecture, layer-by-layer explanation |
| 07 | [07-database-schema.md](./07-database-schema.md) | Full normalized Postgres schema: tables, columns, constraints, indexes |
| 08 | [08-authorization-rls.md](./08-authorization-rls.md) | RLS policies per table, mapped from the permission matrix |
| 09 | [09-api-data-access-strategy.md](./09-api-data-access-strategy.md) | Server Components vs. Server Actions vs. Route Handlers |
| 10 | [10-project-structure.md](./10-project-structure.md) | Practical Next.js folder structure and conventions |
| 11 | [11-environment-variables.md](./11-environment-variables.md) | Required env vars, public vs. server-only |
| 12 | [12-cicd.md](./12-cicd.md) | GitHub + Vercel pipeline, migrations, rollback |
| 13 | [13-error-handling.md](./13-error-handling.md) | Consistent error-handling strategy by category |
| 14 | [14-logging-monitoring.md](./14-logging-monitoring.md) | Lightweight logging/monitoring for a low-cost MVP |
| 15 | [15-security-architecture.md](./15-security-architecture.md) | Security boundaries, common Supabase/Next.js RLS mistakes |
| 16 | [16-development-phases.md](./16-development-phases.md) | Recommended build order and phase dependencies |
| 17 | [17-mvp-vs-future.md](./17-mvp-vs-future.md) | What's in scope now vs. explicitly deferred |

## Non-Negotiable Constraints (repeated here for visibility)

1. Next.js (App Router, React, TypeScript) + Bun + Tailwind + shadcn/ui + Lucide.
2. Supabase for Postgres, Auth, Storage, and Realtime — no custom auth, no separate backend framework, no NoSQL database.
3. Authorization is enforced via Postgres RLS, not just UI checks.
4. One generalized `requests` table backs leave / schedule-change / custom requests — not three separate models.
5. No biometric/GPS/facial-recognition attendance, no payroll, no multi-tenant billing, no configurable workflow engine in the MVP — see `17-mvp-vs-future.md` for the full deferred list.
6. Deploy via Vercel; version control via Git/GitHub; test critical workflows with Vitest + Playwright, not exhaustive coverage.
