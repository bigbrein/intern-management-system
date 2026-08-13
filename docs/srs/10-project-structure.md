# 10 — Project Structure

> **Depends on:** `05-technical-stack.md`, `06-architecture.md`, `09-api-data-access-strategy.md`

```text
minihr/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # shared shell: nav, notification bell
│   │   ├── page.tsx                   # role-aware dashboard/home
│   │   ├── employees/
│   │   │   ├── page.tsx               # list + search/filter (Server Component)
│   │   │   ├── [id]/page.tsx          # profile detail
│   │   │   └── actions.ts             # assign team, suspend, etc. (Server Actions)
│   │   ├── schedules/
│   │   │   ├── page.tsx               # calendar + list views
│   │   │   ├── [id]/page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── actions.ts             # create/edit/publish/delete (Server Actions)
│   │   ├── attendance/
│   │   │   ├── page.tsx               # own history / team view depending on role
│   │   │   └── actions.ts             # check-in/check-out, overrides
│   │   ├── requests/
│   │   │   ├── page.tsx               # my requests + (if supervisor) team requests
│   │   │   ├── [id]/page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── actions.ts             # submit, cancel, approve, reject
│   │   ├── notifications/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx               # own profile edit
│   ├── api/
│   │   └── attachments/[id]/route.ts  # signed URL generation (Route Handler)
│   ├── layout.tsx                     # root layout
│   ├── globals.css
│   └── middleware.ts                  # session refresh + protected-route redirect
├── components/
│   ├── ui/                            # shadcn/ui primitives (generated, lightly customized)
│   ├── employees/
│   ├── schedules/
│   │   └── calendar.tsx               # FullCalendar wrapper (client component)
│   ├── attendance/
│   ├── requests/
│   ├── notifications/
│   │   └── notification-bell.tsx      # client component, Supabase Realtime subscription
│   └── layout/
│       ├── nav.tsx
│       └── mobile-nav-sheet.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # browser client factory
│   │   ├── server.ts                  # server client factory (cookies-bound)
│   │   └── middleware.ts              # session refresh helper used by middleware.ts
│   ├── data/                          # read-query modules, one per domain
│   │   ├── employees.ts
│   │   ├── schedules.ts
│   │   ├── attendance.ts
│   │   ├── requests.ts
│   │   └── notifications.ts
│   ├── validation/                    # Zod schemas, one per domain
│   │   ├── employee.ts
│   │   ├── schedule.ts
│   │   ├── attendance.ts
│   │   └── request.ts
│   ├── auth/
│   │   └── session.ts                 # getCurrentUser(), requireRole() helpers
│   └── utils.ts                       # cn(), date formatting, etc.
├── types/
│   └── database.ts                    # generated via `supabase gen types typescript`
├── supabase/
│   ├── migrations/                    # SQL migration files (timestamped)
│   ├── seed.sql                       # dev seed data
│   └── config.toml
├── tests/
│   ├── unit/                          # Vitest — validation schemas, utils, isolated logic
│   └── e2e/                           # Playwright — critical workflows only
├── public/
├── .env.local.example
├── middleware.ts                      # (re-exported from app/middleware.ts if using src-less root, else lives here)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── bun.lock
└── docs/
    └── srs/                           # this SRS
```

## 10.1 Conventions

- **Feature folders over type folders where it matters**: each domain (`employees`, `schedules`, `attendance`, `requests`, `notifications`) keeps its page(s), Server Actions, and domain-specific components together under `app/(dashboard)/<domain>/` and `components/<domain>/`, so a developer (or AI assistant) working on one module doesn't need to hunt across the tree.
- **`lib/data/*` is read-only** query logic; **`actions.ts` files are write-only** Server Actions. This split makes it obvious where to add a new read vs. a new mutation.
- **No `src/` directory** — kept flat at the repo root since the project is small enough that the extra nesting adds no navigational benefit.
- **Route groups** `(auth)` and `(dashboard)` separate the unauthenticated shell from the authenticated app shell without affecting the URL path.
- Generated shadcn/ui components in `components/ui/` are not hand-edited beyond the generator's own customization step — treat them as vendored code.
- `types/database.ts` is regenerated from the live schema (`bunx supabase gen types typescript --linked > types/database.ts`) after every migration, not hand-maintained.
