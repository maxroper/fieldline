import { nextNumber, schema as s, type Connection } from "@fieldline/db";
import { agreementCreate, agreementUpdate, companyDay, isoDate, newId, newToken } from "@fieldline/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";

const generateBody = z.object({ season: z.enum(["spring", "fall", "quarterly"]).default("fall"), year: z.number().int().optional() });
const scheduleBody = z.object({ scheduledFor: isoDate, techId: z.string().uuid().nullable().optional(), startMinute: z.number().int().min(0).max(1439).optional(), allocatedHours: z.number().min(0).max(24).optional() });

export function agreementsRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/", async (c) => {
    const data = await run(c, async (tx) => {
      const rows = await tx
        .select({ a: s.agreements, customerName: s.customers.name, siteName: s.sites.name, siteCity: s.sites.city, primaryTechName: s.users.name })
        .from(s.agreements)
        .innerJoin(s.customers, eq(s.customers.id, s.agreements.customerId))
        .innerJoin(s.sites, eq(s.sites.id, s.agreements.siteId))
        .leftJoin(s.users, eq(s.users.id, s.sites.primaryTechId))
        .orderBy(s.customers.name);
      const ids = rows.map((x) => x.a.id);
      const assets = ids.length ? await tx.select({ agreementId: s.agreementAssets.agreementId, n: sql<number>`count(*)` }).from(s.agreementAssets).where(inArray(s.agreementAssets.agreementId, ids)).groupBy(s.agreementAssets.agreementId) : [];
      const visits = ids.length ? await tx.select().from(s.agreementVisits).where(inArray(s.agreementVisits.agreementId, ids)).orderBy(s.agreementVisits.dueOn) : [];
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).limit(1);
      const today = companyDay(new Date(), org?.timezone);
      const in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
      const list = rows.map((row) => {
        const mine = visits.filter((v) => v.agreementId === row.a.id);
        const next = mine.find((v) => v.status !== "done" && v.status !== "skipped");
        return { ...row.a, customerName: row.customerName, siteName: row.siteName, siteCity: row.siteCity, primaryTechName: row.primaryTechName, assetCount: Number(assets.find((x) => x.agreementId === row.a.id)?.n ?? 0), visits: mine, nextVisit: next ?? null, renewalSoon: row.a.endsOn <= in60 };
      });
      const active = list.filter((a) => a.status === "active");
      const season = visits.filter((v) => v.dueOn.slice(0, 4) === today.slice(0, 4) && Number(v.dueOn.slice(5, 7)) >= 9);
      return {
        agreements: list,
        kpis: { active: active.length, annualValue: active.reduce((sum, a) => sum + (a.billingMethod === "monthly_card" ? a.amount * 12 : a.amount), 0), renewalsDue: active.filter((a) => a.renewalSoon).length, renewalValue: active.filter((a) => a.renewalSoon).reduce((sum, a) => sum + a.amount, 0), season: { total: season.length, done: season.filter((v) => v.status === "done").length, scheduled: season.filter((v) => v.status === "scheduled").length, unscheduled: season.filter((v) => v.status === "unscheduled").length } },
        today,
      };
    });
    return c.json(data);
  });

  r.get("/:id", async (c) => {
    const id = c.req.param("id");
    const data = await run(c, async (tx) => {
      const [agreement] = await tx.select().from(s.agreements).where(eq(s.agreements.id, id)).limit(1);
      if (!agreement) notFound("Agreement not found");
      const [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, agreement.customerId)).limit(1);
      const [site] = await tx.select().from(s.sites).where(eq(s.sites.id, agreement.siteId)).limit(1);
      const assets = await tx.select({ asset: s.agreementAssets, unit: s.equipment }).from(s.agreementAssets).innerJoin(s.equipment, eq(s.equipment.id, s.agreementAssets.equipmentId)).where(eq(s.agreementAssets.agreementId, id));
      const visits = await tx.select({ v: s.agreementVisits, woNumber: s.workOrders.number, woTrip: s.workOrders.trip, techName: s.users.name, scheduledFor: s.workOrders.scheduledFor }).from(s.agreementVisits).leftJoin(s.workOrders, eq(s.workOrders.id, s.agreementVisits.workOrderId)).leftJoin(s.users, eq(s.users.id, s.workOrders.assignedTechId)).where(eq(s.agreementVisits.agreementId, id)).orderBy(s.agreementVisits.dueOn);
      const invoices = await tx.select().from(s.invoices).where(eq(s.invoices.customerId, agreement.customerId)).orderBy(desc(s.invoices.billedAt)).limit(12);
      const allUnits = await tx.select().from(s.equipment).where(eq(s.equipment.siteId, agreement.siteId));
      return { agreement, customer: customer ?? null, site: site ?? null, assets, visits, invoices, siteEquipment: allUnits };
    });
    return c.json(data);
  });

  r.post("/", async (c) => {
    const body = parse(agreementCreate, await jsonBody(c));
    const id = await run(c, async (tx, session) => {
      const { equipmentIds, ...fields } = body;
      const newAgreementId = newId();
      await tx.insert(s.agreements).values({ ...fields, id: newAgreementId, orgId: session.orgId, name: fields.name || `${fields.tier[0]!.toUpperCase()}${fields.tier.slice(1)} agreement`, createdBy: session.userId });
      if (equipmentIds.length) await tx.insert(s.agreementAssets).values(equipmentIds.map((equipmentId) => ({ orgId: session.orgId, agreementId: newAgreementId, equipmentId })));
      return newAgreementId;
    });
    publish(c.get("session").orgId, "agreement.created", id);
    return c.json({ id }, 201);
  });

  r.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(agreementUpdate, await jsonBody(c));
    await run(c, async (tx, session) => {
      const { equipmentIds, ...fields } = body;
      await tx.update(s.agreements).set({ ...fields, updatedAt: nowIso() }).where(eq(s.agreements.id, id));
      if (equipmentIds) {
        await tx.delete(s.agreementAssets).where(eq(s.agreementAssets.agreementId, id));
        if (equipmentIds.length) await tx.insert(s.agreementAssets).values(equipmentIds.map((equipmentId) => ({ orgId: session.orgId, agreementId: id, equipmentId })));
      }
    });
    publish(c.get("session").orgId, "agreement.updated", id);
    return c.json({ ok: true });
  });

  /** Generate a season's visits for every active agreement (or one), skipping any that already exist. */
  r.post("/generate", async (c) => {
    const body = parse(generateBody.extend({ agreementId: z.string().uuid().optional() }), await jsonBody(c));
    const result = await run(c, async (tx, session) => {
      const year = body.year ?? new Date().getFullYear();
      const conds = [eq(s.agreements.status, "active")];
      if (body.agreementId) conds.push(eq(s.agreements.id, body.agreementId));
      const list = await tx.select().from(s.agreements).where(and(...conds));
      const dueFor = (season: string, q = 0) => (season === "spring" ? `${year}-04-15` : season === "fall" ? `${year}-10-15` : `${year}-${String(q * 3 + 2).padStart(2, "0")}-15`);
      let created = 0;
      for (const a of list) {
        const seasons = body.season === "quarterly" ? ["q1", "q2", "q3", "q4"] : [body.season];
        for (const [i, season] of seasons.entries()) {
          const due = dueFor(season, i);
          const [existing] = await tx.select({ id: s.agreementVisits.id }).from(s.agreementVisits).where(and(eq(s.agreementVisits.agreementId, a.id), eq(s.agreementVisits.season, season), sql`${s.agreementVisits.dueOn} between ${`${year}-01-01`} and ${`${year}-12-31`}`)).limit(1);
          if (existing) continue;
          await tx.insert(s.agreementVisits).values({ orgId: session.orgId, agreementId: a.id, season, dueOn: due, status: "unscheduled" });
          created++;
        }
      }
      return { created };
    });
    publish(c.get("session").orgId, "agreement.updated");
    return c.json(result);
  });

  /** Scheduling a visit creates the maintenance work order and links it. */
  r.post("/visits/:id/schedule", async (c) => {
    const id = c.req.param("id");
    const body = parse(scheduleBody, await jsonBody(c));
    const result = await run(c, async (tx, session) => {
      const [visit] = await tx.select().from(s.agreementVisits).where(eq(s.agreementVisits.id, id)).limit(1);
      if (!visit) notFound("Visit not found");
      const [agreement] = await tx.select().from(s.agreements).where(eq(s.agreements.id, visit.agreementId)).limit(1);
      if (!agreement) notFound("Agreement not found");
      const [site] = await tx.select().from(s.sites).where(eq(s.sites.id, agreement.siteId)).limit(1);
      const assets = await tx.select({ n: sql<number>`count(*)` }).from(s.agreementAssets).where(eq(s.agreementAssets.agreementId, agreement.id));
      const unitCount = Number(assets[0]?.n ?? 0);
      const number = await nextNumber(tx, session.orgId, "work_order");
      const woId = newId();
      await tx.insert(s.workOrders).values({ id: woId, orgId: session.orgId, number, customerId: agreement.customerId, siteId: agreement.siteId, title: `${visit.season === "spring" ? "Spring" : visit.season === "fall" ? "Fall" : "Quarterly"} PM${unitCount ? `, ${unitCount} unit${unitCount === 1 ? "" : "s"}` : ""}`, description: agreement.includedServices.join(". "), callType: "maintenance", billingType: "tm", priority: "normal", assignedTechId: body.techId ?? site?.primaryTechId ?? null, scheduledFor: body.scheduledFor, startMinute: body.startMinute ?? 8 * 60, allocatedHours: body.allocatedHours ?? Math.max(1, unitCount * 1.25), signatureRequired: true, agreementId: agreement.id, agreementVisitId: visit.id, trackingToken: newToken(8), createdBy: session.userId });
      await tx.update(s.agreementVisits).set({ status: "scheduled", workOrderId: woId }).where(eq(s.agreementVisits.id, id));
      return { workOrderId: woId, number };
    });
    publish(c.get("session").orgId, "work_order.created", result.workOrderId);
    return c.json(result, 201);
  });

  return r;
}
