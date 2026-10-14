import type { Connection } from "@fieldline/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requireSession, type Vars } from "./auth";
import { env } from "./env";
import { agreementsRoutes } from "./routes/agreements";
import { authRoutes } from "./routes/auth";
import { billingRoutes } from "./routes/billing";
import { customersRoutes } from "./routes/customers";
import { dispatchRoutes } from "./routes/dispatch";
import { eventsRoutes } from "./routes/events";
import { filesRoutes } from "./routes/files";
import { followUpsRoutes } from "./routes/followups";
import { inventoryRoutes } from "./routes/inventory";
import { messagesRoutes } from "./routes/messages";
import { publicRoutes } from "./routes/public";
import { purchasingRoutes } from "./routes/purchasing";
import { quotesRoutes } from "./routes/quotes";
import { reportsRoutes } from "./routes/reports";
import { settingsRoutes } from "./routes/settings";
import { techsRoutes } from "./routes/techs";
import { timeRoutes } from "./routes/time";
import { workOrdersRoutes } from "./routes/work-orders";

export type AppEnv = { Variables: Vars };

/** Build the app around a database connection, so tests can pass an in-memory one. */
export function createApp(conn: Connection) {
  const app = new Hono<AppEnv>();
  if (!env.production) app.use(logger());
  app.use("/api/*", cors({ origin: env.corsOrigins, credentials: true }));

  app.get("/api/health", (c) => c.json({ ok: true, database: conn.kind, time: new Date().toISOString() }));
  app.route("/api/auth", authRoutes(conn));
  app.route("/api/public", publicRoutes(conn));

  const authed = new Hono<AppEnv>();
  authed.use("*", requireSession);
  authed.route("/events", eventsRoutes());
  authed.route("/dispatch", dispatchRoutes(conn));
  authed.route("/work-orders", workOrdersRoutes(conn));
  authed.route("/customers", customersRoutes(conn).customers);
  authed.route("/sites", customersRoutes(conn).sites);
  authed.route("/equipment", customersRoutes(conn).equipment);
  authed.route("/techs", techsRoutes(conn));
  authed.route("/time", timeRoutes(conn));
  authed.route("/follow-ups", followUpsRoutes(conn));
  authed.route("/quotes", quotesRoutes(conn).quotes);
  authed.route("/pricebook", quotesRoutes(conn).pricebook);
  authed.route("/purchasing", purchasingRoutes(conn));
  authed.route("/inventory", inventoryRoutes(conn));
  authed.route("/billing", billingRoutes(conn));
  authed.route("/agreements", agreementsRoutes(conn));
  authed.route("/messages", messagesRoutes(conn));
  authed.route("/reports", reportsRoutes(conn));
  authed.route("/settings", settingsRoutes(conn));
  authed.route("/files", filesRoutes(conn));
  app.route("/api", authed);

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message, issues: err.cause ?? undefined }, err.status);
    }
    console.error(err);
    return c.json({ error: env.production ? "Server error" : String(err) }, 500);
  });
  return app;
}
