import { applyRls } from "@fieldline/db";
import { connectBrowser } from "@fieldline/db/browser";
import { SEED_VERSION, seedDemo } from "@fieldline/db/seed";
import { createApp } from "./app";
import { memoryStorage, setStorage } from "./storage";

export { subscribe } from "./realtime";

/**
 * The whole API inside a browser, for the static demo on GitHub Pages: PGlite in IndexedDB, the
 * bundled migrations, row-level security, the demo seed, memory file storage, and the same Hono app
 * the server runs. The web app calls `app.fetch(request)` instead of the network.
 */
const DB_NAME = `fieldline-demo-v${SEED_VERSION}`;

/** Drop demo databases from earlier seed versions so a visitor sees the current company, not a stale copy. */
async function dropOldDemoDatabases(): Promise<void> {
  if (typeof indexedDB === "undefined" || !indexedDB.databases) return;
  const names = (await indexedDB.databases()).map((d) => d.name ?? "");
  const stale = names.filter((n) => n.includes("fieldline-demo") && !n.endsWith(DB_NAME));
  await Promise.all(stale.map((name) => new Promise<void>((resolve) => { const req = indexedDB.deleteDatabase(name); req.onsuccess = req.onerror = req.onblocked = () => resolve(); })));
}

export async function createDemoApp(options: { dataDir?: string } = {}) {
  setStorage(memoryStorage());
  if (!options.dataDir) await dropOldDemoDatabases();
  const conn = await connectBrowser({ dataDir: options.dataDir ?? `idb://${DB_NAME}` });
  await conn.migrate();
  await applyRls(conn.db);
  await seedDemo(conn.db);
  return { app: createApp(conn), conn };
}
