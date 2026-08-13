# 02 — User Roles & Permissions

> **Depends on:** `01-project-overview.md`
> **Feeds into:** `08-authorization-rls.md` (RLS policies implement this matrix at the database level).

## 2.1 Roles

MiniHR has exactly three application roles, stored as a Postgres enum (`user_role`) on each user's profile. A user has exactly one role at a time.

### Supervisor

Full management authority over their team(s). Can:

- View all employees/wards under their supervision.
- View employee profile information.
- View team attendance (current and historical).
- Create, edit, publish, and delete schedules for their team.
- Schedule meetings.
- Send team-wide notifications.
- Review leave requests (approve/reject).
- Review schedule-modification requests (approve/reject).
- Review custom HR requests (approve/reject).
- Assign/reassign employees to teams they supervise.
- Promote/manage assistants within their team (grant assistant role, scoped to their team).

### Assistant

A delegated, limited role that helps a supervisor with scheduling. Assistants do **not** automatically inherit supervisor privileges — every capability below is explicit, and everything not listed is denied.

- View relevant team schedules (the team(s) they are assigned to assist).
- Create schedule **drafts** (status = `draft`).
- Update schedule drafts they created or are permitted to edit.
- Modify schedules only within permissions granted by their supervisor (see "Assistant scoping" below).
- Cannot publish schedules by default (publishing is a supervisor action; see `2.3`).
- Cannot approve/reject any request type.
- Cannot view attendance beyond their own.
- Cannot send team notifications (can be CC'd/notified like any employee).

**Assistant scoping:** an assistant is linked to exactly one supervisor and inherits that supervisor's team scope via the `team_id` on their profile. A boolean flag `can_publish_schedules` on the assistant's profile (default `false`) lets a supervisor optionally delegate publish rights. This is the only configurable permission for assistants in the MVP — do not build a general permissions/ACL editor.

### Employee / Ward

The base role. Can:

- View their own profile.
- View their own schedule.
- View their own attendance (current status + history).
- Record their own attendance (check-in/check-out).
- Submit leave requests.
- Request schedule modifications (creates a `request` referencing a schedule).
- Submit custom HR requests.
- View the status and history of their own requests.
- View their own notifications.

## 2.2 Role Assignment

- Roles are assigned by a Supervisor (or, for the very first user in an organization, via a one-time setup/seed step — see `16-development-phases.md`, Phase 2).
- There is no self-service "sign up as Supervisor" flow; new accounts default to `employee` and must be promoted.
- A user's `team_id` determines which supervisor/assistant relationship applies. A team has exactly one primary supervisor in the MVP (no co-supervisors, no matrix reporting).

## 2.3 Refined Permission Matrix

| Resource / Action                  | Supervisor | Assistant                        | Employee |
| ----------------------------------- | :--------: | :-------------------------------: | :------: |
| View own profile                    | ✓          | ✓                                  | ✓        |
| Edit own profile (non-sensitive fields) | ✓      | ✓                                  | ✓        |
| View team employees                 | ✓ (own team) | ✓ (own team, read-only)         | ✗        |
| Edit employee records               | ✓ (own team) | ✗                                | ✗        |
| Assign employee to team             | ✓          | ✗                                  | ✗        |
| View own schedule                   | ✓          | ✓                                  | ✓        |
| View team schedule                  | ✓          | ✓                                  | ✗ (own only) |
| Create schedule (draft)             | ✓          | ✓ (draft only)                    | ✗        |
| Edit schedule draft                 | ✓          | ✓ (own drafts / delegated)        | ✗        |
| Publish schedule                    | ✓          | Only if `can_publish_schedules = true` | ✗   |
| Delete schedule                     | ✓          | ✗                                  | ✗        |
| Schedule meetings                   | ✓          | ✓ (draft, needs supervisor publish unless delegated) | ✗ |
| Record own attendance               | ✓          | ✓                                  | ✓        |
| View own attendance                 | ✓          | ✓                                  | ✓        |
| View team attendance                | ✓          | ✓ (read-only, own team)           | ✗        |
| Submit leave request                | ✓          | ✓                                  | ✓        |
| Approve/reject leave request        | ✓ (own team) | ✗                                | ✗        |
| Submit schedule-modification request | ✓         | ✓                                  | ✓        |
| Submit custom HR request            | ✓          | ✓                                  | ✓        |
| Approve/reject any request          | ✓ (own team) | ✗                                | ✗        |
| View own requests + status          | ✓          | ✓                                  | ✓        |
| View team requests                  | ✓          | ✓ (read-only, own team)           | ✗        |
| Send team notification              | ✓          | ✗                                  | ✗        |
| View own notifications              | ✓          | ✓                                  | ✓        |
| Upload attachment to own request    | ✓          | ✓                                  | ✓        |

Notes:

- "Own team" always means: the team(s) where `team.supervisor_id = current_user.id` (for supervisors) or `profile.team_id = current_user.team_id` scoped through the assistant's linked supervisor (for assistants).
- Assistants are always **read-only** on attendance and requests — they can see status to help with scheduling but cannot change approval outcomes.
- This matrix is the single source of truth for `08-authorization-rls.md`. If a future feature needs a permission not listed here, add it to this table first, then implement the RLS policy.
