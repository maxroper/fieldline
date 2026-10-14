import { schema as s, type Connection } from "@fieldline/db";
import { companyDay, isoDate } from "@fieldline/shared";
import { and, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { jsonBody, parse } from "../http";
import { publish } from "../realtime";
import { workOrderQuery } from "./work-orders";

const itemAction = z.object({ action: z.enum(["snooze", "done", "skip", "reopen"]), until: isoDate.optional() });

/**
 * The follow-up queue is derived: work orders with a wait reason, quotes waiting on the customer,
 * lump-sum purchase orders waiting for a pack list, and the follow_up_items table for the rest.
 */
export function followUpsRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/", async (c) => {
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const wos = await workOrderQuery(tx).where(and(eq(s.workOrders.status, "open"), or(isNotNull(s.workOrders.followUp), eq(s.workOrders.needReturn, true), eq(s.workOrders.waitingOnParts, true))!)).orderBy(s.workOrders.createdAt);
      const quotes = await tx
        .select({ q: s.quotes, customerName: s.customers.name, siteName: s.sites.name })
        .from(s.quotes)
        .leftJoin(s.customers, eq(s.customers.id, s.quotes.customerId))
        .leftJoin(s.sites, eq(s.sites.id, s.quotes.siteId))
        .where(inArray(s.quotes.status, ["sent", "viewed", "follow_up"]))
        .orderBy(s.quotes.followUpDate);
      const pos = await tx.select({ po: s.purchaseOrders, number: s.workOrders.number }).from(s.purchaseOrders).leftJoin(s.workOrders, eq(s.workOrders.id, s.purchaseOrders.workOrderId)).where(and(eq(s.purchaseOrders.lumpSum, true), isNotNull(s.purchaseOrders.remindAt), inArray(s.purchaseOrders.status, ["issued", "partial"]))).orderBy(s.purchaseOrders.remindAt);
      const items = await tx.select({ item: s.followUpItems, customerName: s.customers.name }).from(s.followUpItems).leftJoin(s.customers, eq(s.customers.id, s.followUpItems.customerId)).where(and(inArray(s.followUpItems.status, ["open", "snoozed"]), or(sql`${s.followUpItems.snoozedUntil} is null`, sql`${s.followUpItems.snoozedUntil} <= ${today}`)!)).orderBy(s.followUpItems.dueOn);
      const automations = await tx.select().from(s.automations).orderBy(s.automations.key);
      const overdue = (date: string | null | undefined) => Boolean(date && date < today);
      return {
        today,
        workOrders: wos.map((w) => ({ ...w, overdue: overdue(w.followUp?.date ?? w.followUp?.expectedDate) })),
        quotes: quotes.map((row) => ({ ...row.q, customerName: row.customerName, siteName: row.siteName, overdue: overdue(row.q.followUpDate) })),
        purchaseOrders: pos.map((row) => ({ ...row.po, workOrderNumber: row.number, overdue: Boolean(row.po.remindAt && row.po.remindAt < nowIso()) })),
        items: items.map((row) => ({ ...row.item, customerName: row.customerName, overdue: overdue(row.item.dueOn) })),
        automations,
        counts: {
          overdue: wos.filter((w) => overdue(w.followUp?.date ?? w.followUp?.expectedDate)).length + quotes.filter((q) => overdue(q.q.followUpDate)).length + items.filter((i) => overdue(i.item.dueOn)).length,
          dueToday: wos.filter((w) => (w.followUp?.date ?? w.followUp?.expectedDate) === today).length + quotes.filter((q) => q.q.followUpDate === today).length + items.filter((i) => i.item.dueOn === today).length,
          total: wos.length + quotes.length + pos.length + items.length,
        },
      };
    });
    return c.json(data);
  });

  r.post("/items/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(itemAction, await jsonBody(c));
    await run(c, async (tx) => {
      if (body.action === "snooze") await tx.update(s.followUpItems).set({ status: "snoozed", snoozedUntil: body.until ?? null }).where(eq(s.followUpItems.id, id));
      else if (body.action === "reopen") await tx.update(s.followUpItems).set({ status: "open", snoozedUntil: null, doneAt: null }).where(eq(s.followUpItems.id, id));
      else await tx.update(s.followUpItems).set({ status: body.action === "done" ? "done" : "skipped", doneAt: nowIso() }).where(eq(s.followUpItems.id, id));
    });
    publish(c.get("session").orgId, "follow_up.updated", id);
    return c.json({ ok: true });
  });

  /** Parts arrived: clear the wait so the job goes back to the open queue. */
  r.post("/work-orders/:id/parts-received", async (c) => {
    const id = c.req.param("id");
    await run(c, async (tx, session) => {
      await tx.update(s.workOrders).set({ waitingOnParts: false, followUp: null, updatedAt: nowIso() }).where(eq(s.workOrders.id, id));
      await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "work_order", entityId: id, field: "waitingOnParts", fromValue: "true", toValue: "false", userId: session.userId });
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ ok: true });
  });

  r.get("/recent", async (c) => {
    const rows = await run(c, (tx) => tx.select().from(s.followUpItems).where(inArray(s.followUpItems.status, ["done", "skipped"])).orderBy(desc(s.followUpItems.doneAt)).limit(20));
    return c.json({ items: rows });
  });

  return r;
}
