/** Command-line entry for `npm run db:seed`. Kept apart from seed.ts so the seed itself stays browser-safe. */
import { connect } from "../client";
import { seed } from "./seed";

try {
  process.loadEnvFile?.(new URL("../../../../.env", import.meta.url).pathname);
} catch {
  /* no .env */
}
const conn = await connect();
await conn.migrate();
await seed(conn.db);
await conn.close();
