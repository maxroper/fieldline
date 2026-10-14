import { nextNumber, withBypass, schema as s, type Connection } from "@fieldline/db";
import { companyDay, minuteLabel, newId, newToken } from "@fieldline/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { nowIso } from "../db";
import { jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";

const approve = z.object({ optionId: z.string().uuid().optional(), signerName: z.string().trim().min(1) });
const requestService = z.object({ problem: z.string().trim().min(1), urgency: z.enum(["today", "this_week", "whenever"]).default("this_week"), window: z.string().optional(), contactPhone: z.string().optional(), siteId: z.string().uuid().optional() });
const pay = z.object({ amount: z.number().min(0.01) });

/**
 * Customer-facing pages, reached by token links in texts and emails. No session; the token is the
 * capability, and row-level security is bypassed only inside these token lookups.
 */
export function publicRoutes(conn: Connection) {
  const r = new Hono();

  r.get("/track/:token", async (c) => {
    const token = c.req.param("token");
    const data = await withBypass(conn.db, async (tx) => {
      const [wo] = await tx.select().from(s.workOrders).where(eq(s.workOrders.trackingToken, token)).limit(1);
      if (!wo) notFound("That link is not valid");
      const [org] = await tx.select({ name: s.orgs.name, phone: s.orgs.phone, timezone: s.orgs.timezone }).from(s.orgs).where(eq(s.orgs.id, wo.orgId)).limit(1);
      const [site] = wo.siteId ? await tx.select({ name: s.sites.name, address: s.sites.address, lat: s.sites.lat, lng: s.sites.lng }).from(s.sites).where(eq(s.sites.id, wo.siteId)).limit(1) : [];
      const [tech] = wo.assignedTechId ? await tx.select({ id: s.users.id, name: s.users.name, title: s.users.title }).from(s.users).where(eq(s.users.id, wo.assignedTechId)).limit(1) : [];
      const [location] = tech ? await tx.select().from(s.techLocations).where(eq(s.techLocations.techId, tech.id)).orderBy(desc(s.techLocations.recordedAt)).limit(1) : [];
      const fileRows = wo.status !== "open" ? await tx.select({ id: s.files.id, caption: s.files.caption, kind: s.files.kind }).from(s.files).where(and(eq(s.files.workOrderId, wo.id), eq(s.files.includeInReport, true), eq(s.files.kind, "photo"))) : [];
      return {
        company: org,
        workOrder: { number: wo.number, title: wo.title, status: wo.status, techStatus: wo.techStatus, techStatusAt: wo.techStatusAt, scheduledFor: wo.scheduledFor, window: wo.startMinute != null ? `${minuteLabel(wo.startMinute)} – ${minuteLabel(wo.startMinute + Number(wo.allocatedHours ?? 2) * 60)}` : null, workPerformed: wo.status !== "open" ? wo.summary || wo.workPerformed : "" },
        site,
        tech: tech ? { firstName: tech.name.split(" ")[0], title: tech.title } : null,
        location: wo.techStatus === "en_route" && location ? { lat: Number(location.lat), lng: Number(location.lng), at: location.recordedAt } : null,
        photos: fileRows,
      };
    });
    return c.json(data);
  });

  r.get("/portal/:token", async (c) => {
    const token = c.req.param("token");
    const data = await withBypass(conn.db, async (tx) => {
      const [customer] = await tx.select().from(s.customers).where(and(eq(s.customers.portalToken, token), eq(s.customers.portalEnabled, true))).limit(1);
      if (!customer) notFound("That link is not valid");
      const [org] = await tx.select({ name: s.orgs.name, phone: s.orgs.phone }).from(s.orgs).where(eq(s.orgs.id, customer.orgId)).limit(1);
      const sites = await tx.select().from(s.sites).where(eq(s.sites.customerId, customer.id));
      const quotes = await tx.select().from(s.quotes).where(and(eq(s.quotes.customerId, customer.id), inArray(s.quotes.status, ["sent", "viewed", "follow_up"]))).orderBy(desc(s.quotes.number));
      const options = quotes.length ? await tx.select().from(s.quoteOptions).where(inArray(s.quoteOptions.quoteId, quotes.map((q) => q.id))).orderBy(s.quoteOptions.sort) : [];
      const invoices = await tx.select().from(s.invoices).where(and(eq(s.invoices.customerId, customer.id), inArray(s.invoices.status, ["billed", "partially_credited"]))).orderBy(desc(s.invoices.billedAt));
      const paymentsRows = invoices.length ? await tx.select({ invoiceId: s.payments.invoiceId, amount: sql<number>`coalesce(sum(${s.payments.amount}), 0)` }).from(s.payments).where(inArray(s.payments.invoiceId, invoices.map((i) => i.id))).groupBy(s.payments.invoiceId) : [];
      const visits = await tx.select({ wo: s.workOrders, siteName: s.sites.name, techName: s.users.name }).from(s.workOrders).leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId)).leftJoin(s.users, eq(s.users.id, s.workOrders.assignedTechId)).where(and(eq(s.workOrders.customerId, customer.id), inArray(s.workOrders.status, ["closed", "billed"]))).orderBy(desc(s.workOrders.scheduledFor)).limit(8);
      const photos = visits.length ? await tx.select({ id: s.files.id, workOrderId: s.files.workOrderId, caption: s.files.caption }).from(s.files).where(and(inArray(s.files.workOrderId, visits.map((v) => v.wo.id)), eq(s.files.kind, "photo"), eq(s.files.includeInReport, true))) : [];
      const units = sites.length ? await tx.select().from(s.equipment).where(inArray(s.equipment.siteId, sites.map((x) => x.id))) : [];
      for (const q of quotes) if (!q.viewedAt) await tx.update(s.quotes).set({ status: q.status === "sent" ? "viewed" : q.status, viewedAt: nowIso(), viewCount: q.viewCount + 1 }).where(eq(s.quotes.id, q.id));
      return {
        company: org,
        customer: { name: customer.name, cardOnFile: customer.cardOnFile },
        sites: sites.map((x) => ({ id: x.id, name: x.name, address: x.address })),
        quotes: quotes.map((q) => ({ id: q.id, number: q.number, scope: q.scope, problemText: q.problemText, sentAt: q.sentAt, approvalToken: q.approvalToken, options: options.filter((o) => o.quoteId === q.id) })),
        invoices: invoices.map((i) => ({ id: i.id, number: i.number, billedAt: i.billedAt, dueDate: i.dueDate, amount: i.amount, balance: Math.max(0, i.amount - Number(paymentsRows.find((p) => p.invoiceId === i.id)?.amount ?? 0)), paymentToken: i.paymentToken, lines: i.snapshot.lines })),
        visits: visits.map((v) => ({ id: v.wo.id, number: v.wo.number, title: v.wo.title, date: v.wo.scheduledFor, siteName: v.siteName, techName: v.techName, summary: v.wo.summary || v.wo.workPerformed, photos: photos.filter((p) => p.workOrderId === v.wo.id) })),
        equipment: units.map((u) => ({ id: u.id, tag: u.tag, make: u.make, model: u.model, siteId: u.siteId, installYear: u.installYear, warrantyPartsUntil: u.warrantyPartsUntil })),
      };
    });
    return c.json(data);
  });

  /** Customer approval with a typed signature; creates the quoted work order like the office approval does. */
  r.post("/quotes/:token/approve", async (c) => {
    const token = c.req.param("token");
    const body = parse(approve, await jsonBody(c));
    const result = await withBypass(conn.db, async (tx) => {
      const [quote] = await tx.select().from(s.quotes).where(eq(s.quotes.approvalToken, token)).limit(1);
      if (!quote) notFound("That link is not valid");
      if (quote.status === "approved") return { already: true, orgId: quote.orgId };
      const options = await tx.select().from(s.quoteOptions).where(eq(s.quoteOptions.quoteId, quote.id));
      const option = (body.optionId ? options.find((o) => o.id === body.optionId) : options.find((o) => o.id === quote.selectedOptionId)) ?? options.find((o) => o.isRecommended) ?? options[0] ?? null;
      const number = await nextNumber(tx, quote.orgId, "work_order");
      const woId = newId();
      await tx.insert(s.workOrders).values({ id: woId, orgId: quote.orgId, number, customerId: quote.customerId, siteId: quote.siteId, equipmentId: quote.equipmentId, title: option ? `${quote.scope} · ${option.name}` : quote.scope, description: option?.description || quote.problemText, callType: "quoted", billingType: "quoted", quotedAmount: option?.price ?? null, priority: "normal", signatureRequired: true, trackingToken: newToken(8), followUp: { reason: "approved", date: null, note: `Approved online by ${body.signerName}`, part: "", expectedDate: null } });
      await tx.update(s.quotes).set({ status: "approved", approvedAt: nowIso(), selectedOptionId: option?.id ?? null, createdWorkOrderId: woId, signerName: body.signerName, updatedAt: nowIso() }).where(eq(s.quotes.id, quote.id));
      return { already: false, orgId: quote.orgId, workOrderNumber: number };
    });
    publish(result.orgId, "quote.updated");
    return c.json({ ok: true, workOrderNumber: "workOrderNumber" in result ? result.workOrderNumber : null });
  });

  /** A demo payment: records the payment as if the hosted payment page had completed. Stripe replaces this. */
  r.post("/invoices/:token/pay", async (c) => {
    const token = c.req.param("token");
    const body = parse(pay, await jsonBody(c));
    const result = await withBypass(conn.db, async (tx) => {
      const [invoice] = await tx.select().from(s.invoices).where(eq(s.invoices.paymentToken, token)).limit(1);
      if (!invoice) notFound("That link is not valid");
      const [customer] = invoice.customerId ? await tx.select().from(s.customers).where(eq(s.customers.id, invoice.customerId)).limit(1) : [];
      await tx.insert(s.payments).values({ orgId: invoice.orgId, invoiceId: invoice.id, customerId: invoice.customerId, amount: body.amount, method: customer?.cardOnFile ? "card" : "link", reference: "portal", providerId: `demo-${Date.now()}` });
      const [paidRow] = await tx.select({ paid: sql<number>`coalesce(sum(${s.payments.amount}), 0)` }).from(s.payments).where(eq(s.payments.invoiceId, invoice.id));
      const paid = Number(paidRow?.paid ?? 0);
      if (paid >= invoice.amount) await tx.update(s.invoices).set({ status: "paid", updatedAt: nowIso() }).where(eq(s.invoices.id, invoice.id));
      return { orgId: invoice.orgId, balance: Math.max(0, invoice.amount - paid) };
    });
    publish(result.orgId, "invoice.updated");
    return c.json({ ok: true, balance: result.balance });
  });

  r.post("/portal/:token/request-service", async (c) => {
    const token = c.req.param("token");
    const body = parse(requestService, await jsonBody(c));
    const result = await withBypass(conn.db, async (tx) => {
      const [customer] = await tx.select().from(s.customers).where(and(eq(s.customers.portalToken, token), eq(s.customers.portalEnabled, true))).limit(1);
      if (!customer) notFound("That link is not valid");
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).where(eq(s.orgs.id, customer.orgId)).limit(1);
      const [site] = body.siteId ? await tx.select().from(s.sites).where(eq(s.sites.id, body.siteId)).limit(1) : await tx.select().from(s.sites).where(eq(s.sites.customerId, customer.id)).limit(1);
      const number = await nextNumber(tx, customer.orgId, "work_order");
      await tx.insert(s.workOrders).values({ orgId: customer.orgId, number, customerId: customer.id, siteId: site?.id ?? null, title: body.problem.slice(0, 80), description: `${body.problem}\n\nRequested from the portal · ${body.urgency.replace("_", " ")}${body.window ? ` · ${body.window}` : ""}`, callType: "service", billingType: "tm", priority: body.urgency === "today" ? "urgent" : "normal", callerName: customer.name, callerPhone: body.contactPhone ?? customer.phone, trackingToken: newToken(8), dispatchNote: `Portal request on ${companyDay(new Date(), org?.timezone)}` });
      return { orgId: customer.orgId, number };
    });
    publish(result.orgId, "work_order.created");
    return c.json({ ok: true, workOrderNumber: result.number }, 201);
  });

  return r;
}
