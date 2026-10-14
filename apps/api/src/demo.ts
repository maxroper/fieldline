import { applyRls } from "@fieldline/db";
import { connectBrowser } from "@fieldline/db/browser";
import { seedDemo } from "@fieldline/db/seed";
import { createApp } from "./app";
import { memoryStorage, setStorage } from "./storage";

export { subscribe } from "./realtime";

/**
 * The whole API inside a browser, for the static demo on GitHub Pages: PGlite in IndexedDB, the
 * bundled migrations, row-level security, the demo seed, memory file storage, and the same Hono app
 * the server runs. The web app calls `app.fetch(request)` instead of the network.
 */
export async function createDemoApp(options: { dataDir?: string } = {}) {
  setStorage(memoryStorage());
  const conn = await connectBrowser({ dataDir: options.dataDir ?? "idb://fieldline-demo" });
  await conn.migrate();
  await applyRls(conn.db);
  await seedDemo(conn.db);
  return { app: createApp(conn), conn };
}
