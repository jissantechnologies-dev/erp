# Indus ERP

Multi-tenant ERP for metal casting foundries, built from the approved design in
[`mockups/indus-foundries-erp-design.html`](mockups/indus-foundries-erp-design.html).

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript + Vite, React Router, TanStack Query |
| Forms | React Hook Form + Zod (schemas shared with the API) |
| Styling | The design's own CSS, ported verbatim as `apps/web/src/styles/design-system.css` |
| Backend | NestJS 10 + TypeScript |
| ORM / DB | Prisma 6 + PostgreSQL 17 |
| Auth | JWT access tokens (in memory) + rotating httpOnly refresh cookie, permission-based RBAC |
| Jobs | Redis (BullMQ) — provisioned, not yet used |
| Monorepo | npm workspaces |

**Why the CSS is not Tailwind.** The prototype's stylesheet is hand-crafted,
covers light and dark, and already expresses the whole component vocabulary. It
is ported unchanged so the React app is pixel-identical to the approved design.
Rewriting 273 lines of it as utility classes would have risked fidelity for no
gain. New rules go in `apps/web/src/styles/app.css`; `design-system.css` is the
contract with the design and should not be reformatted.

## Layout

```
packages/shared/     Zod schemas, enums, RBAC permissions, nav tree, en-IN formatters
apps/api/            NestJS API + Prisma schema, migrations and seed
apps/web/            React app
mockups/             The original design prototype (reference)
docs/                Architecture notes
```

`packages/shared` is imported by **both** sides. A field's validation rule is
written once there and enforced in the browser and on the server.

## Getting started

Prerequisites: Node 20+, Docker Desktop **running**.

```bash
npm install
npm approve-scripts @prisma/client @prisma/engines prisma esbuild argon2   # native deps
cp .env.example .env

npm run db:up          # Postgres on 5433, Redis on 6380
npm run db:migrate     # create the schema
npm run db:seed        # load the design's sample data
npm run dev            # API on :4000, web on :5173
```

Open <http://localhost:5173> and sign in:

| | |
|---|---|
| Workspace | `indus-foundries` |
| Email | `admin@indusfoundries.in` |
| Password | `IndusDemo2026!` |

The seed also creates the staff the design names in its owner columns — Arun V.,
Divya R., Karthik S. (Sales), Ganesh P., Lakshmi N. (Methods) — each with the
same password and a role-scoped sidebar, which is the quickest way to see RBAC
working.

Ports 5433/6380 are deliberate, to avoid clashing with any Postgres or Redis you
already run locally.

API docs (dev only): <http://localhost:4000/api/docs>

## Multi-tenancy

Every tenant-owned table carries `tenantId`. Isolation is enforced in three
layers, deliberately redundant:

1. **Prisma client extension** (`apps/api/src/prisma/prisma.service.ts`) injects
   the tenant filter into every read and stamps it onto every write. Services
   use `this.prisma.scoped.*` and cannot forget it. The cross-tenant escape
   hatch is named `unscoped` so skipping the guard is visible in review.
2. **AsyncLocalStorage** carries the request's tenant, so the extension needs no
   argument threading (`tenant-context.ts`).
3. **Postgres row-level security** (`apps/api/prisma/rls.sql`) as a backstop for
   raw SQL. Apply after each migration:
   ```bash
   docker exec -i indus-erp-db psql -U erp -d indus_erp -f /dev/stdin < apps/api/prisma/rls.sql
   ```

> **Be clear about layer 3.** The policies are installed and correct, but they
> are **inert in the default dev setup**. Postgres superusers bypass RLS even
> with `FORCE`, and the `erp` role the Docker image creates is a superuser.
> Measured against a non-superuser role: no `app.current_tenant` set returns 0
> rows, and setting it returns exactly that tenant's rows — so the policies work,
> they are simply not binding on `erp`.
>
> **Today, layers 1–2 (the Prisma extension) are the real guard.** To activate
> RLS, create the unprivileged `erp_app` role documented at the foot of
> `rls.sql`, point `DATABASE_URL` at it, and route queries through
> `PrismaService.withRlsTenant()` so the session variable is set per
> transaction. That last part is not yet wired into the request path.

Natural keys (part numbers, tool codes, drawing numbers) are unique **per
tenant**, never globally.

Tenant resolution is set by `TENANT_STRATEGY`: `header` (the `X-Tenant` header,
for local dev) or `subdomain` (production). Either way the claim is only a hint —
`JwtAuthGuard` checks it against the token, so claiming a tenant grants nothing.

## What is built

**Products & Masters — all five screens, end to end** (register with filters and
status chips, detail with tabs, create/edit form, API, shared validation):

| Screen | Notable behaviour |
|---|---|
| Part Master | Derived casting yield and machining loss; cross-field weight rules re-checked server-side against the merged record on PATCH |
| Material / Alloy | Chemistry limits (min/max per element), mechanical properties, charge guide; child rows replaced as a unit |
| Drawing Revision | Append-only revisions; adding one supersedes the current revision **and** updates the part's revision in the same transaction; approval releases it |
| Pattern / Die / Tool | Rated-life tracking with the design's colour thresholds; posting shots auto-flags Maintenance Due at 85 % |
| Customer Part Mapping | Agreed price in paise; one mapping per (customer, part) |

**Sales:** Customers register, detail and form. The rest of Sales is placeholder.

**Platform:** auth with rotating refresh tokens, permission-based RBAC with
eight seeded roles, per-tenant document numbering, an audit trail, and a
Dashboard reporting only what Masters can answer truthfully.

**Placeholders.** Purchase, Production, Inventory, Quality, Rejection,
Traceability, Maintenance, Dispatch, Reports, ISO, Team and Administration appear
in the sidebar and render a shared `ComingSoon` page. The nav tree in
`packages/shared/src/nav.ts` marks them `soon: true`; delete that flag and add a
route as each is built.

## Verified, and not

Checked by running it against the real stack:

- Clean `npm run build` and `npm run typecheck` across all three workspaces
- Migration and seed apply to a fresh Postgres; the seed is idempotent
- All six list endpoints return the design's facet counts; detail endpoints
  return derived yield (68.98 % for IF-PH-4410, matching the design's 69.0 %)
- Validation returns per-field errors; duplicates return 409 with field errors
- **Tenant isolation**, against a second registered tenant: list (0 rows),
  direct-id read (404), direct-id write (404), token replay with another
  tenant's header (403), and the target row left unmodified
- RBAC: a Sales user gets 200 on `masters:read`, 403 on `masters:create`
- Drawing revision flow: add → previous auto-superseded → approve → released,
  with the linked part's revision and status kept in step
- Audit rows written with the correct actor
- Every in-app link target resolves to a declared route

Not verified: **the UI has not been looked at in a browser.** The Chrome
extension was unavailable in this session, so rendering is confirmed only by a
clean production build, every module transforming, and an audit that every CSS
class the components emit exists in the stylesheets. Worth a visual pass before
showing it to anyone.

## Conventions worth knowing

- **Money** is stored as integer paise (`BigInt`), never a float. `rupees()` and
  `lakhs()` in `@erp/shared` format it; the API formats too, so exports and the
  UI cannot disagree.
- **Enums** are display strings end to end (`"Under Revision"`), mapped
  mechanically to Postgres enums (`UNDER_REVISION`) at the DB boundary by
  `apps/api/src/common/enum-map.ts`. The UI never sees the DB spelling.
- **Derived values are never stored.** Casting yield, machining loss and tool
  life percentage are computed from their inputs.
- **Validation errors** come back as `{ fieldErrors: { field: message } }` and
  are mapped onto the matching inputs, so client and server errors look the same.
- **Document numbers** come from the per-tenant `NumberSeries` table via an
  atomic `UPDATE ... RETURNING`, inside the same transaction as the insert, so a
  failed save never burns a number.
- **Records are archived, not deleted.** Parts and mappings go to `Obsolete`,
  because drawings, tooling and orders reference them.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | API + web together |
| `npm run build` | Build all three packages |
| `npm run typecheck` | Typecheck every workspace |
| `npm run db:up` / `db:down` | Start / stop Postgres + Redis |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Load the design's sample data (idempotent) |
| `npm run db:studio` | Prisma Studio |

## Next

Sales is the natural next module — Enquiry → Feasibility → Quotation → Sales
Order → Delivery Schedule. It is the most completely designed part of the
prototype, its foreign keys (customers, parts, alloys) already exist, and its
stepper/tabs pattern then repeats across Production and Quality.
