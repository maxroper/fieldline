import { nextNumber, schema as s, type Connection, type Tx } from "@fieldline/db";
import { companySettings, financingMonthly, laborCostRate, newId, newToken, pricebookItemCreate, quoteCreate, quoteTotals, quoteUpdate, taxRateFor } from "@fieldline/shared";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { conflict, jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";

const approveBody = z.object({ optionId: z.string().uuid().optional(), signerName: z.string().optional(), schedule: z.boolean().default(false) });
const declineBody = z.object({ reason: z.string().default("other"), note: z.string().optional() });

export async function quoteDetail(tx: Tx, orgId: string, id: string) {
  const [quote] = await tx.select().from(s.quotes).where(eq(s.quotes.id, id)).limit(1);
  if (!quote) return null;
  const [org] = await tx.select({ settings: s.orgs.settings }).from(s.orgs).where(eq(s.orgs.id, orgId)).limit(1);
  const settings = companySettings(org?.settings);
  const options = await tx.select().from(s.quoteOptions).where(eq(s.quoteOptions.quoteId, id)).orderBy(s.quoteOptions.sort);
  const lines = await tx.select().from(s.quoteLines).where(eq(s.quoteLines.quoteId, id)).orderBy(s.quoteLines.sort);
  const customer = quote.customerId ? (await tx.select().from(s.customers).where(eq(s.customers.id, quote.customerId)).limit(1))[0] : null;
  const site = quote.siteId ? (await tx.select().from(s.sites).where(eq(s.sites.id, quote.siteId)).limit(1))[0] : null;
  const unit = quote.equipmentId ? (await tx.select().from(s.equipment).where(eq(s.equipment.id, quote.equipmentId)).limit(1))[0] : null;
  const labor = { ...quote.labor, journeymanRate: quote.labor.journeymanRate ?? laborCostRate(settings, "Journeyman"), apprenticeRate: quote.labor.apprenticeRate ?? laborCostRate(settings, "Apprentice"), driverRate: quote.labor.driverRate ?? laborCostRate(settings, "Driver") };
  const totals = quoteTotals({ labor, materials: lines.filter((l) => l.kind === "material"), marginPercent: quote.marginPercent, taxRate: taxRateFor({ customer, site, settings }) });
  const selected = options.find((o) => o.id === quote.selectedOptionId) ?? options.find((o) => o.isRecommended) ?? options[0] ?? null;
  return { quote, options, lines, customer, site, equipment: unit, totals, labor, selectedOption: selected, price: selected?.price ?? totals.sell };
}

export function quotesRoutes(conn: Connection) {
  const run = scoped(conn);
  const quotes = new Hono<AppEnv>();
  const pricebook = new Hono<AppEnv>();

  quotes.get("/", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const conds = [];
      if (q.status) conds.push(inArray(s.quotes.status, q.status.split(",") as never));
      if (q.customerId) conds.push(eq(s.quotes.customerId, q.customerId));
      if (q.q) conds.push(or(ilike(s.quotes.scope, `%${q.q}%`), ilike(s.customers.name, `%${q.q}%`), ilike(s.sites.name, `%${q.q}%`))!);
      const rows = await tx
        .select({ quote: s.quotes, customerName: s.customers.name, siteName: s.sites.name, unitTag: s.equipment.tag, createdByName: s.users.name })
        .from(s.quotes)
        .leftJoin(s.customers, eq(s.customers.id, s.quotes.customerId))
        .leftJoin(s.sites, eq(s.sites.id, s.quotes.siteId))
        .leftJoin(s.equipment, eq(s.equipment.id, s.quotes.equipmentId))
        .leftJoin(s.users, eq(s.users.id, s.quotes.createdBy))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(s.quotes.number))
        .limit(300);
      const ids = rows.map((r) => r.quote.id);
      const options = ids.length ? await tx.select().from(s.quoteOptions).where(inArray(s.quoteOptions.quoteId, ids)).orderBy(s.quoteOptions.sort) : [];
      const list = rows.map((row) => {
        const opts = options.filter((o) => o.quoteId === row.quote.id);
        const selected = opts.find((o) => o.id === row.quote.selectedOptionId) ?? opts.find((o) => o.isRecommended) ?? opts[0];
        return { ...row.quote, customerName: row.customerName, siteName: row.siteName, unitTag: row.unitTag, createdByName: row.createdByName, options: opts.map((o) => ({ id: o.id, tier: o.tier, price: o.price, isRecommended: o.isRecommended })), price: selected?.price ?? null };
      });
      const open = list.filter((x) => ["sent", "viewed", "follow_up"].includes(x.status));
      const sentOrLater = list.filter((x) => x.status !== "draft");
      const approved = list.filter((x) => x.status === "approved");
      const kpis = {
        openValue: open.reduce((sum, x) => sum + (x.price ?? 0), 0),
        openCount: open.length,
        closeRate: sentOrLater.length ? Math.round((approved.length / sentOrLater.length) * 100) : 0,
        averageQuote: list.length ? Math.round(list.reduce((sum, x) => sum + (x.price ?? 0), 0) / list.length) : 0,
        followUpsDue: open.filter((x) => x.followUpDate && x.followUpDate <= new Date().toISOString().slice(0, 10)).length,
        byStatus: Object.fromEntries(["draft", "sent", "viewed", "approved", "declined", "follow_up"].map((st) => [st, list.filter((x) => x.status === st).length])),
      };
      return { quotes: list, kpis };
    });
    return c.json(data);
  });

  quotes.get("/:id", async (c) => {
    const data = await run(c, async (tx, session) => {
      const detail = await quoteDetail(tx, session.orgId, c.req.param("id"));
      if (!detail) notFound("Quote not found");
      const templates = await tx.select().from(s.scopeTemplates).where(eq(s.scopeTemplates.active, true)).orderBy(s.scopeTemplates.name);
      const fileRows = await tx.select().from(s.files).where(eq(s.files.relatedId, detail.quote.id));
      return { ...detail, scopeTemplates: templates, files: fileRows };
    });
    return c.json(data);
  });

  quotes.post("/", async (c) => {
    const body = parse(quoteCreate, await jsonBody(c));
    const created = await run(c, async (tx, session) => {
      const number = await nextNumber(tx, session.orgId, "quote");
      const id = newId();
      const [org] = await tx.select({ settings: s.orgs.settings }).from(s.orgs).limit(1);
      const settings = companySettings(org?.settings);
      const { options, lines, ...fields } = body;
      await tx.insert(s.quotes).values({ ...fields, id, orgId: session.orgId, number, marginPercent: fields.marginPercent ?? settings.defaultQuoteMargin, approvalToken: newToken(10), createdBy: session.userId });
      await replaceOptionsAndLines(tx, session.orgId, id, options, lines);
      return id;
    });
    publish(c.get("session").orgId, "quote.created", created);
    return c.json({ id: created }, 201);
  });

  quotes.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(quoteUpdate, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [current] = await tx.select().from(s.quotes).where(eq(s.quotes.id, id)).limit(1);
      if (!current) notFound("Quote not found");
      const { options, lines, status, ...fields } = body;
      const stamps: Partial<typeof s.quotes.$inferInsert> = {};
      if (status && status !== current.status) {
        if (status === "sent") stamps.sentAt = nowIso();
        if (status === "declined") stamps.declinedAt = nowIso();
      }
      await tx.update(s.quotes).set({ ...fields, ...(status ? { status } : {}), ...stamps, updatedAt: nowIso() }).where(eq(s.quotes.id, id));
      if (options || lines) await replaceOptionsAndLines(tx, session.orgId, id, options, lines);
    });
    publish(c.get("session").orgId, "quote.updated", id);
    return c.json({ ok: true });
  });

  quotes.post("/:id/send", async (c) => {
    const id = c.req.param("id");
    await run(c, async (tx) => {
      await tx.update(s.quotes).set({ status: "sent", sentAt: nowIso(), updatedAt: nowIso() }).where(eq(s.quotes.id, id));
    });
    publish(c.get("session").orgId, "quote.updated", id);
    return c.json({ ok: true });
  });

  /** Approval creates the quoted work order with the chosen option's price. */
  quotes.post("/:id/approve", async (c) => {
    const id = c.req.param("id");
    const body = parse(approveBody, await jsonBody(c));
    const result = await run(c, async (tx, session) => {
      const detail = await quoteDetail(tx, session.orgId, id);
      if (!detail) notFound("Quote not found");
      if (detail.quote.status === "approved") conflict("This quote is already approved");
      const option = body.optionId ? detail.options.find((o) => o.id === body.optionId) : detail.selectedOption;
      const price = option?.price ?? detail.totals.sell ?? 0;
      const number = await nextNumber(tx, session.orgId, "work_order");
      const woId = newId();
      await tx.insert(s.workOrders).values({ id: woId, orgId: session.orgId, number, customerId: detail.quote.customerId, siteId: detail.quote.siteId, equipmentId: detail.quote.equipmentId, title: option ? `${detail.quote.scope} · ${option.name}` : detail.quote.scope || `Quote ${detail.quote.number}`, description: option?.description || detail.quote.problemText, callType: "quoted", billingType: "quoted", quotedAmount: price, materialBudget: detail.totals.materialCost, laborBudgetHours: detail.totals.hours, priority: "normal", signatureRequired: true, trackingToken: newToken(8), createdBy: session.userId, followUp: { reason: "approved", date: null, note: `Quote ${detail.quote.number} approved; waiting for a date`, part: "", expectedDate: null } });
      await tx.update(s.quotes).set({ status: "approved", approvedAt: nowIso(), selectedOptionId: option?.id ?? detail.quote.selectedOptionId, createdWorkOrderId: woId, signerName: body.signerName ?? detail.quote.signerName, updatedAt: nowIso() }).where(eq(s.quotes.id, id));
      if (option?.id) {
        const used = await tx.select({ pricebookItemId: s.quoteLines.pricebookItemId }).from(s.quoteLines).where(eq(s.quoteLines.quoteId, id));
        for (const row of used) if (row.pricebookItemId) await tx.update(s.pricebookItems).set({ timesUsed: sql`${s.pricebookItems.timesUsed} + 1` }).where(eq(s.pricebookItems.id, row.pricebookItemId));
      }
      return { workOrderId: woId, number };
    });
    publish(c.get("session").orgId, "quote.updated", id);
    return c.json(result);
  });

  quotes.post("/:id/decline", async (c) => {
    const id = c.req.param("id");
    const body = parse(declineBody, await jsonBody(c));
    await run(c, (tx) => tx.update(s.quotes).set({ status: "declined", declinedAt: nowIso(), lossReason: body.reason, lossNote: body.note ?? "", updatedAt: nowIso() }).where(eq(s.quotes.id, id)));
    publish(c.get("session").orgId, "quote.updated", id);
    return c.json({ ok: true });
  });

  pricebook.get("/", async (c) => {
    const q = c.req.query();
    const rows = await run(c, (tx) => {
      const conds = [eq(s.pricebookItems.active, true)];
      if (q.category) conds.push(ilike(s.pricebookItems.category, `${q.category}%`));
      if (q.q) conds.push(or(ilike(s.pricebookItems.name, `%${q.q}%`), ilike(s.pricebookItems.code, `%${q.q}%`), ilike(s.pricebookItems.description, `%${q.q}%`))!);
      return tx.select().from(s.pricebookItems).where(and(...conds)).orderBy(s.pricebookItems.category, s.pricebookItems.name).limit(500);
    });
    const categories = [...new Set(rows.map((r) => r.category))].sort();
    return c.json({ items: rows.map((r) => ({ ...r, financingMonthly: r.priceBetter ? financingMonthly(r.priceBetter) : null })), categories });
  });

  pricebook.post("/", async (c) => {
    const body = parse(pricebookItemCreate, await jsonBody(c));
    const item = await run(c, async (tx, session) => (await tx.insert(s.pricebookItems).values({ ...body, orgId: session.orgId }).returning())[0]!);
    return c.json({ item }, 201);
  });

  pricebook.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(pricebookItemCreate.partial(), await jsonBody(c));
    await run(c, (tx) => tx.update(s.pricebookItems).set({ ...body, updatedAt: nowIso() }).where(eq(s.pricebookItems.id, id)));
    return c.json({ ok: true });
  });

  return { quotes, pricebook };
}

async function replaceOptionsAndLines(tx: Tx, orgId: string, quoteId: string, options: z.infer<typeof quoteCreate>["options"] | undefined, lines: z.infer<typeof quoteCreate>["lines"] | undefined) {
  if (options) {
    await tx.delete(s.quoteOptions).where(eq(s.quoteOptions.quoteId, quoteId));
    if (options.length) {
      const rows = options.map((o, i) => ({ id: newId(), orgId, quoteId, tier: o.tier, name: o.name, description: o.description ?? "", price: o.price, cost: o.cost ?? null, financingMonthly: financingMonthly(o.price), isRecommended: o.isRecommended, included: o.included, sort: i }));
      await tx.insert(s.quoteOptions).values(rows);
      const recommended = rows.find((o) => o.isRecommended) ?? rows[0];
      await tx.update(s.quotes).set({ selectedOptionId: recommended?.id ?? null }).where(eq(s.quotes.id, quoteId));
    }
  }
  if (lines) {
    await tx.delete(s.quoteLines).where(eq(s.quoteLines.quoteId, quoteId));
    if (lines.length) await tx.insert(s.quoteLines).values(lines.map((l, i) => ({ orgId, quoteId, kind: l.kind, description: l.description, quantity: l.quantity, unitCost: l.unitCost, pricebookItemId: l.pricebookItemId ?? null, sort: i })));
  }
}
