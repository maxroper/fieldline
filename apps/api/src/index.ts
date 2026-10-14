/**
 * The Node entry point. Loads `.env`, installs the disk storage adapter, opens the database,
 * applies migrations and row-level security, and serves the app. Everything is imported after the
 * environment is loaded so `env.ts` sees the file's values.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
try {
  process.loadEnvFile?.(resolve(repoRoot, ".env"));
} catch {
  /* no .env: defaults apply */
}

const [{ env }, { createApp }, { connect }, { applyRls }, { setStorage }, { localDiskStorage }, { serve }] = await Promise.all([
  import("./env"),
  import("./app"),
  import("@fieldline/db/node"),
  import("@fieldline/db"),
  import("./storage"),
  import("./storage-node"),
  import("@hono/node-server"),
]);

setStorage(localDiskStorage(resolve(repoRoot, env.filesDir)));
const conn = await connect({ url: env.databaseUrl });
await conn.migrate();
await applyRls(conn.db);
const app = createApp(conn);

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`fieldline api on http://localhost:${info.port} (${conn.kind})`);
});
