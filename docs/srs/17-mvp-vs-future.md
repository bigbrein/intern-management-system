# 17 — MVP vs. Future Features

> **Depends on:** all prior modules. Read this to know what *not* to build yet.

## 17.1 MVP Scope (build now)

- Authentication (Supabase Auth: login, logout, password reset, session management).
- Role-based access (Supervisor / Assistant / Employee) enforced via RLS.
- Employee management: view, search, filter, profile view/edit, team assignment, suspend/reactivate.
- Scheduling: create/edit/draft/publish, team + individual assignment, meetings (via `schedule.type`), FullCalendar view.
- Attendance: check-in/check-out with derived status, supervisor override, own + team history views.
- Leave management and the generalized request system (leave, schedule-change, custom), with optional file attachments.
- Notifications: system-generated (schedule published, request reviewed) + supervisor-sent team notifications, with Realtime delivery.
- Responsive UI (desktop/tablet/mobile).
- Critical-path automated tests (Vitest + Playwright) and a working CI/CD pipeline to Vercel.

## 17.2 Future Features (explicitly deferred — do not build in the MVP)

| Feature | Why deferred |
|---|---|
| Payroll, benefits, compensation | Out of scope entirely for this product's positioning as a lightweight scheduling/attendance/requests tool, not a full HRIS. |
| Public self-service registration | MVP uses supervisor-invited accounts only; open registration needs an org-invite/verification flow not yet designed. |
| Multi-tenant SaaS (multiple organizations per deployment, billing) | MVP is single-organization per deployment; schema is structured so `organization_id` can be added additively later (`07-database-schema.md` §7.11), but building multi-tenancy now adds RLS and billing complexity with no current user need. |
| Multi-level / matrix org structures (co-supervisors, supervisor-of-supervisors) | Adds significant RLS and permission-matrix complexity; current small-team target doesn't need it. |
| Leave balance / accrual tracking | MVP tracks the request/approval workflow only, not balances — a meaningfully separate feature (accrual rules, carry-over policy) better scoped on its own. |
| Biometric attendance, GPS/geofenced check-in, facial recognition | Explicitly excluded per the original brief; also raises privacy/compliance obligations disproportionate to a lightweight MVP. |
| Configurable multi-step/parallel approval workflows | MVP approval is single-step (one reviewing supervisor); a workflow engine is a different order of complexity. |
| Native mobile app | Mobile-responsive web is sufficient for the MVP's usage pattern; a native app is a distinct, larger project. |
| Dedicated audit-log table / compliance reporting | Lightweight `console.log`-based audit trail (`14-logging-monitoring.md`) is sufficient until a concrete compliance requirement emerges. |
| Advanced analytics/reporting dashboards | Not requested; would add a new data-aggregation layer with no current use case. |
| Rate-limiting middleware beyond Supabase Auth's defaults | Add only if abuse is actually observed on a specific endpoint (`15-security-architecture.md` §15.7). |
| Third-party calendar sync (Google/Outlook) | FullCalendar in-app is sufficient for MVP; external sync is a meaningful integration project on its own. |
| Sentry/full APM from day one | Vercel + Supabase dashboards are sufficient to launch; add Sentry when/if the team has budget and a demonstrated need (`14-logging-monitoring.md`). |

## 17.3 How to Promote a Future Feature

When a future feature becomes a real requirement: add it to `03-functional-requirements.md` with `FR-` IDs, extend the permission matrix in `02-user-roles-and-permissions.md` if it changes what a role can do, extend the schema in `07-database-schema.md` via an additive migration, and add the corresponding RLS policies in `08-authorization-rls.md`. Do not silently build ahead of this document — keep the SRS and the codebase in sync.
