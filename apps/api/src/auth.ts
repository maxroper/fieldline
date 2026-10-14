import type { Role } from "@fieldline/shared";
import { OFFICE_ROLES } from "@fieldline/shared";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import { env } from "./env";

/**
 * Sessions are a signed cookie carrying the user, organization and role. Signing in is a
 * development-only user picker until a real identity provider is connected (see docs/ARCHITECTURE.md,
 * "Auth"). The hook for Clerk is `verifyExternalToken` below.
 *
 * Signing uses Web Crypto (HMAC-SHA256) so the same code runs on Node and inside the browser demo.
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
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

let keyPromise: Promise<CryptoKey> | null = null;
function signingKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey("raw", encoder.encode(env.sessionSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return keyPromise;
}

async function sign(payload: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Constant-time string comparison. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function encodeSession(session: Omit<Session, "exp">): Promise<string> {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ ...session, exp: Date.now() + TTL_MS })));
  return `${payload}.${await sign(payload)}`;
}

export async function decodeSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (!same(signature, await sign(payload))) return null;
  try {
    const session = JSON.parse(decoder.decode(fromBase64Url(payload))) as Session;
    if (!session.userId || !session.orgId || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function setSessionCookie(c: Context, session: Omit<Session, "exp">): Promise<void> {
  setCookie(c, COOKIE, await encodeSession(session), { httpOnly: true, sameSite: "Lax", path: "/", maxAge: TTL_MS / 1000, secure: env.production });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export async function readSession(c: Context): Promise<Session | null> {
  const bearer = c.req.header("authorization");
  if (bearer?.startsWith("Bearer ")) return decodeSession(bearer.slice(7));
  return decodeSession(getCookie(c, COOKIE));
}

/** Every /api route except /api/auth/* and /api/public/* needs a session. */
export const requireSession: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const session = await readSession(c);
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
