import { nextNumber, schema as s, type Connection, type Tx } from "@fieldline/db";
import { agingBucket, cents, companyDay, creditCreate, invoiceCreate, invoiceDeliver, newId, newToken, paymentCreate, type WorkOrderBill } from "@fieldline/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { canBill } from "../auth";
import { nowIso, scoped } from "../db";
import { env } from "../env";
import { conflict, forbidden, jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";
import { buildBill, workOrderQuery } from "./work-orders";

type FrozenLine = s.FrozenLine;

/** Turn the live bill into the frozen invoice lines the customer sees. */
export function freezeLines(bill: WorkOrderBill, opts: { laborMode: "itemized" | "one"; materialMode: "itemized" | "one"; hideHourlyRate: boolean; descriptions: Record<string, string>; travelSeparate: boolean }): FrozenLine[] {
  const lines: FrozenLine[] = [];
  const d = (key: string, fallback: string) => opts.descriptions[key] ?? fallback;
  if (bill.quotedFlat || bill.fixedPrice) {
    lines.push({ id: "flat", kind: "flat", description: d("flat", bill.fixedPrice ? "Maintenance visit, agreement price" : "Quoted work, as approved"), quantity: 1, rate: bill.amount, amount: bill.amount ?? 0 });
    return lines;
  }
  const billed = bill.labor.filter((l) => !l.running);
  if (opts.laborMode === "one") {
    const labor = billed.filter((l) => opts.travelSeparate ? l.kind === "Labor" : true);
    const travel = opts.travelSeparate ? billed.filter((l) => l.kind === "Travel") : [];
    const hours = cents(labor.reduce((sum, l) => sum + l.hours, 0));
    lines.push({ id: "labor", kind: "labor", description: d("labor", `Labor, ${hours} hours`), quantity: hours, rate: opts.hideHourlyRate ? null : (labor[0]?.rate ?? null), amount: cents(labor.reduce((sum, l) => sum + (l.total ?? 0), 0)) });
    if (travel.length) lines.push({ id: "travel", kind: "travel", description: d("travel", `Travel, ${cents(travel.reduce((sum, l) => sum + l.hours, 0))} hours`), quantity: cents(travel.reduce((sum, l) => sum + l.hours, 0)), rate: opts.hideHourlyRate ? null : (travel[0]?.rate ?? null), amount: cents(travel.reduce((sum, l) => sum + (l.total ?? 0), 0)) });
  } else {
    for (const l of billed) lines.push({ id: l.id, kind: l.kind === "Travel" ? "travel" : "labor", description: d(l.id, `${l.kind} · ${l.who} · ${l.date} · visit ${l.visit}`), quantity: l.hours, rate: opts.hideHourlyRate ? null : l.rate, amount: l.total ?? 0 });
  }
  if (opts.materialMode === "one") {
    if (bill.materials.length) lines.push({ id: "material", kind: "material", description: d("material", "Material"), quantity: 1, rate: null, amount: bill.materialTotal ?? 0 });
  } else {
    for (const m of bill.materials) lines.push({ id: m.id, kind: "material", description: d(m.id, m.description), quantity: m.quantity, rate: m.sell != null && m.quantity > 0 ? cents(m.sell / m.quantity) : null, amount: m.sell ?? 0 });
  }
  if ((bill.miscAmount ?? 0) > 0) lines.push({ id: "misc", kind: "misc", description: d("misc", `Misc material, ${bill.miscPercent}% of labor and material`), quantity: 1, rate: null, amount: bill.miscAmount ?? 0 });
  if (bill.vehicleAmount > 0) lines.push({ id: "vehicle", kind: "vehicle", description: d("vehicle", "Vehicle charge"), quantity: 1, rate: null, amount: bill.vehicleAmount });
  if ((bill.salesTax ?? 0) > 0) lines.push({ id: "tax", kind: "tax", description: d("tax", `Sales tax ${bill.taxRate}%`), quantity: 1, rate: null, amount: bill.salesTax ?? 0 });
  return lines;
}

async function invoiceWithTotals(tx: Tx, id: string) {
  const [invoice] = await tx.select().from(s.invoices).where(eq(s.invoices.id, id)).limit(1);
  if (!invoice) return null;
  const paymentsRows = await tx.select().from(s.payments).where(eq(s.payments.invoiceId, id)).orderBy(desc(s.payments.receivedAt));
  const credits = await tx.select().from(s.creditMemos).where(eq(s.creditMemos.invoiceId, id)).orderBy(desc(s.creditMemos.createdAt));
  const deliveries = await tx.select({ d: s.invoiceDeliveries, userName: s.users.name }).from(s.invoiceDeliveries).leftJoin(s.users, eq(s.users.id, s.invoiceDeliveries.userId)).where(eq(s.invoiceDeliveries.invoiceId, id)).orderBy(desc(s.invoiceDeliveries.createdAt));
  const revisions = await tx.select().from(s.invoiceRevisions).where(eq(s.invoiceRevisions.invoiceId, id)).orderBy(desc(s.invoiceRevisions.rev));
  const paid = cents(paymentsRows.reduce((sum, p) => sum + p.amount, 0));
  const credited = cents(credits.reduce((sum, c) => sum + c.amount, 0));
  const balance = Math.max(0, cents(invoice.amount - paid - credited));
  return { invoice, payments: paymentsRows, credits, deliveries, revisions, paid, credited, balance };
}

export function billingRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  /** Closed work orders without an invoice, each with its live bill. */
  r.get("/waiting", async (c) => {
    const data = await run(c, async (tx, session) => {
      const closed = await workOrderQuery(tx).where(eq(s.workOrders.status, "closed")).orderBy(s.workOrders.closedAt);
      const invoiced = await tx.select({ workOrderId: s.invoices.workOrderId }).from(s.invoices);
      const invoicedNumbers = new Set<number>();
      for (const inv of invoiced) {
        const [w] = closed.filter((x) => x.id === inv.workOrderId);
        if (w) invoicedNumbers.add(w.number);
      }
      const seen = new Set<number>();
      const out = [];
      for (const wo of closed) {
        if (seen.has(wo.number) || invoicedNumbers.has(wo.number)) continue;
        seen.add(wo.number);
        const built = await buildBill(tx, session.orgId, wo.id);
        if (!built) continue;
        const allClosed = built.trips.every((t) => t.status !== "open");
        out.push({ workOrder: wo, bill: built.bill, allTripsClosed: allClosed, flags: { clockRunning: built.bill.clockRunning, overNte: built.bill.overNte, rateMissing: built.bill.rateMissing, amountMissing: built.bill.amount == null } });
      }
      return { waiting: out, total: out.reduce((sum, x) => sum + (x.bill.amount ?? 0), 0) };
    });
    return c.json(data);
  });

  r.get("/invoices", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const conds = [];
      if (q.status) conds.push(inArray(s.invoices.status, q.status.split(",") as never));
      if (q.customerId) conds.push(eq(s.invoices.customerId, q.customerId));
      const rows = await tx
        .select({ invoice: s.invoices, customerName: s.customers.name, woNumber: s.workOrders.number, woTrip: s.workOrders.trip, woTitle: s.workOrders.title, siteName: s.sites.name, callType: s.workOrders.callType })
        .from(s.invoices)
        .leftJoin(s.customers, eq(s.customers.id, s.invoices.customerId))
        .leftJoin(s.workOrders, eq(s.workOrders.id, s.invoices.workOrderId))
        .leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(s.invoices.number))
        .limit(300);
      const ids = rows.map((x) => x.invoice.id);
      const paymentsRows = ids.length ? await tx.select({ invoiceId: s.payments.invoiceId, amount: sql<number>`coalesce(sum(${s.payments.amount}), 0)` }).from(s.payments).where(inArray(s.payments.invoiceId, ids)).groupBy(s.payments.invoiceId) : [];
      const credits = ids.length ? await tx.select({ invoiceId: s.creditMemos.invoiceId, amount: sql<number>`coalesce(sum(${s.creditMemos.amount}), 0)` }).from(s.creditMemos).where(inArray(s.creditMemos.invoiceId, ids)).groupBy(s.creditMemos.invoiceId) : [];
      const deliveries = ids.length ? await tx.select().from(s.invoiceDeliveries).where(inArray(s.invoiceDeliveries.invoiceId, ids)).orderBy(desc(s.invoiceDeliveries.createdAt)) : [];
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const list = rows.map((row) => {
        const paid = Number(paymentsRows.find((p) => p.invoiceId === row.invoice.id)?.amount ?? 0);
        const credited = Number(credits.find((p) => p.invoiceId === row.invoice.id)?.amount ?? 0);
        const balance = Math.max(0, cents(row.invoice.amount - paid - credited));
        const due = row.invoice.dueDate ?? row.invoice.billedAt.slice(0, 10);
        return { ...row.invoice, customerName: row.customerName, workOrderNumber: row.woNumber, workOrderTrip: row.woTrip, workOrderTitle: row.woTitle, siteName: row.siteName, callType: row.callType, paid, credited, balance, bucket: balance > 0 ? agingBucket(due, today) : null, daysPastDue: balance > 0 ? Math.max(0, Math.floor((Date.parse(today) - Date.parse(due)) / 86400000)) : 0, lastDelivery: deliveries.find((d) => d.invoiceId === row.invoice.id) ?? null };
      });
      const aging: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
      for (const inv of list) if (inv.bucket) aging[inv.bucket]! += inv.balance;
      const monthStart = today.slice(0, 8) + "01";
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [collected] = await tx.select({ amount: sql<number>`coalesce(sum(${s.payments.amount}), 0)`, n: sql<number>`count(*)` }).from(s.payments).where(sql`${s.payments.receivedAt} >= ${weekAgo}`);
      const kpis = { billedThisMonth: list.filter((i) => i.billedAt >= monthStart).reduce((sum, i) => sum + i.amount, 0), billedCount: list.filter((i) => i.billedAt >= monthStart).length, arOver30: aging["31-60"]! + aging["61-90"]! + aging["90+"]!, arTotal: list.reduce((sum, i) => sum + i.balance, 0), collectedThisWeek: Number(collected?.amount ?? 0), collectedCount: Number(collected?.n ?? 0), qboAlerts: list.filter((i) => i.qboError).length };
      return { invoices: list, aging, kpis, quickbooks: { connected: env.integrations.quickbooks, lastSync: null } };
    });
    return c.json(data);
  });

  r.get("/invoices/:id", async (c) => {
    const data = await run(c, async (tx, session) => {
      const detail = await invoiceWithTotals(tx, c.req.param("id"));
      if (!detail) notFound("Invoice not found");
      const [wo] = await workOrderQuery(tx).where(eq(s.workOrders.id, detail.invoice.workOrderId));
      const built = await buildBill(tx, session.orgId, detail.invoice.workOrderId);
      return { ...detail, workOrder: wo ?? null, customer: built?.customer ?? null, site: built?.site ?? null, liveBill: built?.bill ?? null };
    });
    return c.json(data);
  });

  /** Mark billed: freeze the bill into an invoice, number it, and move every trip of the job to billed. */
  r.post("/work-orders/:woId/invoice", async (c) => {
    const woId = c.req.param("woId");
    const body = parse(invoiceCreate, await jsonBody(c));
    const created = await run(c, async (tx, session) => {
      const [user] = await tx.select({ canBill: s.users.canBill }).from(s.users).where(eq(s.users.id, session.userId)).limit(1);
      if (!canBill(session, user?.canBill)) forbidden("Billing permission needed");
      const built = await buildBill(tx, session.orgId, woId);
      if (!built) notFound("Work order not found");
      if (built.bill.clockRunning) conflict("A clock is still running on this job");
      if (built.bill.amount == null) conflict(built.bill.rateMissing ? "Set the labor bill rates in Settings first" : "The bill is missing an amount");
      const [existing] = await tx.select({ id: s.invoices.id }).from(s.invoices).where(inArray(s.invoices.workOrderId, built.trips.map((t) => t.id))).limit(1);
      if (existing) conflict("This job already has an invoice");
      const lines = freezeLines(built.bill, { ...body, travelSeparate: built.settings.billTravelSeparately });
      const number = await nextNumber(tx, session.orgId, "invoice");
      const id = newId();
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const due = new Date(`${today}T12:00:00Z`);
      due.setUTCDate(due.getUTCDate() + body.dueInDays);
      const amount = built.bill.amount;
      await tx.insert(s.invoices).values({ id, orgId: session.orgId, number, workOrderId: built.wo.id, customerId: built.wo.customerId, status: "billed", billedAt: nowIso(), dueDate: due.toISOString().slice(0, 10), amount, laborMode: body.laborMode, materialMode: body.materialMode, hideHourlyRate: body.hideHourlyRate, descriptions: body.descriptions, snapshot: { lines, subtotal: cents(amount - (built.bill.salesTax ?? 0)), tax: built.bill.salesTax ?? 0, total: amount, taxKind: built.bill.taxKind, nteAmount: built.bill.nteAmount, travelSeparate: built.settings.billTravelSeparately }, taxableAmount: built.bill.taxableAmount ?? 0, taxRate: built.bill.taxRate, salesTax: built.bill.salesTax ?? 0, accruedUseTax: built.bill.accruedUseTax, paymentToken: newToken(10), createdBy: session.userId });
      await tx.update(s.workOrders).set({ status: "billed", updatedAt: nowIso() }).where(inArray(s.workOrders.id, built.trips.map((t) => t.id)));
      await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "work_order", entityId: built.wo.id, field: "status", fromValue: "closed", toValue: "billed", userId: session.userId });
      return { id, number, amount };
    });
    publish(c.get("session").orgId, "invoice.created", created.id);
    return c.json(created, 201);
  });

  r.post("/invoices/:id/payments", async (c) => {
    const id = c.req.param("id");
    const body = parse(paymentCreate, await jsonBody(c));
    const result = await run(c, async (tx, session) => {
      const detail = await invoiceWithTotals(tx, id);
      if (!detail) notFound("Invoice not found");
      await tx.insert(s.payments).values({ orgId: session.orgId, invoiceId: id, customerId: detail.invoice.customerId, amount: body.amount, method: body.method, reference: body.reference ?? "", receivedAt: body.receivedAt ?? nowIso(), createdBy: session.userId });
      const after = await invoiceWithTotals(tx, id);
      if (after && after.balance <= 0) await tx.update(s.invoices).set({ status: "paid", updatedAt: nowIso() }).where(eq(s.invoices.id, id));
      return { balance: after?.balance ?? 0 };
    });
    publish(c.get("session").orgId, "invoice.updated", id);
    return c.json(result);
  });

  r.post("/invoices/:id/credits", async (c) => {
    const id = c.req.param("id");
    const body = parse(creditCreate, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [user] = await tx.select({ canBill: s.users.canBill }).from(s.users).where(eq(s.users.id, session.userId)).limit(1);
      if (!canBill(session, user?.canBill)) forbidden("Billing permission needed");
      const number = await nextNumber(tx, session.orgId, "credit");
      await tx.insert(s.creditMemos).values({ orgId: session.orgId, invoiceId: id, number, amount: body.amount, reason: body.reason, note: body.note ?? "", lineIds: body.lineIds, userId: session.userId });
      const after = await invoiceWithTotals(tx, id);
      if (after) await tx.update(s.invoices).set({ status: after.credited >= after.invoice.amount ? "credited" : after.balance <= 0 ? "paid" : "partially_credited", updatedAt: nowIso() }).where(eq(s.invoices.id, id));
    });
    publish(c.get("session").orgId, "invoice.updated", id);
    return c.json({ ok: true });
  });

  r.post("/invoices/:id/deliveries", async (c) => {
    const id = c.req.param("id");
    const body = parse(invoiceDeliver, await jsonBody(c));
    await run(c, async (tx, session) => {
      await tx.insert(s.invoiceDeliveries).values({ orgId: session.orgId, invoiceId: id, method: body.method, emails: body.emails ?? [], userId: session.userId });
    });
    return c.json({ ok: true });
  });

  r.post("/invoices/:id/revise", async (c) => {
    const id = c.req.param("id");
    const body = parse(invoiceCreate.extend({ reason: z.string().min(1) }), await jsonBody(c));
    await run(c, async (tx, session) => {
      const detail = await invoiceWithTotals(tx, id);
      if (!detail) notFound("Invoice not found");
      const built = await buildBill(tx, session.orgId, detail.invoice.workOrderId);
      if (!built || built.bill.amount == null) conflict("The bill cannot be rebuilt");
      await tx.insert(s.invoiceRevisions).values({ orgId: session.orgId, invoiceId: id, rev: detail.revisions.length + 1, reason: body.reason, snapshot: detail.invoice.snapshot, userId: session.userId });
      const lines = freezeLines(built.bill, { ...body, travelSeparate: built.settings.billTravelSeparately });
      await tx.update(s.invoices).set({ amount: built.bill.amount, laborMode: body.laborMode, materialMode: body.materialMode, hideHourlyRate: body.hideHourlyRate, descriptions: body.descriptions, snapshot: { lines, subtotal: cents(built.bill.amount - (built.bill.salesTax ?? 0)), tax: built.bill.salesTax ?? 0, total: built.bill.amount, taxKind: built.bill.taxKind, nteAmount: built.bill.nteAmount, travelSeparate: built.settings.billTravelSeparately }, updatedAt: nowIso() }).where(eq(s.invoices.id, id));
    });
    publish(c.get("session").orgId, "invoice.updated", id);
    return c.json({ ok: true });
  });

  r.get("/aging", async (c) => {
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const open = await tx.select({ invoice: s.invoices, customerName: s.customers.name, cardOnFile: s.customers.cardOnFile }).from(s.invoices).leftJoin(s.customers, eq(s.customers.id, s.invoices.customerId)).where(inArray(s.invoices.status, ["billed", "partially_credited"]));
      const byCustomer = new Map<string, { customerId: string | null; customerName: string | null; cardOnFile: unknown; buckets: Record<string, number>; total: number; oldest: number }>();
      for (const row of open) {
        const detail = await invoiceWithTotals(tx, row.invoice.id);
        if (!detail || detail.balance <= 0) continue;
        const key = row.invoice.customerId ?? "none";
        const entry = byCustomer.get(key) ?? { customerId: row.invoice.customerId, customerName: row.customerName, cardOnFile: row.cardOnFile, buckets: { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }, total: 0, oldest: 0 };
        const due = row.invoice.dueDate ?? row.invoice.billedAt.slice(0, 10);
        entry.buckets[agingBucket(due, today)]! += detail.balance;
        entry.total += detail.balance;
        entry.oldest = Math.max(entry.oldest, Math.floor((Date.parse(today) - Date.parse(due)) / 86400000));
        byCustomer.set(key, entry);
      }
      return { customers: [...byCustomer.values()].sort((a, b) => b.total - a.total) };
    });
    return c.json(data);
  });

  return r;
}

