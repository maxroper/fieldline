# Architecture

Fieldline is a TypeScript monorepo with one API, one web app and two shared packages. The choices below follow the architecture review done during the October 2026 redesign; `DECISIONS.md` records the alternatives that were considered.

## Shape

```
browser ──/api──► Vite dev proxy ──► Hono API (Node) ──► Drizzle ──► Postgres (PGlite locally)
   ▲                                     │
   └──────── Server-Sent Events ◄────────┘
```

- **`packages/shared`**: pure TypeScript. Enums, the `CompanySettings` shape, zod schemas for every write, and the business rules (money, billing, time, visits). It has no I/O and is the only place a rule is written. Vitest tests live beside the code.
- **`packages/db`**: Drizzle ORM schema in `src/schema`, generated SQL migrations in `drizzle/`, row-level security in `src/rls.ts`, and the `connect`, `withOrg`, `withBypass`, `nextNumber` helpers in `src/client.ts`.
- **`apps/api`**: Hono on `@hono/node-server`. One file per area under `src/routes`. Sessions, realtime, storage and integrations are small modules at `src/`.
- **`apps/web`**: Vite 7, React 19, TanStack Router (file-based) and TanStack Query, with Zustand for the little UI state that is not server data. The design system is one CSS file plus thin React wrappers.

## Runtime and data

**Node 22+** everywhere. The API and the scripts run TypeScript directly with `tsx`; the web app builds with Vite.

**Postgres is the database.** Locally it is PGlite, a WebAssembly Postgres that stores files in `./data/pglite`, so a clone runs with no install. With `DATABASE_URL` set, `connect()` switches to `node-postgres` and the same migrations apply to a hosted Postgres (Neon, Supabase, RDS). Nothing in the app depends on which one is running.

**Multi-tenancy is enforced in the database.** Every table with an `org_id` has row-level security with FORCE, and the policy reads `app.org_id` from the transaction's settings. `withOrg(db, {orgId, userId}, fn)` sets those with `set_config(..., true)` inside the transaction, so a forgotten `where org_id = ...` cannot leak another company's rows. `withBypass` sets `app.bypass_rls` and is used only by sign-in, seeds, migrations and the customer token routes.

**Business numbers** (work orders from 1001, quotes, purchase orders, invoices, credits) come from the `counters` table through `nextNumber(tx, orgId, key)`, which is an upsert and therefore atomic.

**Optimistic locking.** `work_orders.version` increments on every write. The office record and the board send the version they loaded; a mismatch returns 409 and the screen refreshes.

**Audit.** `field_changes` records who changed which field from what to what for customers, sites, work orders, time entries and settings. The record screens show it as a change log.

## API

REST-ish JSON under `/api`. Reads return the shape the screen needs (joins done server-side, no N+1 in the browser). Writes validate with zod (`parse(schema, body)`), run inside `withOrg`, and `publish()` an event. Errors are `{ error, issues? }` with 400, 401, 403, 404 or 409.

**Auth.** A signed cookie (`fl_session`, HMAC-SHA256 over base64url JSON) holds `{userId, orgId, role, name, exp}`. Development sign-in is `POST /api/auth/dev-login` with a user id; the user picker is hidden when `NODE_ENV=production`. `auth.ts` has a `verifyExternalToken` hook where a provider such as Clerk exchanges its token for the same session. Roles: admin, supervisor, dispatcher, customer_service, billing, tech. `requireRole()` guards settings; `canBill()` guards invoicing and credits.

**Realtime.** `GET /api/events` is Server-Sent Events, one stream per browser tab, filtered by organization. Writes call `publish(orgId, type, id)`; the web app invalidates queries on any event. No websockets, no message broker; a single Node process keeps the subscriber list in memory. Multi-instance deployments would move the hub to Redis pub/sub without changing callers.

**Files.** `storage.ts` is an adapter with `put/get/delete` over a local directory (`FILES_DIR`). Uploads are multipart to `POST /api/files` with a `kind` (photo, nameplate, signature, document, report, vendor_invoice). Signatures arrive as data URLs from the phone and are decoded server-side. An S3-compatible adapter is the production replacement.

**Integrations** are adapters with a demo fallback so the product works end to end without keys:

| Concern | Provider | Where | Without keys |
| --- | --- | --- | --- |
| Texting | Twilio | `routes/messages.ts` `sendSms` | messages recorded as delivered |
| Payments | Stripe | `routes/public.ts` pay route | demo payment recorded |
| Accounting | QuickBooks Online | invoice `qbo*` columns, Settings | shown as not connected |
| Drive times | Google Maps | `routes/dispatch.ts` suggestions | straight-line distance |
| Sign-in | Clerk | `auth.ts` hook | development user picker |

## Web app

**Routing** is file-based under `src/routes`. `__root.tsx` provides the QueryClient context and the toast host. `_office.tsx` is a pathless layout that requires an office session and renders `OfficeShell`; `tech.tsx` renders `PhoneShell`. Search params are validated with zod and are the source of truth for filters, selected records and sheets, so every view is a URL.

**Data** is TanStack Query. `app/queries.ts` holds shared `queryOptions` and `useAction()`, a mutation wrapper that invalidates and toasts. `app/realtime.ts` subscribes to SSE and invalidates on events. Screens hold only form state locally.

**Design system.** `design/fieldline.css` is the whole visual language (tokens, layout, components, phone, map, animations). `design/components.tsx` maps React components one to one onto those classes so a designer can restyle without touching screens. See `DESIGN-SYSTEM.md`.

**Phone.** The tech screens are the same React app at `/tech/*`, laid out for a 390px viewport, with a web manifest so it installs to a home screen. Status taps include the device position when the browser grants it. Offline queueing is a roadmap item; the shell already shows an online/offline pill.

## Deployment shape (not yet done)

One Node process serves the API; the web app is static files from `apps/web/dist` served by the same process or a CDN with `VITE_API_URL` pointing at the API. Postgres is hosted. Environment variables are listed in `.env.example`. A GitHub Actions workflow runs typecheck, tests and the build on every push.

## Security notes

- Secrets only in environment variables; `.env` is ignored by git.
- Cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Customer links are unguessable tokens; the routes read only the rows that token owns and never accept an org id from the client.
- Input validation is centralized in zod; SQL is parameterized by Drizzle; file uploads are size-limited and served with their stored MIME type.

## Testing

- `packages/shared`: Vitest unit tests for billing, time and money rules (`npm test`).
- API and web: `npm run typecheck` is the gate today. Route tests with an in-memory PGlite (`connect({ pgliteDir: ":memory:" })`) are the intended next layer; see `ROADMAP.md`.
