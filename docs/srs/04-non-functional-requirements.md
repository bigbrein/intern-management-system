# 04 — Non-Functional Requirements

> **Depends on:** `01-project-overview.md`, `03-functional-requirements.md`

## 4.1 Performance

- Pages using Server Components should render with a Time-to-First-Byte suitable for a global small-team audience (target: under ~500ms server processing time for typical list/detail queries on Vercel's default region colocated with the Supabase project).
- Lists (employees, schedules, requests, notifications) must be paginated or virtualized once they exceed ~50 rows; no unbounded `SELECT *` on tables expected to grow (attendance, notifications).
- Add indexes for every foreign key and every column used in a common `WHERE`/`ORDER BY` (see `07-database-schema.md` for the specific index list). This is a small-team app — sub-second responses are the bar, not high-throughput optimization.
- Do not introduce caching layers (Redis, etc.) in the MVP; Next.js's built-in data cache and Supabase's connection pooling are sufficient at this scale.

## 4.2 Security

Summarized here; full detail in `15-security-architecture.md`.

- Authentication via Supabase Auth only (FR-AUTH-1).
- Authorization enforced at the database layer via RLS on every table containing user data — never trust a client-supplied `user_id` or `role`.
- Row-level data protection: a user can only read/write rows their role and team membership entitle them to, enforced by policy, not by application filtering alone.
- All inputs validated with Zod schemas at every boundary (Server Action, Route Handler) — never trust client-side validation alone.
- Environment variables: secrets never committed to the repo, never exposed to the client bundle (see `11-environment-variables.md`).
- XSS: React's default escaping is relied on; no `dangerouslySetInnerHTML` with unsanitized user content.
- CSRF: Server Actions have built-in Next.js CSRF protection (origin-checking); Route Handlers that mutate data must be POST/PATCH/DELETE only, never mutate on GET.
- SQL injection: no raw SQL string concatenation — use Supabase's query builder (parameterized) or parameterized `rpc()` calls for anything more complex.
- File uploads: see §4.2.1 and `07-database-schema.md` (Storage buckets).

### 4.2.1 File Upload Security

- Allowed only as attachments to `requests`.
- Allowed types: PDF, PNG, JPG/JPEG (documents/images relevant to HR requests, e.g. a doctor's note).
- Max file size: 5 MB per file, max 3 files per request.
- Files are stored in a private Supabase Storage bucket (`request-attachments`), never public; access is via signed URLs generated server-side after an RLS/ownership check equivalent to the check on the parent `requests` row.
- File paths are namespaced by `request_id`/`uuid` to prevent path guessing; original filenames are stored as metadata, not used as the storage key.

## 4.3 Scalability

- The modular monolith (Next.js + Supabase Postgres) can scale to several thousand users and organizations without a rewrite: Postgres scales vertically well past small-team volumes, and Vercel/Supabase both scale horizontally on their managed infrastructure.
- The schema is designed with an `organization_id`-ready structure in mind (see `07-database-schema.md` notes) even though the MVP ships single-organization, so that multi-tenancy can be added later by adding a column and RLS predicate rather than restructuring tables.
- **Explicitly out of scope for MVP**: horizontal sharding, read replicas, message queues, microservices, multi-region deployment. Do not add these — they solve problems this system does not have yet.

## 4.4 Availability

- Target: reasonable best-effort availability appropriate for an internal small-team tool, not a customer-facing SLA product. Vercel and Supabase's managed-platform uptime (typically 99.9%+ on their infrastructure) is accepted as sufficient without additional redundancy work.
- No custom failover, multi-region, or disaster-recovery infrastructure in the MVP. Supabase's automated daily backups (available even on lower tiers) are the accepted backup strategy; document the restore procedure in the deployment runbook (`12-cicd.md`).
- Planned maintenance/deploys use Vercel's zero-downtime deployment model (new deployment is fully built and health-checked before traffic switches).

## 4.5 Accessibility

- Follow WCAG 2.1 AA where practical for a small internal app:
  - All interactive elements reachable and operable via keyboard.
  - Sufficient color contrast (shadcn/ui's default theme meets AA; do not override with low-contrast custom colors).
  - Form fields have associated `<label>`s (React Hook Form + shadcn/ui form components handle this by default — use them rather than bare inputs).
  - Semantic HTML landmarks (`nav`, `main`, `header`) and heading hierarchy.
  - Icon-only buttons (Lucide icons) have `aria-label`s.
  - Toasts/alerts for errors are announced via `aria-live` regions (shadcn/ui's `sonner`/toast component supports this).
- Full accessibility audit tooling (axe CI integration, screen-reader QA pass) is a "should" for MVP, not a hard gate — prioritize the items above.

## 4.6 Responsiveness

- The application must be usable at three breakpoints: desktop (≥1024px), tablet (768–1023px), mobile (<768px).
- Tailwind's default responsive breakpoints (`sm`, `md`, `lg`, `xl`) are used directly — no custom breakpoint system.
- Data tables (employee list, attendance history) collapse to card/list layouts on mobile rather than horizontally-scrolling tables where practical.
- The calendar view (FullCalendar) uses its built-in responsive list/day views on small screens instead of the full month grid.
- Primary navigation collapses to a mobile drawer/sheet (shadcn/ui `Sheet` component) below `md`.
