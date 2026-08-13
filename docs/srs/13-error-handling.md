# 13 — Error Handling

> **Depends on:** `09-api-data-access-strategy.md`

## 13.1 Principle

Errors are handled consistently by category, and the UI always gives the user a next step without leaking implementation details (stack traces, raw SQL/Postgres error text, internal table/column names).

## 13.2 Categories & Strategy

| Category | Where caught | User-facing behavior |
|---|---|---|
| **Validation errors** (Zod parse failure) | Server Action / Route Handler, before any Supabase call | Field-level error messages returned in the Server Action's result object, rendered inline next to the relevant form field via React Hook Form |
| **Authentication errors** (no session / expired session) | `middleware.ts`, and defensively inside Server Actions | Redirect to `/login`, optionally with a "please sign in again" toast; no partial page render of protected content |
| **Authorization errors** (RLS denies a write, or role check fails) | Server Action catch block | Generic "You don't have permission to do that" message — never reveal *why* in detail (e.g., don't say "row exists but belongs to another team," since that itself leaks information) |
| **Database errors** (constraint violation, connection issue) | Server Action / Route Handler catch block | Generic "Something went wrong saving your changes, please try again" toast; the real Postgres error is logged server-side (see `14-logging-monitoring.md`), not shown to the user |
| **Network failures** (client-side fetch/Realtime disconnect) | Client component (e.g., notification bell's Realtime subscription) | Non-blocking indicator (e.g., a small "reconnecting…" state) with automatic retry via Supabase Realtime's built-in reconnection; never a hard crash of the page |
| **Unexpected server errors** | Next.js `error.tsx` boundaries per route segment | A friendly fallback UI ("Something went wrong") with a retry action; full error detail goes to server logs only |

## 13.3 Server Action Error Shape

All Server Actions return a consistent discriminated union rather than throwing across the server/client boundary:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
```

This lets the calling client component handle success/failure uniformly (toast on `ok: false`, field errors on `fieldErrors`) without a try/catch wrapping every call site.

## 13.4 Route Handler Error Shape

Route Handlers return a standard JSON error body on failure:

```json
{ "error": "message safe to show the user" }
```

with an appropriate HTTP status (`400` validation, `401` unauthenticated, `403` unauthorized, `404` not found, `500` unexpected).

## 13.5 Route-Segment Error Boundaries

Every major route segment (`app/(dashboard)/employees/`, `.../schedules/`, etc.) has an `error.tsx` so a failure in one module's page doesn't take down the whole dashboard shell, plus a top-level `app/(dashboard)/error.tsx` as the catch-all. A `not-found.tsx` handles missing resources (e.g., a schedule ID that doesn't exist or isn't visible to the current user under RLS) distinctly from a hard error.

## 13.6 What Never Reaches the Client

- Raw Postgres/Supabase error messages and codes.
- Stack traces.
- Internal table/column names or RLS policy names.
- Any hint about whether a resource exists but is merely inaccessible vs. truly not existing, where that distinction itself would leak information (e.g., "is this employee's leave request pending" for a request the user has no right to see) — both cases render as a generic not-found/forbidden state.
