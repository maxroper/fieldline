import { connect } from "../client";
import { applyRls } from "../rls";

export { applyRls };

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
