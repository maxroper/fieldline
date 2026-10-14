import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = PgTransaction<PgQueryResultHKT, typeof schema, Record<string, never>>;
export type DbOrTx = Db | Tx;

export interface Connection {
  db: Db;
  kind: "pglite" | "postgres";
  /** Apply pending migrations from packages/db/drizzle. */
  migrate: () => Promise<void>;
  close: () => Promise<void>;
}

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, "../drizzle");

/**
 * Open the database. With DATABASE_URL set, a hosted Postgres over `pg`; otherwise the embedded
 * PGlite Postgres stored in ./data/pglite at the repo root (or in memory for tests with ":memory:").
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

export interface OrgContext {
  orgId: string;
  userId?: string | null;
}

/**
 * Run a function inside a transaction scoped to one organization. Row-level security policies read
 * `app.org_id`, so every query inside sees only that organization's rows, no matter what the code forgets.
 */
export async function withOrg<T>(db: Db, ctx: OrgContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.org_id', ${ctx.orgId}, true), set_config('app.user_id', ${ctx.userId ?? ""}, true)`);
    return fn(tx as unknown as Tx);
  });
}

/**
 * Run a function with row-level security bypassed. Only for sign-in (finding the user before the
 * organization is known), migrations and seeds. Never from a request handler that has a user.
 */
export async function withBypass<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return fn(tx as unknown as Tx);
  });
}

/** Next business number for an org (work order, quote, purchase order, invoice, credit). Atomic. */
export async function nextNumber(tx: DbOrTx, orgId: string, key: "work_order" | "quote" | "purchase_order" | "invoice" | "credit"): Promise<number> {
  const rows = await tx.execute(sql`
    insert into counters (org_id, key, value) values (${orgId}, ${key}, 1001)
    on conflict (org_id, key) do update set value = counters.value + 1
    returning value
  `);
  const first = (rows as unknown as { rows?: { value: number }[] }).rows?.[0] ?? (rows as unknown as { value: number }[])[0];
  return Number(first?.value ?? 1001);
}

export { schema, sql };
