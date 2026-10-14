import { schema as s, type Connection } from "@fieldline/db";
import { agingBucket, companyDay } from "@fieldline/shared";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { scoped } from "../db";

/**
 * Owner numbers, computed from the tables that hold the truth: invoices and payments for money,
 * time entries for hours, quotes for the funnel, agreements for renewals. No separate warehouse yet.
 */
export function reportsRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/overview", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const range = q.range ?? "month";
      const start = range === "week" ? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10) : range === "quarter" ? `${today.slice(0, 4)}-${String(Math.floor((Number(today.slice(5, 7)) - 1) / 3) * 3 + 1).padStart(2, "0")}-01` : range === "year" ? `${today.slice(0, 4)}-01-01` : today.slice(0, 8) + "01";
      const startStamp = `${start}T00:00:00Z`;
      const invoices = await tx.select({ inv: s.invoices, callType: s.workOrders.callType, techId: s.workOrders.assignedTechId }).from(s.invoices).leftJoin(s.workOrders, eq(s.workOrders.id, s.invoices.workOrderId)).where(and(gte(s.invoices.billedAt, startStamp), inArray(s.invoices.status, ["billed", "paid", "partially_credited"])));
      const billed = invoices.reduce((sum, x) => sum + x.inv.amount, 0);
      const prevStart = new Date(Date.parse(startStamp) - (Date.now() - Date.parse(startStamp))).toISOString();
      const [prev] = await tx.select({ amount: sql<number>`coalesce(sum(${s.invoices.amount}), 0)` }).from(s.invoices).where(and(gte(s.invoices.billedAt, prevStart), lte(s.invoices.billedAt, startStamp)));
      const waiting = await tx.select({ n: sql<number>`count(*)` }).from(s.workOrders).where(eq(s.workOrders.status, "closed"));
      const createdWos = await tx.select({ n: sql<number>`count(*)`, urgent: sql<number>`count(*) filter (where ${s.workOrders.priority} = 'urgent')` }).from(s.workOrders).where(gte(s.workOrders.createdAt, startStamp));
      const quotes = await tx.select().from(s.quotes).where(gte(s.quotes.createdAt, startStamp));
      const quoteOptions = quotes.length ? await tx.select().from(s.quoteOptions).where(inArray(s.quoteOptions.quoteId, quotes.map((x) => x.id))) : [];
      const quotePrice = (id: string, selectedId: string | null) => {
        const opts = quoteOptions.filter((o) => o.quoteId === id);
        return (opts.find((o) => o.id === selectedId) ?? opts.find((o) => o.isRecommended) ?? opts[0])?.price ?? 0;
      };
      const sent = quotes.filter((x) => x.status !== "draft");
      const viewed = quotes.filter((x) => x.viewedAt || x.status === "approved" || x.status === "declined");
      const approved = quotes.filter((x) => x.status === "approved");
      const open = await tx.select({ inv: s.invoices }).from(s.invoices).where(inArray(s.invoices.status, ["billed", "partially_credited"]));
      const paymentsAll = await tx.select({ invoiceId: s.payments.invoiceId, amount: sql<number>`coalesce(sum(${s.payments.amount}), 0)` }).from(s.payments).groupBy(s.payments.invoiceId);
      const creditsAll = await tx.select({ invoiceId: s.creditMemos.invoiceId, amount: sql<number>`coalesce(sum(${s.creditMemos.amount}), 0)` }).from(s.creditMemos).groupBy(s.creditMemos.invoiceId);
      const aging: Record<string, { amount: number; count: number }> = { current: { amount: 0, count: 0 }, "1-30": { amount: 0, count: 0 }, "31-60": { amount: 0, count: 0 }, "61-90": { amount: 0, count: 0 }, "90+": { amount: 0, count: 0 } };
      let arOver30 = 0;
      let oldest = 0;
      for (const row of open) {
        const paid = Number(paymentsAll.find((p) => p.invoiceId === row.inv.id)?.amount ?? 0);
        const credited = Number(creditsAll.find((p) => p.invoiceId === row.inv.id)?.amount ?? 0);
        const balance = Math.max(0, row.inv.amount - paid - credited);
        if (balance <= 0) continue;
        const due = row.inv.dueDate ?? row.inv.billedAt.slice(0, 10);
        const bucket = agingBucket(due, today);
        aging[bucket]!.amount += balance;
        aging[bucket]!.count += 1;
        if (bucket !== "current" && bucket !== "1-30") arOver30 += balance;
        oldest = Math.max(oldest, Math.floor((Date.parse(today) - Date.parse(due)) / 86400000));
      }
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const renewals = await tx.select().from(s.agreements).where(and(eq(s.agreements.status, "active"), lte(s.agreements.endsOn, in60)));
      // Revenue by week, last 12 weeks
      const weeks: { start: string; amount: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(`${today}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - d.getUTCDay() - i * 7);
        weeks.push({ start: d.toISOString().slice(0, 10), amount: 0 });
      }
      const twelveWeeksAgo = `${weeks[0]!.start}T00:00:00Z`;
      const recentInvoices = await tx.select({ billedAt: s.invoices.billedAt, amount: s.invoices.amount }).from(s.invoices).where(and(gte(s.invoices.billedAt, twelveWeeksAgo), inArray(s.invoices.status, ["billed", "paid", "partially_credited"])));
      for (const inv of recentInvoices) {
        const day = inv.billedAt.slice(0, 10);
        const week = [...weeks].reverse().find((w) => w.start <= day);
        if (week) week.amount += inv.amount;
      }
      // Capacity: scheduled hours vs tech hours per week
      const techCount = await tx.select({ n: sql<number>`count(*)` }).from(s.users).where(and(eq(s.users.role, "tech"), eq(s.users.active, true)));
      const capacityPerWeek = Number(techCount[0]?.n ?? 0) * 40;
      const scheduled = await tx.select({ day: s.workOrders.scheduledFor, hours: sql<number>`coalesce(sum(${s.workOrders.allocatedHours}), 0)` }).from(s.workOrders).where(gte(s.workOrders.scheduledFor, weeks[0]!.start)).groupBy(s.workOrders.scheduledFor);
      const capacity = weeks.map((w) => {
        const end = new Date(`${w.start}T12:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 6);
        const endDay = end.toISOString().slice(0, 10);
        const hours = scheduled.filter((x) => x.day && x.day >= w.start && x.day <= endDay).reduce((sum, x) => sum + Number(x.hours), 0);
        return { start: w.start, percent: capacityPerWeek ? Math.round((hours / capacityPerWeek) * 100) : 0 };
      });
      // Margin by job type (billed amount vs estimated cost from time entries at cost rate and material cost)
      const byType: Record<string, { revenue: number; count: number }> = {};
      for (const row of invoices) {
        const key = row.callType ?? "service";
        byType[key] = byType[key] ?? { revenue: 0, count: 0 };
        byType[key]!.revenue += row.inv.amount;
        byType[key]!.count += 1;
      }
      // Tech scorecard
      const techs = await tx.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "tech"), eq(s.users.active, true))).orderBy(s.users.name);
      const jobs = await tx.select({ techId: s.workOrders.assignedTechId, jobs: sql<number>`count(*) filter (where ${s.workOrders.status} in ('closed','billed'))`, callbacks: sql<number>`count(*) filter (where ${s.workOrders.needReturn})` }).from(s.workOrders).where(gte(s.workOrders.createdAt, startStamp)).groupBy(s.workOrders.assignedTechId);
      const hours = await tx.select({ techId: s.timeEntries.techId, worked: sql<number>`coalesce(sum(case when ${s.timeEntries.stoppedAt} is not null and ${s.timeEntries.startedAt} is not null then extract(epoch from (${s.timeEntries.stoppedAt}::timestamptz - ${s.timeEntries.startedAt}::timestamptz)) / 3600 else ${s.timeEntries.hours} end) filter (where ${s.timeEntries.kind} in ('labor','travel')), 0)`, billable: sql<number>`coalesce(sum(case when ${s.timeEntries.stoppedAt} is not null and ${s.timeEntries.startedAt} is not null then extract(epoch from (${s.timeEntries.stoppedAt}::timestamptz - ${s.timeEntries.startedAt}::timestamptz)) / 3600 else ${s.timeEntries.hours} end) filter (where ${s.timeEntries.kind} in ('labor','travel') and ${s.timeEntries.workOrderId} is not null), 0)` }).from(s.timeEntries).where(gte(s.timeEntries.date, start)).groupBy(s.timeEntries.techId);
      const revenueByTech = new Map<string, number>();
      for (const row of invoices) if (row.techId) revenueByTech.set(row.techId, (revenueByTech.get(row.techId) ?? 0) + row.inv.amount);
      const scorecard = techs.map((t) => {
        const j = jobs.find((x) => x.techId === t.id);
        const h = hours.find((x) => x.techId === t.id);
        const worked = Number(h?.worked ?? 0);
        const billable = Number(h?.billable ?? 0);
        const revenue = revenueByTech.get(t.id) ?? 0;
        const jobCount = Number(j?.jobs ?? 0);
        return { techId: t.id, name: t.name, jobs: jobCount, worked: Math.round(worked * 10) / 10, billable: Math.round(billable * 10) / 10, billableShare: worked ? Math.round((billable / worked) * 100) : 0, avgTicket: jobCount ? Math.round(revenue / jobCount) : 0, callbacks: Number(j?.callbacks ?? 0), revenue };
      });
      const unsold = sent.filter((x) => x.status === "sent" || x.status === "viewed" || x.status === "follow_up");
      return {
        range,
        start,
        today,
        kpis: {
          billed,
          billedChange: Number(prev?.amount ?? 0) ? Math.round(((billed - Number(prev!.amount)) / Number(prev!.amount)) * 100) : null,
          waitingToBill: Number(waiting[0]?.n ?? 0),
          workOrdersCreated: Number(createdWos[0]?.n ?? 0),
          urgentShare: Number(createdWos[0]?.n ?? 0) ? Math.round((Number(createdWos[0]!.urgent) / Number(createdWos[0]!.n)) * 100) : 0,
          averageTicket: invoices.length ? Math.round(billed / invoices.length) : 0,
          closeRate: sent.length ? Math.round((approved.length / sent.length) * 100) : 0,
          quotesSent: sent.length,
          quotesViewed: viewed.length,
          quotesApproved: approved.length,
          approvedValue: approved.reduce((sum, x) => sum + quotePrice(x.id, x.selectedOptionId), 0),
          sentValue: sent.reduce((sum, x) => sum + quotePrice(x.id, x.selectedOptionId), 0),
          unsoldValue: unsold.reduce((sum, x) => sum + quotePrice(x.id, x.selectedOptionId), 0),
          unsoldCount: unsold.length,
          arOver30,
          arTotal: Object.values(aging).reduce((sum, b) => sum + b.amount, 0),
          oldestDays: oldest,
          renewalsDue: renewals.length,
          renewalsValue: renewals.reduce((sum, a) => sum + a.amount, 0),
        },
        revenueByWeek: weeks,
        capacityByWeek: capacity,
        aging,
        byJobType: byType,
        scorecard,
      };
    });
    return c.json(data);
  });

  r.get("/activity", async (c) => {
    const rows = await run(c, (tx) => tx.select({ f: s.fieldChanges, userName: s.users.name }).from(s.fieldChanges).leftJoin(s.users, eq(s.users.id, s.fieldChanges.userId)).orderBy(desc(s.fieldChanges.createdAt)).limit(100));
    return c.json({ activity: rows });
  });

  return r;
}
