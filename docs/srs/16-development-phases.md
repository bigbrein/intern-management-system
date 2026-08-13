# 16 — Development Strategy & Phases

> **Depends on:** all prior modules. This is the execution order — an AI coding assistant should generally not start Phase *N* work until Phase *N-1* is functionally complete, per the dependency notes below.

```text
Phase 1  — Project setup
Phase 2  — Database + Auth
Phase 3  — Roles + RLS
Phase 4  — Employee management
Phase 5  — Scheduling
Phase 6  — Attendance
Phase 7  — Leave + Requests
Phase 8  — Notifications
Phase 9  — Responsive / mobile UI polish
Phase 10 — Testing
Phase 11 — Deployment
```

## Phase 1 — Project Setup

Scaffold Next.js (App Router, TypeScript strict) with Bun, install Tailwind + shadcn/ui + Lucide, set up ESLint/Prettier, initialize the Supabase project and CLI, create `.env.local.example`, initialize Git/GitHub repo. **Dependency**: none — this is the foundation everything else builds on.

## Phase 2 — Database + Auth

Write the migrations for `07-database-schema.md` (enums, tables, constraints, indexes, `set_updated_at()` trigger, `on_auth_user_created` trigger). Wire up Supabase Auth (`@supabase/ssr` client/server factories, `middleware.ts` for session refresh + protected routes), login/logout/password-reset pages. **Dependency**: needs Phase 1's project scaffold. Nothing in later phases can be built without a working schema and login flow.

## Phase 3 — Roles + RLS

Implement the `security definer` helper functions and every RLS policy in `08-authorization-rls.md`. Seed a first Supervisor account (one-time manual step or a `seed.sql` script) since there's no public self-registration. Build the `account_status`-suspended check. **Dependency**: needs Phase 2's schema and auth in place; must be done *before* Phase 4 onward, since every subsequent feature's data access assumes RLS is already correct — building UI against an un-secured schema and retrofitting RLS later is exactly the anti-pattern this SRS wants to avoid (`15-security-architecture.md` §15.5).

## Phase 4 — Employee Management

Employee list/search/filter, profile view/edit, team assignment, suspend/reactivate. **Dependency**: needs Phase 3 (RLS) so that "view team employees" is correctly scoped from the start.

## Phase 5 — Scheduling

Schedule CRUD (draft/publish), FullCalendar integration, team/individual assignment via `schedule_assignments`, assistant draft permissions and the `can_publish_schedules` delegation. **Dependency**: needs Phase 4 (teams/employees must exist to assign schedules to).

## Phase 6 — Attendance

Check-in/check-out UI, derived-status trigger, supervisor manual override, attendance history views. **Dependency**: needs Phase 4 (employee/team scoping) but is independent of Phase 5 — can be built in parallel with Scheduling if working with more than one implementer.

## Phase 7 — Leave + Requests

The generalized `requests` model end-to-end: submit (leave / schedule_change / custom), attachments (Storage bucket + signed URLs), supervisor review queue, approve/reject, cancel. **Dependency**: schedule_change requests reference `schedules` (Phase 5), so Phase 7 should follow Phase 5; leave and custom requests have no such dependency and could technically start earlier, but building the unified request UI once, after scheduling exists, avoids rework.

## Phase 8 — Notifications

Notification table + triggers/Server Action logic for schedule-published and request-status-changed events, team notification send, notification list UI, Realtime subscription for the bell. **Dependency**: needs Phase 5 and Phase 7 complete, since notifications are triggered by their events.

## Phase 9 — Responsive / Mobile UI Polish

Pass over every screen built in Phases 4–8 against the breakpoints in `04-non-functional-requirements.md` §4.6 (mobile nav sheet, card layouts for tables, FullCalendar's list/day views on small screens). **Dependency**: needs the feature UI from Phases 4–8 to exist first — this is a polish pass, not new functionality.

## Phase 10 — Testing

Vitest unit tests for Zod schemas and isolated utility logic (can be written incrementally alongside each phase rather than deferred entirely to the end — recommended). Playwright e2e tests for the critical workflows only: login, create+publish a schedule, submit+approve a leave request, attendance check-in/out. **Dependency**: e2e tests need the corresponding features complete; unit tests can and should start as early as Phase 2 (validation schemas exist from Phase 2 onward).

## Phase 11 — Deployment

Wire up the GitHub Actions CI workflow (`12-cicd.md`), connect the repo to Vercel, configure Preview vs. Production environment variables and Supabase projects, do a first production deploy and smoke test. **Dependency**: technically could be stood up as early as Phase 1 (an empty app deploying successfully is a good early signal) and then just kept green through every subsequent phase — recommend enabling CI/CD from Phase 1, not saving it for last, even though it's listed last as "the point where production go-live happens."

## Cross-Phase Note

Phases 4 through 8 each touch `types/database.ts` regeneration (after their Phase 2/3 or any later schema tweak) and should keep `docs/srs/07-database-schema.md` in sync if the implementation deviates from the spec during build — this SRS is meant to be updated, not treated as immutable once coding starts.
