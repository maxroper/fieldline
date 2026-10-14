import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Connection, Db } from "./core";
import * as schema from "./schema";

export * from "./core";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../drizzle");

/**
 * Open the database on Node. With DATABASE_URL set, a hosted Postgres over `pg`; otherwise the embedded
 * PGlite Postgres stored in ./data/pglite at the repo root (or in memory for tests with ":memory:").
 * Browsers use `browser.ts` instead; this module imports Node-only packages.
 */
export async function connect(options: { url?: string | null; pgliteDir?: string } = {}): Promise<Connection> {
  const url = options.url === undefined ? process.env.DATABASE_URL : options.url;
  if (url) {
    const pool = new pg.Pool({ connectionString: url, max: 10 });
    const db = drizzlePg(pool, { schema, casing: "snake_case" }) as unknown as Db;
    return {
      db,
      kind: "postgres",
      migrate: () => migratePg(db as never, { migrationsFolder }),
      close: () => pool.end(),
    };
  }
  const dir = options.pgliteDir ?? process.env.PGLITE_DIR ?? resolve(here, "../../../data/pglite");
  if (dir !== ":memory:") mkdirSync(dirname(dir), { recursive: true });
  const client = dir === ":memory:" ? new PGlite() : new PGlite(dir);
  const db = drizzlePglite(client, { schema, casing: "snake_case" }) as unknown as Db;
  return {
    db,
    kind: "pglite",
    migrate: () => migratePglite(db as never, { migrationsFolder }),
    close: () => client.close(),
  };
}
