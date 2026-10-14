# Fieldline redesign — screen build brief

This folder is a design mockup pass for Fieldline, an HVAC dispatching app for a small Orange County company (office dispatchers and CSRs on desktop, technicians on phones, commercial and light-commercial customers: business parks, retail, medical offices, restaurants, with rooftop units, PM agreements, NTE billing, purchase orders). The mockup is a single HTML page assembled by `build.mjs` from `shell.html` + `fieldline-ds.css` + `fieldline-ds.js` + `screens/*.html` + `review/*.html`. It is reviewed in a browser; nothing here is the production React code.

The brief from Max (the owner): a complete redesign of every page, beautiful and modern, with animations, and "a very easy way to see and understand everything". Keep the same coloring. Keep the navigation elements and the component set so it stays easy to navigate. Fold in the top 20 features found in the research. Every existing capability of a screen (see `research/ui-inventory.md`) must still be present in its redesigned version, reorganized but not dropped.

## Files to read before building

1. `fieldline-ds.css` — the design system. Use its classes. Read it fully; it is the vocabulary.
2. `fieldline-ds.js` — the behaviors, all driven by data attributes (listed below). Do not write your own scripts.
3. `shell.html` — the page shell: review bar, office top bar and tabs, phone frames. Do not edit it.
4. `screens/10-dispatch.html` — the reference screen. Copy its conventions: structure, notes block, overlay template, demo data style, callouts.
5. `research/ui-inventory.md` — what every current screen contains. Your screen must cover its section of this inventory.
6. `research/platform-feature-landscape.md` and `research/pain-points-and-emerging-features.md` — only if you need detail on a feature.

## Fragment contract

One file per screen in `screens/`, named `NN-id.html`. The file holds exactly one section:

```html
<section class="screen" id="s-<id>" data-title="<Title shown in the review picker>" data-group="office|tech|customer" data-face="office|tech|customer" data-order="NN">
<style> /* optional, every selector prefixed with #s-<id> */ </style>
… screen markup …
<aside class="notes"><ul>
  <li><span class="f">kept</span>What stayed from today's screen and why.</li>
  <li><span class="f">new</span>Which feature from the list appears here (name it, e.g. F7 Refrigerant log).</li>
  <li><span class="f">changed</span>What moved or was reorganized.</li>
</ul></aside>
<template data-overlay>
  … zero or more `.sheet` / `.modal` blocks with unique ids, opened by data-open="#id" …
</template>
</section>
```

- `id` and `data-order` are assigned per screen below. Do not change them; the shell's nav tabs use `data-go="<id>"`.
- Office screens render inside the office shell under the tab row. Start with either a `.toolbar` row or a `.page` block. Record and editor screens start with a `.back-bar` ("Back to <place>" on the left; "Save" and "Save and back" on the right when the screen edits something). That is a standing rule of the product.
- Tech screens render inside a phone frame below the tech top bar. Start with `.ph-page`. Buttons are thumb sized (`.btn.lg` / `.btn.xl`, `.big-actions`). Sheets on the phone are `.sheet.bottom`.
- Customer screens render inside a phone frame with no app chrome. Start with a `.cf-top` bar (a fake browser URL like `fieldline.app/t/8f2k`) then `.ph-page`.
- Overlays (`.sheet`, `.sheet.bottom`, `.modal`) must live inside `<template data-overlay>`; the build hoists them to the page root. Give every overlay a unique id prefixed with your screen id, e.g. `#sheet-billing-pay`.
- No external resources: no images, no fonts, no scripts, no iframes. Photos are `.photo` gradient tiles with a `.cap` caption. Maps are the `.map` block with an inline SVG street grid like the dispatch screen. Keep inline SVG small.
- Use only the design system plus a small scoped `<style>` when a layout truly needs it. Do not restyle DS classes globally. If the DS lacks something you need often, build it with scoped CSS and list it in your report so it can be promoted.
- Demo data: Orange County, consistent with the dispatch screen. Company: Harbor Coast Mechanical (teams Costa Mesa and Irvine). Techs: Marcus Hale (MH), Elena Cruz (EC), Andre Walsh (AW), Priya Shah (PS), Diego Ramos (DR), Hannah Cho (HC), Luis Ortega (LO), Naomi Brooks (NB). Office: Admin, Supervisor, James Reynolds (dispatcher), Customer service, Billing. Customers and sites: Irvine Med Offices (Suite 200 RTU-2 Carrier 48TC, warranty), Harbor & Main Kitchen (Costa Mesa, MAU-1, urgent 1055), Newport Plaza Retail (RTU-3 low charge, parts PO 118 from Johnstone), Bristol Court Offices (fall PM 4 RTUs), Warner Business Park (Santa Ana, Yolanda Ruiz), Jamboree Corporate, Balboa Bay Offices, Oak Creek Professional, Santa Ana Gym, Irvine Center Clinics, Tustin Auto Center, Costa Mesa Library, 17th Street Market, Adams Avenue Plaza, Newport Coast HOA, Huntington Harbour Dental. Work orders are 1047–1071 today, quotes 2038–2044, POs 115–121, invoices 7xx. Today is Wed, Oct 14, 2026. Money and hours are realistic for commercial HVAC (a PM visit $380–$1,200, a repair $600–$4,800, labor $165–$195/h).
- Numbers: wrap in `.num` (tabular, mono). Money: `.money`. No emoji anywhere. No lorem ipsum. No placeholder boxes that say "chart goes here"; draw a small real SVG to scale or use `.meter` / `.load-bar`.
- Motion: put `.stagger` on the main list or card grid so rows rise in. Use `.live` for anything live, `.skeleton` for one loading row where a sync is pending, `.meter` for progress. Screen transitions and sheet slides are automatic. Respect reduced motion (the DS does).
- Callouts: `<span class="callout">3</span>` after a label marks a design note; the notes list should mention the numbered callouts where useful.
- The screen must be complete at rest: realistic content visible without interaction, summary before detail, state encoded with `.pill` and tints, interactive things look interactive.
- Phone width: office screens must not overflow at 400px (the DS stacks `.split`, `.grid`, `.field-grid`; wrap wide tables in `.table-wrap` or `.scroll-x`). Never set a fixed width wider than 100%.

## Behaviors (data attributes handled by fieldline-ds.js)

- `data-go="<screen id>"` on any button or link: navigate to a screen.
- Segmented control: `<div class="seg" data-seg="name"><button class="on" data-val="a">…</button>…</div>`; optional panels `<div class="panel on" data-seg-panel="name" data-val="a">` toggle with it.
- Filter chip toggle: `<button class="chip" data-chip>`.
- Tabs: `<div class="tabs" data-tabs="group"><button data-tab="x" class="on">`; panels `<div class="panel on" data-panel="x" data-panel-group="group">`.
- Open an overlay: `data-open="#id"`; close: `data-close` (Escape and the scrim also close).
- Toast: `data-toast="Saved"` on any clickable element (combine with `data-close` to close a sheet and confirm).
- Status track demo: a container with `data-status-host`; inside, `.status-track .st` items with `data-st="key"`, and buttons with `data-status-cycle="key" data-status-text="Label"` (optionally `data-status-btn` to highlight). Clicking moves the track and shows a toast.
- Toggle a class on a target: `data-toggle-class="show-map" data-target="#el"`.
- Checkbox / switch demo: `<label class="check" data-check>` / `<label class="switch" data-switch>`; option cards `<button class="option-card" data-option>`.
- Count-up: `<span data-countup="1840" data-prefix="$" data-decimals="0">`.

## The 20 features (from the research) and where they land

- F1 Live map and GPS tech tracking — dispatch board, tech status, customer tracking page.
- F2 Capacity view and assignment suggestions (assist only, never auto-move) — dispatch board, new WO time picker.
- F3 Two-way SMS inbox, "on my way" live ETA link, appointment confirmations — Messages tab, tech Today ("On my way"), customer tracking page, follow-ups.
- F4 Caller-ID screen pop with customer and equipment history, duplicate detection — New WO call intake, New customer.
- F5 Maintenance agreements engine: tiers, asset-based spring/fall visit schedules auto-generated into the queue, renewals, monthly or annual billing, SLA response targets — Agreements tab, customer record, new WO ("site is on Gold, 4 h response"), dispatch month view.
- F6 Equipment record upgrade: nameplate photo OCR to model/serial/refrigerant/age, warranty status, QR tag, per-unit history — Site & equipment, tech WO, tech lookup.
- F7 Refrigerant log per job: type, pounds added/recovered, cylinder, tech cert, automatic EPA 608 / 40 CFR 84.106 / CARB records, leak-rate math — tech WO, work order Compliance tab, settings.
- F8 Forms and checklists (PM inspection pass/flag/fail, safety), required before complete; flagged items become quote lines — tech WO, work order, closeout.
- F9 Good/Better/Best proposals with e-sign and "as low as $/mo" financing — quote editor, customer portal.
- F10 Pricebook: flat-rate repairs plus parts and labor catalog, plain language, images, margin benchmarks — Pricebook tab, quote editor, tech quote.
- F11 Payments: card on file, payment links, deposits, tap to pay on the phone, AR aging — Billing, tech closeout, customer portal.
- F12 QuickBooks Online sync with ID matching and a sync-alert queue — Settings, Billing.
- F13 Customer portal: approve quotes, pay invoices, see history and photos, request service — customer face.
- F14 Automated review requests and unsold-quote follow-up cadences — Follow-ups, Messages, Quoting.
- F15 Offline-first tech app with visible sync state and upload retry — every tech screen shows a sync indicator.
- F16 Truck stock by SKU with min/max, replenishment, "tomorrow's jobs parts check" — Inventory, My vehicle, tech WO parts.
- F17 Job photo report and voice note to AI job summary at closeout — tech closeout, work order Photos & notes, customer portal.
- F18 Permit / ECC (Title 24) and warranty registration tracker per job — work order Compliance tab, follow-ups, settings.
- F19 Owner KPI dashboard (booking rate, average ticket, close rate, tech scorecards, AR, renewals, job costing) — Reports tab (built separately).
- F20 Timesheets with geofenced auto arrive/depart, California daily overtime, payroll export — Timesheets, tech timesheet.

## Screen specifications

Each entry: `id` · title · order · face · what it must contain.

### Office core

- `followups` · Follow-ups · 12 · office. Toolbar: wait-reason chips (Waiting on parts / customer / tech / Automations), technician and customer selects, "Overdue only" switch. Summary pills: overdue, due today, this week. Grouped list (`.stagger`): work order rows (reason, due date, part expected, note, Snooze / Add note / Parts received / Schedule with date + tech, Back to open queue), quote rows (Quote 2041 · Sent 6 days · next touch: text tomorrow 9:00 [F14]), PO rows (lump-sum reminder kept), and new rows for review requests queued after completion [F14], permit finals and warranty registration deadlines [F18], and "ETA text failed, customer has no mobile" [F3]. An "Automations" side card lists the active cadences with on/off switches. Sheet: schedule a return visit.
- `new-wo` · New WO · 14 · office. This is call intake. Start with the back bar ("Back to Dispatch board", Save / Save and back). Left column: the form (kept fields: site search with crew hint, unit/equipment, WO type T&M / T&M NTE / Quoted job / Maintenance with the budget fields, priority, problem, caller name/phone, customer PO, signature required, dispatcher notes, "Create WO"). Right column: the caller card [F4] ("Incoming call 714-555-0142 · matched: Irvine Med Offices · Dr. Lena Park · 3 open WOs · last visit Oct 2 · RTU-2 under warranty" with a "Possible duplicate: WO 1058 opened yesterday for the same unit" notice), the agreement card [F5] ("Gold agreement · 4 h response · 2 PM visits left · next due Nov"), and a capacity-aware time picker [F2] (next three open slots with drive time, e.g. "Today 3:00 · Priya · 11 min"). Prefilled fields carry the `.prefilled` tag.
- `work-order` · Work order 1058 · 16 · office. Back bar ("Back to Dispatch board"). Record head: number, title, pills (On site, Warranty, Service · T&M), customer / site / tech, status track (Scheduled, En route, On site, Done, Billed) with status buttons (Open / Completed / Billed kept). Tabs: Overview (problem, dispatcher notes, facts, helpers, next steps), Time (time charged table, add a day, place at another time, lunch/breaks, change log), Parts & POs (POs linked, truck parts used, "Issue PO"), Quotes (found quotes, create quoted job), Compliance [F7, F8, F18] (refrigerant log rows with lbs added/recovered and leak rate, PM checklist results with flagged items, permit and warranty status), Photos & notes (photo grid, notes, field change log, site history, AI job summary [F17]), Billing (billing rows kept; invoice facts; "Send to billing"). Side column: timeline of today and the customer contact card with "Text customer" [F3].
- `work-orders` · Work orders · 18 · office. Toolbar with search, saved views as chips (All open, Mine, Waiting, Overdue, Warranty, This week), filters (team, tech, type, priority, wait, dates), Export. Summary pills. Table (`.table-wrap`) with the kept columns (number, customer, site, city, type, priority, status, wait, overdue, lead tech, default tech, date, hours, problem) but with pills for status/priority and a selected row; bulk action bar appears when rows are checked ("Assign", "Text ETA", "Export"). Pagination footer.
- `tech-status` · Tech status · 26 · office. Toolbar: team seg, day nav, Day/Week seg. Grid of tech cards (`.stagger`): avatar, name, live status pill [F1] with location and last GPS time, today meter (hours charged vs capacity), week load bar (Mon–Fri cells, off days hatched), backlog, today's visits list, off-day control kept, a small scorecard strip (jobs this month, close rate, callbacks) and a "Message" button [F3]. A compact map strip at top with truck positions.
- `timesheets` · Timesheets · 28 · office. Toolbar: team seg, day nav, "Break exceptions" button with count, Export (payroll CSV [F20]). Per-tech cards with a lines table (WO, kind, start, stop, hours, edited, and a geofence column showing "GPS verified" / "Manual" [F20]), lunch and breaks rows, totals with CA overtime shown (regular 8.0, OT 1.5x 1.25, double 0) [F20], submitted status. A break-exceptions sheet with approve / fix. Keep the "read only · ERP id empty" hint as a sync status pill instead.

### Customers and money

- `customers` · Customers · 20 · office. Split: left list with search and chips (All, Agreement, Balance due, No visits 12 mo), rows with name, site count, balance; right record for 17th Street Market or Irvine Med Offices: head with Edit, facts (kept bill-to fields: billing address, AP contact, billing rate, credit limit, contract, tax exempt, exemption number, invoice delivery, emails, account manager), an Agreement card [F5], a Balance card with AR aging and card-on-file status [F11], a Portal card ("2 users, last login Oct 9") [F13], sites list with per-site primary/backup tech, and the change log. Edit mode shown in a sheet with the back bar rule.
- `site-equipment` · Site & equipment · 22 · office. Back bar ("Back to Customers"). Site record (kept fields: building name, address, city, contact, phone, special instructions, tax rate, invoice delivery, primary/backup tech, access notes) and PM contract card. Equipment grid of unit cards [F6]: tag, kind, make/model/serial, tons, refrigerant type and charge, install year, warranty pill, nameplate photo tile, last service, "Scan QR" tag, "Add unit from nameplate photo" card that shows OCR fields filling in. Site history list (open WOs, last visits). Sheet: unit detail with service history and refrigerant totals this year [F7].
- `new-customer` · New customer · 24 · office. Progressive form in three cards: Bill-to (name, billing address, AP contact and phone, billing rate, credit limit, contract customer, tax exempt, exemption number), First site (address, city, contact, phone, special instructions, tax rate), People and settings (account manager, primary and backup tech, invoice delivery, portal invite [F13]). A live "Looks like an existing customer?" dedupe notice [F4] with a "Use existing" button. "Create customer" primary.
- `quoting` · Quoting · 30 · office. Toolbar with status chips as a pipeline (Draft 3, Sent 5, Viewed 2, Approved 4, Declined 1, Follow-up 3), customer/site selects, "Quoting setup" (goes to settings) and "New quote" copper. Summary KPIs: open value, close rate 30 d, average quote, follow-ups due. Table: number, customer, site, reason, status pill, options (G/B/B) [F9], total, follow-up, last activity ("Viewed Tue 4:12 PM"). Automations card [F14].
- `quote-editor` · Quote 2041 · 32 · office. Back bar ("Back to Quoting", Save / Save and back). Head: quote number, status, Approve / Decline / "Send for e-sign" / "Create bid PDF". Left: site search kept, quote-customer facts, reason, scope template select (keep the HVAC template names), unit, custom scope lines, labor rows (Journeyman / Apprentice / Driver × hours × rate), materials lines with a pricebook picker sheet [F10], files. Right: option builder [F9] with three `.option-card`s (Good: repair, Better: repair + IAQ, Best: replace) each with price, included lines, and "as low as $/mo" financing; margin control kept (45/40/35/30/custom), computed totals (cost, use tax, sell price, profit), customer view preview with e-sign status and view tracking. Follow-up date and kind kept.
- `billing` · Billing · 38 · office. Toolbar: seg Waiting to bill / Billed / Aging [F11], search, dates, Export. KPIs: waiting value, billed this month, AR over 30 days, collected this week. Table of work orders waiting (kept columns) with "Clock still running" and "Over NTE" flags as pills. Invoice detail sheet for one WO: labor one-line/itemized toggle, hide hourly rate, material rows with source, tax, misc, vehicle, amount to bill, "Mark billed", "Send" (email/print/text link), payment status (card on file, payment link sent, paid), credits and revisions kept. A QuickBooks sync card with a sync-alert queue [F12].

### Ops and new tabs

- `purchasing` · Purchasing · 34 · office. Toolbar: vendor, work order, number, lines seg (Lump sum / Lined), status chips (Issued, Partial, Received, Vendor invoiced), "New PO" copper, Export. Split: PO table left; editor right (ship to, warehouse, work order, site, vendor, lines with received quantities, "Receive all", vendor invoice number/date/amount with difference flag, pack list files, lump-sum reminder kept, "Email PO"). Supplier price hints on lines ("Johnstone $142.10 · in stock Santa Ana") as a tag.
- `inventory` · Inventory · 36 · office. Tiles kept (Categories, Vehicle audit, In and out, By category, Transfer, Count). Warehouse cards (main + vehicles) with balance meters. New [F16]: a truck stock table by SKU for Marcus's van (SKU, description, on hand, min/max, status pill Low/OK, last used), a replenishment queue ("6 items below min across 3 vans · Create transfer"), and "Tomorrow's jobs parts check" card listing tomorrow's jobs with needed parts and a Ready / Missing pill. Transfer and count sheets.
- `users` · Users · 40 · office. People table (name, role pill, home team, phone, last active, permissions summary) with Add person form (name, role, home team, phone, "Can edit customers and sites", "Can edit invoices and issue credits" kept). Role cards explaining Admin / Supervisor / Dispatcher / Customer service / Billing / Tech. A seats card: "Office seats are unlimited; 8 tech seats in use".
- `agreements` · Agreements · 42 · office. New tab [F5]. KPIs: active agreements, annual value, renewals due 60 days, PM visits this season (done / scheduled / unscheduled). Table: customer, site, tier pill (Bronze / Silver / Gold), assets covered, visits per year, next visit, billing (monthly card on file / annual invoice / pre-billed), renewal date, SLA. Detail sheet for Bristol Court Offices Gold: assets list (4 RTUs), visit schedule (spring done Apr 8, fall scheduled Oct 15 · Andre), included services, pricing, renewal with auto-renew switch, SLA 4 h, "Generate fall visits" button with a toast. Season planner strip: October visits by week with capacity bar.
- `messages` · Messages · 44 · office. New tab [F3, F14]. Split: threads list (customer name, last message, time, unread badge, channel icon as a tag "SMS"/"Email") with chips All / Unread / Needs reply / Automated; thread view with bubbles (customer vs office vs automated "On my way" message with the tracking link), composer with templates ("Running late", "Parts arrived", "Review request"), and a right column with the customer card and open WO. Automations card: confirmations, on-my-way, review request after completion, unsold quote cadence, each with a switch and a sent count.
- `pricebook` · Pricebook · 46 · office. New tab [F10]. Left: categories tree (Repairs › Electrical / Refrigeration / Airflow / Controls; Maintenance; Materials; Labor). Right: item cards or table: code, plain-language name ("Replace condenser fan motor, 1/3 hp"), tier prices Good / Better / Best, parts cost, labor hours, margin, a photo tile, "used 14 times this year". Item detail sheet with the included parts and a benchmark note. Toolbar: search, "Import from Johnstone", "New item".
- `settings` · Settings · 50 · office. Company page redesigned as sections with a left anchor nav: Company (name, teams, from/terms/signature block kept), Rates and margins (labor cost rates, bill rates tables for contract / non-contract, margin bands, default margin, sales tax, misc %, vehicle charge kept), Integrations [F12, F3, F11, F1] (QuickBooks Online connected with last sync and alert count, Twilio SMS number and 10DLC status, Stripe payments, Google Maps), Compliance [F7, F18] (refrigerant log required for units over 15 lb, EPA reporting year, permit tracking on by job type, warranty registration reminders), Forms [F8] (PM inspection checklist, safety checklist, with "required before complete" switches), Notifications (which automations are on), Warehouses and vendors kept, People permissions kept.

### Tech phone

- `tech-today` · Today · 60 · tech. Sync pill at top ("Synced 2 min ago" / "3 photos waiting for signal") [F15]. Day nav kept. Big actions row: Timesheet / Lookup / My vehicle (kept) plus Start meal / Start rest. Route list (`.stagger`) of today's visits with time, WO number, customer, site, problem, priority pill, drive time to next, and a swipe-like "On my way" button on the next visit [F3] that toasts "Text sent to Yolanda Ruiz with your ETA". Notices (new assignment / updated) kept. Bottom bar with the command box `.cmd` ("Close, 1.5 hrs, filter change" with a parsed preview of chips) and a mic [F17].
- `tech-wo` · Work order 1135 · 62 · tech. Back bar ("Back to my day"). Head: number, customer, pills. Status track + big status buttons En route / On site / Pause / Complete (use data-status-cycle). Dispatcher notes pinned. Facts (address with Directions, contact, phone, special instructions, problem). Sections as bottom-sheet buttons kept (Follow up, Purchase orders, Inventory, Time, Closeout, Quotes, Notes and history, Billing) rendered as a tidy list of rows with counts; show expanded inline: Checklist [F8] (PM inspection items with pass / flag / fail toggles, one flagged "Belt cracked → add to quote"), Refrigerant log [F7] (type R-410A, added 2.5 lb, recovered 0, cylinder 118-A, leak check: passed, tech cert 608 Universal), Photos grid with "Take photo" tile, Parts from truck [F16] (two SKUs with quantities), Notes with a voice-note button [F17]. Sync pill [F15].
- `tech-closeout` · Complete 1135 · 64 · tech. Back bar ("Back to work order"). Verify cards: Time charged (labor / travel rows, add), Parts used, Checklist complete (1 flagged), Refrigerant log recorded, Photos (6), Work performed (voice note transcribed into a summary with an "Edit" link) [F17], Signature pad with a drawn signature and signer name, "Send photo report to customer" switch [F17], "Collect payment" row with Tap to Pay / Send link [F11], warnings bar, big "Verify and complete" button.
- `tech-timesheet` · Timesheet · 66 · tech. Back bar ("Back to my day"). Date header with total hours. Rows: travel / on site per WO with start, stop, hours, and a "GPS verified" tag or "Manual" [F20]; lunch and break rows; overlap warning kept; add time / lunch / break buttons; the CA rule hints ("Lunch required before 5th hour"); daily OT line; "Submit timesheet" with the blocker card kept.
- `tech-lookup` · Customer lookup · 68 · tech. Back bar. Search; results rows; site facts (parent, site, address, contact, phone, special instructions, default tech, backup); equipment list [F6] with warranty and refrigerant pills and "Scan QR"; history rows with read-only WO fact sheet in a bottom sheet.
- `tech-vehicle` · My vehicle · 70 · tech. Back bar. Van name and balance; truck stock table by SKU with low-stock pills [F16]; "Request replenishment" button; "Tomorrow's jobs" parts check card (job, parts needed, Ready / Missing); history list kept.

### Customer phone

- `cust-tracking` · Tech on the way · 80 · customer. A customer-facing page from the ETA text [F3, F1]: company mark, "Marcus is on the way", tech photo tile, name, ETA 11:05 with a live pill, small map with the truck and the site pin, the appointment summary, "Reply by text" and "Call the office" as selectable numbers, what to expect ("Marcus will check in with the front desk first"), and the review request state after completion as a second card below.
- `cust-portal` · Customer portal · 82 · customer [F13]. Top: "Barranca Medical Partners · Irvine Med Offices". Cards: Quote 2041 to approve with the three options [F9] and an "Approve Better · $3,420" button with e-sign; Invoice 742 due $1,186 with "Pay now" (card on file ending 4242) [F11]; Recent visits with photos and the AI job summary [F17]; Equipment at your site; "Request service" button opening a bottom sheet (problem, urgency, preferred window).

## Checking your work

- After writing each file, run `node build.mjs` from this folder. It must print your screen id in the list and no errors.
- Open nothing in a browser. Visual review happens separately.
- Report back: the files you wrote, one line per screen on what it shows, any DS classes you wished existed (with the scoped CSS you used instead), and anything in the inventory you could not fit.

## Direction update (October 14, afternoon)

Max reviewed the first screens: still too cluttered. These rules now override anything above that conflicts.

1. The shell has a grouped left sidebar menu (Work, Customers, Sales, Money, Insights; Users and Settings at the bottom) and a slim top bar with the page title and one copper "+ New" button. The tab row is gone. "New X" buttons do not belong in toolbars, except one copper button on a list page that creates its own record type.
2. One toolbar row with at most five controls: a segmented control, a date or search, a Filters button, and one or two buttons. Filters live behind a "Filters · 2" button that opens a sheet with the chip groups and selects, with Clear and Apply in the footer. No chip walls on the page.
3. At most four KPI tiles on a page, or one quiet `.summary-line` instead of pills in the toolbar.
4. Air over borders: `.page` padding, `.stack.loose`, grid gaps; no card inside a card; `.card` for the one or two main blocks only; one pill per row.
5. Rails are light and hold a search, a segmented control, a Filters button, and the list.
6. Record pages: Back bar, a calm header (title, two or three pills, one line of facts), then tabs. Facts in one `.facts` list, not cards.
7. Phone screens: one task per screen; section rows with counts, expanded inline only where the brief says so; at most one notice.
