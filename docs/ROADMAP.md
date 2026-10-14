# Roadmap

Where the product is and what comes next, in the order that unblocks the most. Dates are intentionally absent; each phase is a checklist.

## Phase 0, done: working product on local data (October 2026)

- Monorepo, shared business rules with tests, Drizzle schema with row-level security, PGlite locally.
- Every office screen from the approved redesign: dispatch board (day, week, month, map, drag and drop, suggestions), follow-ups and automations, work orders and the full record, customers, sites, equipment, call intake, tech status, timesheets, quoting with Good, Better, Best, pricebook, purchasing, inventory with van replenishment and parts check, billing with invoices, payments, credits and aging, agreements with visit generation, messages, reports, settings, users.
- The tech phone: today, the job (status taps with GPS, photos, checklists, parts from the van, refrigerant log, notes, draft a quote), closeout with signature, timesheet with California checks, lookup, van.
- Customer pages: tracking link and the portal (approve proposals, pay invoices, visit reports, equipment, request service).
- Demo providers for texting and payments; integrations reported honestly in Settings.
- The static demo on GitHub Pages: the whole stack inside the browser, rebuilt on every push by `.github/workflows/pages.yml`.

## Phase 1: production readiness

1. **Hosted Postgres.** Set `DATABASE_URL`, run migrations in CI, back up daily. Nothing in the code changes.
2. **Real sign-in.** Wire `verifyExternalToken` to Clerk (or Auth0). Map provider users to `users` rows by email. Hide `/api/auth/users` and `/login` behind `NODE_ENV=production` (already done) and add an invite flow in Users.
3. **Texting.** Twilio account, A2P 10DLC registration, inbound webhook to record replies into `messages` and to parse "C" confirmations.
4. **Payments.** Stripe: card on file, payment links on invoices, webhook to record payments, Tap to Pay on the phone.
5. **File storage.** S3-compatible adapter behind `storage.ts`; signed URLs for the customer pages.
6. **QuickBooks Online.** OAuth2 app, customer and invoice sync by id, payment sync, error surfacing (`qbo_error` already on invoices).
7. **Deploy.** One container running the API and serving `apps/web/dist`; environment from secrets; health endpoint; logs to the host. CI already typechecks, tests and builds.
8. **Email.** Invoice and quote delivery by email (`invoice_deliveries.method = email`), with PDF rendering of the frozen snapshot.
9. **Route tests.** Vitest against an in-memory PGlite for the billing, time and work order routes.

## Phase 2: field and office depth

- **Offline phone.** Queue status taps, photos and closeouts in IndexedDB; replay on reconnect; conflict rule is server wins with a notice.
- **Maps.** Google Routes for drive times on suggestions and the tracking page; a real map tile layer in `MapPanel`.
- **Scheduling assist.** Capacity view by skill and certification; auto-suggest for maintenance season bulk scheduling.
- **Inbound calls.** Caller ID lookup from a phone system webhook straight into intake; missed-call text-back automation goes live.
- **Reports.** Saved views, export to CSV, margin by job with actual cost, technician scorecard trends.
- **Documents.** Branded quote, invoice and PO PDFs using `settings.documents`.
- **Warranty.** Manufacturer registration helpers and claim tracking with parts return reminders.

## Phase 3: scale

- Multiple organizations with an admin console; per-org feature flags.
- Redis-backed event hub for more than one API instance.
- Native wrappers for the phone app (Capacitor) for push notifications and background location.
- Assistant features: summarize a site's history before a visit, draft the work-performed text from notes and photos, flag quotes that have gone quiet.

## Known gaps to keep in mind

- No role-based limits on the phone yet beyond the tech role; a tech can see every open job at a site in lookup.
- The map is a projection without tiles until a maps key exists.
- Timesheet export is CSV; payroll providers would want their own format.
- Automations run when their trigger fires in a request; there is no scheduler yet for time-based sends (the review request two hours later, the PM reminders). A small cron in the API process is the planned first step.
