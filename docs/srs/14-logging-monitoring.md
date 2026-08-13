# 14 — Logging & Monitoring

> **Depends on:** `13-error-handling.md`

## 14.1 Principle

Lightweight, mostly-free tooling appropriate for a small-team MVP. No enterprise observability stack (no dedicated APM contract, no self-hosted ELK stack) — the managed platforms already in use (Vercel, Supabase) provide most of what's needed out of the box.

## 14.2 What to Use

- **Vercel's built-in logging**: Function/Server Action/Route Handler `console.log`/`console.error` output is captured automatically in the Vercel dashboard (Runtime Logs) — this is the primary log destination for the MVP, no extra integration needed.
- **Vercel Analytics / Web Vitals** (free tier): basic performance and traffic visibility without adding a third-party script.
- **Supabase Dashboard**: database logs, API logs, and Auth logs are visible directly in the Supabase project dashboard — use this for diagnosing RLS-denied queries or slow queries (`pg_stat_statements` is available there).
- **Error tracking**: if budget allows even minimally, Sentry's free tier is a reasonable addition specifically for uncaught exceptions in `error.tsx` boundaries and Server Actions; this is a "nice to have," not a hard MVP requirement — plain structured `console.error` logs read from Vercel's dashboard are sufficient to launch with.

## 14.3 What to Log

- Every caught error in a Server Action/Route Handler: a structured line with an error category (`validation` | `auth` | `authorization` | `database` | `unexpected`), the route/action name, a correlation-friendly identifier (e.g., request ID if available), and the underlying error message — server-side only (never returned to the client, per `13-error-handling.md`).
- Key business events worth a lightweight audit trail: request approved/rejected (who, when, which request), schedule published, account suspended. A simple `console.log` with a consistent prefix (e.g., `[audit]`) is sufficient for the MVP; a dedicated audit-log table is a future feature if compliance needs grow (see `17-mvp-vs-future.md`).

## 14.4 What Must Never Be Logged

- Passwords, password reset tokens, or any Supabase Auth secret/token.
- Full session/JWT contents.
- The `SUPABASE_SERVICE_ROLE_KEY` or any other server-only secret from `11-environment-variables.md`.
- Full request/response bodies containing personal data (leave reason text, HR request descriptions) beyond what's needed to diagnose an error — log identifiers (request ID, user ID) rather than the sensitive free-text content itself wherever possible.
- Uploaded file contents.

## 14.5 Monitoring Cadence

For a small-team MVP, active dashboard-watching is unnecessary; instead, rely on Vercel's deployment failure notifications (email/Slack integration, free) and, if Sentry is added, its default error-alert emails. No on-call rotation or paging system is warranted at this scale.
