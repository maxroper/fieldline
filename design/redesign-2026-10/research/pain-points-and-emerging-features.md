<!-- Research record for the Fieldline redesign, October 2026. Produced by a research agent; treat as notes, verify before relying on a specific claim. -->

# HVAC dispatch pain points, 2025-26 feature trends, HVAC and California needs

# HVAC dispatch software: pain points, 2025–26 feature trends, HVAC/California needs, ranked feature list

Method note: Reddit blocks the search crawler; r/HVAC evidence below comes from one indexed thread [8] and Reddit quotes relayed by third parties [10][15]. Capterra/G2 text comes from indexed review snippets [1–5]; Trustpilot was read directly [6][7]. Vendor stats are flagged as company-reported.

## A. Pain points by role

**Dispatcher**
- Per-seat tax on the board: owner left ServiceTitan because it "charges for every person on the dispatch board" while FieldEdge let office users view without mobile seats [9]. Ask: unlimited office/view seats.
- AI auto-reshuffle churn: "technicians would get ready to head to one job and then get reassigned" until rules were set [11]; r/HVAC: "We dumped it after a rough couple months… some times calls still drop" and fear that "high value calls… will go to the best salesman not the best technician" [8]. Dispatch Pro reshuffles the board every 10 minutes [12].
- Phone flood: dispatcher gets "overwhelmed when there are 10 calls coming in at once" [8]; 74% of 130k contractor calls went unanswered (vendor data) [23]; 35–45% of HVAC calls arrive after hours [38].
- Interruptions: homeowners calling to ask where the tech is is the stated reason for tracking links [42]; techs calling for notes/ETAs is why Atlas Mobile pitches "no need to call dispatch" [26]. Dispatchers tied to office PCs, VPN drops, lag at peak [16].
- Dirty data: duplicate clients from online request forms break QuickBooks sync "at least once a week… caught AFTER the technician has gone out" [17]; many elderly customers have no email/cell, defeating AI tools [8].

**CSR**
- Needs caller history on screen: new-vs-existing flag, equipment, prior techs, no re-spelling names [21]; HCP's 2025 "Tell me more" (past jobs, balances, next step) exists for this [28].
- Booking rate is unmeasured ("nobody hears the calls") [22]; industry average call-to-booked ≈12% [21]; 12% of calls misclassified as "not interested" (vendor) [40].
- Speed expectations: 97% of homeowners say response time drives who they hire; 28% expect an immediate reply [24]; 74% expect service within 24h when AC/heat is out; 50% still prefer phone, 24% text [25].

**Technician**
- App instability/data loss: ServiceTitan Field ~3.3/5 on Google Play, "forced resets during… note taking or photo capture", battery drain 20–50% [14]; Trustpilot Jul 2026: "App constantly crashes" [7]; Reddit techs report apps that "freeze mid-job, erase notes, force logouts, or require internet in basements" [15].
- Offline gaps: ServiceTitan queues status/time/notes/photos/forms offline but POs, inventory, financing, dynamic pricing and e-sign links need signal [13]; HCP "only usable with an internet connection" [3]; HCP added photo-upload retries only in Feb 2026 [29].
- Pricebook friction: FieldEdge flat-rate users "have to learn the lingo to find specific repairs"; one shop quit because it "does not track equipment" [4]; Jobber users can't attach equipment to jobs, can't edit saved records, fields "autofill with the wrong words" [5].
- Missing parts → return trips; stock lives in "technician memory, handwritten bin labels" [82]. Daily office check-ins cost ~2 non-productive hours/tech before mobile dispatch [37].

**Owner**
- Price/lock-in: ~$259 per managed tech (Reddit via [10]); "not worth five times the cost of Housecall Pro" [2]; auto-renewing contracts: "When an add on doesn't work out… you're locked in to paying the full contract amount" (Jul 2026) [7]; G2 asks for "more core platform functionality and less Pro Product add ons" [1]. HCP jumps $59→$149 to add a second user [20]; Trustpilot HCP 2.8/5 (690): "too expensive", "No support unless you want to speak with AI" [6].
- Onboarding/migration: "data specialists caused multiple delays" (Oct 2026) [7]; imports that lost customers and created duplicates [1].
- Accounting/reporting: "no job costing functionality", "QuickBooks integration creating accounting mess", "limited reporting" [19]; FieldEdge "cannot sync to QuickBooks without a new add-on" [4].

## B. Emerging 2025–2026 features

1. **AI call answering & booking** — ServiceTitan Virtual Agents (add-on, book to board using Adaptive Capacity; company-reported +10% booking, −15% abandoned) [26]; HCP CSR AI (Jan 2025; website chat Feb 2026) [28][29]; Jobber AI Receptionist (Aug 2025, 200k conversations, keyword transfer) [32]; Sameday ($449/mo), Avoca (quote-only) [40]. Why: contractors report AI books 60–70% vs humans 85–90% vs answering services 25–40% [36].
2. **AI-assisted dispatch** — Dispatch Pro assist/auto modes [12]; Probook raised $40M (Jun 2026) as dispatch-first OS [39]; Golden Rule's average ticket +35% after AI dispatch, no headcount cut [36]. Caveat: assist mode preferred by small teams [8][11].
3. **Agentic "teammate" layer** — ServiceTitan Atlas (Sept 2025; mobile app Oct 2026) runs reports, dispatches, throttles marketing when full [26][27]; Jobber Teammate (beta Sept 2026): morning digest, Action Board, taught routines such as weather rescheduling [34]; HCP Analyst/Accountant AI [28][29].
4. **AI-agent discovery/booking** — ServiceTitan Homh lists contractors inside ChatGPT/Gemini/Claude with booking confirmed in ST [27]; Jobber MCP for ChatGPT/Claude [34].
5. **Automated review requests** — NiceJob fires on job "Finished", "noreview" tag opt-out [41]; Jobber requests after invoice paid; HCP review widget (Feb 2026) [29].
6. **Live tech tracking** — ST "Track Now" link (needs native GPS) [42]; HCP "On My Way" now sends GPS, vehicle and plate via Force [43]; Workiz adds tech photo/bio [43].
7. **Self-booking** — ST Scheduling Pro (Schedule Engine), HCP Online Booking auto-enroll (May 2026) [30]; payoff depends on filters/deposits and office capacity [54].
8. **Good/better/best proposals** — ST estimate templates linked to pricebook [45]; HCP Sales Proposal add-on [46]; IAQ as the "better vs best" differentiator ($440–720 ticket) [78].
9. **Membership automation** — HCP recurring-job page with card-on-file auto-invoicing (Feb 2026), membership plans on jobs/estimates (Jul 2026) [29][31]; trend to monthly billing, tiers incl. monitoring-only; retention 65–75%→~95% (SmartAC-reported) [76].
10. **Route optimization** — ST one-click (2025) [26]; Jobber native on web (Connect+) [35]; HCP route-based scheduling (May 2026) [30].
11. **Capacity planning** — ST Adaptive Capacity rules ("book 80% of PM in busy season, keep 20% for demand"), Demand Orchestration forecasts 2 weeks vs booking goals (preview) [44].
12. **Weather-driven forecasting** — ST Forecast Demand pulls weather by ZIP into capacity planning [44]; Jobber Teammate weather-reschedule routines [34]; weather-triggered marketing playbooks [55]. No small-shop tool ships a true weather demand model — a gap.
13. **Offline-first mobile** — only partial even at ST [13]; see A.
14. **AI photo/diagnostic** — Bluon nameplate scan → model age, likely warranty status, refrigerant/charge, parts, MasterMechanic trained on 150k support calls; embedded in HCP (Oct 2025) and ST (May 2026) [50]; XOi on-device OCR works offline [51].
15. **Embedded financing** — Wisetack in HCP/Jobber ($500–25k, 3.9% fee, 84/120-month terms Feb 2026) [47][29]; Klarna in HCP [29]; Affirm×ST (Sept 2025) [48]; GreenSky Prescreen/Synchrony QuickScreen preapproval (Oct 2026) [27]; ST claims +15% close, +20% ticket [49].
16. **Texting-first** — HCP global inbox (Oct 2025) [28]; ST interactive SMS scheduling [26]; Jobber in-app phone calls [34]; SMS 45% response vs 6% email [24].
17. **Voice → job summary** — Jobber Voice (hands-free admin, Sept 2025) [33]; Workiz "Hey Genius" (beta) [53]; FieldEquip FieldNote AI (Nov 2025) [52]; HCP "refine it for me" job summaries (May 2026) [30]; ST findings write-up copilot (Oct 2026) [27].
18. **Other** — payroll time tracking, commissions by revenue/GP split seller/tech, automated sales tax by location, job photo reports with executive summary [29][30]; AI pricing benchmarks and tech efficiency reporting [26][31]; supplier self-service portal, Ramp job-profitability sync, Ford Pro telematics without hardware [26][27]; Rilla ride-along coaching (CA requires telling the customer before recording) [56].

## C. HVAC-specific operational needs

- **EPA 608 (Part 82)**: for 5–50 lb appliances disposed, technician (or employer) keeps location, recovery date, refrigerant type, monthly totals by type, destination — 3 years; ≥50 lb ODS: invoice showing refrigerant added plus leak-inspection/verification records to owner; HFC ≥50 lb left 82.157 in 2020 [57].
- **ER&R rule (40 CFR 84.106), effective Jan 1 2026**: appliances ≥15 lb HFC/GWP>53, *excluding residential and light-commercial AC/heat pumps* (so OC commercial comfort-cooling/refrigeration). Servicer must hand the owner a record per install/service/repair/disposal: appliance ID/location, date, parts, work type, tech name, lb added/removed and type, full charge, leak rate and method; owner keeps 3 yrs; leak rate recalculated at every add; triggers 10% comfort cooling/20% refrigeration/30% IPR; repair 30 days, follow-up test within 10 days, annual inspections 15–<500 lb; 125% chronic report Mar 1; EPA e-filing via HAWK/CDX [58][59][60].
- **A2L transition**: CARB capped new residential AC at 750 GWP from Jan 1 2025 (R-410A units built earlier may be sold; virgin R-410A banned ~2030) [63]; EPA's Jan 1 2026 federal install deadline was removed May 21 2026 (effective ~Jul 27) *only* where all specified components were manufactured/imported before Jan 1 2025; VRF faces Jan 1 2027 [61][62]. Record per-component manufacture dates/serials and refrigerant type; A2L (R-454B/R-32) needs rated tools and leak-detection notes [62][63].
- **CARB RMP**: stationary refrigeration >50 lb high-GWP: registration/reporting via R3, 14-day leak repair, service and refrigerant-transaction records kept 5 years; applies to anyone installing/servicing [64][60].
- **Permits/inspections (Title 24)**: 2025 Energy Code effective Jan 1 2026; HERS became "ECC"; installer files CF1R-ALT, rater registers CF2R/CF3R before final [65][69]. Changeout tests: duct leakage ≤15% total/≤10% outside (or seal accessible), airflow ≥300 cfm/ton, refrigerant charge verification (CZ 8 incl. inland OC; study guide says 2025 cycle extends HP charge checks statewide — unverified) [66][67]. Irvine offers automated online permits for rooftop packaged HP changeouts; third-party estimates $135–575 fees, ~1 week [68].
- **Warranty**: register within 60–90 days (brand) for extended parts; needs model, serial, install date, AHRI match; each OEM portal differs; claims need failure codes, photos, part return in 30–60 days [75]; Bluon scan returns likely warranty status [50]; XOi offers guided registration [51].
- **Maintenance seasonality**: two visits/yr; a 500-agreement book means ~250 visits compressed into each 6–8-week spring/fall window [77]; only 20–25% of homeowners sign up; monthly billing beats annual [76].
- **IAQ/duct**: whole-home filtration/humidity/ventilation sells best; >2/3 of Millennials/Gen Z want data proof [78].
- **Parts integrations**: ST–Ferguson pricebook/contract cost sync, POs (procurement phase 2026) [79]; ST–Johnstone P2P real-time price/availability, PO submit (closed beta) [80]; HCP–Watsco add-to-pricebook/buy from job [81].
- **QuickBooks**: match on IDs not names [17]; HCP exposes sync alerts and sync-timing controls (Feb 2026) [18][29].
- **California extras**: TECH Clean California single-family HP HVAC incentives fully reserved; contractor enrollment via The Switch Is On [70]; SCE funds TECH [72]; SoCalGas 2026 furnace rebate needs *proof of permit closure*, install in 2026, postmark by Dec 31 [71]; federal 25C credit ended Dec 31 2025 [73]; daily OT >8h at 1.5x, >12h 2x, 7th-day rules [74].

## D. Ranked candidate features (value to a 2–10-tech OC HVAC shop)

| # | Feature | What | Why | Serves | Cx | Src |
|---|---|---|---|---|---|---|
| 1 | Dispatch board w/ arrival windows & capacity rules | Drag-drop, hold % slots for demand calls, unlimited office seats | Core pain; seat tax; peak chaos | Disp/Own | M | 9,16,44 |
| 2 | Caller-ID customer/equipment pop + dedupe | Match phone/address, show history, block duplicates | Booking speed; QB dupes | CSR/Disp | M | 17,21 |
| 3 | Two-way SMS inbox + "on my way" live ETA link | Texts from board/app, GPS link | Cuts "where's my tech" calls | CSR/Tech | M | 24,42,43 |
| 4 | Offline-first tech app | Queue notes/photos/forms/time; retry uploads | #1 tech complaint | Tech | L | 13,14,15 |
| 5 | Equipment record + nameplate OCR | Model/serial/refrigerant/age/component mfg dates | Warranty, A2L, upsell | Tech/CSR | M | 50,51,61 |
| 6 | Refrigerant log per job | Type, lb added/recovered, cylinder, tech cert; auto 608/84.106 records, leak rate | Compliance, 3–5-yr records | Tech/Own | M | 57,58,64 |
| 7 | QuickBooks Online sync | ID-based, alert queue, sync-timing choice | Accounting mess | Own | M | 17,18 |
| 8 | Membership engine | Tiers, monthly card-on-file, auto spring/fall visits, renewals | Recurring revenue | Own/CSR | M | 29,76 |
| 9 | GBB proposal builder + e-sign | 3 tiers, IAQ add-ons, "as low as" financing | Ticket size | Tech | M | 45,78 |
| 10 | Embedded financing | Wisetack/Affirm/Klarna API, preapproval | Close rate | Tech/Own | M | 47,48 |
| 11 | Auto review requests | On job complete, opt-out tag, follow-up | Lead flow | Own | S | 41 |
| 12 | Missed-call auto-text-back | Instant SMS with booking link | 74% unanswered | CSR | S | 23,24 |
| 13 | AI after-hours answering → board | Own or Sameday-style integration, keyword escalation | After-hours calls | CSR/Own | L | 26,32,36 |
| 14 | Permit/ECC tracker | Permit #, HERS/ECC tests, final, docs per job | Title 24; rebates need permit closure | Own/Disp | M | 65,68,71 |
| 15 | Warranty registration & claims | 60/90-day timers, portal links, part-return window | Lost reimbursements | Own | M | 75 |
| 16 | Timesheets w/ geofenced clock-in + CA OT | Auto arrive/depart, daily OT/double time export | Payroll accuracy | Tech/Own | M | 37,74 |
| 17 | Truck stock min/max + replenishment | Parts-used per job, tomorrow's-jobs check | Return trips | Tech/Disp | M | 82 |
| 18 | Voice note → AI job summary | Dictate → structured notes, recommended repairs | Faster, clearer closeout | Tech | M | 30,52 |
| 19 | Owner KPI dashboard + ask-AI | Booking rate, avg ticket, tech conversion, AR | Reporting gaps | Own | M | 19,22,28 |
| 20 | Job photo report to customer | Photos + summary emailed/texted | Trust, upsell proof | Tech | S | 30 |
| 21 | Route optimization | Daily reorder honoring windows/skills | Drive time | Disp | M | 26,35 |
| 22 | Self-booking w/ capacity-aware slots | Service filters, deposit option | Lead capture | CSR | M | 30,54 |
| 23 | PM batching by geography | Auto-generate/cluster shoulder-season tune-ups | 250 visits/6–8 wks | Disp | M | 77 |
| 24 | Weather-aware demand nudges | Heat-wave forecast → open slots, text members | Peak readiness | Disp/Own | M | 44,55 |
| 25 | Unsold-estimate follow-ups | Automated texts/AI, quote alerts | 25% lift reported | CSR | S | 33,83 |
| 26 | Plain-language flat-rate pricebook + benchmarks | Searchable repairs, margin benchmarks | "Learn the lingo" | Tech | M | 4,31 |
| 27 | Commissions + sales tax by location | Line-item splits, OC tax rates | Payroll disputes | Own | S | 30,31 |
| 28 | Supplier price/PO integration | Johnstone/Ferguson pricing, PO from job | Procurement time | Own | L | 79,80 |
| 29 | AI dispatch suggestions (assist only) | Skill/parts/proximity ranking, no auto-move | Avoid reshuffle churn | Disp | L | 8,11,12 |
| 30 | Data export & transparent pricing | Full CSV + attachments, no per-seat lock-in | Switching trust | Own | S | 7,9,84 |

## Sources
1. G2 ServiceTitan reviews — https://www.g2.com/products/servicetitan/reviews_and_filters
2. Capterra ServiceTitan reviews — https://www.capterra.com/p/150053/ServiceTitan/reviews/
3. Capterra Housecall Pro reviews — https://www.capterra.com/p/140363/HouseCall-Pro/reviews/
4. Capterra FieldEdge / Flat Rate Mobile reviews — https://www.capterra.com/p/111740/FieldEdge/reviews/?page=4 ; https://www.capterra.com/p/132009/Coolfront/reviews/?page=5
5. Capterra Jobber reviews — https://capterra.com/p/127994/Jobber/reviews/?page=3 ; https://www.capterra.com/p/127994/Jobber/reviews/?page=51
6. Trustpilot Housecall Pro — https://www.trustpilot.com/review/housecallpro.com
7. Trustpilot ServiceTitan — https://www.trustpilot.com/review/servicetitan.com
8. r/HVAC "Service Titan with AI dispatching" — https://www.reddit.com/r/HVAC/comments/1jp97gv/service_titan_with_ai_dispatching/
9. HVAC-Talk "FieldEdge vs ServiceTitan" — https://www.hvac-talk.com/threads/fieldedge-vs-servicetitan-vs-recommendations.2199276/
10. OneCrew ServiceTitan review roundup — https://www.getonecrew.com/post/servicetitan-reviews
11. Tradesly Dispatch Pro review — https://www.tradesly.ai/blog/servicetitan-dispatch-pro-review
12. ServiceTitan Dispatch Pro overview — https://help.servicetitan.com/docs/dispatch-pro-overview
13. ServiceTitan offline capabilities — https://help.servicetitan.com/mobile/docs/servicetitan-field-mobile-app-offline-capabilities
14. ServiceTitan Field app review aggregate — https://marlvel.ai/apps/servicetitan-field
15. Arrivy (Reddit tech complaints) — https://www.arrivy.com/blog/why-your-hvac-technicians-need-a-mobile-field-service-app/
16. MIS Solutions dispatch access — https://www.mis-solutions.com/2026/01/hvac-scheduling-and-dispatch/
17. Jobber community: duplicate clients/QuickBooks — https://community.getjobber.com/discussions/customer-management-and-self-serve/how-to-prevent-or-merge-duplicate-client-records-when-syncing-with-quickbooks/3677
18. HCP QuickBooks sync alerts — https://help.housecallpro.com/en/articles/975825-quickbooks-online-sync-alerts
19. CostBench HCP complaints — https://costbench.com/software/field-service-management/housecall-pro/
20. Projul HCP pricing analysis — https://projul.com/blog/housecall-pro-pricing-analysis-2026
21. ACHR News "Using Software to Convert Calls Into Cash" — https://achrnews.com/articles/132458-using-software-to-convert-calls-into-cash
22. Voxjar home services — https://voxjar.com/industries/home-services
23. Carly missed-call analysis — https://www.usecarly.com/blog/missed-call-statistics/
24. Signpost stats (HCP 2025 survey, Jobber 2026 report, SMS) — https://www.signpost.com/resources/10-key-stats-every-home-service-pro-should-know
25. FIELDBOSS 2025 homeowner survey — https://www.fieldboss.com/?p=22208
26. ServiceTitan Pantheon 2025 — https://www.servicetitan.com/press/servicetitan-introducing-the-next-evolution-of-ai-at-pantheon-2025-keynote ; https://www.achrnews.com/articles/165267-servicetitan-introducing-the-next-evolution-of-ai-at-pantheon-2025-keynote-sessions
27. ServiceTitan Pantheon 2026 — https://www.servicetitan.com/press/servicetitan-announcing-new-and-expanded-capabilities-at-pantheon-2026
28. Housecall Pro fall 2025 release — https://www.prnewswire.com/news-releases/housecall-pro-unveils-major-ai-powered-updates-for-fall-2025-302594189.html
29. Housecall Pro Feb 2026 release — https://www.housecallpro.com/resources/february-2026-product-updates/
30. Housecall Pro May 2026 release — https://www.housecallpro.com/resources/may-2026-product-updates/
31. Housecall Pro trade-specific packages (Jul 2026) — https://www.contractormag.com/technology/news/55391529/housecall-pro-launches-trade-specific-software-for-hvac-plumbing-and-electrical-contractors
32. Jobber AI Receptionist (Aug 2025) — https://www.prnewswire.com/news-releases/jobber-launches-ai-powered-receptionist-to-answer-calls-and-texts-for-busy-home-service-businesses-302531125.html
33. Jobber AI features (Sept 2025) — https://www.prnewswire.com/news-releases/industry-leader-jobber-unveils-exciting-new-ai-offerings-for-home-service-businesses-302567290.html
34. Jobber Teammate (Sept 2026) — https://www.prnewswire.com/news-releases/jobber-unveils-jobber-teammate-the-first-ai-agent-for-home-and-commercial-service-businesses-to-plan-act-and-learn-like-a-real-team-member-302886414.html ; MCP — https://www.prnewswire.com/news-releases/jobber-launches-mcp-bringing-home-and-commercial-service-data-and-workflows-directly-into-chatgpt-and-claude-302890385.html
35. Jobber route optimization — https://help.getjobber.com/es/articles/route-optimization-new-schedule/
36. Contracting Business "AI Finds Its Place in the HVAC Business" (Sept 2026) — https://www.contractingbusiness.com/contracting-business-success/article/55396975/ai-finds-its-place-in-the-hvac-business
37. ACHR News "Predictive Software and Smart Dispatch" (Sept 2025) — https://www.achrnews.com/articles/165246-predictive-software-and-smart-dispatch-help-contractors-do-more-with-less
38. ACHR News AI adoption 2026 — https://www.achrnews.com/articles/166731-ai-emerging-as-a-priority-for-commercial-service-contractors ; https://www.achrnews.com/articles/166041-crawl-walk-run-how-hvac-contractors-are-successfully-adopting-ai-in-2026
39. Probook $40M (Jun 2026) — https://www.contractingbusiness.com/industry-news/news/55386309/probook-secures-40-million-to-expand-ai-for-home-services
40. AI receptionist comparison (Sameday/Avoca) — https://thesnowmedia.com/resources/ai-receptionist-plumbing-hvac-options-compared/ ; https://www.avoca.ai/inbound/hvac
41. NiceJob–Housecall Pro integration — https://help.nicejob.co/articles/1567668-connecting-housecall-pro-to-nicejob
42. ServiceTitan technician tracking — https://help.servicetitan.com/docs/best-practices-tech-tracking
43. HCP On My Way + Force (PYMNTS) — https://pymnts.com/?p=1276246 ; Workiz On My Way — https://platform.softwareone.com/product/on-my-way/PCP-1479-8041
44. ServiceTitan Adaptive Capacity / Demand Orchestration / Forecast Demand — https://help.servicetitan.com/release-hub/docs/fill-your-schedule-before-it-thins-with-demand-orchestration-in-command-center ; https://help.servicetitan.com/docs/book-the-ideal-number-of-jobs-with-open-capacity-planning
45. ServiceTitan good-better-best — https://www.servicetitan.com/blog/good-better-best-hvac-proposal
46. QuoteIQ proposal software roundup — https://myquoteiq.com/?p=23738
47. Wisetack via HCP / ContractorToolStack — https://housecallpro.com/?p=758 ; https://contractortoolstack.com/categories/financing-tools/
48. Affirm–ServiceTitan (Sept 2025) — https://investors.affirm.com/news-releases/news-release-details/affirm-partners-servicetitan-bring-smart-flexible-payment
49. ServiceTitan integrated financing — https://www.servicetitan.com/customer-financing
50. Bluon in HCP and ServiceTitan — https://help.housecallpro.com/en/articles/11557855-bluon-integration ; https://www.contractingbusiness.com/industry-news/news/55379434/bluon-integrates-hvac-ai-support-directly-into-servicetitan-platform
51. XOi HVAC — https://xoi.io/how-xoi-helps/hvac/
52. FieldEquip FieldNote AI (Nov 2025) — https://www.fieldtechnologiesonline.com/doc/fieldequip-introduces-ai-to-field-service-management-with-launch-of-fieldnote-ai-0001
53. Workiz Hey Genius / Genius Answering — https://help.workiz.com/hc/en-us/articles/37869982977041 ; https://www.achrnews.com/articles/163805-jessica-is-the-new-ai-receptionist-for-contractors
54. SmartService on self-booking — https://www.smartservice.com/blog/hvac-website-customer-scheduling
55. HVACR Business weather-triggered marketing — https://hvacrbusiness.com/news/2023/jul/01/a-step-by-step-guide-to-weather-triggered-marketing-campaigns
56. Rilla home services (recording consent) — https://rilla.com/industry/home-services
57. EPA Section 608 recordkeeping — https://www.epa.gov/section608/recordkeeping-and-reporting-requirements-stationary-refrigeration
58. 40 CFR 84.106 (Cornell LII) — https://www.law.cornell.edu/cfr/text/40/84.106
59. EPA ER&R reporting resources — https://www.epa.gov/hfcs/reporting-resources-emissions-reduction-reclamation-rule
60. ACHR News "Leak Rules Tighten as Threshold Drops to 15 Pounds" (Jun 2026) — https://www.achrnews.com/articles/166298-leak-rules-tighten-as-threshold-drops-to-15-pounds
61. ACHR News "EPA Removes R-410A Installation Deadline" (May 2026) — https://www.achrnews.com/articles/166226-epa-removes-r-410a-installation-deadline ; ACCA — https://hvac-blog.acca.org/epa-lifts-r-410a-installation-deadline-but-refrigerant-prices-could-rise/
62. ICC Technology Transitions Q4 2025 update — https://www.iccsafe.org/building-safety-journal/bsj-technical/q4-2025-update-epas-technology-transitions-program-related-to-a2l-refrigerants/
63. ACHR News "Ringing in 2025" (CARB 750 GWP) — https://www.achrnews.com/blogs/17-opinions/post/163912-ringing-in-2025-with-big-changes-and-a-few-challenges ; Trane regulatory guide — https://elibrary.tranetechnologies.com/public/commercial-hvac/Literature/Sales/REFR-SLB009-EN_05152024.pdf
64. CARB RMP/R3 updates (Feb 2026) — https://ww2.arb.ca.gov/sites/default/files/2026-02/CARB%20Updates%20to%20R3%202-13-26.pdf ; https://fexa.io/blog/california-refrigerant-management-program/
65. CEC HERS→ECC transition; 2025 Energy Code — https://www.energy.ca.gov/node/130 ; https://www.energy.ca.gov/sites/default/files/2025-06/2025_Energy_Code_Overview_ADA.pdf
66. CEC CF1R-ALT HVAC sample form — https://www.energy.ca.gov/filebrowser/download/4688
67. Title 24 HERS/duct testing study guide (unofficial) — https://open-exam-prep.com/study-guides/ca-hvac-contractor/title-24-mechanical-code/hers-verification-duct-testing
68. Permit requirements: Irvine, Anaheim, City of Irvine — https://permitmint.com/permits/california/irvine/hvac/ ; https://permitmint.com/permits/california/anaheim/hvac/ ; https://cityofirvine.gov/node/69616
69. CHEERS HERS process — https://www.cheers.org/getting-started/homeowners/
70. TECH Clean California incentives — https://techcleanca.com/incentives/
71. SoCalGas 2026 HEER rebate application — https://www.socalgas.com/sites/default/files/2026-03/SCG-HEER-Application.pdf.pdf
72. SCE heat pump rebates (via TECH) — https://electrifyatlas.com/utilities/sce
73. Trane on 25C termination — https://www.trane.com/residential/en/resources/blog/federal-tax-credits-energy-efficiency/
74. California DIR overtime FAQ — https://www.dir.ca.gov/dlse/faq_overtime.htm
75. Warranty registration/claims — https://homelectrical.com/blog/understanding-hvac-warranties-what-homeowners-need-know.7661812 ; https://legacyhousing.com/wp-content/uploads/2025/03/Nortek-1045089A-Jan-24-Public.pdf ; https://liveinthefuture.org/startups/hvac-warranty-claims-recovery.html
76. Contracting Business "Beyond the Tune-Up" (Sept 2026) — https://www.contractingbusiness.com/contracting-business-success/article/55397404/beyond-the-tune-up-rethinking-the-hvac-maintenance-agreement
77. Oxmaint PM contract scheduling — https://oxmaint.com/industries/hvac/preventive-maintenance-contract-scheduling-hvac
78. IAQ: Contracting Business (Apr 2026), ACHR (Nov 2025), CB archive — https://www.contractingbusiness.com/iaq-ventilation/article/55363370/how-hvac-contractors-are-turning-indoor-air-quality-into-a-steady-revenue-stream ; https://www.achrnews.com/blogs/17-opinions/post/165536-its-not-just-clean-air-its-proof-of-clean-air ; https://www.contractingbusiness.com/archive/indoor-air-quality-myth-or-money-generator
79. ServiceTitan–Ferguson — https://help.servicetitan.com/release-hub/docs/ferguson-product-and-pricing-integrationnow-available-for-all ; https://marketplace.servicetitan.com/partner/ferguson
80. ServiceTitan–Johnstone P2P — https://help.servicetitan.com/docs/johnstone-supply-p2p-integration-faq ; https://help.servicetitan.com/docs/available-supply-chain-integrations
81. Housecall Pro–Watsco — https://www.housecallpro.com/?p=48958
82. Truck inventory: ACCA blog; Enterprise DNA — https://hvac-blog.acca.org/?p=17630 ; https://enterprisedna.co/resources/blog/trades-track-service-truck-parts-inventory
83. ACHR News Southern Home Services AI (UpSmith follow-ups) — https://www.achrnews.com/articles/165707-how-southern-home-services-is-using-ai-automation-to-transform-hvac-operations
84. Data export/lock-in guide (CMMS) — https://oxmaint.com/industries/facility-management/facility-cmms-data-export-vendor-lock-in-guide
