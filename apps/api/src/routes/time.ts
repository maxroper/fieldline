import { schema as s, type Connection, type Tx } from "@fieldline/db";
import { californiaDaily, companyDay, entryHours, sheetCheck, timeEntryCreate, timeEntryUpdate, timesheetReview, timesheetSubmit, woLabel, type SheetRow } from "@fieldline/shared";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { conflict, jsonBody, notFound, parse, todayParam } from "../http";
import { publish } from "../realtime";

async function dayRows(tx: Tx, techId: string, date: string) {
  const rows = await tx
    .select({ e: s.timeEntries, number: s.workOrders.number, trip: s.workOrders.trip, title: s.workOrders.title, siteName: s.sites.name })
    .from(s.timeEntries)
    .leftJoin(s.workOrders, eq(s.workOrders.id, s.timeEntries.workOrderId))
    .leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId))
    .where(and(eq(s.timeEntries.techId, techId), eq(s.timeEntries.date, date)))
    .orderBy(s.timeEntries.startedAt, s.timeEntries.createdAt);
  const now = nowIso();
  const entries = rows.map((row) => {
    const running = Boolean(row.e.startedAt && !row.e.stoppedAt);
    const hours = running ? entryHours({ ...row.e, stoppedAt: now }) : entryHours(row.e);
    return { ...row.e, hours, running, label: row.number ? woLabel({ number: row.number, trip: row.trip }) : null, title: row.title, siteName: row.siteName };
  });
  const sheetRows: SheetRow[] = entries.map((e) => ({ id: e.id, kind: e.kind, hours: e.hours, startedAt: e.startedAt, arrivedAt: e.arrivedAt ?? undefined, stoppedAt: e.stoppedAt, edited: e.edited, running: e.running, workOrderId: e.workOrderId }));
  const [scheduled] = await tx.select({ hours: sql<number>`coalesce(sum(${s.workOrders.allocatedHours}), 0)` }).from(s.workOrders).where(and(eq(s.workOrders.assignedTechId, techId), eq(s.workOrders.scheduledFor, date)));
  const check = sheetCheck(sheetRows, Number(scheduled?.hours ?? 0));
  const travel = entries.filter((e) => e.kind === "travel").reduce((sum, e) => sum + e.hours, 0);
  const onSite = entries.filter((e) => e.kind === "labor").reduce((sum, e) => sum + e.hours, 0);
  const meal = entries.filter((e) => e.kind === "meal").reduce((sum, e) => sum + e.hours, 0);
  const rest = entries.filter((e) => e.kind === "rest").reduce((sum, e) => sum + e.hours, 0);
  return { entries, check, totals: { travel: Math.round(travel * 100) / 100, onSite: Math.round(onSite * 100) / 100, meal: Math.round(meal * 100) / 100, rest: Math.round(rest * 100) / 100, paid: check.paidHours }, overtime: californiaDaily(check.paidHours) };
}

export function timeRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/entries", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx, session) => {
      const techId = q.techId === "me" || !q.techId ? session.userId : q.techId;
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const date = todayParam(q.date, companyDay(new Date(), org?.timezone));
      const [sheet] = await tx.select().from(s.timesheets).where(and(eq(s.timesheets.techId, techId), eq(s.timesheets.date, date))).limit(1);
      return { techId, date, ...(await dayRows(tx, techId, date)), timesheet: sheet ?? null };
    });
    return c.json(data);
  });

  r.post("/entries", async (c) => {
    const body = parse(timeEntryCreate, await jsonBody(c));
    const entry = await run(c, async (tx, session) => {
      const techId = session.role === "tech" ? session.userId : body.techId ?? session.userId;
      const [sheet] = await tx.select().from(s.timesheets).where(and(eq(s.timesheets.techId, techId), eq(s.timesheets.date, body.date))).limit(1);
      if (sheet?.status === "approved" && session.role === "tech") conflict("This day was approved. Ask the office to reopen it.");
      const [row] = await tx.insert(s.timeEntries).values({ orgId: session.orgId, techId, workOrderId: body.workOrderId ?? null, kind: body.kind, date: body.date, startedAt: body.startedAt ?? null, arrivedAt: body.arrivedAt ?? null, stoppedAt: body.stoppedAt ?? null, hours: body.hours ?? 0, edited: Boolean(body.edited || body.hours), editedBy: session.userId, source: "manual", gpsVerified: Boolean(body.gpsVerified) }).returning();
      return row!;
    });
    publish(c.get("session").orgId, "time.updated", entry.techId);
    return c.json({ entry }, 201);
  });

  r.patch("/entries/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(timeEntryUpdate, await jsonBody(c));
    const entry = await run(c, async (tx, session) => {
      const [before] = await tx.select().from(s.timeEntries).where(eq(s.timeEntries.id, id)).limit(1);
      if (!before) notFound("Time entry not found");
      const [row] = await tx.update(s.timeEntries).set({ ...body, edited: true, editedBy: session.userId, updatedAt: nowIso() }).where(eq(s.timeEntries.id, id)).returning();
      await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "time_entry", entityId: id, field: "times", fromValue: `${before.startedAt ?? ""}–${before.stoppedAt ?? ""} ${before.hours}`, toValue: `${row!.startedAt ?? ""}–${row!.stoppedAt ?? ""} ${row!.hours}`, userId: session.userId });
      return row!;
    });
    publish(c.get("session").orgId, "time.updated", entry.techId);
    return c.json({ entry });
  });

  r.delete("/entries/:id", async (c) => {
    const id = c.req.param("id");
    await run(c, (tx) => tx.delete(s.timeEntries).where(eq(s.timeEntries.id, id)));
    return c.json({ ok: true });
  });

  /** Office view: every tech's day with the California checks and overtime split. */
  r.get("/timesheets", async (c) => {
    const q = c.req.query();
    const data = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const date = todayParam(q.date, companyDay(new Date(), org?.timezone));
      const conds = [eq(s.users.role, "tech"), eq(s.users.active, true)];
      if (q.teamId) conds.push(eq(s.users.teamId, q.teamId));
      const techs = await tx.select({ id: s.users.id, name: s.users.name, teamId: s.users.teamId }).from(s.users).where(and(...conds)).orderBy(s.users.name);
      const sheets = await tx.select().from(s.timesheets).where(eq(s.timesheets.date, date));
      const out = [];
      for (const tech of techs) {
        const day = await dayRows(tx, tech.id, date);
        if (!day.entries.length && !sheets.some((x) => x.techId === tech.id)) continue;
        out.push({ tech, timesheet: sheets.find((x) => x.techId === tech.id) ?? null, ...day });
      }
      return { date, techs: out };
    });
    return c.json(data);
  });

  r.get("/timesheets/exceptions", async (c) => {
    const rows = await run(c, async (tx) => {
      const sheets = await tx.select({ sheet: s.timesheets, techName: s.users.name }).from(s.timesheets).innerJoin(s.users, eq(s.users.id, s.timesheets.techId)).where(and(sql`(${s.timesheets.missedMeal} or ${s.timesheets.missedRest} or ${s.timesheets.premiumHours} > 0)`, inArray(s.timesheets.status, ["open", "submitted"]))).orderBy(desc(s.timesheets.date));
      return sheets;
    });
    return c.json({ exceptions: rows });
  });

  r.post("/timesheets/submit", async (c) => {
    const body = parse(timesheetSubmit, await jsonBody(c));
    const sheet = await run(c, async (tx, session) => {
      const techId = session.role === "tech" ? session.userId : body.techId ?? session.userId;
      const day = await dayRows(tx, techId, body.date);
      if (!day.check.canSubmit && !body.mealReason) conflict(day.check.blocks[0]?.message ?? "The timesheet is not ready to submit");
      const missedMeal = day.check.mealsNeeded > day.check.mealsLogged;
      const values = { status: "submitted" as const, submittedAt: nowIso(), mealReason: body.mealReason ?? "", missedMeal, missedRest: day.check.restsNeeded > day.check.restsLogged, premiumHours: missedMeal && !day.check.waiverOk ? 1 : 0 };
      const [existing] = await tx.select().from(s.timesheets).where(and(eq(s.timesheets.techId, techId), eq(s.timesheets.date, body.date))).limit(1);
      if (existing) {
        const [row] = await tx.update(s.timesheets).set(values).where(eq(s.timesheets.id, existing.id)).returning();
        return row!;
      }
      const [row] = await tx.insert(s.timesheets).values({ orgId: session.orgId, techId, date: body.date, ...values }).returning();
      return row!;
    });
    publish(c.get("session").orgId, "time.updated", sheet.techId);
    return c.json({ timesheet: sheet });
  });

  r.post("/timesheets/:id/review", async (c) => {
    const id = c.req.param("id");
    const body = parse(timesheetReview, await jsonBody(c));
    await run(c, async (tx, session) => {
      await tx.update(s.timesheets).set({ status: body.status, reviewedBy: session.userId, reviewedAt: nowIso(), reviewComment: body.comment ?? "" }).where(eq(s.timesheets.id, id));
    });
    return c.json({ ok: true });
  });

  /** Payroll export: one row per tech per day with the California split. */
  r.get("/timesheets/export", async (c) => {
    const q = c.req.query();
    const csv = await run(c, async (tx) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const to = todayParam(q.to, today);
      const from = todayParam(q.from, to.slice(0, 8) + "01");
      const techs = await tx.select({ id: s.users.id, name: s.users.name }).from(s.users).where(and(eq(s.users.role, "tech"), eq(s.users.active, true)));
      const days = await tx.select({ techId: s.timeEntries.techId, date: s.timeEntries.date }).from(s.timeEntries).where(and(gte(s.timeEntries.date, from), lte(s.timeEntries.date, to))).groupBy(s.timeEntries.techId, s.timeEntries.date).orderBy(s.timeEntries.techId, s.timeEntries.date);
      const lines = ["tech,date,travel,on_site,meal,rest,paid,regular,ot_1_5x,double,status"];
      for (const d of days) {
        const day = await dayRows(tx, d.techId, d.date);
        const [sheet] = await tx.select().from(s.timesheets).where(and(eq(s.timesheets.techId, d.techId), eq(s.timesheets.date, d.date))).limit(1);
        lines.push([techs.find((t) => t.id === d.techId)?.name ?? d.techId, d.date, day.totals.travel, day.totals.onSite, day.totals.meal, day.totals.rest, day.totals.paid, day.overtime.regular, day.overtime.overtime, day.overtime.double, sheet?.status ?? "open"].join(","));
      }
      return lines.join("\n");
    });
    return c.body(csv, 200, { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="timesheets.csv"` });
  });

  return r;
}
