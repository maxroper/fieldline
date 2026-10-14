import { schema as s, type Connection } from "@fieldline/db";
import { companyDay, inventoryCount, inventoryTransfer } from "@fieldline/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { jsonBody, notFound, parse, todayParam } from "../http";
import { publish } from "../realtime";

export function inventoryRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/warehouses", async (c) => {
    const data = await run(c, async (tx) => {
      const warehouses = await tx.select({ w: s.warehouses, techName: s.users.name }).from(s.warehouses).leftJoin(s.users, eq(s.users.id, s.warehouses.techId)).where(eq(s.warehouses.active, true)).orderBy(s.warehouses.kind, s.warehouses.name);
      const values = await tx.select({ warehouseId: s.inventoryStock.warehouseId, value: sql<number>`coalesce(sum(${s.inventoryStock.onHand} * ${s.inventoryItems.unitCost}), 0)`, belowMin: sql<number>`count(*) filter (where ${s.inventoryStock.onHand} < ${s.inventoryStock.min})`, lastCount: sql<string | null>`max(${s.inventoryStock.lastCountedAt})` }).from(s.inventoryStock).innerJoin(s.inventoryItems, eq(s.inventoryItems.id, s.inventoryStock.itemId)).groupBy(s.inventoryStock.warehouseId);
      const categories = await tx.select().from(s.inventoryCategories).where(eq(s.inventoryCategories.active, true)).orderBy(s.inventoryCategories.name);
      const byCategory = await tx.select({ warehouseId: s.inventoryStock.warehouseId, categoryId: s.inventoryItems.categoryId, value: sql<number>`coalesce(sum(${s.inventoryStock.onHand} * ${s.inventoryItems.unitCost}), 0)` }).from(s.inventoryStock).innerJoin(s.inventoryItems, eq(s.inventoryItems.id, s.inventoryStock.itemId)).groupBy(s.inventoryStock.warehouseId, s.inventoryItems.categoryId);
      return {
        warehouses: warehouses.map((row) => ({ ...row.w, techName: row.techName, value: Number(values.find((v) => v.warehouseId === row.w.id)?.value ?? 0), belowMin: Number(values.find((v) => v.warehouseId === row.w.id)?.belowMin ?? 0), lastCount: values.find((v) => v.warehouseId === row.w.id)?.lastCount ?? null })),
        categories,
        byCategory: byCategory.map((x) => ({ ...x, value: Number(x.value) })),
        total: values.reduce((sum, v) => sum + Number(v.value), 0),
      };
    });
    return c.json(data);
  });

  r.get("/stock", async (c) => {
    const warehouseId = c.req.query("warehouseId");
    const data = await run(c, async (tx, session) => {
      let id = warehouseId;
      if (id === "mine" || !id) {
        const [van] = await tx.select().from(s.warehouses).where(and(eq(s.warehouses.techId, session.userId), eq(s.warehouses.active, true))).limit(1);
        id = van?.id ?? id;
      }
      if (!id) return { warehouse: null, stock: [] };
      const [warehouse] = await tx.select().from(s.warehouses).where(eq(s.warehouses.id, id)).limit(1);
      const rows = await tx.select({ stock: s.inventoryStock, item: s.inventoryItems, categoryName: s.inventoryCategories.name }).from(s.inventoryStock).innerJoin(s.inventoryItems, eq(s.inventoryItems.id, s.inventoryStock.itemId)).leftJoin(s.inventoryCategories, eq(s.inventoryCategories.id, s.inventoryItems.categoryId)).where(eq(s.inventoryStock.warehouseId, id)).orderBy(s.inventoryCategories.name, s.inventoryItems.name);
      const stock = rows.map((row) => ({ ...row.stock, item: row.item, categoryName: row.categoryName, status: row.stock.onHand <= 0 ? "out" : row.stock.onHand < row.stock.min ? "low" : "ok", value: row.stock.onHand * row.item.unitCost }));
      const txns = await tx.select({ t: s.inventoryTxns, userName: s.users.name, woNumber: s.workOrders.number }).from(s.inventoryTxns).leftJoin(s.users, eq(s.users.id, s.inventoryTxns.userId)).leftJoin(s.workOrders, eq(s.workOrders.id, s.inventoryTxns.workOrderId)).where(eq(s.inventoryTxns.warehouseId, id)).orderBy(desc(s.inventoryTxns.date), desc(s.inventoryTxns.createdAt)).limit(100);
      return { warehouse: warehouse ?? null, stock, value: stock.reduce((sum, x) => sum + x.value, 0), txns };
    });
    return c.json(data);
  });

  /** Everything below minimum on any van: the transfer list for the morning. */
  r.get("/replenishment", async (c) => {
    const rows = await run(c, (tx) =>
      tx
        .select({ stock: s.inventoryStock, item: s.inventoryItems, warehouseName: s.warehouses.name, techName: s.users.name })
        .from(s.inventoryStock)
        .innerJoin(s.inventoryItems, eq(s.inventoryItems.id, s.inventoryStock.itemId))
        .innerJoin(s.warehouses, eq(s.warehouses.id, s.inventoryStock.warehouseId))
        .leftJoin(s.users, eq(s.users.id, s.warehouses.techId))
        .where(and(eq(s.warehouses.kind, "vehicle"), sql`${s.inventoryStock.onHand} < ${s.inventoryStock.min}`))
        .orderBy(s.warehouses.name, s.inventoryItems.name),
    );
    return c.json({ items: rows.map((row) => ({ ...row.stock, item: row.item, warehouseName: row.warehouseName, techName: row.techName, need: Math.max(0, row.stock.max - row.stock.onHand) })) });
  });

  /** Tomorrow's jobs against each van: quote lines with pricebook items that are not on the truck. */
  r.get("/parts-check", async (c) => {
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const tomorrow = new Date(`${today}T12:00:00Z`);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const date = todayParam(c.req.query("date"), tomorrow.toISOString().slice(0, 10));
      const jobs = await tx.select({ wo: s.workOrders, siteName: s.sites.name, techName: s.users.name }).from(s.workOrders).leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId)).leftJoin(s.users, eq(s.users.id, s.workOrders.assignedTechId)).where(and(eq(s.workOrders.scheduledFor, date), eq(s.workOrders.status, "open"))).orderBy(s.workOrders.startMinute);
      const out = [];
      for (const job of jobs) {
        const quotes = await tx.select({ id: s.quotes.id }).from(s.quotes).where(eq(s.quotes.createdWorkOrderId, job.wo.id));
        const needed = quotes.length ? await tx.select({ line: s.quoteLines, item: s.inventoryItems }).from(s.quoteLines).leftJoin(s.pricebookItems, eq(s.pricebookItems.id, s.quoteLines.pricebookItemId)).leftJoin(s.inventoryItems, sql`${s.inventoryItems.sku} = ${s.pricebookItems.code}`).where(inArray(s.quoteLines.quoteId, quotes.map((q) => q.id))) : [];
        const [van] = job.wo.assignedTechId ? await tx.select().from(s.warehouses).where(and(eq(s.warehouses.techId, job.wo.assignedTechId), eq(s.warehouses.active, true))).limit(1) : [];
        const parts = [];
        for (const n of needed) {
          if (!n.item) {
            parts.push({ description: n.line.description, quantity: n.line.quantity, onHand: null, status: "unknown" });
            continue;
          }
          const [stock] = van ? await tx.select().from(s.inventoryStock).where(and(eq(s.inventoryStock.warehouseId, van.id), eq(s.inventoryStock.itemId, n.item.id))).limit(1) : [];
          const onHand = stock?.onHand ?? 0;
          parts.push({ description: n.line.description, sku: n.item.sku, quantity: n.line.quantity, onHand, status: onHand >= n.line.quantity ? "ready" : onHand > 0 ? "short" : "missing" });
        }
        const status = parts.some((p) => p.status === "missing") ? "missing" : parts.some((p) => p.status === "short") ? "short" : "ready";
        out.push({ workOrder: { id: job.wo.id, number: job.wo.number, trip: job.wo.trip, title: job.wo.title, callType: job.wo.callType, startMinute: job.wo.startMinute }, siteName: job.siteName, techName: job.techName, van: van?.name ?? null, parts, status: parts.length ? status : "ready" });
      }
      return { date, jobs: out };
    });
    return c.json(data);
  });

  r.post("/transfer", async (c) => {
    const body = parse(inventoryTransfer, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const date = companyDay(new Date(), org?.timezone);
      let amount = body.amount ?? 0;
      let categoryId = body.categoryId ?? null;
      if (body.itemId) {
        const [item] = await tx.select().from(s.inventoryItems).where(eq(s.inventoryItems.id, body.itemId)).limit(1);
        if (!item) notFound("Item not found");
        const qty = body.quantity ?? 0;
        amount = qty * item.unitCost;
        categoryId = item.categoryId;
        await tx.update(s.inventoryStock).set({ onHand: sql`${s.inventoryStock.onHand} - ${qty}` }).where(and(eq(s.inventoryStock.warehouseId, body.fromWarehouseId), eq(s.inventoryStock.itemId, body.itemId)));
        await tx.insert(s.inventoryStock).values({ orgId: session.orgId, warehouseId: body.toWarehouseId, itemId: body.itemId, onHand: qty }).onConflictDoUpdate({ target: [s.inventoryStock.warehouseId, s.inventoryStock.itemId], set: { onHand: sql`${s.inventoryStock.onHand} + ${qty}` } });
      }
      await tx.insert(s.inventoryTxns).values([
        { orgId: session.orgId, warehouseId: body.fromWarehouseId, categoryId, itemId: body.itemId ?? null, kind: "transfer_out", amount: -amount, quantity: body.quantity != null ? -body.quantity : null, description: body.note ?? "Transfer", userId: session.userId, date },
        { orgId: session.orgId, warehouseId: body.toWarehouseId, categoryId, itemId: body.itemId ?? null, kind: "transfer_in", amount, quantity: body.quantity ?? null, description: body.note ?? "Transfer", userId: session.userId, date },
      ]);
    });
    publish(c.get("session").orgId, "inventory.updated");
    return c.json({ ok: true });
  });

  r.post("/count", async (c) => {
    const body = parse(inventoryCount, await jsonBody(c));
    const result = await run(c, async (tx, session) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const date = companyDay(new Date(), org?.timezone);
      const variances = [];
      for (const count of body.counts) {
        const [stock] = await tx.select({ stock: s.inventoryStock, item: s.inventoryItems }).from(s.inventoryStock).innerJoin(s.inventoryItems, eq(s.inventoryItems.id, s.inventoryStock.itemId)).where(and(eq(s.inventoryStock.warehouseId, body.warehouseId), eq(s.inventoryStock.itemId, count.itemId))).limit(1);
        if (!stock) continue;
        const diff = count.counted - stock.stock.onHand;
        await tx.update(s.inventoryStock).set({ onHand: count.counted, lastCountedAt: nowIso() }).where(eq(s.inventoryStock.id, stock.stock.id));
        if (diff !== 0) await tx.insert(s.inventoryTxns).values({ orgId: session.orgId, warehouseId: body.warehouseId, categoryId: stock.item.categoryId, itemId: count.itemId, kind: "count_adjust", amount: diff * stock.item.unitCost, quantity: diff, description: `Count: ${stock.item.name}`, userId: session.userId, date });
        variances.push({ itemId: count.itemId, sku: stock.item.sku, expected: stock.stock.onHand, counted: count.counted, diff });
      }
      return { variances };
    });
    publish(c.get("session").orgId, "inventory.updated");
    return c.json(result);
  });

  r.get("/items", async (c) => {
    const rows = await run(c, (tx) => tx.select({ item: s.inventoryItems, categoryName: s.inventoryCategories.name }).from(s.inventoryItems).leftJoin(s.inventoryCategories, eq(s.inventoryCategories.id, s.inventoryItems.categoryId)).where(eq(s.inventoryItems.active, true)).orderBy(s.inventoryItems.name));
    return c.json({ items: rows.map((r) => ({ ...r.item, categoryName: r.categoryName })) });
  });

  return r;
}
