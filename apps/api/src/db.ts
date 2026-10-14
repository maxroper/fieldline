import { withOrg, type Connection, type Tx } from "@fieldline/db";
import type { Context } from "hono";
import type { AppEnv } from "./app";

/** Run a handler body inside the caller's organization transaction. */
export function scoped(conn: Connection) {
  return <T>(c: Context<AppEnv>, fn: (tx: Tx, session: AppEnv["Variables"]["session"]) => Promise<T>): Promise<T> => {
    const session = c.get("session");
    return withOrg(conn.db, { orgId: session.orgId, userId: session.userId }, (tx) => fn(tx, session));
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}
