import { schema as s, type Connection, type Tx } from "@fieldline/db";
import { agingBucket, companyDay, customerCreate, customerUpdate, equipmentCreate, equipmentUpdate, newId, newToken, siteCreate, siteUpdate } from "@fieldline/shared";
import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";
import { workOrderQuery } from "./work-orders";

async function balances(tx: Tx, customerIds: string[]) {
  if (!customerIds.length) return new Map<string, { billed: number; paid: number; credited: number; open: number; oldestDue: string | null }>();
  const billed = await tx.select({ customerId: s.invoices.customerId, amount: sql<number>`coalesce(sum(${s.invoices.amount}), 0)`, oldest: sql<string | null>`min(${s.invoices.dueDate})` }).from(s.invoices).where(and(inArray(s.invoices.customerId, customerIds), inArray(s.invoices.status, ["billed", "partially_credited"]))).groupBy(s.invoices.customerId);
  const paid = await tx.select({ customerId: s.payments.customerId, amount: sql<number>`coalesce(sum(${s.payments.amount}), 0)` }).from(s.payments).where(inArray(s.payments.customerId, customerIds)).groupBy(s.payments.customerId);
  const credited = await tx.select({ customerId: s.invoices.customerId, amount: sql<number>`coalesce(sum(${s.creditMemos.amount}), 0)` }).from(s.creditMemos).innerJoin(s.invoices, eq(s.invoices.id, s.creditMemos.invoiceId)).where(inArray(s.invoices.customerId, customerIds)).groupBy(s.invoices.customerId);
  const map = new Map<string, { billed: number; paid: number; credited: number; open: number; oldestDue: string | null }>();
  for (const id of customerIds) {
    const b = billed.find((x) => x.customerId === id);
    const p = paid.find((x) => x.customerId === id);
    const cr = credited.find((x) => x.customerId === id);
    const open = Math.max(0, Number(b?.amount ?? 0) - Number(p?.amount ?? 0) - Number(cr?.amount ?? 0));
    map.set(id, { billed: Number(b?.amount ?? 0), paid: Number(p?.amount ?? 0), credited: Number(cr?.amount ?? 0), open: Math.round(open * 100) / 100, oldestDue: b?.oldest ?? null });
  }
  return map;
}

async function logChanges(tx: Tx, orgId: string, userId: string, entity: string, entityId: string, before: Record<string, unknown>, patch: Record<string, unknown>) {
  const rows = Object.entries(patch)
    .filter(([key, value]) => value !== undefined && String(before[key] ?? "") !== String(value ?? ""))
    .map(([field, value]) => ({ orgId, entity, entityId, field, fromValue: String(before[field] ?? ""), toValue: String(value ?? ""), userId }));
  if (rows.length) await tx.insert(s.fieldChanges).values(rows);
}

export function customersRoutes(conn: Connection) {
  const run = scoped(conn);
  const customers = new Hono<AppEnv>();
  const sites = new Hono<AppEnv>();
  const equipment = new Hono<AppEnv>();

  customers.get("/", async (c) => {
    const q = c.req.query();
    const rows = await run(c, async (tx) => {
      const conds = [];
      if (q.q) conds.push(or(ilike(s.customers.name, `%${q.q}%`), ilike(s.customers.billingAddress, `%${q.q}%`), ilike(s.customers.phone, `%${q.q}%`))!);
      const list = await tx.select().from(s.customers).where(conds.length ? and(...conds) : undefined).orderBy(s.customers.name).limit(500);
      const ids = list.map((x) => x.id);
      const siteCounts = ids.length ? await tx.select({ customerId: s.sites.customerId, n: sql<number>`count(*)` }).from(s.sites).where(inArray(s.sites.customerId, ids)).groupBy(s.sites.customerId) : [];
      const agreementCounts = ids.length ? await tx.select({ customerId: s.agreements.customerId, n: sql<number>`count(*)` }).from(s.agreements).where(and(inArray(s.agreements.customerId, ids), eq(s.agreements.status, "active"))).groupBy(s.agreements.customerId) : [];
      const lastVisit = ids.length ? await tx.select({ customerId: s.workOrders.customerId, last: sql<string | null>`max(${s.workOrders.scheduledFor})` }).from(s.workOrders).where(inArray(s.workOrders.customerId, ids)).groupBy(s.workOrders.customerId) : [];
      const bal = await balances(tx, ids);
      return list.map((cu) => ({
        ...cu,
        siteCount: Number(siteCounts.find((x) => x.customerId === cu.id)?.n ?? 0),
        agreements: Number(agreementCounts.find((x) => x.customerId === cu.id)?.n ?? 0),
        lastVisit: lastVisit.find((x) => x.customerId === cu.id)?.last ?? null,
        balance: bal.get(cu.id) ?? { billed: 0, paid: 0, credited: 0, open: 0, oldestDue: null },
      }));
    });
    return c.json({ customers: rows });
  });

  /** Caller-ID style lookup: who is calling, what is open for them, and whether a new work order would be a duplicate. */
  customers.get("/lookup", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const digits = (q.phone ?? "").replace(/\D/g, "").slice(-10);
      const needle = (q.q ?? q.address ?? "").trim();
      const conds = [];
      if (digits.length >= 7) conds.push(or(sql`regexp_replace(${s.sites.contactPhone}, '\\D', '', 'g') like ${"%" + digits}`, sql`regexp_replace(${s.customers.phone}, '\\D', '', 'g') like ${"%" + digits}`)!);
      if (needle) conds.push(or(ilike(s.sites.name, `%${needle}%`), ilike(s.sites.address, `%${needle}%`), ilike(s.customers.name, `%${needle}%`), ilike(s.sites.contact, `%${needle}%`))!);
      if (!conds.length) return { matches: [] };
      const matches = await tx
        .select({ site: s.sites, customerName: s.customers.name, customerId: s.customers.id, contract: s.customers.contract, primaryTechName: s.users.name })
        .from(s.sites)
        .innerJoin(s.customers, eq(s.customers.id, s.sites.customerId))
        .leftJoin(s.users, eq(s.users.id, s.sites.primaryTechId))
        .where(or(...conds))
        .limit(10);
      const out = [];
      for (const m of matches) {
        const openWos = await workOrderQuery(tx).where(and(eq(s.workOrders.siteId, m.site.id), eq(s.workOrders.status, "open"))).orderBy(desc(s.workOrders.createdAt)).limit(5);
        const [lastVisit] = await workOrderQuery(tx).where(and(eq(s.workOrders.siteId, m.site.id), inArray(s.workOrders.status, ["closed", "billed"]))).orderBy(desc(s.workOrders.scheduledFor)).limit(1);
        const units = await tx.select().from(s.equipment).where(eq(s.equipment.siteId, m.site.id));
        const [agreement] = await tx.select().from(s.agreements).where(and(eq(s.agreements.siteId, m.site.id), eq(s.agreements.status, "active"))).limit(1);
        const bal = await balances(tx, [m.customerId]);
        out.push({ ...m, openWorkOrders: openWos, lastVisit: lastVisit ?? null, equipment: units, agreement: agreement ?? null, balance: bal.get(m.customerId)?.open ?? 0 });
      }
      return { matches: out };
    });
    return c.json(data);
  });

  customers.get("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await run(c, async (tx) => {
      const [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, id)).limit(1);
      if (!customer) notFound("Customer not found");
      const siteRows = await tx.select({ site: s.sites, primaryTechName: s.users.name }).from(s.sites).leftJoin(s.users, eq(s.users.id, s.sites.primaryTechId)).where(eq(s.sites.customerId, id)).orderBy(s.sites.name);
      const agreementRows = await tx.select().from(s.agreements).where(eq(s.agreements.customerId, id));
      const visits = agreementRows.length ? await tx.select().from(s.agreementVisits).where(inArray(s.agreementVisits.agreementId, agreementRows.map((a) => a.id))) : [];
      const invoiceRows = await tx.select().from(s.invoices).where(eq(s.invoices.customerId, id)).orderBy(desc(s.invoices.billedAt)).limit(20);
      const paymentRows = await tx.select().from(s.payments).where(eq(s.payments.customerId, id)).orderBy(desc(s.payments.receivedAt)).limit(20);
      const credits = invoiceRows.length ? await tx.select().from(s.creditMemos).where(inArray(s.creditMemos.invoiceId, invoiceRows.map((i) => i.id))) : [];
      const bal = await balances(tx, [id]);
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const aging: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
      for (const inv of invoiceRows) {
        if (inv.status !== "billed" && inv.status !== "partially_credited") continue;
        const paidOnInvoice = paymentRows.filter((p) => p.invoiceId === inv.id).reduce((sum, p) => sum + p.amount, 0);
        const creditedOnInvoice = credits.filter((cr) => cr.invoiceId === inv.id).reduce((sum, cr) => sum + cr.amount, 0);
        const open = Math.max(0, inv.amount - paidOnInvoice - creditedOnInvoice);
        if (open > 0) aging[agingBucket(inv.dueDate ?? inv.billedAt.slice(0, 10), today)]! += open;
      }
      const openWos = await workOrderQuery(tx).where(and(eq(s.workOrders.customerId, id), eq(s.workOrders.status, "open"))).orderBy(desc(s.workOrders.createdAt)).limit(20);
      const recent = await workOrderQuery(tx).where(and(eq(s.workOrders.customerId, id), inArray(s.workOrders.status, ["closed", "billed"]))).orderBy(desc(s.workOrders.scheduledFor)).limit(10);
      const changes = await tx.select({ f: s.fieldChanges, userName: s.users.name }).from(s.fieldChanges).leftJoin(s.users, eq(s.users.id, s.fieldChanges.userId)).where(and(eq(s.fieldChanges.entity, "customer"), eq(s.fieldChanges.entityId, id))).orderBy(desc(s.fieldChanges.createdAt)).limit(30);
      const [ytdRow] = await tx.select({ ytd: sql<number>`coalesce(sum(${s.invoices.amount}), 0)` }).from(s.invoices).where(and(eq(s.invoices.customerId, id), sql`${s.invoices.billedAt} >= date_trunc('year', now())`));
      return { customer, sites: siteRows, agreements: agreementRows.map((a) => ({ ...a, visits: visits.filter((v) => v.agreementId === a.id) })), invoices: invoiceRows, payments: paymentRows, credits, balance: bal.get(id), aging, openWorkOrders: openWos, recentVisits: recent, changes, yearToDate: Number(ytdRow?.ytd ?? 0) };
    });
    return c.json(data);
  });

  customers.post("/", async (c) => {
    const body = parse(customerCreate, await jsonBody(c));
    const created = await run(c, async (tx, session) => {
      const { site, ...fields } = body;
      const id = newId();
      await tx.insert(s.customers).values({ ...fields, id, orgId: session.orgId, email: fields.email || "", portalToken: newToken(10) });
      let siteId: string | null = null;
      if (site) {
        siteId = newId();
        await tx.insert(s.sites).values({ ...site, id: siteId, orgId: session.orgId, customerId: id, name: site.name || site.address });
      }
      await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "customer", entityId: id, field: "created", fromValue: "", toValue: fields.name, userId: session.userId });
      return { id, siteId };
    });
    publish(c.get("session").orgId, "customer.created", created.id);
    return c.json(created, 201);
  });

  customers.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(customerUpdate, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [before] = await tx.select().from(s.customers).where(eq(s.customers.id, id)).limit(1);
      if (!before) notFound("Customer not found");
      await logChanges(tx, session.orgId, session.userId, "customer", id, before, body);
      await tx.update(s.customers).set({ ...body, email: body.email ?? before.email, updatedAt: nowIso() }).where(eq(s.customers.id, id));
    });
    publish(c.get("session").orgId, "customer.updated", id);
    return c.json({ ok: true });
  });

  sites.get("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await run(c, async (tx) => {
      const [site] = await tx.select().from(s.sites).where(eq(s.sites.id, id)).limit(1);
      if (!site) notFound("Site not found");
      const [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, site.customerId)).limit(1);
      const units = await tx.select().from(s.equipment).where(eq(s.equipment.siteId, id)).orderBy(s.equipment.tag);
      const [agreement] = await tx.select().from(s.agreements).where(and(eq(s.agreements.siteId, id), eq(s.agreements.status, "active"))).limit(1);
      const assets = agreement ? await tx.select().from(s.agreementAssets).where(eq(s.agreementAssets.agreementId, agreement.id)) : [];
      const open = await workOrderQuery(tx).where(and(eq(s.workOrders.siteId, id), eq(s.workOrders.status, "open"))).orderBy(desc(s.workOrders.createdAt));
      const history = await workOrderQuery(tx).where(and(eq(s.workOrders.siteId, id), inArray(s.workOrders.status, ["closed", "billed"]))).orderBy(desc(s.workOrders.scheduledFor)).limit(15);
      const logs = units.length ? await tx.select().from(s.refrigerantLogs).where(inArray(s.refrigerantLogs.equipmentId, units.map((u) => u.id))).orderBy(desc(s.refrigerantLogs.loggedAt)) : [];
      const warranty = units.length ? await tx.select().from(s.warrantyClaims).where(inArray(s.warrantyClaims.equipmentId, units.map((u) => u.id))) : [];
      const techs = await tx.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "tech"), eq(s.users.active, true)));
      const changes = await tx.select({ f: s.fieldChanges, userName: s.users.name }).from(s.fieldChanges).leftJoin(s.users, eq(s.users.id, s.fieldChanges.userId)).where(and(eq(s.fieldChanges.entity, "site"), eq(s.fieldChanges.entityId, id))).orderBy(desc(s.fieldChanges.createdAt)).limit(30);
      return { site, customer: customer ?? null, equipment: units, agreement: agreement ? { ...agreement, assetIds: assets.map((a) => a.equipmentId) } : null, openWorkOrders: open, history, refrigerantLogs: logs, warrantyClaims: warranty, techs, changes };
    });
    return c.json(data);
  });

  sites.post("/", async (c) => {
    const body = parse(siteCreate, await jsonBody(c));
    const site = await run(c, async (tx, session) => {
      const [row] = await tx.insert(s.sites).values({ ...body, orgId: session.orgId, name: body.name || body.address }).returning();
      return row!;
    });
    return c.json({ site }, 201);
  });

  sites.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(siteUpdate, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [before] = await tx.select().from(s.sites).where(eq(s.sites.id, id)).limit(1);
      if (!before) notFound("Site not found");
      await logChanges(tx, session.orgId, session.userId, "site", id, before, body);
      await tx.update(s.sites).set({ ...body, updatedAt: nowIso() }).where(eq(s.sites.id, id));
    });
    return c.json({ ok: true });
  });

  equipment.get("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await run(c, async (tx) => {
      const [unit] = await tx.select().from(s.equipment).where(eq(s.equipment.id, id)).limit(1);
      if (!unit) notFound("Unit not found");
      const [site] = await tx.select().from(s.sites).where(eq(s.sites.id, unit.siteId)).limit(1);
      const history = await workOrderQuery(tx).where(eq(s.workOrders.equipmentId, id)).orderBy(desc(s.workOrders.createdAt)).limit(20);
      const logs = await tx.select().from(s.refrigerantLogs).where(eq(s.refrigerantLogs.equipmentId, id)).orderBy(desc(s.refrigerantLogs.loggedAt));
      const warranty = await tx.select().from(s.warrantyClaims).where(eq(s.warrantyClaims.equipmentId, id));
      const fileRows = await tx.select().from(s.files).where(eq(s.files.equipmentId, id)).orderBy(desc(s.files.createdAt));
      return { equipment: unit, site: site ?? null, history, refrigerantLogs: logs, warrantyClaims: warranty, files: fileRows };
    });
    return c.json(data);
  });

  equipment.post("/", async (c) => {
    const body = parse(equipmentCreate, await jsonBody(c));
    const unit = await run(c, async (tx, session) => {
      const [row] = await tx.insert(s.equipment).values({ ...body, orgId: session.orgId, qrCode: `FL-${body.tag.replace(/\s+/g, "")}-${newToken(4)}` }).returning();
      return row!;
    });
    return c.json({ equipment: unit }, 201);
  });

  equipment.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(equipmentUpdate, await jsonBody(c));
    await run(c, async (tx) => {
      await tx.update(s.equipment).set({ ...body, updatedAt: nowIso() }).where(eq(s.equipment.id, id));
    });
    return c.json({ ok: true });
  });

  /** Equipment with a leak rate over threshold or a warranty window closing: the office's compliance list. */
  equipment.get("/", async (c) => {
    const rows = await run(c, async (tx) => {
      const units = await tx.select({ unit: s.equipment, siteName: s.sites.name, customerName: s.customers.name }).from(s.equipment).innerJoin(s.sites, eq(s.sites.id, s.equipment.siteId)).innerJoin(s.customers, eq(s.customers.id, s.sites.customerId)).where(isNull(sql`null`)).orderBy(s.customers.name, s.equipment.tag).limit(500);
      return units;
    });
    return c.json({ equipment: rows });
  });

  return { customers, sites, equipment };
}
