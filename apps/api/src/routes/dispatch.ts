import { schema as s, type Connection, type Tx } from "@fieldline/db";
import { companyDay, companyMinute } from "@fieldline/shared";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { scoped } from "../db";
import { notFound, todayParam } from "../http";
import { workOrderQuery } from "./work-orders";

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

async function techsWithState(tx: Tx, day: string, teamId: string | undefined) {
  const conds = [eq(s.users.role, "tech"), eq(s.users.active, true)];
  if (teamId) conds.push(eq(s.users.teamId, teamId));
  const techs = await tx.select({ id: s.users.id, name: s.users.name, title: s.users.title, teamId: s.users.teamId, shiftHours: s.users.shiftHours, phone: s.users.phone }).from(s.users).where(and(...conds)).orderBy(s.users.name);
  const ids = techs.map((t) => t.id);
  if (!ids.length) return [];
  const off = await tx.select({ userId: s.userOffDays.userId }).from(s.userOffDays).where(and(inArray(s.userOffDays.userId, ids), eq(s.userOffDays.date, day)));
  const offSet = new Set(off.map((o) => o.userId));
  const locations = await tx.select().from(s.techLocations).where(inArray(s.techLocations.techId, ids)).orderBy(desc(s.techLocations.recordedAt)).limit(200);
  const lastLocation = new Map<string, (typeof locations)[number]>();
  for (const loc of locations) if (!lastLocation.has(loc.techId)) lastLocation.set(loc.techId, loc);
  const current = await tx.select({ techId: s.workOrders.assignedTechId, id: s.workOrders.id, number: s.workOrders.number, trip: s.workOrders.trip, title: s.workOrders.title, techStatus: s.workOrders.techStatus, techStatusAt: s.workOrders.techStatusAt, siteName: s.sites.name }).from(s.workOrders).leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId)).where(and(inArray(s.workOrders.assignedTechId, ids), inArray(s.workOrders.techStatus, ["en_route", "on_site", "paused"]), eq(s.workOrders.status, "open"))).orderBy(desc(s.workOrders.techStatusAt));
  const currentByTech = new Map<string, (typeof current)[number]>();
  for (const row of current) if (row.techId && !currentByTech.has(row.techId)) currentByTech.set(row.techId, row);
  const loads = await tx.select({ techId: s.workOrders.assignedTechId, hours: sql<number>`coalesce(sum(${s.workOrders.allocatedHours}), 0)`, visits: sql<number>`count(*)` }).from(s.workOrders).where(and(inArray(s.workOrders.assignedTechId, ids), eq(s.workOrders.scheduledFor, day))).groupBy(s.workOrders.assignedTechId);
  const loadByTech = new Map(loads.map((l) => [l.techId, { hours: Number(l.hours), visits: Number(l.visits) }]));
  return techs.map((t) => ({ ...t, offToday: offSet.has(t.id), location: lastLocation.get(t.id) ?? null, current: currentByTech.get(t.id) ?? null, load: loadByTech.get(t.id) ?? { hours: 0, visits: 0 } }));
}

export function dispatchRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  /** The day board: techs, the day's slots, the open queue, and the summary line. */
  r.get("/", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const tz = org?.timezone ?? "America/Los_Angeles";
      const today = companyDay(new Date(), tz);
      const day = todayParam(q.day, today);
      const nowMinute = companyMinute(new Date(), tz);
      const techs = await techsWithState(tx, day, q.teamId || undefined);
      const slots = await workOrderQuery(tx).where(eq(s.workOrders.scheduledFor, day)).orderBy(s.workOrders.startMinute);
      const helperSlots = await tx.select({ h: s.workOrderHelpers, number: s.workOrders.number, trip: s.workOrders.trip, title: s.workOrders.title, siteName: s.sites.name }).from(s.workOrderHelpers).innerJoin(s.workOrders, eq(s.workOrders.id, s.workOrderHelpers.workOrderId)).leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId)).where(eq(s.workOrderHelpers.scheduledFor, day));
      const queue = await workOrderQuery(tx)
        .where(and(eq(s.workOrders.status, "open"), or(isNull(s.workOrders.assignedTechId), isNull(s.workOrders.scheduledFor))!))
        .orderBy(sql`case ${s.workOrders.priority} when 'urgent' then 0 when 'normal' then 1 else 2 end`, s.workOrders.createdAt)
        .limit(200);
      const readyToClose = await workOrderQuery(tx).where(and(eq(s.workOrders.status, "open"), eq(s.workOrders.techStatus, "done"))).orderBy(desc(s.workOrders.techStatusAt)).limit(100);
      const completed = await workOrderQuery(tx).where(and(inArray(s.workOrders.status, ["closed", "billed"]), eq(s.workOrders.scheduledFor, day))).orderBy(desc(s.workOrders.closedAt)).limit(100);
      const late = day === today ? slots.filter((w) => w.status === "open" && w.startMinute != null && w.startMinute + 15 < nowMinute && (!w.techStatus || w.techStatus === "en_route")).length : 0;
      const capacityHours = techs.filter((t) => !t.offToday).reduce((sum, t) => sum + Number(t.shiftHours || 8), 0);
      const booked = slots.reduce((sum, w) => sum + Number(w.allocatedHours || 0), 0);
      return {
        day,
        today,
        nowMinute,
        techs,
        slots,
        helperSlots,
        queue,
        readyToClose,
        completed,
        summary: { visits: slots.length, unassigned: queue.filter((w) => !w.assignedTechId).length, late, capacity: capacityHours ? Math.round((booked / capacityHours) * 100) : 0, bookedHours: booked, capacityHours },
      };
    });
    return c.json(data);
  });

  r.get("/week", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const start = todayParam(q.start, today);
      const startDate = new Date(`${start}T12:00:00Z`);
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setUTCDate(d.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
      });
      const techs = await techsWithState(tx, today, q.teamId || undefined);
      const rows = await workOrderQuery(tx).where(and(gte(s.workOrders.scheduledFor, days[0]!), lte(s.workOrders.scheduledFor, days[6]!))).orderBy(s.workOrders.scheduledFor, s.workOrders.startMinute);
      const off = await tx.select().from(s.userOffDays).where(and(gte(s.userOffDays.date, days[0]!), lte(s.userOffDays.date, days[6]!)));
      return { days, techs, slots: rows, offDays: off };
    });
    return c.json(data);
  });

  r.get("/month", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const month = /^\d{4}-\d{2}$/.test(q.month ?? "") ? q.month! : today.slice(0, 7);
      const from = `${month}-01`;
      const to = `${month}-31`;
      const rows = await tx
        .select({ day: s.workOrders.scheduledFor, open: sql<number>`count(*) filter (where ${s.workOrders.status} = 'open')`, assigned: sql<number>`count(*) filter (where ${s.workOrders.assignedTechId} is not null)`, hours: sql<number>`coalesce(sum(${s.workOrders.allocatedHours}), 0)`, returns: sql<number>`count(*) filter (where ${s.workOrders.needReturn})`, parts: sql<number>`count(*) filter (where ${s.workOrders.waitingOnParts})`, unassigned: sql<number>`count(*) filter (where ${s.workOrders.assignedTechId} is null and ${s.workOrders.status} = 'open')` })
        .from(s.workOrders)
        .where(and(gte(s.workOrders.scheduledFor, from), lte(s.workOrders.scheduledFor, to)))
        .groupBy(s.workOrders.scheduledFor);
      const [techCount] = await tx.select({ n: sql<number>`count(*)` }).from(s.users).where(and(eq(s.users.role, "tech"), eq(s.users.active, true)));
      const capacity = Number(techCount?.n ?? 0) * 8;
      return { month, today, capacityPerDay: capacity, days: rows.map((row) => ({ ...row, open: Number(row.open), assigned: Number(row.assigned), hours: Number(row.hours), returns: Number(row.returns), parts: Number(row.parts), unassigned: Number(row.unassigned) })) };
    });
    return c.json(data);
  });

  /** Ranked places to put one job: free hours, drive distance, and the site's primary tech. Suggestions only. */
  r.get("/suggestions", async (c) => {
    const woId = c.req.query("workOrderId");
    if (!woId) notFound("workOrderId is required");
    const data = await run(c, async (tx) => {
      const [wo] = await workOrderQuery(tx).where(eq(s.workOrders.id, woId));
      if (!wo) notFound("Work order not found");
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const hours = Number(wo.allocatedHours || 2);
      const out: { techId: string; techName: string; day: string; startMinute: number; freeHours: number; distanceKm: number | null; reason: string; score: number }[] = [];
      for (let offset = 0; offset < 3; offset++) {
        const d = new Date(`${today}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() + offset);
        const day = d.toISOString().slice(0, 10);
        const techs = await techsWithState(tx, day, undefined);
        const booked = await tx.select({ techId: s.workOrders.assignedTechId, startMinute: s.workOrders.startMinute, allocated: s.workOrders.allocatedHours }).from(s.workOrders).where(and(eq(s.workOrders.scheduledFor, day), inArray(s.workOrders.assignedTechId, techs.map((t) => t.id))));
        for (const tech of techs) {
          if (tech.offToday) continue;
          const mine = booked.filter((b) => b.techId === tech.id).sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
          const used = mine.reduce((sum, b) => sum + Number(b.allocated || 0), 0);
          const free = Number(tech.shiftHours || 8) - used;
          if (free < hours) continue;
          let start = 7 * 60;
          for (const b of mine) {
            const end = (b.startMinute ?? 0) + Number(b.allocated || 0) * 60;
            if (end > start) start = end + 15;
          }
          if (offset === 0) {
            const nowMinute = companyMinute(new Date(), org?.timezone);
            if (start < nowMinute + 30) start = Math.ceil((nowMinute + 30) / 15) * 15;
          }
          if (start + hours * 60 > 18 * 60) continue;
          const distance = tech.location && wo.siteLat != null && wo.siteLng != null ? haversineKm({ lat: Number(tech.location.lat), lng: Number(tech.location.lng) }, { lat: Number(wo.siteLat), lng: Number(wo.siteLng) }) : null;
          const primary = wo.sitePrimaryTechId === tech.id;
          const score = (primary ? 30 : 0) + (free - hours) * 2 - (distance ?? 15) - offset * 20 - (offset === 0 ? 0 : 5);
          const reasons = [primary ? "knows the site" : null, distance != null ? `${Math.round(distance * 0.62)} mi away` : null, `${free.toFixed(1)} h free`].filter(Boolean).join(" · ");
          out.push({ techId: tech.id, techName: tech.name, day, startMinute: start, freeHours: free, distanceKm: distance, reason: reasons, score });
        }
      }
      out.sort((a, b) => b.score - a.score);
      return { workOrderId: woId, suggestions: out.slice(0, 5) };
    });
    return c.json(data);
  });

  return r;
}
