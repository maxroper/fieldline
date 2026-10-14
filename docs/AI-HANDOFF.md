# Fieldline handoff for a new AI or engineer

This document is the one to read first. It says what the product is, how the code is organized, how a request travels, and what to do for the most common kinds of change. The other documents go deeper: `ARCHITECTURE.md` (why it is built this way), `DATA-MODEL.md` (every table), `DESIGN-SYSTEM.md` (how screens look and behave), `FEATURES.md` (what is built), `ROADMAP.md` (what is next), `DECISIONS.md` (the choices that were made and the ones rejected).

## The product in one page

Fieldline runs the day of a small HVAC service company. The seed company is Harbor Coast Mechanical in Costa Mesa, California, with two teams, eight technicians and an office of five.

Three faces of the app:

- **Office (desktop).** A dispatcher takes a call, creates a work order, places it on the board, watches techs move through en route, on site and done. Billing closes the loop: completed jobs become invoices, invoices get paid. Sales builds quotes with Good, Better, Best options. Purchasing orders parts and receives them. Inventory tracks the shop and the vans. Agreements plan maintenance visits. Messages texts customers. Reports show the owner the numbers.
- **Tech (phone).** A technician sees today's visits, taps On my way, Arrived, Pause and Complete. Those taps write the time entries that drive both the customer's bill and the tech's timesheet. The tech adds photos, parts from the van, checklist results, refrigerant logs and notes, drafts a quote for found work, and gets the customer's signature at closeout.
- **Customer (links).** An on-my-way text carries a tracking link (`/t/<token>`). The portal (`/portal/<token>`) shows proposals to approve, invoices to pay, visit reports with photos, equipment, and a form to request service. No sign-in; the token is the key.

Money rules that matter (all in `packages/shared/src/billing.ts` and `money.ts`): T&M bills labor at the customer's rate table (contract or standard), material at cost divided by a margin band, a misc material percent, a vehicle charge per block of hours, and sales tax on material sell. Quoted and maintenance jobs are flat price; their material carries use tax as cost. Not-to-exceed caps the bill. Timesheet rules (`time.ts`): quarter-hour rounding for payroll, two-decimal clock hours for billing, California meals, rests and daily overtime.

## Where things are

```
packages/shared/src
  types.ts      enums (statuses, roles, kinds) and CompanySettings
  schemas.ts    zod request schemas, one per write endpoint
  money.ts      rates, margin bands, quote totals, financing
  billing.ts    workOrderBill(): the live bill for a job
  time.ts       timesheet checks, California overtime, company day/minute
  visits.ts     agreement visit helpers
  ids.ts        UUID v7 and short tokens
packages/db/src
  schema/       one file per area; _shared.ts has the column helpers
  core.ts       withOrg(), withBypass(), nextNumber(), the Connection type
  client.ts     connect() on Node (PGlite file or pg); browser.ts for the in-page demo
  migrations.generated.ts  the SQL migrations bundled for the browser (generated)
  rls.ts        row-level security statements
  scripts/      migrate.ts (schema + RLS), seed.ts, reset.ts
  drizzle/      generated migrations (never hand edit)
apps/api/src
  app.ts        createApp(): middleware and route mounting
  auth.ts       signed cookie session, requireRole, canBill
  db.ts         scoped(conn): run a handler inside withOrg
  http.ts       parse(), notFound(), conflict(), forbidden()
  realtime.ts   SSE hub; publish(orgId, type, id) after writes
  storage.ts    file storage interface, memory adapter; storage-node.ts is the disk adapter
  demo.ts       the API inside a browser, for the static demo
  routes/       one file per area; work-orders.ts is the center
apps/web/src
  main.tsx      QueryClient + router
  app/api.ts    the fetch wrapper (same-origin /api) over app/transport.ts
  app/demo.ts   static demo: in-page app, bearer session; demo-state.ts, files.ts
  app/queries.ts  queryOptions and useAction()
  app/types.ts  the API row shapes the screens read
  app/format.ts money, dates, labels, tones
  app/shell/    OfficeShell (sidebar + top bar), PhoneShell (tech frame + bottom nav)
  design/       fieldline.css, components.tsx, icons.tsx
  features/     pieces shared by more than one route (BillPreview, MapPanel, QuoteEditor)
  routes/       file-based routes: _office/*, tech/*, t.$token, portal.$token, login
```

## How a request travels

1. A screen calls `api.get("/dispatch")` (apps/web/src/app/api.ts). In development Vite proxies `/api/*` to the API on port 8787, so cookies are same-origin and there is no CORS.
2. Hono receives it (`apps/api/src/app.ts`). `auth.ts` reads the signed `fl_session` cookie and puts `{userId, orgId, role, name}` on the context. Public token routes and `/api/auth/*` are mounted before the auth guard.
3. The route handler calls `run(c, (tx, session) => ...)` from `scoped(conn)`. That opens a transaction, runs `set_config('app.org_id', ...)`, and every query inside is filtered by row-level security to that organization.
4. Writes `parse()` their body with a zod schema from `packages/shared`, insert or update, write a `field_changes` row for audited fields, and call `publish(orgId, "work_order.updated", id)`.
5. `publish` fans out over Server-Sent Events (`GET /api/events`). The web app's `useRealtime` hook listens and invalidates TanStack Query, so every open screen refreshes without polling.
6. The screen re-renders from the query cache. Mutations go through `useAction`, which invalidates everything but the session and shows a toast.

## Doing common things

**Add a column.** Edit the table in `packages/db/src/schema/*.ts`, run `npm run db:generate`, check the SQL in `packages/db/drizzle/`, run `npm run db:migrate`. Add the field to the zod schema in `packages/shared/src/schemas.ts` if clients write it, to the route's select if clients read it, and to the row type in `apps/web/src/app/types.ts`. Update the seed if the demo should show it.

**Add an endpoint.** Put it in the route file for its area. Use `run(c, ...)` for data, `parse()` for input, `notFound()/conflict()/forbidden()` for errors, `publish()` after writes. Return plain JSON; the screens type it in `types.ts`.

**Add an office screen.** Create `apps/web/src/routes/_office/<name>.tsx` with `createFileRoute("/_office/<name>")`. Use `validateSearch` with zod for anything that belongs in the URL (filters, selected record). Compose from `design/components.tsx`: a `.toolbar` row, then `.page`, then tables, lists, cards and sheets. Add it to the sidebar groups in `app/shell/OfficeShell.tsx`.

**Add a phone screen.** `apps/web/src/routes/tech/<name>.tsx`, rendered inside `PhoneShell`. Use `.ph-page`, `.ph-section`, `.big-actions`, `.ph-ticket`. Read the signed-in tech with `useTechWho()` so office previews keep working.

**Add an automation.** Add the key to `AUTOMATION_KEYS` in shared types, a case in `queueAutomation` (apps/api/src/routes/messages.ts), a label in the follow-ups page, and a seed row.

**Change a money rule.** Change the function in `packages/shared`, add or update the test in `packages/shared/src/*.test.ts`, run `npm test`. Both the API's `buildBill` and the web's `BillPreview` pick it up.

## Gotchas

- PGlite accepts one SQL command per prepared statement. Run DDL in pieces (see `rls.ts`).
- The API must stay runtime-agnostic because the static demo runs it inside the browser: no `node:` imports in `app.ts` or the routes (only `index.ts`, `storage-node.ts` and `packages/db/src/client.ts` may use them), settings through `env.ts`, sessions signed with Web Crypto. After `npm run db:generate`, commit `packages/db/src/migrations.generated.ts`.
- In the browser, `Set-Cookie` and `Cookie` headers on page-built responses and requests are silently dropped. The demo uses the bearer token the dev-login route returns when `FIELDLINE_DEMO=1`.
- Layout routes read the session with `ensureQueryData`, which trusts cached data. After sign-in, remove the cached `me` query and fetch it again (see `routes/login.tsx`) or the redirect bounces back to the login page.
- One process can hold the PGlite directory. Stop `npm run dev` before `db:reset` or `db:seed` from a shell.
- `noUncheckedIndexedAccess` is on. Index results are `T | undefined`; use `?? ` or `!` deliberately.
- Work order status flows: `status` is open → closed → billed (office). `techStatus` is en_route → on_site → paused → done (tech). The bill reads time entries, not statuses.
- A return visit is a new row with the same `number` and `trip + 1`. The invoice covers every trip of the number.
- The invoice `snapshot` is frozen. Revisions keep the old snapshot in `invoice_revisions`. Never recompute an invoice from live data without a revision.
- The seed is idempotent; it exits early when the org exists. Change seed data with `npm run db:reset`.
- Route file names: `customers.index.tsx` is `/customers`, `customers.$id.tsx` is `/customers/:id`, `work-orders.$id_.complete.tsx` is `/work-orders/:id/complete` rendered outside the parent.

## Verifying a change

Sign in as **James Reynolds** (dispatcher) for office screens, **Max Roper** (owner, admin) for settings and users, **Elena Cruz** for the phone. Seed facts worth knowing: today's board has Elena en route to 1059 and Andre on site at 1055; invoice 742 is open; quote 2041 has Good, Better, Best options; Barranca Medical Partners has the customer portal on at `/portal/barranca`; purchase order 121 is a lump sum waiting for lines.

Before calling a change done: `npm run typecheck`, `npm test`, load the screen, check the browser console, check the API log.
