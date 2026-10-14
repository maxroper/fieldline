/**
 * How API requests leave the page. The default is `fetch` to the same-origin `/api` (the Vite dev
 * proxy, or the API served next to the static files). The static demo replaces it with a function
 * that calls the in-browser Hono app directly; see `demo.ts`.
 */
export type Transport = (path: string, init?: RequestInit) => Promise<Response>;

export const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

let current: Transport = (path, init = {}) => fetch(`${apiBase}/api${path}`, { ...init, credentials: "include" });

export function setTransport(next: Transport): void {
  current = next;
}

export function transport(path: string, init?: RequestInit): Promise<Response> {
  return current(path, init);
}

/** True when this build runs the API inside the browser (GitHub Pages demo). Fixed at build time. */
export const isDemo = import.meta.env.VITE_DEMO === "1";
