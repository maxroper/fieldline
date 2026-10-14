import { serve } from "@hono/node-server";
import { applyRls, connect } from "@fieldline/db";
import { createApp } from "./app";
import { env } from "./env";

const conn = await connect({ url: env.databaseUrl });
await conn.migrate();
await applyRls(conn.db);
const app = createApp(conn);

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`fieldline api on http://localhost:${info.port} (${conn.kind})`);
});
