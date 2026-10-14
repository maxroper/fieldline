import { schema as s, type Connection } from "@fieldline/db";
import { companyDay, isoDate } from "@fieldline/shared";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { jsonBody, notFound, parse, todayParam } from "../http";
import { publish } from "../realtime";
import { workOrderQuery } from "./work-orders";
import { z } from "zod";

const locationBody = z.object({ lat: z.number(), lng: z.number(), accuracyM: z.number().int().optional() });
const offDayBody = z.object({ date: isoDate, note: z.string().optional() });

export function techsRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  /** Tech status page: every tech with today's load, status, week hours, backlog and last position. */
  r.get("/", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const day = todayParam(q.day, today);
      const weekStart = new Date(`${day}T12:00:00Z`);
      weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
      const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setUTCDate(d.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
      });
      const conds = [eq(s.users.role, "tech"), eq(s.users.active, true)];
      if (q.teamId) conds.push(eq(s.users.teamId, q.teamId));
      const techs = await tx.select().from(s.users).where(and(...conds)).orderBy(s.users.name);
      const ids = techs.map((t) => t.id);
      const weekWos = ids.length ? await workOrderQuery(tx).where(and(inArray(s.workOrders.assignedTechId, ids), gte(s.workOrders.scheduledFor, weekDays[0]!), lte(s.workOrders.scheduledFor, weekDays[6]!))).orderBy(s.workOrders.scheduledFor, s.workOrders.startMinute) : [];
      const backlog = ids.length ? await tx.select({ techId: s.workOrders.assignedTechId, hours: sql<number>`coalesce(sum(${s.workOrders.allocatedHours}), 0)`, n: sql<number>`count(*)` }).from(s.workOrders).where(and(inArray(s.workOrders.assignedTechId, ids), eq(s.workOrders.status, "open"), or(isNull(s.workOrders.scheduledFor), sql`${s.workOrders.scheduledFor} > ${weekDays[6]!}`)!)).groupBy(s.workOrders.assignedTechId) : [];
      const off = ids.length ? await tx.select().from(s.userOffDays).where(and(inArray(s.userOffDays.userId, ids), gte(s.userOffDays.date, weekDays[0]!))).orderBy(s.userOffDays.date) : [];
      const charged = ids.length ? await tx.select({ techId: s.timeEntries.techId, date: s.timeEntries.date, hours: sql<number>`coalesce(sum(case when ${s.timeEntries.stoppedAt} is not null then extract(epoch from (${s.timeEntries.stoppedAt}::timestamptz - ${s.timeEntries.startedAt}::timestamptz)) / 3600 else ${s.timeEntries.hours} end), 0)` }).from(s.timeEntries).where(and(inArray(s.timeEntries.techId, ids), gte(s.timeEntries.date, weekDays[0]!), lte(s.timeEntries.date, weekDays[6]!), inArray(s.timeEntries.kind, ["labor", "travel"]))).groupBy(s.timeEntries.techId, s.timeEntries.date) : [];
      const locations = ids.length ? await tx.select().from(s.techLocations).where(inArray(s.techLocations.techId, ids)).orderBy(desc(s.techLocations.recordedAt)).limit(100) : [];
      const monthStats = ids.length ? await tx.select({ techId: s.workOrders.assignedTechId, jobs: sql<number>`count(*) filter (where ${s.workOrders.status} in ('closed','billed'))`, returns: sql<number>`count(*) filter (where ${s.workOrders.needReturn})` }).from(s.workOrders).where(and(inArray(s.workOrders.assignedTechId, ids), sql`${s.workOrders.scheduledFor} >= date_trunc('month', now())::date`)).groupBy(s.workOrders.assignedTechId) : [];
      return {
        day,
        today,
        weekDays,
        techs: techs.map((t) => ({
          id: t.id,
          name: t.name,
          title: t.title,
          teamId: t.teamId,
          phone: t.phone,
          shiftHours: t.shiftHours,
          visits: weekWos.filter((w) => w.assignedTechId === t.id),
          todayVisits: weekWos.filter((w) => w.assignedTechId === t.id && w.scheduledFor === day),
          weekHours: weekDays.map((d) => ({ date: d, scheduled: weekWos.filter((w) => w.assignedTechId === t.id && w.scheduledFor === d).reduce((sum, w) => sum + Number(w.allocatedHours || 0), 0), charged: Number(charged.find((x) => x.techId === t.id && x.date === d)?.hours ?? 0), off: off.some((o) => o.userId === t.id && o.date === d) })),
          backlog: { hours: Number(backlog.find((b) => b.techId === t.id)?.hours ?? 0), count: Number(backlog.find((b) => b.techId === t.id)?.n ?? 0) },
          offDays: off.filter((o) => o.userId === t.id).map((o) => o.date),
          location: locations.find((l) => l.techId === t.id) ?? null,
          current: weekWos.find((w) => w.assignedTechId === t.id && w.scheduledFor === day && (w.techStatus === "on_site" || w.techStatus === "en_route" || w.techStatus === "paused")) ?? null,
          month: { jobs: Number(monthStats.find((m) => m.techId === t.id)?.jobs ?? 0), callbacks: Number(monthStats.find((m) => m.techId === t.id)?.returns ?? 0) },
        })),
      };
    });
    return c.json(data);
  });

  /** The tech app's day: visits (lead and helper), notices, time entries, and the van. `me` is the signed-in tech. */
  r.get("/:id/day", async (c) => {
    const param = c.req.param("id");
    const data = await run(c, async (tx, session) => {
      const techId = param === "me" ? session.userId : param;
      const [org] = await tx.select({ timezone: s.orgs.timezone, name: s.orgs.name }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const date = todayParam(c.req.query("date"), today);
      const [tech] = await tx.select().from(s.users).where(eq(s.users.id, techId)).limit(1);
      if (!tech) notFound("Tech not found");
      const lead = await workOrderQuery(tx).where(and(eq(s.workOrders.assignedTechId, techId), eq(s.workOrders.scheduledFor, date))).orderBy(s.workOrders.startMinute);
      const helperRows = await tx.select({ h: s.workOrderHelpers }).from(s.workOrderHelpers).where(and(eq(s.workOrderHelpers.techId, techId), eq(s.workOrderHelpers.scheduledFor, date)));
      const helperWos = helperRows.length ? await workOrderQuery(tx).where(inArray(s.workOrders.id, helperRows.map((h) => h.h.workOrderId))) : [];
      const visits = [...lead.map((w) => ({ ...w, role: "lead" as const })), ...helperWos.map((w) => ({ ...w, role: "helper" as const, startMinute: helperRows.find((h) => h.h.workOrderId === w.id)?.h.startMinute ?? w.startMinute }))].sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
      const siteIds = visits.map((v) => v.siteId).filter((x): x is string => Boolean(x));
      const siteRows = siteIds.length ? await tx.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];
      const notices = await tx.select().from(s.notifications).where(and(eq(s.notifications.userId, techId), isNull(s.notifications.readAt))).orderBy(desc(s.notifications.createdAt)).limit(10);
      const entries = await tx.select().from(s.timeEntries).where(and(eq(s.timeEntries.techId, techId), eq(s.timeEntries.date, date))).orderBy(s.timeEntries.startedAt);
      const [sheet] = await tx.select().from(s.timesheets).where(and(eq(s.timesheets.techId, techId), eq(s.timesheets.date, date))).limit(1);
      const [van] = await tx.select().from(s.warehouses).where(and(eq(s.warehouses.techId, techId), eq(s.warehouses.active, true))).limit(1);
      const pending = await tx.select({ n: sql<number>`count(*)` }).from(s.files).where(and(eq(s.files.createdBy, techId), eq(s.files.bytes, 0)));
      return { date, today, tech: { id: tech.id, name: tech.name, title: tech.title }, org: org?.name, visits, sites: siteRows, notices, timeEntries: entries, timesheet: sheet ?? null, van: van ?? null, pendingUploads: Number(pending[0]?.n ?? 0) };
    });
    return c.json(data);
  });

  r.post("/:id/location", async (c) => {
    const param = c.req.param("id");
    const body = parse(locationBody, await jsonBody(c));
    await run(c, async (tx, session) => {
      const techId = param === "me" ? session.userId : param;
      await tx.insert(s.techLocations).values({ orgId: session.orgId, techId, lat: body.lat, lng: body.lng, accuracyM: body.accuracyM ?? null, recordedAt: nowIso() });
    });
    publish(c.get("session").orgId, "tech.location", param);
    return c.json({ ok: true });
  });

  r.post("/:id/notices/read", async (c) => {
    const param = c.req.param("id");
    await run(c, async (tx, session) => {
      const techId = param === "me" ? session.userId : param;
      await tx.update(s.notifications).set({ readAt: nowIso() }).where(and(eq(s.notifications.userId, techId), isNull(s.notifications.readAt)));
    });
    return c.json({ ok: true });
  });

  r.post("/:id/off-days", async (c) => {
    const techId = c.req.param("id");
    const body = parse(offDayBody, await jsonBody(c));
    await run(c, async (tx, session) => {
      await tx.insert(s.userOffDays).values({ orgId: session.orgId, userId: techId, date: body.date, note: body.note ?? "" }).onConflictDoNothing();
    });
    publish(c.get("session").orgId, "tech.updated", techId);
    return c.json({ ok: true });
  });

  r.delete("/:id/off-days/:date", async (c) => {
    const techId = c.req.param("id");
    const date = c.req.param("date");
    await run(c, (tx) => tx.delete(s.userOffDays).where(and(eq(s.userOffDays.userId, techId), eq(s.userOffDays.date, date))));
    publish(c.get("session").orgId, "tech.updated", techId);
    return c.json({ ok: true });
  });

  return r;
}
