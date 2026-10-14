import type { Role } from "@fieldline/shared";
import { OFFICE_ROLES } from "@fieldline/shared";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { env } from "./env";

/**
 * Sessions are a signed cookie carrying the user, organization and role. Signing in is a
 * development-only email login until a real identity provider is connected (see docs/ARCHITECTURE.md,
 * "Auth"). The hook for Clerk is `verifyExternalToken` below.
 */
export interface Session {
  userId: string;
  orgId: string;
  role: Role;
  name: string;
  exp: number;
}

export type Vars = { session: Session };

const COOKIE = "fl_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 14;

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

export function encodeSession(session: Omit<Session, "exp">): string {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    if (!session.userId || !session.orgId || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSessionCookie(c: Context, session: Omit<Session, "exp">) {
  setCookie(c, COOKIE, encodeSession(session), { httpOnly: true, sameSite: "Lax", path: "/", maxAge: TTL_MS / 1000, secure: env.production });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export function readSession(c: Context): Session | null {
  const bearer = c.req.header("authorization");
  if (bearer?.startsWith("Bearer ")) return decodeSession(bearer.slice(7));
  return decodeSession(getCookie(c, COOKIE));
}

/** Every /api route except /api/auth/* and /api/public/* needs a session. */
export const requireSession: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const session = readSession(c);
  if (!session) throw new HTTPException(401, { message: "Sign in required" });
  c.set("session", session);
  await next();
};

export function requireRole(...roles: Role[]): MiddlewareHandler<{ Variables: Vars }> {
  return async (c, next) => {
    const session = c.get("session");
    if (!roles.includes(session.role)) throw new HTTPException(403, { message: "Your role cannot do that" });
    await next();
  };
}

export const requireOffice: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const session = c.get("session");
  if (!OFFICE_ROLES.includes(session.role)) throw new HTTPException(403, { message: "Office only" });
  await next();
};

export function canBill(session: Session, userFlag: boolean | null | undefined): boolean {
  return userFlag ?? (session.role === "admin" || session.role === "supervisor" || session.role === "billing");
}

export function canEditCustomers(session: Session, userFlag: boolean | null | undefined): boolean {
  return userFlag ?? (session.role === "admin" || session.role === "supervisor" || session.role === "customer_service");
}

/**
 * Where an external identity provider plugs in. With CLERK_SECRET_KEY set, verify the provider's
 * token here, map `sub` to users.auth_subject, and return the user id. Not implemented in this pass.
 */
export async function verifyExternalToken(_token: string): Promise<{ authSubject: string } | null> {
  return null;
}
