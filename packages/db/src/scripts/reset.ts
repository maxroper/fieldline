import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateAll } from "./migrate";
import { seed } from "./seed";

/** Local only: delete the PGlite folder, migrate, seed. Refuses to run against DATABASE_URL. */
if (process.env.DATABASE_URL) {
  console.error("db:reset only resets the local PGlite database. Unset DATABASE_URL.");
  process.exit(1);
}
const dir = process.env.PGLITE_DIR ?? resolve(fileURLToPath(new URL("../../../../data/pglite", import.meta.url)));
rmSync(dir, { recursive: true, force: true });
const conn = await migrateAll({ pgliteDir: dir });
await seed(conn.db);
await conn.close();
console.log("reset: migrated and seeded the local database");
