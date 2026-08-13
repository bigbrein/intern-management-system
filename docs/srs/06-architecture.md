# 06 — Architecture

> **Depends on:** `05-technical-stack.md`
> **Feeds into:** `09-api-data-access-strategy.md`, `10-project-structure.md`

## 6.1 Architectural Style

MiniHR is a **modular monolith**: one Next.js application, one Supabase project, deployed as a single deployable unit. "Modular" refers to internal code organization by feature/domain (employees, scheduling, attendance, leave, requests, notifications), not to separate deployable services. There is no microservices split, no separate API gateway, and no separate backend process.

```text
                          Client (browser)
                                │
                                ▼
                      ┌───────────────────┐
                      │      Next.js       │
                      │   React + TS App    │
                      │       Router        │
                      └─────────┬──────────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
          Server              Server             Route
        Components            Actions            Handlers
     (data fetching,       (form mutations,    (webhooks, file
      read-heavy pages)     writes, redirects)   downloads, any
             │                  │               non-form client
             │                  │                 fetch need)
             └──────────────────┼──────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │    Supabase      │
                       ├─────────────────┤
                       │  PostgreSQL      │
                       │  (RLS enforced)  │
                       │  Auth            │
                       │  Storage         │
                       │  Realtime        │
                       └─────────────────┘
```

## 6.2 Layer-by-Layer Explanation

### Client (browser)

Renders the React tree Next.js sends, hydrates interactive ("use client") components — forms, the FullCalendar widget, the notification bell subscribed to Realtime. The client never talks to Supabase with a service-role key and never holds elevated privileges; it uses the same anon-key + user-session context as everything else, so even direct client-side Supabase calls (e.g., the Realtime subscription) are still fully bound by RLS.

### Server Components

Default for any page/route that primarily *reads and displays* data: employee list, schedule calendar, attendance history, request list, notification list. They call Supabase directly using the server-side Supabase client (bound to the current user's session via cookies), so data fetching happens on the server, close to the database, with no client-exposed API layer needed for reads.

### Server Actions

Used for all form-driven **mutations** initiated from a page rendered by this app: creating/editing a schedule, submitting a leave request, approving/rejecting a request, recording attendance, updating a profile. Server Actions are colocated with the feature (e.g., `app/(dashboard)/schedules/actions.ts`), validate input with the shared Zod schema, perform the Supabase write, and revalidate/redirect as needed.

### Route Handlers

Reserved for cases that don't fit the Server Action model: file download/signed-URL generation for attachments, any endpoint that must be called by something other than this app's own forms (e.g., a future external integration), and any case needing a raw HTTP response (custom headers, non-HTML content type). See `09-api-data-access-strategy.md` for the precise decision rule.

### Supabase

- **PostgreSQL**: all relational data, with RLS enabled on every table.
- **Auth**: identity, sessions, password management.
- **Storage**: request attachments, private bucket, signed-URL access.
- **Realtime**: notification delivery and optional live status updates.

## 6.3 Why Not a Separate Backend Service

Introducing Express/NestJS/etc. would mean: a second runtime to deploy and monitor, a second place to enforce authorization (duplicating what RLS already does), and a REST/GraphQL layer between Next.js and Postgres that adds latency and code for no capability this app needs. Next.js Server Components/Actions already provide server-side execution with direct database access; Supabase already provides the auth/session layer a custom backend would otherwise need to implement. This is revisited only if a genuine cross-application integration need arises (see `17-mvp-vs-future.md`).

## 6.4 Cross-Cutting Concerns

- **Validation**: Zod schemas in `lib/validation/`, used both client-side (via `zodResolver` in React Hook Form) and server-side (re-validated inside every Server Action / Route Handler — never trust the client pass).
- **Authorization**: enforced twice, deliberately redundant — UI-level checks (based on the current user's role, fetched from their profile) hide actions the user isn't permitted to take, and RLS enforces it regardless of what the UI allowed. RLS is the actual boundary (see `08-authorization-rls.md`); UI checks are only a UX layer.
- **Error handling**: see `13-error-handling.md`.
- **Account status enforcement**: because Supabase Auth itself has no "suspended" concept, middleware/layout code checks `profiles.account_status` on each request for a signed-in user and forces logout/blocks access if `suspended` (see `03-functional-requirements.md` FR-AUTH-5, `15-security-architecture.md`).
