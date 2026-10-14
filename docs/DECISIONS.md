# Decisions

Short records of the choices that shape the codebase. Each one says what was decided, why, and what was passed over. Add a new entry when you make a choice the next person would otherwise re-argue.

## 1. Rebuild in a new repo instead of growing the Next.js prototype

The prototype mixed data access, business rules and presentation inside Next.js server components, kept business numbers in local JSON, and had no tenancy, auth or tests. The approved redesign changed every screen anyway. A clean monorepo lets the rules, the data layer and the screens be checked separately. The old repo stays as reference; its design folder was copied here.

## 2. Hono on Node for the API, not Next.js API routes or Express

Hono is small, typed, fast, and runs the same code on Node, workers and edge runtimes. Next.js API routes tie the API's lifecycle to the web build and make long-lived connections (SSE) awkward. Express works but has no types and no modern middleware story.

## 3. Vite + TanStack Router instead of Next.js for the web app

The app is an authenticated, data-heavy tool, not a content site; server rendering buys nothing and complicates realtime and the phone. TanStack Router gives file-based routes with typed params and search, which the office screens lean on (filters and selected records live in the URL). TanStack Query handles caching and invalidation.

## 4. Drizzle ORM, not Prisma

Drizzle is SQL-shaped TypeScript: joins and aggregates read like the SQL they produce, which matters for list endpoints that join five tables. It has no runtime engine and works with PGlite. Prisma's client is heavier and its query layer hides the SQL that these reports need.

## 5. PGlite for local development, Postgres in production

Nobody should install Docker or Postgres to run the product. PGlite is real Postgres compiled to WebAssembly with on-disk persistence. The same migrations and row-level security run on hosted Postgres. The cost is one quirk: one SQL command per prepared statement.

## 6. Row-level security as the tenancy boundary

Filtering by `org_id` in every query is a rule people break. A database policy cannot be forgotten. `withOrg` sets the org per transaction; `FORCE ROW LEVEL SECURITY` makes it apply to the owner role too.

## 7. Business rules in a shared package, tested

Bills and timesheets must come out the same on the phone, in the office and on the invoice. Putting `workOrderBill`, `quoteTotals` and `sheetCheck` in `packages/shared` with Vitest tests makes that true by construction.

## 8. Time entries are the single source of hours

The tech's status taps write `time_entries` (start, arrived, stop). Billing reads them for labor and drive; the timesheet reads them for pay. There is no second place where hours live. `arrivedAt` splits one entry into drive and labor for the bill.

## 9. Invoices freeze a snapshot

An invoice stores its lines, subtotal, tax and total as JSON at the moment it is created. Later changes to rates or time entries do not move it. Corrections go through a revision that keeps the old snapshot, and credits are separate rows.

## 10. Server-Sent Events, not websockets

Every realtime need here is server to client ("something changed, refetch"). SSE is HTTP, works through the Vite proxy and most hosts, needs no library, and reconnects itself. If bidirectional traffic ever appears, that is the time to add a socket.

## 11. Signed cookie sessions with a provider hook

A signed cookie is enough for a single-company deployment and keeps development to a user picker. `verifyExternalToken` is the seam for Clerk (or Auth0, or WorkOS) when real sign-in is needed; the session shape stays the same.

## 12. No CSS framework

The design system is one stylesheet with tokens and a named state color language (steel scheduled, amber en route, moss on site, rust parts, red urgent, plum quoted). Tailwind or a component library would have replaced that language with generic utilities and made the look harder to keep consistent across the office, the phone and the customer pages.

## 13. UUID v7 identifiers and per-org business numbers

UUIDs let the phone create records offline later and merge safely. Version 7 sorts by time, which keeps indexes tidy. Customers and techs still see short business numbers (work order 1059, invoice 742), issued by the `counters` table per organization.

## 14. Zod schemas in the shared package

Every write endpoint validates with a schema that lives next to the types. The web app can import the same schema for forms later. Zod 4 was chosen for speed and its first-class JSON schema output.

## 15. California rules are configuration, not code branches

Meal and rest requirements, overtime thresholds and the use tax treatment sit in `packages/shared/src/time.ts` and `money.ts` with named constants. Another state means another set of constants, not a fork of the logic.

## 16. Demo providers instead of mocks

Without Twilio keys, texts are recorded as delivered; without Stripe, a portal payment is recorded as paid. The product flow can be exercised end to end on a laptop, and Settings is honest about what is connected.
