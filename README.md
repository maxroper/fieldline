# Fieldline

Service operations for a small HVAC company: the dispatch board, work orders, technicians on phones, quoting, purchasing, van inventory, billing, maintenance agreements, customer texting and a customer portal. Built for Harbor Coast Mechanical in Orange County and shaped by California rules (meal and rest breaks, daily overtime, use tax on quoted material, refrigerant logs).

If you are an AI assistant or a new engineer, start with [docs/AI-HANDOFF.md](docs/AI-HANDOFF.md). It is the map.

## See it online

**https://maxroper.github.io/fieldline/** is the live demo. It is the real app: the API and an embedded Postgres run inside your browser tab, so there is no server and every visitor gets their own copy of the demo company. The first visit takes a few seconds while the database starts; after that it is instant. Pick a person on the sign-in page (James Reynolds is the owner, Alex Tran the dispatcher, Elena Cruz a technician). Clearing the site's data in your browser resets the demo. The customer portal demo is at `/fieldline/portal/barranca`.

The demo is rebuilt and published by GitHub Actions on every push to `main` (`.github/workflows/pages.yml`). Build it locally with `npm run build:demo` and serve `apps/web/dist`.

## Run it

Requirements: Node 22.12 or newer (`.nvmrc` says 26). Nothing else. The database is an embedded Postgres (PGlite) stored in `./data/pglite`, so there is no Docker and nothing to install.

```bash
npm run setup
```

That installs dependencies, creates the schema, applies row-level security and seeds a demo company with a day's worth of work. Then:

```bash
npm run dev
```

Open http://localhost:5173 and pick a person. Office people land on the dispatch board; technicians land on the phone app. The API runs on http://localhost:8787 and the web app proxies `/api` to it.

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run typecheck` | TypeScript across every package and app |
| `npm test` | Unit tests (the money and time rules in `packages/shared`) |
| `npm run build` | Production build of the web app into `apps/web/dist` |
| `npm run build:demo` | The static demo (API and database inside the browser) into `apps/web/dist` |
| `npm run db:generate` | Write a new migration after changing `packages/db/src/schema` |
| `npm run db:migrate` | Apply migrations and the row-level security policies |
| `npm run db:seed` | Seed the demo company (idempotent) |
| `npm run db:reset` | Drop the local database and seed it again |

## What is in the repo

```
apps/
  api/        Hono HTTP API on Node. Auth, every route, realtime events, file storage.
  web/        Vite + React app: office screens, the tech phone screens, customer pages.
packages/
  shared/     Types, enums, zod schemas and the money/time business rules. No I/O. Tested.
  db/         Drizzle schema, migrations, row-level security, seed and reset scripts.
design/
  redesign-2026-10/   The approved design mockups, design system CSS and the feature research.
docs/         Architecture, data model, design system, features, roadmap, decisions, AI handoff.
```

## Configuration

Copy `.env.example` to `.env` to change anything. Every value has a local default. Set `DATABASE_URL` to use a hosted Postgres instead of PGlite; add provider keys to turn on texting (Twilio), payments (Stripe), accounting (QuickBooks Online), drive times (Google Maps) and sign-in (Clerk). Without keys the app still runs: texts are recorded as delivered by a demo provider and Settings shows each integration as not connected.

## Status

This is a working product on local data, not yet deployed. [docs/ROADMAP.md](docs/ROADMAP.md) lists what stands between here and production, and [docs/FEATURES.md](docs/FEATURES.md) tracks the twenty researched features and how far each one is built.
