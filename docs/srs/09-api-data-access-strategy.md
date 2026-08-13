# 09 — API / Data Access Strategy

> **Depends on:** `06-architecture.md`, `08-authorization-rls.md`

## 9.1 Decision Rule

| Situation | Use |
|---|---|
| Rendering a page that needs to read data (list, detail, dashboard) | **Server Component** — call Supabase directly (server client) during render |
| A form submission that creates/updates/deletes data and stays within this app | **Server Action** |
| Something needs to be fetched by a `"use client"` component after initial load without a full navigation (e.g., search-as-you-type on the employee list, or "load more") | **Server Action** invoked from a client component, or a lightweight `fetch` to a **Route Handler** if the response isn't naturally form-shaped |
| Generating a signed URL to download/view a request attachment | **Route Handler** (`GET /api/attachments/[id]`) — needs to return a redirect/binary-ish response and enforce ownership before creating the signed URL |
| A future external system needs to call into MiniHR | **Route Handler** (none needed in MVP) |
| Anything requiring elevated/service-role Supabase access (e.g., the `on_auth_user_created` trigger's equivalent, or an admin-only maintenance script) | Prefer a Postgres trigger/function first; only use a Route Handler with the service-role key as a last resort, never expose the service-role key to any client code |

**Default to Server Components for reads and Server Actions for writes.** Route Handlers are the exception, used only when the interaction genuinely isn't a page render or a form submission.

## 9.2 Why Not a Generic REST API

A REST/GraphQL layer between the UI and Postgres would just re-implement what Server Components/Actions plus RLS already provide, and would need its own auth-forwarding and validation duplicate of what Supabase's client already does when called server-side with the user's session. It is added complexity with no corresponding capability gained at this scale (`06-architecture.md` §6.3).

## 9.3 Validation

- Every Server Action and Route Handler that accepts input parses it through the matching Zod schema from `lib/validation/*` before touching Supabase. A failed parse returns a typed error result (Server Action) or a `400` with a field-error payload (Route Handler) — it never reaches the database layer.
- The same schema (or a client-safe subset) is passed to `zodResolver` in the corresponding React Hook Form, so users get instant client-side feedback, but that client check is UX only — the server re-validates unconditionally.

## 9.4 Error Handling (summary — full detail in `13-error-handling.md`)

- Server Actions return a discriminated-union result (`{ ok: true, data } | { ok: false, error }`) rather than throwing across the server/client boundary, so the calling client component can render field-level or toast errors without a try/catch around a thrown server exception.
- Supabase errors (including RLS-denied writes, which surface as a Postgres error) are caught, logged server-side (see `14-logging-monitoring.md`), and translated to a generic user-facing message — raw Postgres/Supabase error text is never shown to the user (see `15-security-architecture.md` for why).

## 9.5 Authorization Enforcement

- The server-side Supabase client used inside Server Components/Actions/Route Handlers is always created with the *user's* session (via `@supabase/ssr`'s server client bound to cookies), never the service-role key. This means every query, even ones written carelessly, is still bound by RLS.
- UI-level role gating (e.g., hiding "Approve" for a non-supervisor) exists purely to keep the interface honest and reduce failed-request noise — it is not treated as a security control anywhere in this codebase.

## 9.6 Data Fetching Patterns

- List pages (employees, schedules, attendance, requests, notifications) fetch via a `lib/data/<domain>.ts` query module (e.g., `lib/data/schedules.ts` exporting `getSchedulesForCurrentUser(filters)`), called from the Server Component. This keeps query logic testable and reusable instead of inlined in every page file.
- Pagination uses Supabase's `.range()`; filters (search, date range, status) are passed as `searchParams` on the page so state is URL-shareable and works without client-side state management.
- Mutations always call `revalidatePath()` (or `revalidateTag()` for shared data) after a successful Server Action so the affected Server Component re-renders with fresh data — no manual client-side cache invalidation library is introduced.
