# 12 — CI/CD

> **Depends on:** `05-technical-stack.md`, `11-environment-variables.md`

## 12.1 Pipeline

```text
Developer
   │
   ▼
Git branch (feature/*)
   │
   ▼
Pull Request → GitHub Actions:
   │  ├─ Lint (eslint)
   │  ├─ Type Check (tsc --noEmit)
   │  ├─ Unit Tests (vitest)
   │  └─ Build (next build)
   ▼
Vercel Preview Deployment (automatic, per-PR)
   │
   ▼
Review (code review + click through the Preview URL; Playwright e2e optionally run against Preview)
   │
   ▼
Merge to main
   │
   ▼
Vercel Production Deployment (automatic)
```

No Kubernetes, no Docker, no custom deploy scripts — Vercel's Git integration handles build and deploy for both preview and production directly from GitHub.

## 12.2 GitHub Actions

A single workflow (`.github/workflows/ci.yml`) triggered on `pull_request` and `push` to `main`, running (via Bun) in this order: install (`bun install --frozen-lockfile`) → lint → typecheck → unit tests → build. Playwright e2e tests run as a separate job, either against a locally-built app with a test Supabase project, or against the Vercel Preview URL once it's available (simpler, avoids spinning up Supabase in CI) — the latter is the recommended MVP approach since it avoids maintaining a CI-local Postgres.

## 12.3 Preview Deployments

- Every PR gets an automatic Vercel Preview deployment with its own URL.
- Preview deployments use a **separate Supabase project** (or, at minimum, a clearly separated dataset) from production, configured via Vercel's "Preview" environment variable scope, so testing in a PR can never touch real employee/attendance/leave data.
- Reviewers use the Preview URL to click through the actual change, not just read the diff.

## 12.4 Production Deployments

- Merging to `main` triggers an automatic Production deployment on Vercel.
- Production environment variables (pointing at the production Supabase project) are configured once in Vercel's "Production" scope and are not duplicated in code.
- Vercel's deployment model builds the new version fully, runs it through health checks, and only then switches traffic — so a bad build never takes down the live app; it simply fails to deploy and the previous deployment keeps serving.

## 12.5 Database Migrations

- Schema changes live as SQL files under `supabase/migrations/`, applied via the Supabase CLI (`bunx supabase db push` for local/dev, or `supabase db push --linked` / the Supabase GitHub integration for review-then-apply against the linked project).
- Migrations are applied **before** the corresponding app-code deployment goes live for any change that's backward-incompatible (e.g., a new `not null` column without a default) — for the MVP's scale and team size, the accepted process is: apply the migration to the target Supabase project manually (or via a CI step gated behind manual approval) right before merging the PR that depends on it, rather than building a fully automated migration-gate pipeline. This keeps the pipeline simple, matching the project's "do not over-engineer" mandate, while still keeping schema changes reviewed (every migration file goes through the same PR review as code).
- Every migration file is forward-only and checked into Git — there is no separate "rollback migration" tooling; rolling back a schema change means writing and applying a new, corrective migration.

## 12.6 Rollback Considerations

- **App rollback**: Vercel keeps prior deployments; rolling back the app is "promote a previous deployment" in the Vercel dashboard — instant, no rebuild needed.
- **Database rollback**: because Postgres schema changes aren't automatically reversible, any migration that could be destructive (dropping/renaming a column, changing a type) is written to be backward-compatible for at least one deploy cycle where practical (e.g., add the new column, migrate data, then drop the old column in a *later* migration) so an app rollback doesn't strand the database in an incompatible state.
- Supabase's automated daily backups are the safety net for data-loss scenarios; the restore procedure (via the Supabase dashboard) should be documented once in the team's internal runbook, not re-derived ad hoc during an incident.
