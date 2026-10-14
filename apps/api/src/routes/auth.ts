import { withBypass, schema, type Connection } from "@fieldline/db";
import { devLogin } from "@fieldline/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../app";
import { clearSessionCookie, readSession, setSessionCookie } from "../auth";
import { env } from "../env";
import { jsonBody, parse } from "../http";

/**
 * Development sign-in: pick a seeded user. There is no password yet; see docs/ARCHITECTURE.md "Auth"
 * for how a real provider replaces `/dev-login`. The user list is hidden in production.
 */
export function authRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();

  r.get("/users", async (c) => {
    if (env.production) throw new HTTPException(404, { message: "Not found" });
    const rows = await withBypass(conn.db, (tx) =>
      tx
        .select({ id: schema.users.id, name: schema.users.name, role: schema.users.role, title: schema.users.title, orgId: schema.users.orgId, orgName: schema.orgs.name })
        .from(schema.users)
        .innerJoin(schema.orgs, eq(schema.orgs.id, schema.users.orgId))
        .where(eq(schema.users.active, true))
        .orderBy(schema.orgs.name, schema.users.role, schema.users.name),
    );
    return c.json({ users: rows });
  });

  r.post("/dev-login", async (c) => {
    if (env.production) throw new HTTPException(404, { message: "Not found" });
    const body = parse(devLogin, await jsonBody(c));
    const [user] = await withBypass(conn.db, (tx) => tx.select().from(schema.users).where(eq(schema.users.id, body.userId)).limit(1));
    if (!user || !user.active) throw new HTTPException(401, { message: "Unknown user" });
    const session = { userId: user.id, orgId: user.orgId, role: user.role, name: user.name };
    setSessionCookie(c, session);
    await withBypass(conn.db, (tx) => tx.update(schema.users).set({ lastActiveAt: new Date().toISOString() }).where(eq(schema.users.id, user.id)));
    return c.json({ session });
  });

  r.post("/logout", (c) => {
    clearSessionCookie(c);
    return c.json({ ok: true });
  });

  r.get("/me", async (c) => {
    const session = readSession(c);
    if (!session) return c.json({ session: null });
    const [user] = await withBypass(conn.db, (tx) => tx.select().from(schema.users).where(eq(schema.users.id, session.userId)).limit(1));
    const [org] = await withBypass(conn.db, (tx) => tx.select({ id: schema.orgs.id, name: schema.orgs.name, city: schema.orgs.city, timezone: schema.orgs.timezone }).from(schema.orgs).where(eq(schema.orgs.id, session.orgId)).limit(1));
    return c.json({ session, user: user ? { id: user.id, name: user.name, role: user.role, title: user.title, teamId: user.teamId, homeTeamId: user.homeTeamId, canBill: user.canBill, canEditCustomers: user.canEditCustomers } : null, org: org ?? null });
  });

  return r;
}
