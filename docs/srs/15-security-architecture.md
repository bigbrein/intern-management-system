# 15 — Security Architecture

> **Depends on:** `08-authorization-rls.md`, `09-api-data-access-strategy.md`

## 15.1 Boundaries

- **Authentication boundary**: Supabase Auth issues sessions; `middleware.ts` refreshes the session on every request and redirects unauthenticated users away from `app/(dashboard)/*`. `app/(auth)/*` (login, reset-password) is the only public surface.
- **Authorization boundary**: PostgreSQL RLS (`08-authorization-rls.md`), enforced regardless of which code path (Server Component, Server Action, Route Handler, or a direct client-side Supabase Realtime subscription) issues the query. UI-level role checks are a convenience layer only.
- **Account-status boundary**: `profiles.account_status = 'suspended'` is checked in `middleware.ts` (or the dashboard root layout) after auth succeeds, since Supabase Auth itself has no first-class "suspended" concept — a suspended user with a still-valid session is forced back to a "your account is suspended" screen and signed out.

## 15.2 RLS Requirements

- RLS is **enabled and has policies for every operation actually needed** (`select`/`insert`/`update`/`delete`) on every table in `07-database-schema.md`. A table with RLS enabled but no matching policy for an operation denies that operation by default — this is relied on deliberately (e.g., no `notifications_insert` policy for regular clients, per `08-authorization-rls.md` §8.9).
- Role/relationship lookups inside policies use `security definer` helper functions (`08-authorization-rls.md` §8.1) rather than nested selects against `profiles` from within a policy defined *on* `profiles`, to avoid the recursive-policy evaluation problem (see §15.5).

## 15.3 Input Validation

- Every Server Action and Route Handler validates with Zod before any database call (`09-api-data-access-strategy.md` §9.3). This is the primary defense against malformed/malicious input, independent of RLS.

## 15.4 File Upload Security

Detailed in `04-non-functional-requirements.md` §4.2.1: private bucket, 5 MB / 3-file limits, allow-listed content types, signed-URL-only access, `request_id`-namespaced storage paths, Storage RLS mirroring the parent `requests` ownership check.

## 15.5 Common Supabase RLS + Next.js Mistakes (explicitly called out)

Implementers — human or AI — should actively avoid these:

1. **Using the service-role key in a code path reachable by normal user requests.** The service-role key bypasses RLS entirely. It must never be imported into any file that could execute in response to a normal authenticated user's request (Server Components, most Server Actions, most Route Handlers). If it's used at all, it belongs only in narrowly-scoped, clearly-named server-only utility code for genuine admin/maintenance tasks.
2. **Enabling RLS but forgetting a policy for one operation**, then being confused why inserts silently fail — this is correct behavior (default-deny), not a bug, but it must be *intentional* and documented per table (as it is in `08-authorization-rls.md`).
3. **Writing a self-referencing policy that causes infinite recursion** — e.g., a policy on `profiles` that queries `profiles` again to check the role. Solved here via `security definer` functions (§15.2).
4. **Trusting a client-supplied `user_id`/`role` field in an insert/update payload.** Always derive identity from `auth.uid()` server-side (both in the RLS policy and, redundantly, in the Server Action itself), never from a form field the client controls.
5. **Assuming middleware-level auth checks are sufficient and skipping RLS.** Middleware only checks "is there a valid session" — it says nothing about row-level ownership. RLS must independently enforce that.
6. **Forgetting that Realtime subscriptions are still subject to RLS** — this is a feature (a client can only subscribe to rows it's allowed to `select`), but it means the `notifications` policy (`recipient_id = auth.uid()`) must be correct, or a user could otherwise attempt to subscribe broadly.
7. **Exposing the anon key's power beyond what RLS intends** by accidentally granting `select`/`insert` too broadly (e.g., a "true" catch-all policy left over from prototyping). Every policy in `08-authorization-rls.md` should be reviewed for over-broad `using (true)` conditions before shipping.
8. **Putting secrets in `NEXT_PUBLIC_*` variables** out of convenience during development and forgetting to move them server-only before shipping (see `11-environment-variables.md`).
9. **Validating only on the client** (trusting React Hook Form + Zod in the browser alone) — the same schema must re-validate server-side, since a client can always be bypassed by calling the Server Action/Route Handler directly.

## 15.6 Session Handling

- Sessions are cookie-based via `@supabase/ssr`, refreshed by `middleware.ts` on every request so Server Components always see a current session.
- No session tokens are stored in `localStorage`/`sessionStorage` (the `@supabase/ssr` cookie approach avoids this by design) or logged.
- Password reset uses Supabase's standard email-link flow; reset links expire per Supabase Auth's default token TTL.

## 15.7 Rate Limiting Considerations

- For the MVP's scale (small internal teams), Supabase Auth's built-in rate limiting on login/password-reset endpoints is accepted as sufficient — no additional rate-limiting middleware is introduced.
- If a specific Route Handler (e.g., attachment signed-URL generation) becomes a target for abuse later, add rate limiting there specifically (e.g., Vercel's Edge Middleware with a simple counter) rather than building a general-purpose rate-limiting layer upfront.

## 15.8 Data Exposure Risks

- Employee profile data is intentionally minimal (`03-functional-requirements.md` FR-EMP-6) specifically to reduce the impact of any future data-exposure bug — there is no salary, national ID, or medical data in the schema to leak in the first place.
- Request `description`/leave `reason` free-text fields can contain sensitive personal context (health details in a sick-leave reason, for example) even though the schema doesn't have dedicated sensitive fields — access to `requests` is restricted to the requester and their reviewing supervisor only (`08-authorization-rls.md` §8.7), and this content is excluded from routine logs (`14-logging-monitoring.md` §14.4).
