import { nextNumber, schema as s, type Connection } from "@fieldline/db";
import { companyDay, newId, poCreate, poReceive, poVendorInvoice } from "@fieldline/shared";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";

const LUMP_REMIND_MS = 15 * 60 * 1000;

export function purchasingRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/vendors", async (c) => {
    const rows = await run(c, (tx) => tx.select().from(s.vendors).where(eq(s.vendors.active, true)).orderBy(s.vendors.name));
    return c.json({ vendors: rows });
  });

  r.get("/", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const conds = [];
      if (q.status) conds.push(inArray(s.purchaseOrders.status, q.status.split(",") as never));
      if (q.vendorId) conds.push(eq(s.purchaseOrders.vendorId, q.vendorId));
      if (q.workOrderId) conds.push(eq(s.purchaseOrders.workOrderId, q.workOrderId));
      if (q.lines === "lump") conds.push(eq(s.purchaseOrders.lumpSum, true));
      if (q.lines === "lined") conds.push(eq(s.purchaseOrders.lumpSum, false));
      if (q.q) conds.push(or(ilike(s.purchaseOrders.vendorName, `%${q.q}%`), sql`${s.purchaseOrders.number}::text like ${"%" + q.q + "%"}`, sql`${s.workOrders.number}::text like ${"%" + q.q + "%"}`)!);
      const rows = await tx
        .select({ po: s.purchaseOrders, woNumber: s.workOrders.number, woTrip: s.workOrders.trip, woTitle: s.workOrders.title, siteName: s.sites.name, warehouseName: s.warehouses.name })
        .from(s.purchaseOrders)
        .leftJoin(s.workOrders, eq(s.workOrders.id, s.purchaseOrders.workOrderId))
        .leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId))
        .leftJoin(s.warehouses, eq(s.warehouses.id, s.purchaseOrders.warehouseId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(s.purchaseOrders.number))
        .limit(300);
      const ids = rows.map((x) => x.po.id);
      const lines = ids.length ? await tx.select().from(s.poLines).where(inArray(s.poLines.purchaseOrderId, ids)).orderBy(s.poLines.sort) : [];
      const list = rows.map((row) => {
        const mine = lines.filter((l) => l.purchaseOrderId === row.po.id);
        const cost = mine.length ? mine.reduce((sum, l) => sum + l.quantity * l.unitCost, 0) : row.po.lumpSum ? (row.po.lumpSumAmount ?? 0) : 0;
        return { ...row.po, workOrderNumber: row.woNumber, workOrderTrip: row.woTrip, workOrderTitle: row.woTitle, siteName: row.siteName, warehouseName: row.warehouseName, lines: mine, cost: Math.round(cost * 100) / 100, received: mine.reduce((sum, l) => sum + l.receivedQty * l.unitCost, 0) };
      });
      const summary = { open: list.filter((p) => p.status === "issued" || p.status === "partial").length, awaitingInvoice: list.filter((p) => p.status === "received").length, lumpReminders: list.filter((p) => p.lumpSum && p.remindAt && p.remindAt < nowIso() && p.status !== "invoiced").length, openValue: list.filter((p) => p.status !== "invoiced" && p.status !== "cancelled").reduce((sum, p) => sum + p.cost, 0) };
      return { purchaseOrders: list, summary };
    });
    return c.json(data);
  });

  r.get("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await run(c, async (tx) => {
      const [po] = await tx.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.id, id)).limit(1);
      if (!po) notFound("Purchase order not found");
      const lines = await tx.select().from(s.poLines).where(eq(s.poLines.purchaseOrderId, id)).orderBy(s.poLines.sort);
      const fileRows = await tx.select().from(s.files).where(eq(s.files.relatedId, id));
      const [wo] = po.workOrderId ? await tx.select({ id: s.workOrders.id, number: s.workOrders.number, trip: s.workOrders.trip, title: s.workOrders.title, siteId: s.workOrders.siteId }).from(s.workOrders).where(eq(s.workOrders.id, po.workOrderId)).limit(1) : [];
      return { purchaseOrder: po, lines, files: fileRows, workOrder: wo ?? null };
    });
    return c.json(data);
  });

  r.post("/", async (c) => {
    const body = parse(poCreate, await jsonBody(c));
    const created = await run(c, async (tx, session) => {
      const number = await nextNumber(tx, session.orgId, "purchase_order");
      const id = newId();
      const { lines, ...fields } = body;
      let siteId: string | null = null;
      if (fields.workOrderId) {
        const [wo] = await tx.select({ siteId: s.workOrders.siteId }).from(s.workOrders).where(eq(s.workOrders.id, fields.workOrderId)).limit(1);
        siteId = wo?.siteId ?? null;
      }
      await tx.insert(s.purchaseOrders).values({ ...fields, id, orgId: session.orgId, number, siteId, status: fields.draft ? "draft" : "issued", orderedAt: nowIso(), remindAt: fields.lumpSum ? new Date(Date.now() + LUMP_REMIND_MS).toISOString() : null, createdBy: session.userId });
      if (lines.length) await tx.insert(s.poLines).values(lines.map((l, i) => ({ ...l, orgId: session.orgId, purchaseOrderId: id, sort: i })));
      return { id, number };
    });
    publish(c.get("session").orgId, "purchase_order.created", created.id);
    return c.json(created, 201);
  });

  r.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(poCreate.partial(), await jsonBody(c));
    await run(c, async (tx, session) => {
      const { lines, ...fields } = body;
      await tx.update(s.purchaseOrders).set({ ...fields, updatedAt: nowIso() }).where(eq(s.purchaseOrders.id, id));
      if (lines) {
        const existing = await tx.select().from(s.poLines).where(eq(s.poLines.purchaseOrderId, id));
        await tx.delete(s.poLines).where(eq(s.poLines.purchaseOrderId, id));
        if (lines.length) await tx.insert(s.poLines).values(lines.map((l, i) => ({ ...l, orgId: session.orgId, purchaseOrderId: id, sort: i, receivedQty: existing[i]?.receivedQty ?? 0 })));
      }
    });
    publish(c.get("session").orgId, "purchase_order.updated", id);
    return c.json({ ok: true });
  });

  /** Receiving moves the status and, for inventory POs, puts the parts on the shelf. */
  r.post("/:id/receive", async (c) => {
    const id = c.req.param("id");
    const body = parse(poReceive, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [po] = await tx.select().from(s.purchaseOrders).where(eq(s.purchaseOrders.id, id)).limit(1);
      if (!po) notFound("Purchase order not found");
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const date = body.receivedOn ?? companyDay(new Date(), org?.timezone);
      for (const update of body.lines) {
        const [line] = await tx.select().from(s.poLines).where(eq(s.poLines.id, update.lineId)).limit(1);
        if (!line) continue;
        const delta = update.receivedQty - line.receivedQty;
        await tx.update(s.poLines).set({ receivedQty: update.receivedQty, receivedOn: date }).where(eq(s.poLines.id, line.id));
        if (po.shipTo === "inventory" && po.warehouseId && delta !== 0) {
          await tx.insert(s.inventoryTxns).values({ orgId: session.orgId, warehouseId: po.warehouseId, categoryId: line.categoryId, itemId: line.inventoryItemId, kind: "po_receipt", amount: delta * line.unitCost, quantity: delta, purchaseOrderId: id, description: `PO ${po.number} · ${line.description}`, userId: session.userId, date });
          if (line.inventoryItemId) {
            await tx
              .insert(s.inventoryStock)
              .values({ orgId: session.orgId, warehouseId: po.warehouseId, itemId: line.inventoryItemId, onHand: delta })
              .onConflictDoUpdate({ target: [s.inventoryStock.warehouseId, s.inventoryStock.itemId], set: { onHand: sql`${s.inventoryStock.onHand} + ${delta}` } });
          }
        }
      }
      const lines = await tx.select().from(s.poLines).where(eq(s.poLines.purchaseOrderId, id));
      const real = lines.filter((l) => l.quantity > 0);
      const status = real.length === 0 ? "received" : real.every((l) => l.receivedQty >= l.quantity) ? "received" : real.some((l) => l.receivedQty > 0) ? "partial" : "issued";
      await tx.update(s.purchaseOrders).set({ status, receivedAt: status === "received" ? nowIso() : po.receivedAt, receivedById: session.userId, updatedAt: nowIso() }).where(eq(s.purchaseOrders.id, id));
    });
    publish(c.get("session").orgId, "purchase_order.updated", id);
    return c.json({ ok: true });
  });

  r.post("/:id/vendor-invoice", async (c) => {
    const id = c.req.param("id");
    const body = parse(poVendorInvoice, await jsonBody(c));
    await run(c, (tx) => tx.update(s.purchaseOrders).set({ vendorInvoiceNumber: body.number ?? "", vendorInvoiceDate: body.date ?? null, vendorInvoiceAmount: body.amount ?? null, status: "invoiced", remindAt: null, updatedAt: nowIso() }).where(eq(s.purchaseOrders.id, id)));
    publish(c.get("session").orgId, "purchase_order.updated", id);
    return c.json({ ok: true });
  });

  return r;
}
