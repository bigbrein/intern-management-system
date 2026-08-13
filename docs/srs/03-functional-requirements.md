# 03 — Functional Requirements

> **Depends on:** `02-user-roles-and-permissions.md`
> **Feeds into:** `07-database-schema.md`, `08-authorization-rls.md`

Each module below lists functional requirements as testable statements (`FR-<module>-<n>`). Use these IDs in tests and PR descriptions where practical.

## 3.1 Authentication & Authorization

Use **Supabase Auth**. Do not implement authentication from scratch.

- **FR-AUTH-1**: Users authenticate with email + password via Supabase Auth.
- **FR-AUTH-2**: Sessions are managed via Supabase's SSR cookie-based session (using `@supabase/ssr`), refreshed automatically.
- **FR-AUTH-3**: Users can log out, which invalidates the local session.
- **FR-AUTH-4**: Users can request a password reset email and set a new password via a Supabase-generated recovery link.
- **FR-AUTH-5**: Every authenticated user has exactly one `role` (`supervisor` | `assistant` | `employee`) and an `account_status` (`active` | `suspended`). Suspended users cannot log in (enforced by an app-level check after auth, since Supabase Auth alone doesn't have this concept — see `06-architecture.md`).
- **FR-AUTH-6**: All non-public routes are protected: unauthenticated requests are redirected to `/login` via Next.js middleware.
- **FR-AUTH-7**: Authorization is enforced at the database level via RLS (see `08-authorization-rls.md`), not only in UI/route logic. UI-level role checks are a UX convenience, never the security boundary.
- **FR-AUTH-8**: New accounts are created by a Supervisor (invite flow) rather than public self-registration, to keep organization membership controlled. (Public self-registration is a future feature.)

## 3.2 Employee Management

- **FR-EMP-1**: Supervisors can view a list of employees on their team(s), with search (by name/email) and filter (by role, team, status).
- **FR-EMP-2**: Supervisors can view an individual employee's profile: name, email, phone (optional), role, team, job title, start date, status.
- **FR-EMP-3**: Supervisors can assign/reassign an employee to a team they supervise.
- **FR-EMP-4**: Supervisors can deactivate (`account_status = suspended`) an employee; this does not delete their historical records.
- **FR-EMP-5**: Employees can view and edit a limited set of their own profile fields (phone, display name, avatar). Role, team, and status are supervisor-managed only.
- **FR-EMP-6**: Employee profile data collected is limited to what's needed for scheduling/attendance/HR requests — no national ID numbers, no salary data, no home address, no emergency-contact medical info in the MVP (see `04-non-functional-requirements.md` §Security for the data-minimization rationale).

## 3.3 Scheduling

- **FR-SCH-1**: Supervisors and Assistants can create a schedule entry with: title, date, start time, end time, assigned employee or team, location, description, status, created-by, updated-at.
- **FR-SCH-2**: A schedule's `status` is one of `draft`, `published`, `cancelled`.
- **FR-SCH-3**: Assistants can create and edit schedules only in `draft` status.
- **FR-SCH-4**: Only Supervisors (or Assistants with `can_publish_schedules = true`) can transition a schedule from `draft` to `published`.
- **FR-SCH-5**: Publishing a schedule triggers a notification to the assigned employee(s)/team (see §3.7).
- **FR-SCH-6**: Employees can view schedules assigned to them or their team, filterable by date range, rendered on a calendar (FullCalendar) and as a list.
- **FR-SCH-7**: Supervisors can schedule meetings using the same schedule entity with a `type = meeting` discriminator (see `07-database-schema.md`) rather than a separate meetings table.
- **FR-SCH-8**: Employees can submit a schedule-modification request referencing an existing schedule (via the general Request model, §3.6), rather than editing the schedule directly.
- **FR-SCH-9**: A schedule assigned to a team fans out to all current members of that team at read time (via `schedule_assignments`, not by duplicating rows per employee) — see `07-database-schema.md`.

## 3.4 Attendance

**MVP decision — check-in/check-out, with derived status.** MiniHR uses **check-in/check-out timestamps** as the single source of truth, and *derives* a present/absent/late label from those timestamps rather than maintaining both as independently-entered data.

Rationale: capturing raw timestamps is strictly more useful (it gives duration, lateness, and history) while being no harder to build than a present/absent toggle — one `attendance` row per employee per day with nullable `check_in_at` / `check_out_at`. A pure present/absent model would lose timestamp precision; maintaining *both* a manual present/absent flag and timestamps independently would create a data-consistency problem (what if they disagree?) for no MVP benefit. Status is computed:

- No `check_in_at` by end of day → `absent`.
- `check_in_at` present, no `check_out_at` → `checked_in` (in progress).
- Both present → `present` (optionally `late` if `check_in_at` is after the team's expected start time, a simple comparison, not a full shift-rules engine).
- A supervisor can manually override a record (e.g. mark `excused` for a verbal sick day) — this writes an explicit `manual_status` that takes precedence over the derived one.

Requirements:

- **FR-ATT-1**: Employees can record their own check-in and check-out for the current day (one open attendance record per employee per day).
- **FR-ATT-2**: Employees can view their own attendance history.
- **FR-ATT-3**: Supervisors can view current-day attendance and historical attendance for their team.
- **FR-ATT-4**: Supervisors can manually set/override an attendance record's status with a note (e.g., `excused`).
- **FR-ATT-5**: The system does **not** use biometric verification, GPS/geofencing, or facial recognition. (Future feature only — see `17-mvp-vs-future.md`.)

## 3.5 Leave Management

- **FR-LV-1**: Employees can submit a leave request specifying: leave type (`vacation`, `sick`, `personal`, `other`), start date, end date, reason (free text).
- **FR-LV-2**: A leave request has status `pending` → `approved` | `rejected`, or `cancelled` (by the requester, only while `pending`).
- **FR-LV-3**: Supervisors can view all pending leave requests for their team, and the full history (all statuses).
- **FR-LV-4**: Supervisors can approve or reject a leave request, optionally with review notes.
- **FR-LV-5**: Employees can view the status of their own leave requests and past history.
- **FR-LV-6**: Leave requests are implemented as rows in the generalized `requests` table with `type = leave`, not a separate table (see §3.6 and `07-database-schema.md`).
- **FR-LV-7**: The MVP does not track leave balances/accrual — it only tracks the request/approval workflow. Balance tracking is a future feature.

## 3.6 General Request System

A single generalized `requests` model backs leave requests, schedule-modification requests, and custom HR requests, differentiated by a `type` column. This avoids three parallel architectures for what is functionally the same submit → review → approve/reject workflow.

- **FR-REQ-1**: Every request has: requester, type/category, description, status, created-at, updated-at, reviewer (nullable until reviewed), review notes (nullable).
- **FR-REQ-2**: `type` ∈ `leave`, `schedule_change`, `custom`. Type-specific structured fields (leave dates/leave type, referenced schedule id) are stored in a `details` JSONB column rather than as separate nullable columns per type — this keeps one table instead of three, while still allowing type-specific data. See `07-database-schema.md` for the exact shape and the CHECK-constraint approach used to keep `details` internally consistent per type.
- **FR-REQ-3**: `status` ∈ `pending`, `approved`, `rejected`, `cancelled`.
- **FR-REQ-4**: Only a Supervisor for the requester's team can review (approve/reject) a request.
- **FR-REQ-5**: A requester can cancel their own request while it is `pending`.
- **FR-REQ-6**: Requests may have zero or more file attachments stored in Supabase Storage (see `04-non-functional-requirements.md` §Security and `07-database-schema.md`).
- **FR-REQ-7**: Reviewing a request (approve/reject) triggers a notification to the requester.

## 3.7 Notifications

- **FR-NOT-1**: A notification has: title, message, recipient (a user), type, read/unread state, created-at.
- **FR-NOT-2**: `type` ∈ `team`, `schedule`, `leave_status`, `request_status`, `general`.
- **FR-NOT-3**: Supervisors can send a notification to all members of a team they supervise (`type = team`).
- **FR-NOT-4**: The system automatically creates notifications for: schedule published/updated for a recipient, leave request status change, general request status change.
- **FR-NOT-5**: Users can view their notifications (unread first), mark individual notifications as read, and mark all as read.
- **FR-NOT-6**: New notifications appear in near-real-time in the UI (via Supabase Realtime subscription on the `notifications` table filtered to the current user) without a page refresh.
- **FR-NOT-7**: Realtime is used specifically for notifications and, where useful, live status changes on a request the user is currently viewing — not applied broadly (e.g., not for live-updating employee lists) to keep the MVP simple. See `05-technical-stack.md` §Realtime.
