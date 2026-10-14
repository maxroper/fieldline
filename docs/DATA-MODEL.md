# Data model

Forty-seven tables in `packages/db/src/schema`, one file per area. The schema files are the authority; this page explains what each table is for and the rules that are not visible in the column list. Column helpers in `_shared.ts`: `idCol()` is a UUID primary key, `money()` is `numeric(12,2)` read as a number, `hours()` and `qty()` are small numerics, `percent()` is a numeric, `stamp()` is `timestamptz` read as an ISO string, `createdAt()` and `updatedAt()` default to now.

Every table except `orgs` has an `org_id` and is under row-level security (`rls.ts`). Instants are stored as `timestamptz`; calendar days (`scheduled_for`, `date`, `due_on`) are `date` columns holding the company day in the org's timezone.

## core.ts

| Table | Purpose |
| --- | --- |
| `orgs` | The company. `settings` is the `CompanySettings` JSON (rate tables, margin bands, misc percent, vehicle charge, quote margin, sales tax, document text, compliance switches). Also name, city, timezone, phone, email, address, license. |
| `teams` | Dispatch teams (Costa Mesa, Irvine). `is_home` marks the default. |
| `users` | Everyone who signs in. `role` from `ROLES`, `title`, `phone`, `team_id` and `home_team_id` (loans between teams), `can_bill`, `can_edit_customers`, `shift_hours` for techs, `active`, `last_active_at`. |
| `user_off_days` | A tech's days off, one row per date. The board and suggestions skip them. |
| `counters` | Per-org business numbers: `(org_id, key)` → `value`. `nextNumber()` upserts it. |
| `field_changes` | The audit log: entity, entity id, field, from, to, who, when. |

## customers.ts

| Table | Purpose |
| --- | --- |
| `customers` | The bill-to parent. Contract flag (selects the contract rate and margin tables), tax exempt, credit limit, AP contact, invoice delivery preference and emails, card on file display data, portal token and switch, QuickBooks id. |
| `sites` | A service address under a customer: contact, access notes (shown to the tech), primary and backup tech, tax rate override, invoice delivery override, latitude and longitude for the map and distance. |
| `equipment` | A unit at a site: tag, kind, make, model, serial, tons, refrigerant and full charge (for leak rate), install year, parts and labor warranty dates, location note, source (manual, import, nameplate photo), stage (proposed, active, retired), nameplate file, QR code. |

## work.ts

| Table | Purpose |
| --- | --- |
| `work_orders` | The job. `number` plus `trip` is unique per org; a return visit is trip 2 of the same number. `status` is open, closed, billed (office); `tech_status` is en_route, on_site, paused, done (tech) with `tech_status_at`. Call type (service, maintenance, quoted) and billing type (tm, nte, quoted) with `nte_amount` and `quoted_amount`. Assignment and schedule: `assigned_tech_id`, `scheduled_for`, `start_minute`, `allocated_hours`. Flags: `priority`, `warranty`, `need_return`, `waiting_on_parts`, `signature_required`. `follow_up` JSON holds the wait reason, date, note, part and expected date. Closeout: `work_performed`, `summary`, `signer_name`, `signature_file_id`, `closed_at`. `tracking_token` for the customer link. `version` for optimistic locking. `agreement_id` and `agreement_visit_id` when the job is a planned maintenance visit. |
| `work_order_helpers` | Extra techs on a job with their own schedule slot and tech status. |
| `notes` | Notes on a work order with a kind (note, dispatch, access) and author. |
| `files` | Photos, nameplates, signatures, documents, reports and vendor invoices. Linked to a work order, a unit or a related record (`related_id` for quotes and purchase orders). `storage_key` points into the storage adapter; `include_in_report` controls the customer-facing photo set. |
| `time_entries` | The single source of hours. Kind (labor, travel, meal, rest), `started_at`, `arrived_at`, `stopped_at`, or `hours` when typed. `arrived_at` splits one entry into drive and labor for billing. `edited`, `edited_by`, `source` (clock, manual), `gps_verified`. |
| `timesheets` | One row per tech per day once submitted: status (open, submitted, approved), meal reason, missed meal and rest flags, premium hours, reviewer and comment. Totals are always recomputed from `time_entries`. |
| `notifications` | Messages to a tech's phone (assignment, dispatch note) with `read_at`. |
| `tech_locations` | Position samples from the phone; the latest per tech feeds the map, suggestions and the tracking page. |
| `follow_up_items` | Reminders that are not derived from another table: review requests, failed texts, permit finals, warranty registrations, quote touches, custom. Status open, snoozed, done, skipped. |

## sales.ts

| Table | Purpose |
| --- | --- |
| `quotes` | A proposal: customer, site, unit, the work order it was found on, contact, reason, problem text, scope, scope template, `labor` JSON (hours and cost rates per class), margin percent, status (draft, sent, viewed, approved, declined, follow_up), follow-up date, sent, viewed (with count), approved and declined stamps, loss reason and note, selected option, the work order it created, signer name, approval token. |
| `quote_options` | The customer-facing choices: tier (single, good, better, best), name, description, price, cost, financing figure, recommended flag, included list. |
| `quote_lines` | Material and labor lines behind the price, with pricebook item links. |
| `scope_templates` | Reusable scope text with default labor hours. |
| `pricebook_items` | Flat-rate items: code, name, category, description, parts cost, labor hours, Good, Better, Best prices, margin override, usage count. |

## purchasing.ts

| Table | Purpose |
| --- | --- |
| `vendors` | Suppliers. |
| `warehouses` | The shop (`main`) and one van per tech (`vehicle`), with a target stock value. |
| `inventory_categories` | Groups for items and for category-level transfers. |
| `inventory_items` | SKU, name, category, unit cost, unit of measure. |
| `inventory_stock` | On hand, min and max per warehouse and item (unique pair), last counted, last used. |
| `inventory_txns` | Every movement: PO receipt, used on a work order, transfer in and out, count adjustment; amount and quantity, with links to the PO or work order. |
| `purchase_orders` | A PO to a vendor for a job or for stock: ship-to, warehouse, lump sum flag and amount, expected date, status (draft, issued, partial, received, invoiced, cancelled), received stamps, vendor invoice number, date and amount, `remind_at` for lump sums. |
| `po_lines` | Lines with quantity, unit cost, received quantity and date, category and inventory item links. |
| `truck_parts` | Parts a tech took from a van (or added directly) for a job, with the inventory transaction that moved them. They appear on the bill as material. |

## billing.ts

| Table | Purpose |
| --- | --- |
| `invoices` | One per job (all trips). Number, status (draft, billed, paid, partially_credited, credited, void), billed and due dates, amount, presentation choices (labor mode, material mode, hide hourly rate, custom descriptions), the frozen `snapshot` (lines, subtotal, tax, total, tax kind, NTE, travel separate), tax figures, payment token, QuickBooks sync columns. |
| `invoice_revisions` | The previous snapshot and a reason each time an invoice is revised. |
| `credit_memos` | Credits against an invoice with a reason and the line ids they relate to. |
| `invoice_deliveries` | Each send: method (email, print, both, text), addresses, who sent it. |
| `payments` | Amount, method (card, ach, check, cash, link, tap_to_pay, autopay), reference, provider id, received at. |

## agreements.ts

| Table | Purpose |
| --- | --- |
| `agreements` | A maintenance plan on a site: tier, name, status, term, auto-renew, billing method (monthly_card, annual_invoice, pre_billed, on_demand), amount, per-visit amount, visits per year, response promise in hours, included services, notes. |
| `agreement_assets` | Which units the plan covers. |
| `agreement_visits` | Planned visits: season, due date, status (unscheduled, scheduled, done, skipped), and the work order once scheduled. |

## comms.ts

| Table | Purpose |
| --- | --- |
| `messages` | Texts and emails in and out: customer, work order, channel, direction, addresses, body, automated flag and template, status (queued, sent, delivered, failed, received), provider id, error, sender, read at. |
| `automations` | The switches: key (confirmation, on_my_way, review_request, quote_followup, permit_warranty, pm_due, missed_call), enabled, config JSON, sent count, last run. |

## compliance.ts

| Table | Purpose |
| --- | --- |
| `checklist_templates` | Named item lists with a kind, a trigger (call types, equipment kinds) and a required-before-complete flag. |
| `checklist_results` | A tech's answers for one template on one work order: items with result (pass, flag, fail, na) and note, completed at. |
| `refrigerant_logs` | Per job and unit: refrigerant type, pounds added and recovered, cylinder, leak check result, leak rate percent, full charge, notes, tech and certification. |
| `permits` | One per work order: jurisdiction, number, status (needed, applied, issued, inspected, final, na), tests map, filed and final dates, notes. |
| `warranty_claims` | Manufacturer, registered on, claim status, parts return deadline, notes, linked to a unit and work order. |

## Rules worth knowing

- **Bills read, they do not store.** `workOrderBill()` is computed from time entries, truck parts, received PO lines, the customer and site, and the org settings every time. The only stored money is the invoice snapshot.
- **Numbers vs ids.** Ids are UUID v7 everywhere. Business numbers come from `counters` and are what people see.
- **Return trips** share a number. `GET /work-orders/:id` returns every trip, and billing closes all of them together.
- **Soft state lives in JSON** where it is one object per row: `orgs.settings`, `work_orders.follow_up`, `quotes.labor`, `invoices.snapshot`, `checklist_results.items`, `permits.tests`.

## Migrations

1. Edit the schema in `packages/db/src/schema`.
2. `npm run db:generate` writes SQL under `packages/db/drizzle/` (drizzle-kit).
3. `npm run db:migrate` applies pending migrations and re-applies the row-level security statements (idempotent).
4. `npm run db:reset` drops the local PGlite directory and seeds again when the change is not worth a data-preserving migration locally.

Never edit a generated migration; generate a new one. Row-level security is applied after migrations by `applyRls`, so new tables with an `org_id` are covered automatically.
