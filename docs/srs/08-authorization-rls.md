# 08 — Authorization Model & RLS Policies

> **Depends on:** `02-user-roles-and-permissions.md`, `07-database-schema.md`

## 8.1 Principle

RLS is the actual authorization boundary (`06-architecture.md` §6.4). Every table listed in `07-database-schema.md` has RLS **enabled and forced** (`alter table ... enable row level security；` and no table is left with a permissive default-allow policy). All policies below are written against `auth.uid()` and the requesting user's own `profiles` row.

To avoid infinite-recursion issues (a common Supabase RLS pitfall — see `15-security-architecture.md`), role/team lookups needed inside policies are wrapped in `security definer` helper functions rather than sub-selecting `profiles` directly inside a policy on `profiles` itself.

```sql
create or replace function current_user_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_user_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from profiles where id = auth.uid();
$$;

create or replace function is_supervisor_of(target_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles target
    join teams t on t.id = target.team_id
    where target.id = target_profile_id and t.supervisor_id = auth.uid()
  );
$$;

create or replace function is_same_team(target_profile_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles me, profiles target
    where me.id = auth.uid() and target.id = target_profile_id
      and me.team_id is not distinct from target.team_id
      and me.team_id is not null
  );
$$;
```

## 8.2 `profiles`

| Policy | Applies to | Rule |
|---|---|---|
| `profiles_select_own` | all | `id = auth.uid()` |
| `profiles_select_team` | supervisor, assistant | `is_supervisor_of(id)` (supervisor over the row's team) OR the requester is an assistant whose `assisting_supervisor_id` equals the target row's team's supervisor |
| `profiles_update_own_limited` | all | `id = auth.uid()`, and only via a Server Action that restricts the updatable column set (`full_name`, `phone`, `avatar_url`) — RLS allows the update, application logic + a `check` trigger blocks changing `role`/`team_id`/`account_status` from a non-supervisor context |
| `profiles_update_team` | supervisor | `is_supervisor_of(id)` — supervisor can update `team_id`, `role` (to `assistant`/`employee`), `account_status` for their team's employees |
| `profiles_insert` | handled by the `on_auth_user_created` trigger (security definer), not by client insert | — |

## 8.3 `teams`

| Policy | Applies to | Rule |
|---|---|---|
| `teams_select` | all authenticated | `supervisor_id = auth.uid()` OR `id = current_user_team_id()` (members can see their own team's name) |
| `teams_insert` | supervisor | `supervisor_id = auth.uid()` (a supervisor can only create teams they supervise) |
| `teams_update` | supervisor | `supervisor_id = auth.uid()` |
| `teams_delete` | supervisor | `supervisor_id = auth.uid()` |

## 8.4 `schedules`

| Policy | Applies to | Rule |
|---|---|---|
| `schedules_select` | all authenticated | `team_id = current_user_team_id()` OR `exists (select 1 from schedule_assignments sa where sa.schedule_id = schedules.id and sa.employee_id = auth.uid())` OR `created_by = auth.uid()` |
| `schedules_insert` | supervisor, assistant | supervisor: `team_id is null or is_supervisor_of_team(team_id)`; assistant: same, but application-level check forces `status = 'draft'` on insert (also enforced by a `check`-style trigger for defense in depth) |
| `schedules_update` | supervisor, assistant | supervisor: full update on their team's schedules; assistant: `created_by = auth.uid() and status = 'draft'` for edits, plus a separate narrower policy allowing an assistant to set `status = 'published'` only when their `profiles.can_publish_schedules = true` |
| `schedules_delete` | supervisor | supervisor over the schedule's team only |

## 8.5 `schedule_assignments`

| Policy | Applies to | Rule |
|---|---|---|
| `schedule_assignments_select` | all authenticated | `employee_id = auth.uid()` OR requester supervises/assists the schedule's team |
| `schedule_assignments_insert/delete` | supervisor, assistant (draft only) | mirrors the parent `schedules` update policy |

## 8.6 `attendance`

| Policy | Applies to | Rule |
|---|---|---|
| `attendance_select_own` | all | `employee_id = auth.uid()` |
| `attendance_select_team` | supervisor, assistant | `is_supervisor_of(employee_id)` or assistant equivalent (read-only for assistant — enforced by only granting `select`, no `update`/`insert` policy for assistant role) |
| `attendance_insert_own` | employee, supervisor, assistant | `employee_id = auth.uid()`, and only for `date = current_date` (no backdating check-ins) |
| `attendance_update_own` | employee, supervisor, assistant | `employee_id = auth.uid() and is_manual_override = false` (an employee can complete their own check-out but not edit a supervisor override) |
| `attendance_update_override` | supervisor | `is_supervisor_of(employee_id)`, allowed to set `is_manual_override = true` and change `status`/`note` |

## 8.7 `requests`

| Policy | Applies to | Rule |
|---|---|---|
| `requests_select_own` | all | `requester_id = auth.uid()` |
| `requests_select_team` | supervisor | `is_supervisor_of(requester_id)` |
| `requests_select_team_readonly` | assistant | `is_same_team(requester_id)` (read-only, no update policy granted) |
| `requests_insert` | all | `requester_id = auth.uid() and status = 'pending' and reviewer_id is null` |
| `requests_update_own_cancel` | all | `requester_id = auth.uid()`, application logic restricts this path to setting `status = 'cancelled'` while current status is `pending` |
| `requests_update_review` | supervisor | `is_supervisor_of(requester_id) and status = 'pending'` (transitioning row), setting `status`, `reviewer_id = auth.uid()`, `review_notes`, `reviewed_at = now()` |

## 8.8 `request_attachments`

| Policy | Applies to | Rule |
|---|---|---|
| `request_attachments_select` | requester, reviewing supervisor | `exists (select 1 from requests r where r.id = request_id and (r.requester_id = auth.uid() or is_supervisor_of(r.requester_id)))` |
| `request_attachments_insert` | requester | `uploaded_by = auth.uid() and exists (select 1 from requests r where r.id = request_id and r.requester_id = auth.uid())` |

Storage bucket policy (`request-attachments`, private bucket) mirrors this: object path is namespaced `request_id/uuid-filename`, and the Storage RLS policy checks the same `requests` ownership/supervisor condition against the path prefix before allowing `select`/`insert`.

## 8.9 `notifications`

| Policy | Applies to | Rule |
|---|---|---|
| `notifications_select_own` | all | `recipient_id = auth.uid()` |
| `notifications_update_own` | all | `recipient_id = auth.uid()` (only for toggling `is_read`) |
| `notifications_insert` | server-side only | inserted via Server Actions/triggers running with the user's session (supervisor sending a team notification) or a `security definer` function for system-generated notifications (schedule published, request reviewed) — no generic client insert policy for arbitrary recipients |

## 8.10 Permission Matrix Reference

See `02-user-roles-and-permissions.md` §2.3 for the full application-level permission matrix this section implements. Every row in that matrix must correspond to at least one policy above; if you add a new capability, add it to that matrix first, then add the policy here.
