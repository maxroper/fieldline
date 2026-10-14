<!-- Research record for the Fieldline redesign, October 2026. Produced by a research agent; treat as notes, verify before relying on a specific claim. -->

# Reference architectures and technology choices for field-service apps (Oct 2026)

# Reference architectures for a field-service / HVAC dispatch product (research as of 2026-10-14)

Web research only; no local files were read. Prices come from vendor pages unless marked "third-party".

## 1. What the incumbents run on (public job posts, blogs, help docs)

| Platform | Backend | Web | Mobile | Notes |
|---|---|---|---|---|
| ServiceTitan | C#/.NET on Azure; MS SQL Server historically, Redis caches, Redshift/Snowflake analytics [1][2] | React + TypeScript (legacy JS/Angular) [1] | React Native app of "150+ modular packages, native integrations, offline-first"; Redux + Redux Saga, Redux Persist for offline; Expo/EAS preferred; native modules in Swift/Kotlin. Earlier generations were a native tablet app (2015) and Cordova (2017) [1][3] | Aspire/FieldRoutes unit: React Native + C#/.NET [3] |
| Jobber | Ruby on Rails, GraphQL, Sidekiq [4][5] | React + TypeScript; open-source Atlantis design system [4][6] | React Native (TypeScript) [4][5] | Public GraphQL API with webhooks [7] |
| Housecall Pro | Ruby on Rails [8] | React/Redux [8] | Separate native iOS (Swift) and Android (Kotlin) teams [8] | Stripe incl. Terminal for payments [9] |
| Workiz | Node.js/TypeScript, MySQL or Postgres, GCP, legacy PHP [10] | React [10] | not public | Elasticsearch/Redis/Mongo "nice to have" |
| BuildOps | Node.js/TypeScript, GraphQL (Apollo) + REST, "real-time, event-driven systems" [11][12] | React [11] | React Native expected of full-stack hires [11] | Python a plus |
| FieldPulse | Node.js/Next.js [13] | React/TypeScript [13] | not public | |

Takeaways: none is a no-backend SPA; every one has a conventional API server (Rails, Node, or .NET) over a relational database. Three of six (ServiceTitan, Jobber, BuildOps) converged on React Native for the tech app; ServiceTitan's native-to-Cordova-to-React-Native path is the cautionary tale about shipping wrapped web code to technicians. Realtime and offline internals are not published beyond ServiceTitan's Redux-Persist offline-first and BuildOps' event-driven backend.

## 2. Offline-first in 2026

All serious engines assume Postgres as source of truth and push writes through your API:

- **PowerSync** (most mature for mobile offline writes). Postgres-to-SQLite partial replication via "Sync Streams" (YAML sync rules now legacy) [14]; client SDKs for RN, web, Flutter, Kotlin, Swift, .NET under Apache/MIT; the service is source-available under FSL, converting to OSS after two years [15]. Writes queue client-side in order and drain to *your* upload endpoint; default is per-field last-write-wins, with documented patterns for idempotent ops (per-client op IDs), "deletes win", and server-side rejection [16]. Cloud: Free 2 GB synced/month and 50 concurrent clients; Pro from $49 (30 GB synced, 1,000 clients, $1/GB and $30 per 1,000 extra clients); Team $599 [17]. Schema demands: a string `id` primary key per synced table, a client schema mirroring synced tables, and stream parameters keyed by org/tech.
- **ElectricSQL**: read-path only ("shapes" over HTTP from logical replication); writes through your API, usually with TanStack DB optimistic mutations [18]. Cloud is pay-as-you-go: reads free, $1 per 1M writes, $0.10/GB-month retention, +$2 per 1M for Postgres Sync; under $5/month waived; Pro $249 [19]. Needs primary keys and a logical-replication publication.
- **Zero (Rocicorp)**: 1.0 in June 2026; zero-cache replica plus ZQL queries; needs Postgres 15+, `wal_level=logical`, event triggers (Neon/RDS full support, Supabase partial, Heroku not recommended); read-only when offline; no SSR [20][21]. Hosted "Cloud Zero" exists but prices are only on third-party sites (~$30 Hobby, ~$300 Pro) [22]. Good for a snappy web dispatch board, wrong for techs who must write offline.
- **TanStack DB + `@tanstack/offline-transactions`**: a durable outbox with idempotency keys, per-key ordering, and `NonRetriableError`; newest of the group [23][24].
- **WatermelonDB**: last release 0.28 (April 2025), the one before in August 2023; no New Architecture notes [25]. Yellow flag.
- **RxDB**: free core; performance storages under annual premium licenses [26]. **Triplit**: repo last pushed January 2026; treat as dormant [27].
- **Custom outbox**: TanStack Query's persister resumes paused mutations but needs `setMutationDefaults` per key and generates no idempotency keys [28]. Reasonable only if the mobile write surface stays small (status, notes, photos, signatures).

PWA versus shell: on iOS, web push works only for home-screen-installed PWAs, and there is no background geolocation, geofencing, or background sync [29][30]. A PWA is fine for the office and for a foreground-only tech app. "On my way" GPS triggers, dependable push, and camera/barcode flows need Expo (SDK 57: background location requires a development build, `UIBackgroundModes=location`, an Android foreground service, and Play review) [31] or Capacitor 8 (Dec 2025; iOS 15+/Android 24+; background location via community plugin) [32]. The incumbents landed on Expo/React Native.

## 3. Backend and data

- **Multi-tenancy**: keep orgId-per-row and enforce it with Postgres RLS. Schema-per-tenant fights transaction-mode pooling (`search_path` pinning), multiplies migrations, and bloats the catalog; it wins only for a few large tenants needing clean export or isolation [33][34]. RLS hygiene: `SET LOCAL` tenant per transaction, connect as a non-owner role, index policy columns (leading btree column), wrap `auth.uid()`/tenant lookups in `(select ...)`, use security-definer membership helpers, scope policies `to authenticated` [35].
- **Hosts**: Supabase Pro $25 bundles Postgres, Auth, Storage, Realtime (RLS-native) [36]; Neon is pay-as-you-go ($0.106/CU-hour, $0.35/GB-month, free 1 GB/100 CU-hours) with branching and logical replication, the cleanest Zero/Electric upstream [37]; Railway Hobby $5/Pro $20 puts app and DB on one bill but default Postgres lacks PITR/HA [36]; Fly suits multi-region WebSockets, Managed Postgres Basic ~$38 [36]; Cloudflare D1/Durable Objects cap each database/object at 10 GB, are single-threaded per database, and DO storage billing began January 2026 [38][39]; attractive per-tenant SQLite, but no RLS and none of the sync engines above target it.
- **ORM**: Prisma 7 (Nov 19, 2025) dropped the Rust engine (~90% smaller bundles) [40]; Drizzle's team was hired by PlanetScale in March 2026 and stays independent OSS [41][42]. Drizzle fits this team: SQL-first, tiny, `drizzle-kit` migrations, RLS policies as plain SQL.
- **Auth**: Clerk 50k MRU free, Pro $25, Organizations/RBAC included (100 orgs, 20 members, admin/member plus custom permissions), B2B add-on $100/month for custom roles and unlimited members, SSO $75/connection [43]; Supabase Auth 50k MAU free then ~$0.00325/MAU (third-party figure), orgs/roles built by you with tables plus RLS [44]; WorkOS AuthKit 1M MAU free, SSO and Directory Sync $125/connection, custom domain $99 [45]; Auth.js free, DIY orgs. Clerk or Supabase Auth now; WorkOS when enterprise SSO appears.

## 4. Frontend

- **Next.js 16.4** (Oct 6, 2026) is current: Turbopack default, `proxy.ts` replaced middleware, React 19.3 (stable View Transitions, Fragment refs), Cache Components (`'use cache'`, PPR plus partial prefetching) on by default for new apps and the default in Next 17; Next 15 reaches EOL Oct 21, 2026 [46][47]. Your `output: 'export'` build uses none of this, and static export excludes Server Actions, proxy, and server caching. For an authenticated, client-heavy dispatch app with no SEO, Vite + TanStack Router (typed search params, file routing) is the simpler fit; TanStack Start (npm 1.169.x, though the official v1 post still reads "release candidate") if you later want server functions or SSR [48][49][50]. Keep Next.js for the public site only.
- **State**: TanStack Query for server state, Zustand (or Jotai for derived atoms) for UI state. A 4,500-line context mixing API data and UI flags is exactly the 2026 anti-pattern [51]. Split the 10,500-line component into feature slices (`features/dispatch`, `features/invoicing`, each with `ui/ model/ api/` and a public `index.ts`), extract query hooks, and let React Compiler 1.0 handle memoization [52][53].
- **Styling/components**: Tailwind v4 CSS-first config; shadcn/ui now defaults to Base UI (1.6, MUI-maintained), Radix is still supported but slowed since the WorkOS acquisition, and a React Aria base arrived July 2026 [54][55][56].

## 5. Realtime dispatch board

- **Transport**: SSE from your API is the cheapest one-way feed for a handful of dispatchers; WebSockets when you need presence or live drag. Supabase Realtime Free 200 connections/100 msg/s, Pro 500/500; Postgres Changes evaluate RLS per subscriber (benchmark drops from 32k to 3k msg/s with RLS), so use Broadcast from DB triggers at scale [57][58]. Ably Free 6M msgs/200 connections, Standard $29; Pusher Sandbox 200k msgs/day, $49 entry [59]. For 2-10 techs any works; the question is who runs the socket server.
- **Two dispatchers moving one job**: Optimistic Offline Lock: integer `version` column, `UPDATE ... WHERE id=? AND version=?`, zero rows means HTTP 409 returning the current row; the UI shows the other move and asks to re-apply instead of retrying blindly; `SELECT ... FOR UPDATE` for high-contention reassignments; per-field merge for notes [60][61]. Tech offline edits reconcile server-side with "deletes win" and validation (reject edits to invoiced jobs) [16].

## 6. Documents and integrations

- **PDF**: `@react-pdf/renderer` (PDFKit underneath, serverless-safe, JSX layouts) for estimates/invoices; Playwright/Chromium only if output must match HTML/CSS (Chrome exceeds Lambda's 250 MB, ~127 ms cold) [62][63]; Typst via `typst-ts-node-compiler` 0.7.0 is still RC, so run the Typst CLI in a container if you want it [64].
- **XLSX**: SheetJS CE is Apache-2.0 but npm `xlsx` is frozen at 0.18.5; install from cdn.sheetjs.com tarballs; styling is Pro-only. ExcelJS (MIT) does styling and streaming, .xlsx only [65][66].
- **QuickBooks Online**: OAuth2; access tokens 60 min; refresh tokens rotate every 24-26 h, expire after 100 days unused (5-year hard cap from 2026); 500 req/min and 10 concurrent per realm; batch 120/min; `minorversion` >= 75; webhooks are reference-only and batched, so use CDC (30-day lookback); production keys are gated by Intuit's app-assessment questionnaire; Builder tier caps 500k read calls/month [67][68][69].
- **Twilio SMS**: A2P 10DLC registration is mandatory: brand $4.50 (Sole Proprietor or Low-Volume Standard) or $46 (Standard incl. secondary vetting); $15 non-refundable campaign vetting; $1.50-$10/month per campaign; carrier surcharges on top (T-Mobile $0.0045/segment since Jan 29, 2026) plus $0.0083 base; 5-15 business days; each tenant texting from its own number needs its own brand/campaign [70][71][72].
- **Stripe**: SetupIntent with `usage: off_session` for card-on-file, Terminal/Tap to Pay for in-home collection, Invoicing 0.4% (Starter) or 0.5% (Plus) per paid invoice on top of processing [73][74][75].
- **Routing**: Google Compute Routes Essentials 10k free then $5/1k; Route Optimization SingleVehicle 5k free then $10/1k, FleetRouting 1k free then $30/1k; Dynamic Maps 10k free then $7/1k [76]. Mapbox Directions/Optimization/Matrix 100k free then $2/1k; map loads 50k free then $5/1k [77]. Mapbox is cheaper for daily optimization; Google wins on US address quality.
- **Telephony**: incumbents integrate rather than build: ServiceTitan Phones Pro runs on Dialpad with tracking numbers and campaign attribution; Housecall Pro has a CallRail screen-pop; Jobber integrates Aircall [78][79][80]. Build a caller-lookup webhook and click-to-call deep links first.

## 7. Testing and delivery

Vitest 4 (Oct 2025; Browser Mode stable via `@vitest/browser-playwright`, visual regression) for unit/component tests; Playwright for E2E including phone-viewport tech flows; Storybook 10 (ESM-only, 10.6 current) for the component library pulled out of the monolith [81][82]. CI: GitHub Actions gives 2,000 free private minutes, $0.006 per Linux minute [83]; run typecheck, lint, Vitest, Playwright on PR; EAS Build for mobile. Observability: Sentry Developer free (5k errors), Team $26/month annual [84]; PostHog for analytics, replay, and flags (1M flag requests free, third-party figure) [85]; alternatives Flagsmith, Unleash (AGPL since v8, June 2026), LaunchDarkly ~$10/seat [86]. Use flags for per-tenant rollout of the sync engine and each integration.

**Net recommendation**: Postgres (Supabase or Neon) with RLS on orgId, Drizzle, a thin Node API; Vite + TanStack Router web app split into feature slices with TanStack Query/Zustand; Expo tech app on PowerSync with a server-authoritative upload endpoint; SSE or Supabase Broadcast plus a `version` column for the board; react-pdf and ExcelJS; Clerk; Vitest/Playwright/Storybook, Sentry, PostHog.

## Sources

1. https://medium.com/servicetitan-engineering/problems-we-solve-38ec4a275189
2. https://builtin.com/company/servicetitan/product-tech
3. https://www.indexventures.com/startup-jobs/servicetitan/senior-software-engineering-mobile/ and https://builtin.com/job/software-engineer-i-mobile-aspirefieldroutes/4589177
4. https://github.com/GetJobber
5. https://www.getjobber.com/careers/senior-software-engineer-remote-canada-8cc365d8/
6. https://atlantis.getjobber.com/packages/components
7. https://developer.getjobber.com/
8. https://www.wayup.com/i-Government-Administration-j-Housecall-Pro-843084525830602/ and https://www.wayup.com/i-Government-Administration-j-Housecall-Pro-868851179749235/
9. https://stripe.com/en-jp/customers/housecall-pro
10. https://freehire.me/jobs/full-stack-engineer-workiz-kvjgdsin
11. https://simplify.jobs/p/8d491c03-b8fb-4a9c-b6a8-110403e63700/Full-Stack-Engineer
12. https://www.welcometothejungle.com/en/companies/buildops/jobs/senior-backend-engineer_san-francisco_bfokj42y
13. https://builtin.com/company/fieldpulse/jobs
14. https://docs.powersync.com/sync/streams/migration.md
15. https://www.powersync.com/open-source and https://powersync.com/legal/licensing-terms
16. https://docs.powersync.com/usage/lifecycle-maintenance/handling-update-conflicts
17. https://powersync.com/pricing
18. https://electric.ax/cloud and https://electric.ax/blog/2025/03/17/electricsql-1.0-released
19. https://electric.ax/pricing
20. https://infoq.com/news/2026/06/zero-version-1
21. https://zero.rocicorp.dev/docs/connecting-to-postgres
22. https://zero.rocicorp.dev/docs/cloud-zero and https://toolradar.com/tools/zero-sync/pricing (third-party)
23. https://tanstack.com/db/latest/docs/guides/offline-transactions
24. https://github.com/TanStack/db/discussions/554
25. https://github.com/Nozbe/WatermelonDB/blob/master/CHANGELOG.md
26. https://rxdb.info/premium/
27. https://gittrend.io/repo/aspen-cloud/triplit
28. https://tanstack.com/query/latest/docs/framework/react/guides/mutations
29. https://www.mobiloud.com/blog/progressive-web-apps-ios/
30. https://progressier.com/pwa-vs-native-app-comparison-table
31. https://docs.expo.dev/versions/latest/sdk/location/
32. https://capgo.app/docs/upgrade/from-v7-to-v8/ and https://www.plushcap.com/content/ionic/blog/ionic-announcing-capacitor-8
33. https://dev.to/itsjayanth/multi-tenant-postgresql-row-level-security-vs-schema-per-tenant-when-to-use-which-3joe
34. https://dev.to/__8fa66572/postgresql-rls-in-go-architecting-secure-multi-tenancy-4ifm
35. https://supabase.com/docs/guides/database/postgres/row-level-security
36. https://www.prisma.io/blog/app-hosting-platforms-with-managed-postgres-2026 and https://blog.railway.com/p/best-postgresql-hosting-2026
37. https://neon.com/pricing
38. https://developers.cloudflare.com/d1/platform/limits
39. https://developers.cloudflare.com/changelog/2025-12-12-durable-objects-sqlite-storage-billing
40. https://www.prisma.io/blog/announcing-prisma-orm-7-0-0
41. https://planetscale.com/blog/drizzle-joins-planetscale
42. https://orm.drizzle.team/docs/sustainability
43. https://clerk.com/pricing
44. https://www.buildmvpfast.com/api-costs/authentication (third-party)
45. https://workos.com/pricing
46. https://nextjs.org/blog/next-16-4
47. https://www.herodevs.com/blog-posts/nextjs-eol-dates-version-support-timeline and https://pockit.tools/blog/nextjs-16-migration-guide-turbopack-proxy-cache-components/
48. https://tanstack.com/start/latest/docs/framework/react/comparison
49. https://tanstack.com/blog/announcing-tanstack-start-v1 and https://registry.npmjs.org/@tanstack/react-start/latest
50. https://makerkit.dev/blog/tutorials/tanstack-start-vs-nextjs
51. https://www.pkgpulse.com/guides/state-of-react-state-management-2026
52. https://dev.to/fpaghar/folder-structuring-techniques-for-beginner-to-advanced-react-projects-30d7
53. https://react.dev/blog/2025/10/07/react-compiler-1
54. https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
55. https://ui.shadcn.com/docs/changelog/2026-07-react-aria
56. https://tailwindcss.com/blog/tailwindcss-v4 and https://www.greatfrontend.com/blog/top-headless-ui-libraries-for-react-in-2026
57. https://supabase.com/docs/guides/realtime/limits
58. https://supabase.com/docs/guides/realtime/postgres-changes
59. https://ably.com/compare/ably-vs-supabase and https://www.buildmvpfast.com/api-costs/realtime (third-party)
60. https://www.martinfowler.com/eaaCatalog/optimisticOfflineLock.html
61. https://oneuptime.com/blog/post/2026-03-31-mysql-optimistic-concurrency-control/view
62. https://pdf4.dev/blog/pdf-generation-nextjs
63. https://orshot.com/blog/nodejs-pdf-generator
64. https://github.com/myriad-dreamin/typst.ts
65. https://docs.sheetjs.com/docs/getting-started/installation/nodejs
66. https://www.pkgpulse.com/guides/sheetjs-vs-exceljs-vs-node-xlsx-excel-files-node-2026
67. https://truto.one/blog/how-to-integrate-with-the-quickbooks-online-api-2026-guide/
68. https://help.developer.intuit.com/s/article/Handling-OAuth-token-expiration
69. https://docs.codat.io/integrations/accounting/quickbooksonline/qbo-app-assessment-questionnaire
70. https://help.twilio.com/articles/1260803965530-What-pricing-and-fees-are-associated-with-the-A2P-10DLC-service-
71. https://support.twilio.com/hc/en-us/articles/44609260499995-T-Mobile-Messaging-Carrier-Fee-Changes-January-2026
72. https://www.twilio.com/en-us/sms/pricing and https://help.twilio.com/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ
73. https://docs.stripe.com/payments/setup-intents
74. https://docs.stripe.com/terminal/overview
75. https://stripe.com/invoicing/pricing
76. https://developers.google.com/maps/billing-and-pricing/pricing
77. https://www.mapbox.com/pricing
78. https://help.servicetitan.com/residential-s-r/docs/phone-integrations-in-servicetitan
79. https://housecallpro.com/partner/callrail
80. https://aircall.io/en-au/blog/partnerships/aircall-jobber-integration-launch/
81. https://vitest.dev/blog/vitest-4
82. https://storybook.js.org/blog/storybook-10/
83. https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/
84. https://sentry.io/pricing/
85. https://schematichq.com/blog/posthog-pricing (third-party)
86. https://futurepicker.com/en/launchdarkly-alternatives-2026/ and https://www.growthbook.io/blog/launchdarkly-alternatives
