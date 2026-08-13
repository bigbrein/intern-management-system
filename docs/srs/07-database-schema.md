# 07 — Database Schema

> **Depends on:** `02-user-roles-and-permissions.md`, `03-functional-requirements.md`
> **Feeds into:** `08-authorization-rls.md`

Normalized PostgreSQL schema for Supabase. All tables use `uuid` primary keys (`default gen_random_uuid()`), `timestamptz` for all timestamps, and `created_at`/`updated_at` where the table is mutable. `updated_at` is maintained via a shared trigger function (`set_updated_at()`), not application code, so it's correct regardless of write path.

## 7.1 Enums

```sql
create type user_role as enum ('supervisor', 'assistant', 'employee');
create type account_status as enum ('active', 'suspended');
create type schedule_type as enum ('shift', 'meeting');
create type schedule_status as enum ('draft', 'published', 'cancelled');
create type attendance_status as enum ('present', 'late', 'absent', 'checked_in', 'excused');
create type request_type as enum ('leave', 'schedule_change', 'custom');
create type request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type leave_type as enum ('vacation', 'sick', 'personal', 'other');
create type notification_type as enum ('team', 'schedule', 'leave_status', 'request_status', 'general');
```

## 7.2 `teams`

**Purpose**: departments/teams a supervisor manages and employees belong to.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `name` | `text` | `not null` |
| `supervisor_id` | `uuid` | FK → `profiles.id`, `not null` |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

- **Constraints**: `unique (name, supervisor_id)` to avoid duplicate team names under the same supervisor.
- **Indexes**: `idx_teams_supervisor_id on teams(supervisor_id)`.
- **Relationships**: one team → one supervisor; one team → many `profiles`.

## 7.3 `profiles`

**Purpose**: application-level user record, 1:1 with `auth.users`. Never store passwords or auth secrets here — Supabase Auth owns those.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users.id` (`on delete cascade`) |
| `full_name` | `text` | `not null` |
| `email` | `text` | `not null unique` (mirrors `auth.users.email` for convenient joins/display) |
| `phone` | `text` | nullable |
| `avatar_url` | `text` | nullable |
| `role` | `user_role` | `not null default 'employee'` |
| `account_status` | `account_status` | `not null default 'active'` |
| `team_id` | `uuid` | FK → `teams.id`, nullable (supervisor may not have a `team_id` if they only supervise, though a supervisor can also belong to a team above them in future multi-level orgs — MVP: nullable) |
| `assisting_supervisor_id` | `uuid` | FK → `profiles.id`, nullable; set when `role = 'assistant'`, points to the supervisor they assist |
| `can_publish_schedules` | `boolean` | `not null default false`; only meaningful when `role = 'assistant'` |
| `job_title` | `text` | nullable |
| `start_date` | `date` | nullable |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

- **Constraints**: `check (role <> 'assistant' or assisting_supervisor_id is not null)` — an assistant must have a supervisor.
- **Indexes**: `idx_profiles_team_id on profiles(team_id)`, `idx_profiles_role on profiles(role)`, `idx_profiles_assisting_supervisor_id on profiles(assisting_supervisor_id)`.
- **Relationships**: many profiles → one team; many assistant profiles → one supervisor profile (self-referencing FK).
- A trigger on `auth.users` (`on_auth_user_created`) inserts the matching `profiles` row on signup, defaulting `role = 'employee'`.

## 7.4 `schedules`

**Purpose**: shifts and meetings (unified via `type`), replacing a separate `meetings` table.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `title` | `text` | `not null` |
| `type` | `schedule_type` | `not null default 'shift'` |
| `date` | `date` | `not null` |
| `start_time` | `time` | `not null` |
| `end_time` | `time` | `not null` |
| `location` | `text` | nullable |
| `description` | `text` | nullable |
| `status` | `schedule_status` | `not null default 'draft'` |
| `team_id` | `uuid` | FK → `teams.id`, nullable (set when assigned to a whole team) |
| `created_by` | `uuid` | FK → `profiles.id`, `not null` |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

- **Constraints**: `check (end_time > start_time)`.
- **Indexes**: `idx_schedules_team_id on schedules(team_id)`, `idx_schedules_date on schedules(date)`, `idx_schedules_created_by on schedules(created_by)`, `idx_schedules_status on schedules(status)`.
- **Relationships**: one schedule → optionally one team (bulk assignment) and/or many individual employees via `schedule_assignments`.

## 7.5 `schedule_assignments`

**Purpose**: join table assigning a schedule to one or more individual employees, independent of (or in addition to) a team-level assignment — avoids duplicating a schedule row per employee.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `schedule_id` | `uuid` | FK → `schedules.id` (`on delete cascade`), `not null` |
| `employee_id` | `uuid` | FK → `profiles.id` (`on delete cascade`), `not null` |
| `created_at` | `timestamptz` | `not null default now()` |

- **Constraints**: `unique (schedule_id, employee_id)`.
- **Indexes**: `idx_schedule_assignments_schedule_id`, `idx_schedule_assignments_employee_id`.
- **Relationships**: many-to-many between `schedules` and `profiles`.

## 7.6 `attendance`

**Purpose**: one row per employee per day; `check_in_at`/`check_out_at` are the source of truth, `status` is derived/overridable (see `03-functional-requirements.md` §3.4).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `employee_id` | `uuid` | FK → `profiles.id`, `not null` |
| `date` | `date` | `not null` |
| `check_in_at` | `timestamptz` | nullable |
| `check_out_at` | `timestamptz` | nullable |
| `status` | `attendance_status` | `not null default 'absent'`; recomputed on check-in/out via trigger, or set explicitly by a supervisor override |
| `is_manual_override` | `boolean` | `not null default false` |
| `note` | `text` | nullable, used with manual overrides (e.g., "excused — doctor's note on file") |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

- **Constraints**: `unique (employee_id, date)`; `check (check_out_at is null or check_out_at > check_in_at)`.
- **Indexes**: `idx_attendance_employee_id on attendance(employee_id)`, `idx_attendance_date on attendance(date)`, composite `idx_attendance_employee_date on attendance(employee_id, date)` for history queries.
- **Relationships**: many attendance rows → one employee (`profiles`).

## 7.7 `requests`

**Purpose**: generalized request/approval model backing leave, schedule-change, and custom HR requests.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `requester_id` | `uuid` | FK → `profiles.id`, `not null` |
| `type` | `request_type` | `not null` |
| `description` | `text` | `not null` |
| `status` | `request_status` | `not null default 'pending'` |
| `details` | `jsonb` | `not null default '{}'::jsonb`; shape depends on `type` (see below) |
| `reviewer_id` | `uuid` | FK → `profiles.id`, nullable until reviewed |
| `review_notes` | `text` | nullable |
| `reviewed_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | `not null default now()` |
| `updated_at` | `timestamptz` | `not null default now()` |

`details` shape by type (validated by the Zod schema at the application boundary, and by a Postgres `check` constraint for the required keys per type):

- `type = 'leave'`: `{ "leave_type": "vacation" | "sick" | "personal" | "other", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }`
- `type = 'schedule_change'`: `{ "schedule_id": "<uuid>", "requested_change": "text" }`
- `type = 'custom'`: `{ "category": "text" }` (free-form; minimal structure)

- **Constraints**:
  - `check (status = 'pending' or reviewer_id is not null)` — can't be approved/rejected without a reviewer.
  - `check (type <> 'leave' or (details ? 'leave_type' and details ? 'start_date' and details ? 'end_date'))`
  - `check (type <> 'schedule_change' or details ? 'schedule_id')`
- **Indexes**: `idx_requests_requester_id`, `idx_requests_status`, `idx_requests_type`, `idx_requests_reviewer_id`.
- **Relationships**: many requests → one requester (`profiles`); many requests → optionally one reviewer (`profiles`); `details->>'schedule_id'` loosely references `schedules.id` (not a hard FK, since it lives inside JSONB — validated at the application layer).

## 7.8 `request_attachments`

**Purpose**: optional file attachments on a request, stored in Supabase Storage.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `request_id` | `uuid` | FK → `requests.id` (`on delete cascade`), `not null` |
| `storage_path` | `text` | `not null`; path within the `request-attachments` bucket |
| `file_name` | `text` | `not null`; original filename, display-only |
| `file_size_bytes` | `integer` | `not null`; `check (file_size_bytes <= 5242880)` (5 MB) |
| `content_type` | `text` | `not null`; `check (content_type in ('application/pdf','image/png','image/jpeg'))` |
| `uploaded_by` | `uuid` | FK → `profiles.id`, `not null` |
| `created_at` | `timestamptz` | `not null default now()` |

- **Indexes**: `idx_request_attachments_request_id`.
- **Relationships**: many attachments → one request.

## 7.9 `notifications`

**Purpose**: per-user notification feed.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `recipient_id` | `uuid` | FK → `profiles.id`, `not null` |
| `title` | `text` | `not null` |
| `message` | `text` | `not null` |
| `type` | `notification_type` | `not null` |
| `related_entity_type` | `text` | nullable (e.g. `'schedule'`, `'request'`) — for building a link to the relevant page |
| `related_entity_id` | `uuid` | nullable |
| `is_read` | `boolean` | `not null default false` |
| `created_at` | `timestamptz` | `not null default now()` |

- **Indexes**: `idx_notifications_recipient_id on notifications(recipient_id)`, composite `idx_notifications_recipient_unread on notifications(recipient_id, is_read)` for the common "unread for me" query.
- **Relationships**: many notifications → one recipient (`profiles`).
- Table is added to the `supabase_realtime` publication so clients can subscribe (see `05-technical-stack.md` §5.12).

## 7.10 Entity Relationship Summary

```text
teams (1) ─────< profiles (many)          [team_id]
profiles (1, supervisor) ─────< teams (many)  [supervisor_id]
profiles (1, supervisor) ─────< profiles (many, assistants) [assisting_supervisor_id]

schedules (many) >───── teams (1, optional)   [team_id]
schedules (1) ─────< schedule_assignments (many) >───── profiles (1) [employee_id]
profiles (1, created_by) ─────< schedules (many)

profiles (1) ─────< attendance (many)     [employee_id]

profiles (1, requester) ─────< requests (many)   [requester_id]
profiles (1, reviewer)  ─────< requests (many)   [reviewer_id]
requests (1) ─────< request_attachments (many)   [request_id]

profiles (1, recipient) ─────< notifications (many)  [recipient_id]
```

## 7.11 Design Notes

- **No duplication**: schedule-team assignment fans out at query time via `schedule_assignments`/`team_id`, not by writing one row per employee.
- **One request table, not three**: keeps RLS policies, notification triggers, and the review UI single-implementation instead of tripled.
- **Multi-tenancy-ready but not multi-tenant**: no `organization_id` column exists in the MVP (one organization per Supabase project/deployment, per `01-project-overview.md`). If multi-tenancy becomes a real requirement later, the migration path is: add `organization_id` to `teams` and `profiles`, backfill, then extend RLS predicates — a additive migration, not a rewrite. Do not add this column speculatively now.
- **Triggers required**: `set_updated_at()` on every mutable table; `on_auth_user_created` to create the matching `profiles` row; an attendance trigger to recompute `status` on `check_in_at`/`check_out_at` change (skipped when `is_manual_override = true`); notification-creation triggers (or equivalent Server Action logic — either is acceptable, but pick one approach consistently, see `09-api-data-access-strategy.md`) for schedule-published and request-status-changed events.
