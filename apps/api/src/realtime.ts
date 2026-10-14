/**
 * Server-sent events, one stream per signed-in browser, fanned out per organization.
 * The web app invalidates its queries when an event arrives, so two dispatchers see each other's moves.
 * In-memory: fine for one API process. Move to Postgres NOTIFY or a broker when there are several.
 */
export interface RealtimeEvent {
  type: string;
  id?: string;
  at: string;
  data?: Record<string, unknown>;
}

type Listener = (event: RealtimeEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function subscribe(orgId: string, listener: Listener): () => void {
  let set = listeners.get(orgId);
  if (!set) {
    set = new Set();
    listeners.set(orgId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(orgId);
  };
}

export function publish(orgId: string, type: string, id?: string, data?: Record<string, unknown>): void {
  const set = listeners.get(orgId);
  if (!set) return;
  const event: RealtimeEvent = { type, id, at: new Date().toISOString(), data };
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      /* a dead stream is removed by its own close handler */
    }
  }
}
