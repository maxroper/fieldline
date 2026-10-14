/**
 * Runtime settings. Read from the process environment on Node (the entry point loads the repo-root
 * `.env` first) and from `globalThis.__FIELDLINE_ENV__` when the API runs inside a browser for the
 * static demo. Nothing here touches Node-only modules, so every route stays runtime-agnostic.
 */
type Source = Record<string, string | undefined>;

const globals = globalThis as { process?: { env?: Source }; __FIELDLINE_ENV__?: Source };
const source: Source = globals.process?.env ?? globals.__FIELDLINE_ENV__ ?? {};

const twilio = { sid: source.TWILIO_ACCOUNT_SID ?? "", token: source.TWILIO_AUTH_TOKEN ?? "", from: source.TWILIO_FROM_NUMBER ?? "" };

export const env = {
  port: Number(source.API_PORT ?? 8787),
  sessionSecret: source.SESSION_SECRET ?? "dev-only-change-me",
  /** Relative to the repo root; the Node entry resolves it for the disk storage adapter. */
  filesDir: source.FILES_DIR ?? "data/files",
  corsOrigins: (source.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
  databaseUrl: source.DATABASE_URL ?? null,
  production: source.NODE_ENV === "production",
  /** The in-browser demo: no network, PGlite in IndexedDB, memory file storage. */
  demo: source.FIELDLINE_DEMO === "1",
  twilio,
  integrations: {
    twilio: Boolean(twilio.sid && twilio.token && twilio.from),
    stripe: Boolean(source.STRIPE_SECRET_KEY),
    quickbooks: Boolean(source.QBO_CLIENT_ID && source.QBO_CLIENT_SECRET),
    maps: Boolean(source.GOOGLE_MAPS_API_KEY),
    clerk: Boolean(source.CLERK_SECRET_KEY),
  },
};
