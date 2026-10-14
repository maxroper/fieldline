import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Runtime-agnostic database helpers: the connection shape, organization scoping, bypass for the few
 * places that need it, and business numbers. `client.ts` (Node) and `browser.ts` (the static demo)
 * each produce a `Connection`; everything else works through this module.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Tx = PgTransaction<PgQueryResultHKT, typeof schema, Record<string, never>>;
export type DbOrTx = Db | Tx;

export interface Connection {
  db: Db;
  kind: "pglite" | "postgres";
  /** Apply pending migrations. */
  migrate: () => Promise<void>;
  close: () => Promise<void>;
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
 * organization is known), migrations, seeds and the customer token routes. Never from a request handler that has a user.
 */
export async function withBypass<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.bypass_rls', 'on', true)`);
    return fn(tx as unknown as Tx);
  });
}

/** Rows from `db.execute`, whichever driver shape comes back. */
export function rowsOf<T>(result: unknown): T[] {
  const r = result as { rows?: T[] } | T[];
  return Array.isArray(r) ? r : (r.rows ?? []);
}

/** Next business number for an org (work order, quote, purchase order, invoice, credit). Atomic. */
export async function nextNumber(tx: DbOrTx, orgId: string, key: "work_order" | "quote" | "purchase_order" | "invoice" | "credit"): Promise<number> {
  const rows = rowsOf<{ value: number }>(
    await tx.execute(sql`
      insert into counters (org_id, key, value) values (${orgId}, ${key}, 1001)
      on conflict (org_id, key) do update set value = counters.value + 1
      returning value
    `),
  );
  return Number(rows[0]?.value ?? 1001);
}
