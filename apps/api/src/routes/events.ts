import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppEnv } from "../app";
import { subscribe } from "../realtime";

/** GET /api/events: server-sent events for the signed-in user's organization. */
export function eventsRoutes() {
  const r = new Hono<AppEnv>();
  r.get("/", (c) => {
    const session = c.get("session");
    return streamSSE(c, async (stream) => {
      let open = true;
      const unsubscribe = subscribe(session.orgId, (event) => {
        if (!open) return;
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      });
      stream.onAbort(() => {
        open = false;
        unsubscribe();
      });
      await stream.writeSSE({ event: "hello", data: JSON.stringify({ at: new Date().toISOString() }) });
      while (open) {
        await stream.sleep(25000);
        if (open) await stream.writeSSE({ event: "ping", data: "" });
      }
    });
  });
  return r;
}
