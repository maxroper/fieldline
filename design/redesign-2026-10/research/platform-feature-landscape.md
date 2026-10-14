<!-- Research record for the Fieldline redesign, October 2026. Produced by a research agent; treat as notes, verify before relying on a specific claim. -->

# HVAC and field-service platform feature landscape

# HVAC / Field-Service Platform Feature Landscape (research as of Oct 2026)

Abbrev: ST ServiceTitan, HCP Housecall Pro, JB Jobber, FE FieldEdge, SF Service Fusion, WZ Workiz, BO BuildOps, STr ServiceTrade, SP Simpro, CS Commusoft, FP FieldPulse, ZP Zuper, SW Successware, SR Sera, SFS Salesforce FS, D365 Dynamics 365 FS. **TS** = table stakes, **DF** = differentiator. [n] = source list at end. Most evidence is vendor docs/feature pages plus G2/Capterra; treat tier placement as approximate.

## 1. Dispatch & scheduling
- Drag-and-drop day board (tech rows x time) + map with live tech GPS — **TS** (all 16). BO users complain tech rows are locked alphabetical [45]; make row order configurable.
- Skills/certs + zone/territory filtering — **TS** (ST, FE, BO, SW, SR, WZ "Service Areas", ZP territories, CS, SFS, D365) [2,42,44,45,48,50,51,52].
- Recurring jobs — **TS** (all).
- Route optimization (one-click reorder of a tech's day) — **TS but tier-gated**: HCP MAX, JB (Routing), ZP Core+, WZ Genius Scheduling, CS AI daily routes, SF (traffic/weather), D365 RSO, SFS optimizer [26,36,43,44,48,50,53,54].
- AI auto-assignment simulating scenarios on skills, drive time, shift, tech sales performance — **DF**: ST Dispatch Pro; BO OpsAI Optimizer/Schedule Assistant; SFS/D365 scheduling policies [2,45,53,54].
- Capacity planning (book caps per job type/business unit; Adaptive Capacity forecasts demand and auto-adjusts booking) — **DF**: ST; SP Maintenance Planner labor forecasting [3,47].
- On-call shifts as first-class shift type, consumed by auto-dispatch for after-hours AI-booked jobs, tech notified by call/SMS — **DF**: ST [4]. Others handle after-hours manually.
- SLA/priority: contract SLAs with on-screen response clocks and auto-generated SLA jobs — **DF**: CS; BO ranks work orders by SLA/urgency; D365 SLAs/entitlements with pre-breach alerts; SP service-level alerts [48,45,54,47].
- Mass scheduling of annual contract visits, suggestions ranked by efficiency — **DF**: CS [48].
- Multi-day jobs / crew scheduling (WZ, JB Plus, BO, SP) — TS commercial, DF residential [44,36,45].

## 2. Technician mobile app
- Status flow (dispatched/en route/arrived/complete), customer + equipment history, estimates/invoices, e-signature, photos — **TS** (all).
- Checklists/forms with pass-flag-fail, required-before-complete — **TS** (HCP, JB, WZ, ZP, BO, CS, D365 inspections). Forms auto-triggered by event (Arrive tap) or by equipment type, photos auto-filed to job — **DF**: ST form triggers [7,28,44]. Inspection findings auto-become deficiencies then quotes — **DF**: STr [46].
- Photo/video: 60-sec video + annotations/timestamps (HCP), unlimited media library (JB Plus), STr photo/video shared via Service Link — photos TS, video/annotation DF [29,36,46].
- Offline: ST caches opened jobs; status, signatures, time, photos sync later (payments/POs/financing need signal) — strongest SMB offering; JB added offline forms/time Mar 2026; HCP view-only for previously opened jobs; SF cannot create jobs or take payments offline; SP shows last-synced data; SFS/D365 full offline — **DF** (ST, SFS, D365), partial elsewhere [5,39,30,43,47,53,54].
- Pricebook on phone with images, explainer PDFs, one-click Good/Better/Best auto-proposals, regional price benchmarks, smart upsell suggestions, auto-updated content — **DF**: ST Pricebook Pro [25]; FP pricebook images [49].
- Payments on phone: card readers (ST, HCP, JB, FE, WZ, SF Stripe reader) **TS**; Tap to Pay (HCP, JB) and tipping (JB, WZ) **DF** [26,36,42,43,44].
- "On my way" text with tech photo + bio — **TS** (HCP photo toggle, WZ, JB, CS, ST) [27,44,36,48,6].
- Tech sees own scorecard (jobs, conversion, revenue, NPS) in app — **DF**: ST [13].
- Voice-driven assistant for hands-free notes/updates — **DF**: JB "AI Voice for Field Workers", ZP AI, D365 Copilot [36,50,54].

## 3. Customer communications
- Confirmations/reminders by SMS + email, two-way texting — **TS**.
- Live tracking link with map + ETA (needs verified address) — **DF**: ST; HCP via vehicle-GPS link; SFS Appointment Assistant (name/photo, expiring link, consent controls); D365 portal "track technician"; WZ photo/bio only [6,27,53,54,44].
- Post-job review requests (Google/FB) — **TS** (HCP all plans, JB Reviews add-on, ST via Marketing Pro, WZ, SF, SW) [26,36,14,44,43,51].
- Online booking widget on real availability — **TS** (HCP, JB, WZ, FP, SP, SR, CS, ST Scheduling Pro add-on with abandoned-session flagging) [26,36,44,49,47,52,48,24]. Reserve with Google — **DF**: WZ [44].
- Customer portal (pay/view invoices, approve estimates, book/reschedule, history, assets) — **TS** (HCP, JB Client Hub incl. optional line items + stored card, WZ, FP, SP, CS, STr Service Portal with deficiency history as WordPress plugin, SR, D365). ST has no native portal — a notable gap [32,37,44,49,47,48,46,52,54,24].
- Service-due reminder auto-sent from contract with self-book link — **DF**: CS [48]. After-service report emailed to customer — **DF**: STr Service Link [46].

## 4. Sales
- Estimates with e-sign, email-open tracking, convert to job/invoice — **TS**.
- Good/Better/Best — **TS**: ST, HCP Sales Proposal Tool (MAX/add-on), JB optional line items (Grow), FE Proposal Pro, FP, WZ Sales Proposals [25,26,36,42,49,44].
- Flat-rate pricebook — **TS** (ST, HCP Essentials+, FE Flat Rate, WZ importable pre-made books, FP, SW). Vendor-maintained content + regional benchmarks — **DF**: ST [25]. Margin-based pricing engine — **DF**: SR [52].
- Consumer financing inside estimate: Wisetack (HCP, JB, ST, FP, WZ), Sunbit (WZ), GreenSky/Service Finance (ST), Acorn (SF) — **TS** [55,44,43].
- Automated unsold-estimate follow-up cadences — **TS**: JB (Connect+), HCP Pipeline add-on, ST Follow-Up screen + Marketing Pro, WZ automations [36,26,14,44]. Install pipeline/CRM: BO Pipeline, JB Pipeline, HCP Pipeline, STr SalesManager, CS Sales+ [45,36,26,46,48].
- Quote-to-contract with asset scoping for commercial agreements — **DF**: STr, BO [46,45]. Recorded sales-presentation coaching — **DF**: ST Field Pro [1].

## 5. Agreements / memberships
- Full engine: membership types (term, price, included recurring services), visit events auto-pre-generated into a booking queue, auto-renew creates linked record, card-on-file auto-billing with failed-payment alerts, deferred revenue — **DF depth**: ST [8]. TS versions: HCP Service Plans (MAX), JB recurring jobs + autopay (no real membership object), FE agreements (renewal/billing/scheduling), SF agreements + recurring-revenue dashboard, WZ Service Plans, FP (agreement template + visit job template + billing), SW, SR, ZP [26,36,42,43,44,49,51,52,50].
- Asset-based PM contracts: visits per asset/service level, test readings, failure points, SLA alerts, labor forecasting — **DF (commercial)**: SP Maintenance Planner, BO (asset-specific agreements auto-ticket + pull-through work), CS (PPM, monthly/quarterly/annual billing), STr, D365/SFS maintenance plans [47,45,48,46,54,53].

## 6. Billing & payments
- Invoice from job, card/ACH, payment links, card on file, autopay — **TS**.
- Deposits on estimates (% or $, optional, require card) — **TS** (HCP, JB, WZ, SP; FP weak) [31,38,44,47].
- Progress/milestone invoicing — JB payment schedules (all plans, set at quote), ST project billing, BO (T&M/fixed/progress/AIA/milestone per job), SP progress claims with customer pre-approval, WZ progressive — **TS for install work** [38,9,45,47,44].
- AIA pay apps, schedule of values, retainage (SP sliding retention) — **DF**: ST, BO, SP [9,45,47].
- Instant payouts, tipping — JB, WZ [36,44]. Payment policies (card required, approve-then-deposit) — **DF**: WZ [44].
- Accounting: QBO universal; QB Desktop: FE, HCP, ST, SW; Xero: JB, CS, ST (preview); Sage Intacct: FE, BO, STr; NetSuite/Vista/Spectrum/Acumatica: BO, STr; built-in GL: SW, SP [42,26,10,36,48,45,46,51,47].

## 7. Inventory & purchasing
- Truck + warehouse stock; parts used auto-deduct from van and auto-add to invoice — **TS commercial** (ST, CS, SP, STr PartsManager, BO, ZP serialized multi-warehouse, WZ, FP, SR "where installed"); HCP/JB weak [12,48,47,46,45,50,44,49,52].
- Min/max templates → replenishment records (triggered after job start) → warehouse-to-truck transfers — **DF**: ST; CS auto-PO at min level [12,48].
- POs linked to job + pricebook — **TS** (ST, WZ, SP, CS, BO, STr).
- Supplier catalog + live price/availability + PO sent to supplier — **DF**: ST (Johnstone w/ branch purchasing, R.E. Michel, Winsupply, Hajoca, Consolidated, Gensco; Ferguson + Trane catalog with PO "coming soon"), SP vendor catalogs + price comparison, CS Wolseley, FP Reece, JB Home Depot [11,47,48,49,36].
- Parts forecasting — **DF**: STr [46]. Supplier-invoice/receipt scanning — **DF**: JB [36].

## 8. Reporting & dashboards
- Standard KPIs: revenue, booked-call rate, avg ticket ("opportunity job average"), close rate, memberships sold, tech scorecards (overview/lead-gen/memberships/productivity/sales), billable vs worked hours — ST sets the bar [13]. JB: Insights, salesperson + team-productivity reports, revenue goals; FE: gross margin, tech productivity; HCP: job costing; FP: 60+ prebuilt reports; WZ: ad/source ROI; SP/CS/BO: real-time job costing [36,42,26,49,44,47,48,45].
- Custom report builder — **TS at top tiers** (ST The Works, JB Plus, WZ, FP) [1,36,44,49].
- Marketing attribution: tracking numbers/DNI → campaign → job revenue, 84-day last-touch window, campaign scorecard ranked by revenue, Google Ads/GA link — **DF**: ST Marketing Pro; WZ Ad & Source Tracking; FE spend-by-channel [14,44,42].
- Job-profit alerts when margin slips — **DF**: JB Plus [36]. AI insights/next-best-action (STr, ZP, BO OpsAI, SP RAIN) — emerging DF [46,50,45,47].

## 9. Call center / CSR
- Caller-ID screen pop with customer, history, equipment — **TS** (ST, SW Connection, FE, SF ServiceCall.ai, WZ, HCP Voice) [16,51,42,43,44,35].
- Call recording tied to customer/job + campaign tracking number — **TS** (ST Basic Phones, WZ recordings & tags, FE Elite, HCP Voice, SF) [15,44,42,35,43].
- Booking scripts by call type — **DF**: SW Call Handling; ST CSR scripts + Contact Center Pro guided booking (preview) [51,16].
- Native phone system (IVR, queues, multi-brand, transcripts/sentiment) — **DF**: ST Phones Pro/Contact Center Pro, HCP Voice, WZ phone + call masking, FP Engage [15,35,44,49].
- AI call answering/booking — becoming **TS**: ST AI Voice Agent (escalates to CSR, auto-dispatches on-call tech), HCP CSR AI, JB AI Receptionist ($29), WZ Genius Answering, FP Operator AI, SF [17,33,36,44,49,43]. AI call insights + lead extraction from email — WZ [44].

## 10. Fleet/GPS, timesheets/payroll, commissions
- Phone GPS — **TS**. Hardware telematics + dashcams + geofence timesheet verification — **DF**: ST Fleet Pro (AI SafetyCams), HCP VGPS/Dashcams, SF (driver behavior, fuel), BO Fleet+, CS Fleet+, FP, WZ Linxup [19,26,43,45,48,49,44].
- Timesheets with job vs non-job time, GPS waypoints at start/stop, geofence auto-timers (JB Grow), export to Gusto/QBO — **TS** [18,40,26,36].
- Commissions: ST Performance Pay/Configurable Payroll (pay profiles, % or flat on revenue base, only on posted job invoices); HCP revenue- or GP-based with sold-by/completed-by splits; WZ Commission Management — **TS at upper tiers** [18,34,44,1]. Mobile timecards + integrated payroll — **DF**: SW [51].

## 11. HVAC-specific
- Equipment records (type/model/serial/install date/warranty/history) per location — **TS** (ST, FE, WZ with photos + warranties, CS multi-site parent/child, ZP warranty tracking, FP, SP, STr, BO, HCP property equipment, SFS asset hierarchy). JB lacks native equipment — gap [42,44,48,50,49,47,46,45,26,53].
- Barcode/QR scan on asset to open history/tests — **DF**: CS, SP [48,47].
- Refrigerant/EPA 608 log per equipment per job (added/recovered/recycled/disposed), office notified to bill — **DF**: ST (custom form, no leak-rate math), CS per-asset audit trail. Leak-rate calculation still third-party (Ref LeakLog) — open gap [20,48].
- Warranty: extended labor warranties via JB Warranties/JB360 two-way (ST, SR, SF, WZ) — **DF** [22,52,44]. OEM registration: ST–Carrier collaboration only; Trane/Lennox/Goodman remain manual — open gap [22].
- Permits: nothing native anywhere; ST uses custom fields/tasks or iPermit integration — open gap [21].
- Deficiency → quote → repair loop with NFPA-style compliance reports — **DF**: STr; SP defects with severity [46,47]. Bluon parts/tech-support integration — **DF**: SR [52].

## 12. Integrations & platform
- Public API: ST (The Works tier only), HCP (MAX only; webhooks MAX), JB (GraphQL, OAuth2, versioned, GraphiQL), WZ (Developer API add-on), SP REST, ZP REST (~300 endpoints, SDK, custom functions), CS v2 REST + webhooks, STr OAuth2, FP — **TS at top tiers**; gating is a common complaint [23,26,41,44,47,50,48,46,49].
- Zapier: HCP, JB (Connect+), WZ, ST (early access), SP, ZP, CS, STr, SR — **TS** [23,26,36,44,48,52].
- Marketing suites: ST Marketing Pro (email/direct mail/ads/reputation), HCP Campaigns/Postcards, JB Marketing Suite ($99), WZ Genius Marketing, FE MarketingEdge, SW — **TS** [14,26,36,44,42,51].
- Lead sources Angi/Thumbtack/Yelp (WZ, FP); CompanyCam, NiceJob, Gusto, Google Calendar common [36,44,49]. IoT-triggered work orders, mixed-reality Remote Assist, SAP — **DF enterprise**: D365 [54].

## 15 features reviewers praise most
1. ST — reporting depth ("pull any report I want") — G2 [56a]
2. ST — pricebook integrated with distributors for accurate estimates — G2 [56a]
3. ST — call recording to review customer interactions — G2 [56a]
4. HCP — intuitive UI, fast to learn (95% positive, 2.7k reviews) — Capterra [56b]
5. HCP — mobile app: estimate, schedule, take payment from phone — fieldservicesoftware.io [56c]
6. HCP — review requests + marketing automation working out of the box — [56c]
7. JB — Client Hub ("customers comment how professional") — Capterra [56d]
8. JB — ease of use / streamlined scheduling (4.6, 478 reviews) — G2 [56e]
9. FE — two-way QuickBooks Desktop + Online sync — [42b]
10. WZ — caller ID, call recording and lead attribution inside the dispatch tool — [56f]
11. BO — mobile app with fillable forms + timekeeping; dispatch rated 10.0 — G2 [56g]
12. STr — asset history documentation, real-time job tracking, support — G2 [56g]
13. SP — real-time job costing (labor + materials) in one system — G2 [56h]
14. FP — fast onboarding/ease of use, responsive support (4.7, 349 reviews) — G2 [56i]
15. ZP — support (9.6) and ease of setup; SF — all-in-one dispatch/scheduling/invoicing — G2 [56j,56k]

Recurring complaints to design against: ST learning curve, add-on cost, lock-in; HCP inflexible invoice formatting and no billable hours from timesheets; JB tier price jumps; SF app stability; SR QuickBooks gaps/iOS-only; BO fixed dispatch row order and clunky agreement edits.

## Sources
[1] servicetitan.com/pricing · [2] servicetitan.com/features/pro/dispatch · [3] help.servicetitan.com/docs/dispatching.md · [4] help.servicetitan.com/release-hub/docs/on-call-shift-support-for-dispatch-pro · [5] help.servicetitan.com/docs/servicetitan-field-mobile-app-offline-capabilities · [6] help.servicetitan.com/docs/dispatch-and-track-your-technicians · [7] help.servicetitan.com/docs/use-form-triggers · [8] help.servicetitan.com/docs/grow-recurring-revenue-with-memberships · [9] help.servicetitan.com/v1/docs/bill-for-project-progress · [10] help.servicetitan.com/landing-page/xero-accounting-integration · [11] help.servicetitan.com/docs/available-supplier-integrations · [12] help.servicetitan.com/how-to/replenish-items-using-transfers · [13] help.servicetitan.com/docs/technician-scorecards.md · [14] help.servicetitan.com/roofing/docs/use-marketing-pro-analytics · [15] help.servicetitan.com/docs/phone-integrations-in-servicetitan · [16] servicetitan.com/go/call-booking-software; help.servicetitan.com/release-hub/docs/book-jobs-faster-in-contact-center-pro-with-a-new-guided-booking-flow · [17] servicetitan.com/features/pro/voice-agent · [18] help.servicetitan.com/docs/payroll-features · [19] help.servicetitan.com/how-to/fleet-pro-sections · [20] help.servicetitan.com/docs/set-up-and-use-refrigerant-tracking-for-epa-recordkeeping · [21] community.servicetitan.com/t5/The-Puddle/Permits/m-p/19689; einpresswire.com/article/654355182 · [22] marketplace.servicetitan.com/partner/jb-warranties; carrier.com/residential/en/ca/news/news-article/servicetitan_and_carrier_announce_new_collaboration.html · [23] help.servicetitan.com/docs/servicetitan-zapier-integration · [24] help.servicetitan.com/docs/scheduling-pro · [25] servicetitan.com/features/pro/pricebook · [26] housecallpro.com/pricing · [27] help.housecallpro.com/en/articles/357613-customer-notifications-overview · [28] help.housecallpro.com/en/articles/3935784-how-to-create-manage-checklists · [29] housecallpro.com/features/jobsite-photo-app · [30] help.housecallpro.com/en/articles/4747652-housecall-pro-mobile-faq · [31] help.housecallpro.com/en/articles/12151673-collect-deposits-on-estimates · [32] help.housecallpro.com/en/articles/8448657-using-the-customer-portal · [33] help.housecallpro.com/en/articles/9740104-csr-ai-overview · [34] housecallpro.com/resources/may-2026-product-updates · [35] housecallpro.com/?p=778 (Voice) · [36] getjobber.com/pricing · [37] help.getjobber.com/en/articles/what-do-your-clients-see-in-client-hub · [38] productupdates.getjobber.com/109291 · [39] productupdates.getjobber.com/134787 · [40] help.getjobber.com/hc/en-us/articles/14125014745239 · [41] developer.getjobber.com/docs · [42] fieldedge.com; [42b] ainora.lt/blog/fieldedge-ai-review-alternatives-2026; softwareadvice.com/field-service/fieldedge-profile · [43] servicefusion.com; servicefusion.com/blog/introducing-offline-mode; servicefusion.com/servicecall · [44] workiz.com/features; fsm.workiz.com/genius-answering; help.workiz.com/hc/en-us/articles/18055843100945 · [45] buildops.com/department/finance; buildops.com/features/schedule-dispatch; buildops.com/platform; g2.com/compare/buildops-vs-servicetrade · [46] servicetrade.com/features; servicetrade.com/features/service-portal · [47] simprogroup.com/us/pricing; helpguide.simprogroup.com/Content/Service-and-Enterprise/Progress-Claim.htm; …/Retention.htm; …/Asset-Service-Levels.htm; simprogroup.com/solutions/asset-maintenance; simprogroup.com/features/field-service-mobile-app · [48] commusoft.com/en-us/features; …/features/job-scheduling-software; …/industries/refrigeration-software; …/features/inventory-management; …/industries/facility-maintenance-software; developer.commusoft.com · [49] fieldpulse.com/features; fieldpulse.com/features/estimate-software; help.fieldpulse.com/training-resources/migration-guides/servicetitan-to-fieldpulse-migration-guide · [50] zuper.co/?p=56681 (pricing); docs.zuper.co/Getting_Started/Concepts; zuper.co/hvac-dispatching-software; developers.zuper.co/docs; businesswire.com/news/home/20250728446307 · [51] successware.com/features; successware.com/features/call-booking-crm; successware.com/blog/2023/august/did-you-know-call-handling · [52] sera.tech; support.sera.tech/warranty-programs-jb-warranties-integration-; g2.com/products/sera-systems-sera/reviews · [53] trailhead.salesforce.com/content/learn/modules/field_service_basics/field_service_basics_intro; salesforce.com/blog/appointment-assistant-best-practices · [54] learn.microsoft.com/dynamics365/field-service/overview; learn.microsoft.com/en-us/training/modules/use-service-level-agreements-entitlements/service-level-agreements; learn.microsoft.com/dynamics365/field-service/customer-portal-overview · [55] contractortoolstack.com/software/wisetack; wisetack.com/merchant-hs · [56a] g2.com/products/servicetitan/reviews_and_filters · [56b] capterra.com/p/140363/housecall-pro · [56c] fieldservicesoftware.io/comparisons/housecall-pro-vs-jobber · [56d] capterra.com/p/127994/Jobber/reviews · [56e] g2.com/products/jobber/reviews · [56f] stackscored.com/alternatives/workiz · [56g] g2.com/compare/buildops-vs-servicetrade · [56h] g2.com/compare/servicetrade-vs-simpro · [56i] g2.com/compare/buildops-vs-fieldpulse-fieldpulse · [56j] g2.com/compare/buildops-vs-zuper · [56k] g2.com/compare/service-fusion-vs-workiz; capterra.com/p/135788/Service-Fusion

Notes on evidence quality: Simpro's pricing page and FieldEdge/Workiz/Zuper feature pages blocked direct fetch, so those lists come from homepage fetches, help guides and search snippets. No source confirmed native serial-barcode scanning in ServiceTitan, native permit tracking in any platform, or Ferguson full P2P (catalog only, PO "coming soon").
