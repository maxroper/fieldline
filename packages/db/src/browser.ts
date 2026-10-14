import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { rowsOf, type Connection, type Db } from "./core";
import { MIGRATIONS } from "./migrations.generated";
import * as schema from "./schema";

/**
 * The database inside a browser: PGlite persisted to IndexedDB (`idb://name`) or in memory.
 * Used by the static demo build, where the whole API runs in the page with no server.
 * Migrations come from `migrations.generated.ts`, a bundle of the drizzle SQL files, applied one
 * statement at a time and tracked in a small table so reloads are idempotent.
 */
export async function connectBrowser(options: { dataDir?: string } = {}): Promise<Connection> {
  const client = options.dataDir ? new PGlite(options.dataDir) : new PGlite();
  const db = drizzle(client, { schema, casing: "snake_case" }) as unknown as Db;
  return {
    db,
    kind: "pglite",
    migrate: () => runBundledMigrations(db),
    close: () => client.close(),
  };
}

export async function runBundledMigrations(db: Db): Promise<void> {
  await db.execute(sql`create table if not exists __fieldline_migrations (tag text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set(rowsOf<{ tag: string }>(await db.execute(sql`select tag from __fieldline_migrations`)).map((r) => r.tag));
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.tag)) continue;
    // One transaction per migration: Postgres DDL is transactional, so an interrupted first visit
    // (tab closed mid-way) leaves nothing behind and the next visit starts clean.
    await db.transaction(async (tx) => {
      for (const statement of migration.sql.split("--> statement-breakpoint")) {
        const text = statement.trim();
        if (text) await tx.execute(sql.raw(text));
      }
      await tx.execute(sql`insert into __fieldline_migrations (tag) values (${migration.tag})`);
    });
  }
}
