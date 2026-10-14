import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./api";

/**
 * One server-sent-events stream per browser. Any event invalidates the queries that could have changed,
 * so the board, lists and records refresh when another person changes something.
 */
export function useRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    const source = new EventSource(api.eventsUrl(), { withCredentials: true });
    let timer: number | undefined;
    const invalidate = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" }), 150);
    };
    const types = ["work_order.created", "work_order.updated", "customer.created", "customer.updated", "quote.created", "quote.updated", "purchase_order.created", "purchase_order.updated", "invoice.created", "invoice.updated", "inventory.updated", "agreement.created", "agreement.updated", "message.sent", "time.updated", "tech.location", "tech.updated", "follow_up.updated", "settings.updated"];
    for (const type of types) source.addEventListener(type, invalidate);
    return () => {
      window.clearTimeout(timer);
      source.close();
    };
  }, [enabled, queryClient]);
}

/** Online state for the sync pill on the phone. */
export function useOnline(): boolean {
  const query = useQueryClient();
  void query;
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}
