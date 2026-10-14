import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Load the repo-root .env once. Missing file is fine: every setting has a local default.
try {
  process.loadEnvFile?.(resolve(fileURLToPath(new URL("../../../.env", import.meta.url))));
} catch {
  /* no .env */
}

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

export const env = {
  port: Number(process.env.API_PORT ?? 8787),
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-change-me",
  filesDir: process.env.FILES_DIR ? resolve(repoRoot, process.env.FILES_DIR) : resolve(repoRoot, "data/files"),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
  databaseUrl: process.env.DATABASE_URL ?? null,
  production: process.env.NODE_ENV === "production",
  integrations: {
    twilio: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    quickbooks: Boolean(process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET),
    maps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    clerk: Boolean(process.env.CLERK_SECRET_KEY),
  },
};
