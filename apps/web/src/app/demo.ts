import { setDemoSubscribe, useDemo } from "./demo-state";
import { setTransport } from "./transport";

/**
 * The static demo: the whole API runs inside the page (Hono + PGlite in IndexedDB + the seed) and
 * requests never leave the browser. `installDemo()` is called from `main.tsx` only when the build was
 * made with VITE_DEMO=1, so the normal build never loads this module or the API bundle.
 *
 * Sessions: browsers drop `Set-Cookie` on responses built in the page and `Cookie` on requests built in
 * the page, so the demo keeps the session as a bearer token (the API accepts both). It lives in
 * sessionStorage, so a reload keeps you signed in and closing the tab signs you out. Each visitor gets
 * their own copy of the demo company; clearing site data resets it.
 */
type DemoApp = { fetch: (request: Request) => Response | Promise<Response> };

const TOKEN_KEY = "fl.demo.token";
let appPromise: Promise<DemoApp> | null = null;

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* private mode: the session lasts for this page only */
  }
}

async function boot(): Promise<DemoApp> {
  useDemo.setState({ booting: true, error: null });
  try {
    (globalThis as { __FIELDLINE_ENV__?: Record<string, string> }).__FIELDLINE_ENV__ = { FIELDLINE_DEMO: "1", CORS_ORIGINS: location.origin, SESSION_SECRET: "demo" };
    const demo = await import("@fieldline/api/demo");
    const { app } = await demo.createDemoApp();
    setDemoSubscribe((orgId, listener) => demo.subscribe(orgId, listener));
    useDemo.setState({ booting: false, ready: true });
    return app;
  } catch (err) {
    useDemo.setState({ booting: false, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const app = await (appPromise ??= boot());
  const headers = new Headers(init.headers);
  const token = readToken();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const method = init.method ?? "GET";
  const response = await app.fetch(new Request(`http://demo.local${path}`, { method, headers, body: init.body ?? null }));
  if (method === "POST" && path.endsWith("/auth/dev-login") && response.ok) {
    const data = (await response.clone().json()) as { token?: string };
    if (data.token) writeToken(data.token);
  }
  if (method === "POST" && path.endsWith("/auth/logout")) writeToken(null);
  return response;
}

/** Replace the network with the in-page app and start it so the first screen is quick. */
export function installDemo(): void {
  setTransport((path, init) => demoFetch(`/api${path}`, init));
  void (appPromise ??= boot());
}
