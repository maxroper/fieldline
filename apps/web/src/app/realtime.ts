import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./api";
import { demoSubscribe } from "./demo-state";
import { isDemo } from "./transport";

const TYPES = ["work_order.created", "work_order.updated", "customer.created", "customer.updated", "quote.created", "quote.updated", "purchase_order.created", "purchase_order.updated", "invoice.created", "invoice.updated", "inventory.updated", "agreement.created", "agreement.updated", "message.sent", "time.updated", "tech.location", "tech.updated", "follow_up.updated", "settings.updated"];

/**
 * One server-sent-events stream per browser. Any event invalidates the queries that could have changed,
 * so the board, lists and records refresh when another person changes something. The static demo has
 * no server, so it listens to the in-page app's event bus instead.
 */
export function useRealtime(enabled: boolean, orgId?: string | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const invalidate = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" }), 150);
    };
    if (isDemo) {
      if (!orgId) return;
      const unsubscribe = demoSubscribe(orgId, (event) => {
        if (TYPES.includes(event.type)) invalidate();
      });
      return () => {
        window.clearTimeout(timer);
        unsubscribe();
      };
    }
    if (typeof EventSource === "undefined") return;
    const source = new EventSource(api.eventsUrl(), { withCredentials: true });
    for (const type of TYPES) source.addEventListener(type, invalidate);
    return () => {
      window.clearTimeout(timer);
      source.close();
    };
  }, [enabled, orgId, queryClient]);
}
