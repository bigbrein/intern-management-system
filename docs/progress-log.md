# MiniHR — Build Progress Log

A running record of what was actually done in each phase, how it differs from the [SRS](./srs/00-index.md) baseline, and what was learned. Phases follow [16-development-phases.md](./srs/16-development-phases.md). This is a learning project — the user implements every phase; Claude acts as instructor only (see phase entries for what was taught vs. what was built independently).

---

## Phase 1 — Project Setup ✅

**Status:** Complete, committed at `335ec7a`.

**What exists:**
- Next.js (App Router, TypeScript) scaffolded via `create-next-app`, Bun as package manager.
- Tailwind + shadcn/ui (full component set generated under `components/ui/`) + Lucide.
- Biome for lint/format (`bun run lint`, `bun run format`) — **deviates from the SRS's ESLint/Prettier**, kept intentionally as an equivalent substitute.
- Route groups `(auth)`, `(employee)`, `(supervisor)`, `(assistant)` — **deviates from the SRS's `(auth)` + single `(dashboard)` structure**, kept intentionally: each role gets its own layout/shell.
- Git repo initialized; scaffold committed.

**What was learned / fixed this phase:**
- App Router fundamentals: file-based routing, `layout.tsx` nesting, route groups only affect organization/layout — **not** the URL.
- A route group folder does not isolate a URL. `app/(supervisor)/page.tsx` and `app/page.tsx` both resolved to `/`, and Next.js silently dropped the grouped one with **no build error or warning** — confirmed via `.next/app-path-routes-manifest.json`, which had no entry at all for the `(supervisor)` route. Fixed by giving each role a real nested URL segment inside its group: `app/(supervisor)/supervisor/page.tsx` → `/supervisor`, same pattern for `/employee`, `/assistant`. Root `app/page.tsx` stays at `/` as the entry point that will redirect by auth/role once auth exists.
- A `layout.tsx` Next.js discovers must always export a valid component — "deferring" a layout means a minimal stub that renders `{children}`, not an empty/missing file.
- Not yet committed as a habit: reviewing `git status`/diff before every commit, writing a commit message that describes the snapshot rather than listing files.

**Not yet done / carried forward:** `.env.local.example` doesn't exist yet — arrives with Supabase in Phase 2.

---

## Phase 2 — Database + Auth 🚧

**Status:** In progress.

*(To be filled in once this phase is complete.)*
