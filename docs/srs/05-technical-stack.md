# 05 — Technical Stack

> **Depends on:** `01-project-overview.md`
> **Feeds into:** `06-architecture.md`, `10-project-structure.md`

Use the stack below unless there is a strong, documented technical reason to deviate. If you deviate, record the reason in the PR description and update this file.

## 5.1 Frontend / Full-Stack Framework — Next.js

- React + TypeScript, **App Router** (not Pages Router).
- Next.js's built-in server capabilities (Server Components, Server Actions, Route Handlers) serve as the entire backend — do not introduce Express, NestJS, Fastify, or any other backend framework. There is no justified requirement for one at this scale; adding one would duplicate routing/middleware Next.js already provides and split the codebase into two runtimes for no benefit.

## 5.2 Runtime & Package Manager — Bun

- Bun is used for package installation (`bun install`), running dev/build scripts (`bun run dev`, `bun run build`), and test execution (`bun run test` wrapping Vitest).
- **Compatibility notes:**
  - Next.js runs on Node.js APIs at build/runtime; Bun is used here as the *package manager and script runner*, while the actual Next.js dev server and build (`next dev`, `next build`) run through Bun's Node-compatible runtime, which Next.js supports. Vercel's build step also supports Bun as the install/build tool directly (auto-detected via `bun.lockb` / `bun.lock`).
  - A small number of npm packages ship native Node-API bindings that can occasionally lag Bun compatibility (rare for this stack's dependencies — Supabase JS client, FullCalendar, shadcn/ui, React Hook Form, Zod are all pure-JS/TS and known to work under Bun). If a future dependency has a Bun compatibility issue, fall back to running that specific script with Node while keeping Bun for install, rather than abandoning Bun project-wide.
  - Do not use pnpm as the primary package manager; a single `bun.lock` is the committed lockfile.

## 5.3 Styling — Tailwind CSS

- Utility-first styling, configured via `tailwind.config.ts`. No CSS-in-JS library, no separate SCSS pipeline.

## 5.4 UI Components — shadcn/ui

- shadcn/ui components (installed into `components/ui/`) are the base for all UI: forms, tables, dialogs, sheets, toasts, buttons, calendars, etc.
- Prefer composing/extending shadcn primitives over hand-rolling new base components. Only build a fully custom component when no reasonable shadcn primitive fits (e.g., the FullCalendar wrapper).

## 5.5 Icons — Lucide React

- All icons come from `lucide-react`. No mixing in a second icon library.

## 5.6 Database — Supabase PostgreSQL

- PostgreSQL is the single source of truth for all relational data.
- Use foreign keys and `CHECK`/`NOT NULL` constraints to enforce data integrity at the database layer (not only in application code).
- Use Postgres enums for fixed value sets (`user_role`, `schedule_status`, `request_type`, `request_status`, `attendance_status`, `notification_type`).
- Use transactions (via Postgres functions/`rpc()`) for any multi-table write that must be atomic (e.g., approving a schedule-change request and updating the referenced schedule together).
- No MongoDB or other NoSQL store — there is no requirement here (document-shaped data, if any, like request `details`, fits in a single JSONB column within Postgres; see `07-database-schema.md`).

## 5.7 Authentication — Supabase Auth

- Supabase Auth handles credential storage, session issuance, password hashing, password reset emails, and identity. The app never stores or hashes passwords itself.
- Integrated via `@supabase/ssr` for cookie-based sessions compatible with Server Components, Server Actions, and Route Handlers.

## 5.8 Authorization — Supabase Row Level Security (RLS)

- RLS policies on every table are the actual authorization boundary. See `08-authorization-rls.md` for the full policy set derived from the permission matrix in `02-user-roles-and-permissions.md`.
- Frontend role checks (hiding a button) are a UX nicety only; they must never be the only thing standing between a user and unauthorized data.

## 5.9 Backend — Next.js Server-Side + Supabase

- No separate API server. See `09-api-data-access-strategy.md` for the precise rule on when to use Server Components vs. Server Actions vs. Route Handlers.

## 5.10 Forms — React Hook Form + Zod

- React Hook Form manages form state/UX (via shadcn/ui's `Form` wrapper).
- Zod schemas define validation and are the single source of truth for shape — the same schema (or a derived subset) validates on the client for UX and again on the server (Server Action/Route Handler) as the actual security/data-integrity boundary. Never rely on client-side Zod validation alone.

## 5.11 Calendar — FullCalendar

- FullCalendar (`@fullcalendar/react` with `dayGrid`, `timeGrid`, and `list` plugins) renders schedule/meeting views. No custom calendar grid is built from scratch.

## 5.12 Realtime — Supabase Realtime

- Used specifically for: the notifications bell/list (subscribe to `notifications` filtered by `recipient_id = current_user`), and optionally live status updates on a request-detail page the user currently has open.
- Not used for: employee lists, schedule lists, attendance lists — these load fresh via Server Components/Server Actions on navigation/refresh, which is sufficient for this workload and keeps client complexity down.

## 5.13 Storage — Supabase Storage

- Single private bucket `request-attachments` for request attachments (see `04-non-functional-requirements.md` §4.2.1 for size/type limits and `07-database-schema.md` for the bucket's RLS policy).
- Access via short-lived signed URLs generated server-side, never public bucket URLs.

## 5.14 Deployment — Vercel

- The Next.js app deploys to Vercel; Supabase is the managed database/auth/storage/realtime backend. See `12-cicd.md` for the pipeline.

## 5.15 Version Control — Git + GitHub

- Trunk-based-ish flow: short-lived feature branches off `main`, PR review, squash-merge. See `12-cicd.md`.

## 5.16 Testing — Vitest + Playwright

- Vitest for unit/component tests (utilities, Zod schemas, isolated component logic).
- Playwright for end-to-end tests of critical workflows only (login, create+publish schedule, submit+approve leave request, attendance check-in). Do not chase exhaustive coverage of every component in the MVP.

## 5.17 Code Quality — ESLint, Prettier, TypeScript strict mode

- `tsconfig.json` has `"strict": true`.
- ESLint with the `next/core-web-vitals` + TypeScript config; Prettier for formatting, run via a pre-commit hook or CI check (not both blocking in ways that conflict — Prettier owns formatting, ESLint owns code-quality rules with formatting rules disabled).
- Conventions (detailed in `10-project-structure.md`):
  - **Naming**: `camelCase` for variables/functions, `PascalCase` for components/types, `kebab-case` for file names except component files which are `PascalCase.tsx`.
  - **Database access**: only through the `lib/supabase/` client factories and `lib/data/*` query modules — no ad-hoc `createClient()` calls scattered through components.
  - **Validation**: Zod schemas live in `lib/validation/*`, imported by both forms and Server Actions.
  - **Error handling**: see `13-error-handling.md`.
