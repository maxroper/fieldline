import { create } from "zustand";

/**
 * State the static demo shares with ordinary screens: whether the in-browser database is still
 * starting, object URLs for files it serves, and the in-process realtime subscription. Kept apart
 * from `demo.ts` so screens can import it without pulling the API bundle into the normal build.
 */
interface DemoState {
  booting: boolean;
  ready: boolean;
  error: string | null;
  fileUrls: Record<string, string>;
}

export const useDemo = create<DemoState>(() => ({ booting: false, ready: false, error: null, fileUrls: {} }));

type Subscribe = (orgId: string, listener: (event: { type: string; id?: string }) => void) => () => void;
let subscribeImpl: Subscribe | null = null;

export function setDemoSubscribe(fn: Subscribe): void {
  subscribeImpl = fn;
}

export function demoSubscribe(orgId: string, listener: (event: { type: string; id?: string }) => void): () => void {
  return subscribeImpl ? subscribeImpl(orgId, listener) : () => undefined;
}

/** Wipe the in-browser database (and anything PGlite stored) and start over. */
export async function resetDemoData(): Promise<void> {
  const names = (await (indexedDB.databases?.() ?? Promise.resolve([]))).map((d) => d.name).filter((n): n is string => Boolean(n));
  const targets = new Set([...names.filter((n) => n.includes("fieldline-demo") || n.includes("pglite")), "/pglite/fieldline-demo", "fieldline-demo"]);
  await Promise.all([...targets].map((name) => new Promise<void>((resolve) => { const req = indexedDB.deleteDatabase(name); req.onsuccess = req.onerror = req.onblocked = () => resolve(); })));
  location.reload();
}
