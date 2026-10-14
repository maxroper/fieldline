import { sql } from "drizzle-orm";
import { connect, type Db } from "../client";
import { RLS_STATEMENTS } from "../rls";

/** Schema migrations first (drizzle-kit output), then the row-level security policies. Idempotent. One statement per round trip. */
export async function applyRls(db: Db): Promise<void> {
  for (const statement of RLS_STATEMENTS) await db.execute(sql.raw(statement));
}

export async function migrateAll(options?: { url?: string | null; pgliteDir?: string }) {
  const conn = await connect(options);
  await conn.migrate();
  await applyRls(conn.db);
  return conn;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (isMain) {
  try {
    process.loadEnvFile?.(new URL("../../../../.env", import.meta.url).pathname);
  } catch {
    /* no .env: defaults apply */
  }
  const conn = await migrateAll();
  console.log(`migrated (${conn.kind})`);
  await conn.close();
}
