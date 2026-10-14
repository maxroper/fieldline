# Features

The October 2026 research (`design/redesign-2026-10/research/pain-points-and-emerging-features.md`) ranked the features a two-to-ten-tech HVAC shop in Orange County gets the most from. The top twenty were taken into the design, and this page tracks how far each is built. Status is one of **built**, **partial** or **planned**; the last column says where to look.

| # | Feature | Status | Where |
| --- | --- | --- | --- |
| 1 | Dispatch board with arrival windows and capacity | built | `routes/_office/dispatch.tsx`, `api/routes/dispatch.ts`. Day, week and month views, drag and drop with 15-minute snapping, capacity line, late count, ranked suggestions. Reserved demand slots are planned. |
| 2 | Caller-ID customer and equipment pop with dedupe | built | `routes/_office/new.work-order.tsx`, `GET /customers/lookup`. Phone or name lookup shows the site, open jobs (duplicate warning), last visit, equipment, agreement and balance. Phone-system webhook is planned. |
| 3 | Two-way texting and the on-my-way live link | built | `routes/_office/messages.tsx`, `api/routes/messages.ts`, `routes/t.$token.tsx`. Threads per customer, templates, automatic on-my-way text with the tracking page. Inbound replies need the Twilio webhook (roadmap). |
| 4 | Offline-first tech app | partial | `app/shell/PhoneShell.tsx` shows online state; the app installs from `public/manifest.webmanifest`. Queued writes and photo retry are on the roadmap. |
| 5 | Equipment record and nameplate capture | partial | `routes/_office/sites.$id.tsx`, `equipment` table with refrigerant, charge, install year, warranty dates and a nameplate photo. OCR of the nameplate is planned. |
| 6 | Refrigerant log per job | built | `POST /work-orders/:id/refrigerant`, phone sheet in `routes/tech/work-orders.$id.tsx`, office tab Compliance. Leak rate from the unit's full charge, tech certification stamped on each entry. |
| 7 | QuickBooks Online sync | planned | Invoice and customer rows carry `qbo_id`, `qbo_synced_at`, `qbo_error`; Settings shows the connection. The sync job is roadmap phase 1. |
| 8 | Membership engine | built | `routes/_office/agreements.*`, `api/routes/agreements.ts`. Tiers, covered units, season visit generation, scheduling a visit creates the maintenance work order, renewal flags, agreement pricing on the bill. Monthly card-on-file charging waits on Stripe. |
| 9 | Good, Better, Best proposals with approval | built | `features/quoting/QuoteEditor.tsx`, portal approval in `routes/portal.$token.tsx` and `POST /public/quotes/:token/approve`. Options from the pricebook, financing figure, typed-name approval creates the quoted work order. |
| 10 | Embedded financing | partial | `financingMonthly()` in `packages/shared/src/money.ts` shows an "as low as" monthly figure on options. A lender API is planned. |
| 11 | Automatic review requests | built | `queueAutomation("review_request")` creates a follow-up item two hours after closeout; the follow-ups page sends or skips it. |
| 12 | Missed-call text-back | partial | The automation switch exists (`automations.missed_call`); firing it needs a phone-system webhook. |
| 13 | After-hours AI answering to the board | planned | Not started. Intake and the public request-service form give it a landing place. |
| 14 | Permit and Title 24 tracker | built | `PUT /work-orders/:id/permit`, office Compliance tab. Jurisdiction, number, status, filed and final dates, test results map. |
| 15 | Warranty registration and claims | partial | `warranty_claims` with parts-return dates shown on the work order and the site; `compliance.warrantyReminderDays` in Settings. Registration helpers are planned. |
| 16 | Timesheets with clock-in and California overtime | built | `packages/shared/src/time.ts`, `routes/_office/timesheets.tsx`, `routes/tech/timesheet.tsx`, `GET /time/timesheets/export`. Status taps stamp time with the device position when granted; meals, rests, daily overtime and double time; payroll CSV. Geofenced automatic arrive and depart is planned. |
| 17 | Truck stock min and max with replenishment | built | `routes/_office/inventory.tsx`, `routes/tech/vehicle.tsx`. Per-van minimums, the morning transfer list, tomorrow's parts check against quoted lines, cycle counts, parts used from the phone land on the bill. |
| 18 | Voice note to job summary | planned | Closeout has the work-performed text; dictation and summarization are roadmap phase 3. |
| 19 | Owner KPI dashboard | built | `routes/_office/reports.tsx`, `GET /reports/overview`. Billed with change, average ticket, close rate, receivables aging, revenue and capacity by week, job type mix, technician scorecard. |
| 20 | Job photo report to the customer | built | Closeout option `sendPhotoReport` texts the portal link; the portal's Visits tab shows the summary and photos. |

## Also in the product

Not on the ranked list, but needed to make the list work:

- Work order record with tabs for overview, time, parts and POs, quotes, compliance, photos and notes, billing; return visits as trips of one number; follow-up reasons and dates.
- Follow-ups queue that derives from work orders, quotes, lump-sum purchase orders and reminder items, with the automation switches.
- Purchasing with lump-sum POs and a reminder to add lines, receiving to inventory, vendor invoice matching.
- Billing: closed jobs with their live bill and flags, invoice creation with labor and material presentation choices, payments, credits, deliveries, revisions, aging by customer.
- Tech status page with week strips, backlog, days off; a Week grid.
- Settings: company, rate tables and margin bands, document text, compliance switches, teams and vendors, checklists, warehouses, integrations. Users with roles and permissions.
- Customer portal request-service form that creates a work order in the queue.
