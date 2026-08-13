# 11 — Environment Variables

> **Depends on:** `05-technical-stack.md`

No Supabase URL, API key, or secret is ever hardcoded in source. All configuration comes from environment variables, loaded via `.env.local` in development (git-ignored) and via Vercel's Environment Variables UI in deployed environments.

## 11.1 Public (exposed to the browser — `NEXT_PUBLIC_` prefix)

These are safe to expose because Supabase's anon key is designed to be public; real protection comes from RLS (`08-authorization-rls.md`), not from hiding this key.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public API key, used by the browser client and by server clients acting on behalf of a user session |

## 11.2 Server-only secrets (never `NEXT_PUBLIC_`, never sent to the client bundle)

| Variable | Purpose |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Elevated key, used only in trusted server-only contexts if strictly necessary (e.g., a maintenance script) — **not used in normal request-handling code paths** since RLS with the user's session is preferred everywhere possible; never imported into any file reachable by a client component |
| `SUPABASE_JWT_SECRET` | Only needed if manually verifying JWTs outside the standard Supabase SSR helpers (not required for the standard flow — include only if a specific edge case needs it) |

## 11.3 Example `.env.local.example` (committed; real values are not)

```bash
# Public — safe for the browser
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only — never prefix with NEXT_PUBLIC_, never log these
SUPABASE_SERVICE_ROLE_KEY=
```

## 11.4 Rules

- `.env.local` (and any `.env*` except `.env.local.example`) is listed in `.gitignore` from the first commit.
- Vercel environment variables are configured per-environment (Production, Preview, Development) in the Vercel dashboard — Preview deployments point at a separate Supabase project (or a clearly-marked staging schema) so PR previews never touch production data (see `12-cicd.md`).
- The service-role key, if used at all, is restricted to server-only files (never imported by any file under `components/` or any `"use client"` module) and is never logged (see `14-logging-monitoring.md` and `15-security-architecture.md`).
- CI (GitHub Actions) reads secrets from GitHub Actions repository/environment secrets, not from a checked-in file.
