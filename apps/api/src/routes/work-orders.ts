import { nextNumber, schema as s, type Connection, type Tx } from "@fieldline/db";
import {
  closeout,
  companyDay,
  companySettings,
  followUpSet,
  newId,
  newToken,
  noteCreate,
  paging,
  refrigerantLogCreate,
  checklistResult,
  permitUpsert,
  returnVisitCreate,
  techStatusChange,
  truckPartUse,
  workOrderAssign,
  workOrderBill,
  workOrderCreate,
  workOrderStatus,
  workOrderUpdate,
  woLabel,
  type ChargedTimeInput,
  type MaterialInput,
} from "@fieldline/shared";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { conflict, jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";
import { decodeDataUrl, storage, storageKey } from "../storage";
import { queueAutomation } from "./messages";

export const listSelect = {
  id: s.workOrders.id,
  number: s.workOrders.number,
  trip: s.workOrders.trip,
  title: s.workOrders.title,
  description: s.workOrders.description,
  callType: s.workOrders.callType,
  billingType: s.workOrders.billingType,
  priority: s.workOrders.priority,
  status: s.workOrders.status,
  techStatus: s.workOrders.techStatus,
  techStatusAt: s.workOrders.techStatusAt,
  assignedTechId: s.workOrders.assignedTechId,
  techName: s.users.name,
  scheduledFor: s.workOrders.scheduledFor,
  startMinute: s.workOrders.startMinute,
  allocatedHours: s.workOrders.allocatedHours,
  needReturn: s.workOrders.needReturn,
  waitingOnParts: s.workOrders.waitingOnParts,
  warranty: s.workOrders.warranty,
  followUp: s.workOrders.followUp,
  nteAmount: s.workOrders.nteAmount,
  quotedAmount: s.workOrders.quotedAmount,
  customerId: s.workOrders.customerId,
  customerName: s.customers.name,
  siteId: s.workOrders.siteId,
  siteName: s.sites.name,
  siteAddress: s.sites.address,
  siteCity: s.sites.city,
  siteLat: s.sites.lat,
  siteLng: s.sites.lng,
  sitePrimaryTechId: s.sites.primaryTechId,
  agreementId: s.workOrders.agreementId,
  dispatchNote: s.workOrders.dispatchNote,
  createdAt: s.workOrders.createdAt,
  updatedAt: s.workOrders.updatedAt,
  version: s.workOrders.version,
};

export function workOrderQuery(tx: Tx) {
  return tx
    .select(listSelect)
    .from(s.workOrders)
    .leftJoin(s.customers, eq(s.customers.id, s.workOrders.customerId))
    .leftJoin(s.sites, eq(s.sites.id, s.workOrders.siteId))
    .leftJoin(s.users, eq(s.users.id, s.workOrders.assignedTechId));
}

/** Everything the bill needs for one job (all trips of the number). */
export async function buildBill(tx: Tx, orgId: string, woId: string) {
  const [wo] = await tx.select().from(s.workOrders).where(eq(s.workOrders.id, woId)).limit(1);
  if (!wo) return null;
  const [org] = await tx.select({ settings: s.orgs.settings }).from(s.orgs).where(eq(s.orgs.id, orgId)).limit(1);
  const settings = companySettings(org?.settings);
  const trips = await tx.select({ id: s.workOrders.id, number: s.workOrders.number, trip: s.workOrders.trip, status: s.workOrders.status }).from(s.workOrders).where(eq(s.workOrders.number, wo.number));
  const tripIds = trips.map((t) => t.id);
  const chargedIds = new Set(trips.filter((t) => t.status === "closed" || t.status === "billed").map((t) => t.id));
  const customer = wo.customerId ? (await tx.select().from(s.customers).where(eq(s.customers.id, wo.customerId)).limit(1))[0] : null;
  const site = wo.siteId ? (await tx.select().from(s.sites).where(eq(s.sites.id, wo.siteId)).limit(1))[0] : null;
  const entries = await tx
    .select({ e: s.timeEntries, techName: s.users.name, trip: s.workOrders.trip, number: s.workOrders.number })
    .from(s.timeEntries)
    .innerJoin(s.users, eq(s.users.id, s.timeEntries.techId))
    .innerJoin(s.workOrders, eq(s.workOrders.id, s.timeEntries.workOrderId))
    .where(and(inArray(s.timeEntries.workOrderId, tripIds), inArray(s.timeEntries.kind, ["labor", "travel"])));
  const time: ChargedTimeInput[] = entries
    .filter((row) => chargedIds.has(row.e.workOrderId!) || (row.e.startedAt && !row.e.stoppedAt))
    .map((row) => ({
      id: row.e.id,
      kind: row.e.kind,
      hours: row.e.hours,
      startedAt: row.e.startedAt,
      arrivedAt: row.e.arrivedAt ?? undefined,
      stoppedAt: row.e.stoppedAt,
      edited: row.e.edited,
      running: Boolean(row.e.startedAt && !row.e.stoppedAt),
      visitLabel: woLabel({ number: row.number, trip: row.trip }),
      techName: row.techName,
      date: row.e.date,
    }));
  const pos = await tx.select().from(s.purchaseOrders).where(and(inArray(s.purchaseOrders.workOrderId, tripIds), eq(s.purchaseOrders.draft, false), inArray(s.purchaseOrders.status, ["partial", "received", "invoiced"]), eq(s.purchaseOrders.shipTo, "work_order")));
  const materials: MaterialInput[] = [];
  for (const po of pos) {
    const lines = await tx.select().from(s.poLines).where(eq(s.poLines.purchaseOrderId, po.id));
    for (const line of lines) {
      if (line.receivedQty > 0) materials.push({ id: line.id, source: "PO", description: line.description, quantity: line.receivedQty, unitCost: line.unitCost });
    }
    if (po.lumpSum && lines.length === 0 && (po.lumpSumAmount ?? 0) > 0) materials.push({ id: `${po.id}-lump`, source: "PO", description: po.vendorName || "Lump sum", quantity: 1, unitCost: po.lumpSumAmount ?? 0 });
  }
  const parts = await tx.select().from(s.truckParts).where(inArray(s.truckParts.workOrderId, tripIds));
  for (const part of parts) materials.push({ id: part.id, source: part.direct ? "Direct" : part.inventoryTxnId ? "Inventory" : "Truck", description: part.description, quantity: part.quantity, unitCost: part.unitCost });
  let agreementVisitAmount: number | null = null;
  if (wo.agreementId) {
    const [agreement] = await tx.select({ visitAmount: s.agreements.visitAmount }).from(s.agreements).where(eq(s.agreements.id, wo.agreementId)).limit(1);
    agreementVisitAmount = agreement?.visitAmount ?? null;
  }
  const bill = workOrderBill({
    callType: wo.callType,
    billingType: wo.billingType,
    nteAmount: wo.nteAmount,
    quotedAmount: wo.quotedAmount,
    agreementVisitAmount,
    customer,
    site,
    settings,
    time,
    materials,
  });
  return { wo, bill, settings, customer, site, trips };
}

async function stopRunningEntries(tx: Tx, techId: string, woId: string | null, at: string) {
  const conds = [eq(s.timeEntries.techId, techId), isNull(s.timeEntries.stoppedAt), inArray(s.timeEntries.kind, ["labor", "travel"])];
  if (woId) conds.push(eq(s.timeEntries.workOrderId, woId));
  await tx.update(s.timeEntries).set({ stoppedAt: at, updatedAt: at }).where(and(...conds));
}

export function workOrdersRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/", async (c) => {
    const q = c.req.query();
    const page = parse(paging, q);
    const rows = await run(c, async (tx) => {
      const conds = [];
      if (q.status) conds.push(inArray(s.workOrders.status, q.status.split(",") as never));
      if (q.techId === "unassigned") conds.push(isNull(s.workOrders.assignedTechId));
      else if (q.techId) conds.push(eq(s.workOrders.assignedTechId, q.techId));
      if (q.callType) conds.push(eq(s.workOrders.callType, q.callType as never));
      if (q.priority) conds.push(eq(s.workOrders.priority, q.priority as never));
      if (q.day) conds.push(eq(s.workOrders.scheduledFor, q.day));
      if (q.from) conds.push(gte(s.workOrders.scheduledFor, q.from));
      if (q.to) conds.push(lte(s.workOrders.scheduledFor, q.to));
      if (q.siteId) conds.push(eq(s.workOrders.siteId, q.siteId));
      if (q.customerId) conds.push(eq(s.workOrders.customerId, q.customerId));
      if (q.wait === "parts") conds.push(eq(s.workOrders.waitingOnParts, true));
      if (q.wait === "return") conds.push(eq(s.workOrders.needReturn, true));
      if (q.wait === "warranty") conds.push(eq(s.workOrders.warranty, true));
      if (q.unscheduled === "1") conds.push(isNull(s.workOrders.scheduledFor));
      if (q.q) {
        const needle = `%${q.q.trim()}%`;
        const asNumber = Number(q.q.trim());
        conds.push(or(ilike(s.workOrders.title, needle), ilike(s.customers.name, needle), ilike(s.sites.address, needle), ilike(s.sites.name, needle), Number.isInteger(asNumber) ? eq(s.workOrders.number, asNumber) : sql`false`)!);
      }
      const sort = q.sort === "oldest" ? [s.workOrders.createdAt] : q.sort === "newest" ? [desc(s.workOrders.createdAt)] : [sql`case ${s.workOrders.priority} when 'urgent' then 0 when 'normal' then 1 else 2 end`, s.workOrders.createdAt];
      return workOrderQuery(tx).where(conds.length ? and(...conds) : undefined).orderBy(...sort).limit(page.limit).offset(page.offset);
    });
    return c.json({ workOrders: rows });
  });

  r.post("/", async (c) => {
    const body = parse(workOrderCreate, await jsonBody(c));
    const created = await run(c, async (tx, session) => {
      const number = await nextNumber(tx, session.orgId, "work_order");
      const id = newId();
      let customerId = body.customerId ?? null;
      if (!customerId && body.siteId) {
        const [site] = await tx.select({ customerId: s.sites.customerId }).from(s.sites).where(eq(s.sites.id, body.siteId)).limit(1);
        customerId = site?.customerId ?? null;
      }
      await tx.insert(s.workOrders).values({ ...body, id, orgId: session.orgId, number, customerId, trackingToken: newToken(8), createdBy: session.userId });
      if (body.assignedTechId) {
        await tx.insert(s.notifications).values({ orgId: session.orgId, userId: body.assignedTechId, workOrderId: id, kind: "assignment", body: `${number} ${body.title} assigned to you${body.scheduledFor ? ` on ${body.scheduledFor}` : ""}.` });
      }
      const [row] = await workOrderQuery(tx).where(eq(s.workOrders.id, id));
      return row!;
    });
    publish(c.get("session").orgId, "work_order.created", created.id);
    return c.json({ workOrder: created }, 201);
  });

  r.get("/:id", async (c) => {
    const id = c.req.param("id");
    const detail = await run(c, async (tx, session) => {
      const [row] = await workOrderQuery(tx).where(eq(s.workOrders.id, id));
      if (!row) notFound("Work order not found");
      const full = (await tx.select().from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1))[0]!;
      const built = await buildBill(tx, session.orgId, id);
      const [equipmentRow] = full.equipmentId ? await tx.select().from(s.equipment).where(eq(s.equipment.id, full.equipmentId)).limit(1) : [];
      const helpers = await tx.select({ h: s.workOrderHelpers, techName: s.users.name }).from(s.workOrderHelpers).innerJoin(s.users, eq(s.users.id, s.workOrderHelpers.techId)).where(eq(s.workOrderHelpers.workOrderId, id));
      const notesRows = await tx.select({ n: s.notes, userName: s.users.name }).from(s.notes).leftJoin(s.users, eq(s.users.id, s.notes.userId)).where(eq(s.notes.workOrderId, id)).orderBy(desc(s.notes.createdAt));
      const tripIds = built!.trips.map((t) => t.id);
      const entries = await tx.select({ e: s.timeEntries, techName: s.users.name }).from(s.timeEntries).innerJoin(s.users, eq(s.users.id, s.timeEntries.techId)).where(inArray(s.timeEntries.workOrderId, tripIds)).orderBy(s.timeEntries.date, s.timeEntries.startedAt);
      const fileRows = await tx.select().from(s.files).where(inArray(s.files.workOrderId, tripIds)).orderBy(desc(s.files.createdAt));
      const pos = await tx.select().from(s.purchaseOrders).where(inArray(s.purchaseOrders.workOrderId, tripIds)).orderBy(desc(s.purchaseOrders.number));
      const poLines = pos.length ? await tx.select().from(s.poLines).where(inArray(s.poLines.purchaseOrderId, pos.map((p) => p.id))) : [];
      const parts = await tx.select().from(s.truckParts).where(inArray(s.truckParts.workOrderId, tripIds));
      const quotes = await tx.select().from(s.quotes).where(or(inArray(s.quotes.workOrderId, tripIds), eq(s.quotes.createdWorkOrderId, id))!).orderBy(desc(s.quotes.number));
      const checklists = await tx.select({ r: s.checklistResults, template: s.checklistTemplates }).from(s.checklistResults).innerJoin(s.checklistTemplates, eq(s.checklistTemplates.id, s.checklistResults.templateId)).where(eq(s.checklistResults.workOrderId, id));
      const templates = await tx.select().from(s.checklistTemplates).where(eq(s.checklistTemplates.active, true));
      const refrigerant = await tx.select().from(s.refrigerantLogs).where(inArray(s.refrigerantLogs.workOrderId, tripIds)).orderBy(desc(s.refrigerantLogs.loggedAt));
      const permitRows = await tx.select().from(s.permits).where(eq(s.permits.workOrderId, id));
      const warranty = full.equipmentId ? await tx.select().from(s.warrantyClaims).where(eq(s.warrantyClaims.equipmentId, full.equipmentId)) : [];
      const [invoice] = await tx.select().from(s.invoices).where(inArray(s.invoices.workOrderId, tripIds)).limit(1);
      const changes = await tx.select({ f: s.fieldChanges, userName: s.users.name }).from(s.fieldChanges).leftJoin(s.users, eq(s.users.id, s.fieldChanges.userId)).where(and(eq(s.fieldChanges.entity, "work_order"), eq(s.fieldChanges.entityId, id))).orderBy(desc(s.fieldChanges.createdAt)).limit(50);
      const history = full.siteId ? await workOrderQuery(tx).where(and(eq(s.workOrders.siteId, full.siteId), sql`${s.workOrders.id} <> ${id}`)).orderBy(desc(s.workOrders.createdAt)).limit(15) : [];
      const [agreement] = full.agreementId ? await tx.select().from(s.agreements).where(eq(s.agreements.id, full.agreementId)).limit(1) : [];
      const messagesRows = full.customerId ? await tx.select().from(s.messages).where(eq(s.messages.workOrderId, id)).orderBy(desc(s.messages.createdAt)).limit(10) : [];
      return {
        workOrder: { ...row!, ...full },
        customer: built!.customer,
        site: built!.site,
        equipment: equipmentRow ?? null,
        agreement: agreement ?? null,
        helpers,
        notes: notesRows,
        timeEntries: entries,
        files: fileRows,
        purchaseOrders: pos.map((p) => ({ ...p, lines: poLines.filter((l) => l.purchaseOrderId === p.id) })),
        truckParts: parts,
        quotes,
        checklists,
        checklistTemplates: templates,
        refrigerantLogs: refrigerant,
        permits: permitRows,
        warrantyClaims: warranty,
        invoice: invoice ?? null,
        bill: built!.bill,
        trips: built!.trips,
        changes,
        history,
        messages: messagesRows,
      };
    });
    return c.json(detail);
  });

  r.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = parse(workOrderUpdate, await jsonBody(c));
    const updated = await run(c, async (tx, session) => {
      const [current] = await tx.select().from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      if (!current) notFound("Work order not found");
      if (body.version != null && body.version !== current.version) conflict("Someone else changed this work order. Reload and try again.");
      const { version: _v, ...patch } = body;
      const changes = Object.entries(patch)
        .filter(([key, value]) => value !== undefined && String((current as Record<string, unknown>)[key] ?? "") !== String(value ?? ""))
        .map(([field, value]) => ({ orgId: session.orgId, entity: "work_order", entityId: id, field, fromValue: String((current as Record<string, unknown>)[field] ?? ""), toValue: String(value ?? ""), userId: session.userId }));
      if (changes.length) await tx.insert(s.fieldChanges).values(changes);
      await tx.update(s.workOrders).set({ ...patch, version: current.version + 1, updatedAt: nowIso() }).where(eq(s.workOrders.id, id));
      if (patch.assignedTechId && patch.assignedTechId !== current.assignedTechId) {
        await tx.insert(s.notifications).values({ orgId: session.orgId, userId: patch.assignedTechId, workOrderId: id, kind: "assignment", body: `${woLabel(current)} ${current.title} assigned to you.` });
      } else if (changes.length && current.assignedTechId) {
        await tx.insert(s.notifications).values({ orgId: session.orgId, userId: current.assignedTechId, workOrderId: id, kind: "updated", body: `${woLabel(current)} updated: ${changes.map((ch) => ch.field).join(", ")}.` });
      }
      const [row] = await workOrderQuery(tx).where(eq(s.workOrders.id, id));
      return row!;
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ workOrder: updated });
  });

  r.post("/:id/status", async (c) => {
    const id = c.req.param("id");
    const body = parse(workOrderStatus, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [current] = await tx.select().from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      if (!current) notFound("Work order not found");
      if (body.status === "billed") conflict("Billed is set from Billing when the invoice is created.");
      if (current.status === "billed") conflict("A billed work order cannot change status.");
      const at = nowIso();
      await tx.update(s.workOrders).set({ status: body.status, closedAt: body.status === "closed" ? at : null, techStatus: body.status === "closed" ? "done" : current.techStatus, version: current.version + 1, updatedAt: at }).where(eq(s.workOrders.id, id));
      await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "work_order", entityId: id, field: "status", fromValue: current.status, toValue: body.status, userId: session.userId });
      if (body.status === "closed" && current.assignedTechId) await stopRunningEntries(tx, current.assignedTechId, id, at);
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ ok: true });
  });

  r.post("/:id/assign", async (c) => {
    const id = c.req.param("id");
    const body = parse(workOrderAssign, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [current] = await tx.select().from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      if (!current) notFound("Work order not found");
      if (body.version != null && body.version !== current.version) conflict("Someone else moved this work order. Reload the board.");
      const at = nowIso();
      if (body.role === "helper" && body.techId) {
        await tx.insert(s.workOrderHelpers).values({ orgId: session.orgId, workOrderId: id, techId: body.techId, role: "helper", scheduledFor: body.scheduledFor ?? current.scheduledFor, startMinute: body.startMinute ?? current.startMinute, allocatedHours: body.allocatedHours ?? current.allocatedHours });
        await tx.insert(s.notifications).values({ orgId: session.orgId, userId: body.techId, workOrderId: id, kind: "assignment", body: `${woLabel(current)} ${current.title}: you are the helper.` });
      } else {
        await tx
          .update(s.workOrders)
          .set({ assignedTechId: body.techId, scheduledFor: body.scheduledFor === undefined ? current.scheduledFor : body.scheduledFor, startMinute: body.startMinute === undefined ? current.startMinute : body.startMinute, allocatedHours: body.allocatedHours === undefined ? current.allocatedHours : body.allocatedHours, version: current.version + 1, updatedAt: at })
          .where(eq(s.workOrders.id, id));
        await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "work_order", entityId: id, field: "assignment", fromValue: `${current.assignedTechId ?? "unassigned"} ${current.scheduledFor ?? ""} ${current.startMinute ?? ""}`, toValue: `${body.techId ?? "unassigned"} ${body.scheduledFor ?? current.scheduledFor ?? ""} ${body.startMinute ?? current.startMinute ?? ""}`, userId: session.userId });
        if (body.techId) await tx.insert(s.notifications).values({ orgId: session.orgId, userId: body.techId, workOrderId: id, kind: body.techId === current.assignedTechId ? "updated" : "assignment", body: `${woLabel(current)} ${current.title} ${body.techId === current.assignedTechId ? "moved" : "assigned to you"}${body.scheduledFor ? ` on ${body.scheduledFor}` : ""}.` });
      }
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ ok: true });
  });

  /** The tech's status buttons. Each one writes the time entries so the timesheet and the bill follow. */
  r.post("/:id/tech-status", async (c) => {
    const id = c.req.param("id");
    const body = parse(techStatusChange, await jsonBody(c));
    const result = await run(c, async (tx, session) => {
      const [current] = await tx.select().from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      if (!current) notFound("Work order not found");
      const techId = session.role === "tech" ? session.userId : current.assignedTechId ?? session.userId;
      const at = body.at ?? nowIso();
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).where(eq(s.orgs.id, session.orgId)).limit(1);
      const day = companyDay(new Date(at), org?.timezone ?? "America/Los_Angeles");
      const [running] = await tx.select().from(s.timeEntries).where(and(eq(s.timeEntries.techId, techId), eq(s.timeEntries.workOrderId, id), isNull(s.timeEntries.stoppedAt), inArray(s.timeEntries.kind, ["labor", "travel"]))).limit(1);
      if (body.techStatus === "en_route") {
        await stopRunningEntries(tx, techId, null, at);
        await tx.insert(s.timeEntries).values({ orgId: session.orgId, workOrderId: id, techId, kind: "labor", date: day, startedAt: at, arrivedAt: null, source: "clock", gpsVerified: body.lat != null });
        if (body.lat != null && body.lng != null) await tx.insert(s.techLocations).values({ orgId: session.orgId, techId, lat: body.lat, lng: body.lng, recordedAt: at });
        await queueAutomation(tx, session.orgId, "on_my_way", { workOrderId: id, customerId: current.customerId, techId });
      } else if (body.techStatus === "on_site") {
        if (running) await tx.update(s.timeEntries).set({ arrivedAt: running.arrivedAt ?? at, updatedAt: at }).where(eq(s.timeEntries.id, running.id));
        else await tx.insert(s.timeEntries).values({ orgId: session.orgId, workOrderId: id, techId, kind: "labor", date: day, startedAt: at, arrivedAt: at, source: "clock", gpsVerified: body.lat != null });
        if (body.lat != null && body.lng != null) await tx.insert(s.techLocations).values({ orgId: session.orgId, techId, lat: body.lat, lng: body.lng, recordedAt: at });
      } else if (body.techStatus === "paused" || body.techStatus === "done") {
        await stopRunningEntries(tx, techId, id, at);
      }
      await tx.update(s.workOrders).set({ techStatus: body.techStatus, techStatusAt: at, updatedAt: at }).where(eq(s.workOrders.id, id));
      return { techStatus: body.techStatus, at };
    });
    publish(c.get("session").orgId, "work_order.updated", id, { techStatus: result.techStatus });
    return c.json(result);
  });

  r.post("/:id/follow-up", async (c) => {
    const id = c.req.param("id");
    const body = parse(followUpSet, await jsonBody(c));
    await run(c, async (tx) => {
      const followUp = body.reason ? { reason: body.reason, date: body.date ?? null, note: body.note ?? "", part: body.part ?? "", expectedDate: body.expectedDate ?? null } : null;
      await tx.update(s.workOrders).set({ followUp, waitingOnParts: body.reason === "parts", updatedAt: nowIso() }).where(eq(s.workOrders.id, id));
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ ok: true });
  });

  r.post("/:id/return-visit", async (c) => {
    const id = c.req.param("id");
    const body = parse(returnVisitCreate, await jsonBody(c));
    const created = await run(c, async (tx, session) => {
      const [current] = await tx.select().from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      if (!current) notFound("Work order not found");
      const [tripRow] = await tx.select({ maxTrip: sql<number>`max(${s.workOrders.trip})` }).from(s.workOrders).where(eq(s.workOrders.number, current.number));
      const newWoId = newId();
      await tx.insert(s.workOrders).values({
        id: newWoId,
        orgId: session.orgId,
        number: current.number,
        trip: Number(tripRow?.maxTrip ?? 1) + 1,
        customerId: current.customerId,
        siteId: current.siteId,
        equipmentId: current.equipmentId,
        title: current.title,
        description: body.note ?? current.description,
        callType: current.callType,
        billingType: current.billingType,
        nteAmount: current.nteAmount,
        quotedAmount: current.quotedAmount,
        priority: body.priority ?? current.priority,
        assignedTechId: body.techId ?? null,
        scheduledFor: body.scheduledFor ?? null,
        startMinute: body.startMinute ?? null,
        allocatedHours: body.allocatedHours ?? null,
        waitingOnParts: Boolean(body.waitingOnParts),
        warranty: body.warranty ?? current.warranty,
        agreementId: current.agreementId,
        trackingToken: newToken(8),
        createdBy: session.userId,
      });
      await tx.update(s.workOrders).set({ needReturn: false, followUp: null, updatedAt: nowIso() }).where(eq(s.workOrders.id, id));
      const [row] = await workOrderQuery(tx).where(eq(s.workOrders.id, newWoId));
      return row!;
    });
    publish(c.get("session").orgId, "work_order.created", created.id);
    return c.json({ workOrder: created }, 201);
  });

  r.post("/:id/notes", async (c) => {
    const id = c.req.param("id");
    const body = parse(noteCreate, await jsonBody(c));
    const note = await run(c, async (tx, session) => {
      const [row] = await tx.insert(s.notes).values({ orgId: session.orgId, workOrderId: id, userId: session.userId, kind: body.kind, body: body.body }).returning();
      return row!;
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ note }, 201);
  });

  r.post("/:id/closeout", async (c) => {
    const id = c.req.param("id");
    const body = parse(closeout, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [current] = await tx.select().from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      if (!current) notFound("Work order not found");
      const at = nowIso();
      let signatureFileId: string | null = current.signatureFileId;
      if (body.signatureDataUrl) {
        const decoded = decodeDataUrl(body.signatureDataUrl);
        if (decoded) {
          signatureFileId = newId();
          const key = storageKey(session.orgId, signatureFileId, decoded.mime);
          await storage.put(key, decoded.bytes);
          await tx.insert(s.files).values({ id: signatureFileId, orgId: session.orgId, kind: "signature", workOrderId: id, storageKey: key, mime: decoded.mime, bytes: decoded.bytes.byteLength, caption: body.signerName ?? "", createdBy: session.userId, includeInReport: false });
        }
      }
      const techId = session.role === "tech" ? session.userId : current.assignedTechId;
      if (techId) await stopRunningEntries(tx, techId, id, at);
      await tx.update(s.workOrders).set({ workPerformed: body.workPerformed, summary: current.summary || body.workPerformed, signerName: body.signerName ?? current.signerName, signatureFileId, needReturn: body.needReturn, techStatus: "done", techStatusAt: at, status: "closed", closedAt: at, version: current.version + 1, updatedAt: at }).where(eq(s.workOrders.id, id));
      await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "work_order", entityId: id, field: "status", fromValue: current.status, toValue: "closed", userId: session.userId });
      await queueAutomation(tx, session.orgId, "review_request", { workOrderId: id, customerId: current.customerId, techId: techId ?? null });
      if (body.sendPhotoReport) await queueAutomation(tx, session.orgId, "photo_report", { workOrderId: id, customerId: current.customerId, techId: techId ?? null });
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ ok: true });
  });

  r.post("/:id/checklist", async (c) => {
    const id = c.req.param("id");
    const body = parse(checklistResult, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [existing] = await tx.select().from(s.checklistResults).where(and(eq(s.checklistResults.workOrderId, id), eq(s.checklistResults.templateId, body.templateId))).limit(1);
      const payload = { items: body.items, completedAt: body.completedAt ?? null, techId: session.userId };
      if (existing) await tx.update(s.checklistResults).set(payload).where(eq(s.checklistResults.id, existing.id));
      else await tx.insert(s.checklistResults).values({ orgId: session.orgId, workOrderId: id, templateId: body.templateId, ...payload });
    });
    return c.json({ ok: true });
  });

  r.post("/:id/refrigerant", async (c) => {
    const id = c.req.param("id");
    const body = parse(refrigerantLogCreate, await jsonBody(c));
    const log = await run(c, async (tx, session) => {
      const [wo] = await tx.select({ equipmentId: s.workOrders.equipmentId }).from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      const equipmentId = body.equipmentId ?? wo?.equipmentId ?? null;
      let fullCharge = body.fullChargeLbs ?? null;
      if (fullCharge == null && equipmentId) {
        const [unit] = await tx.select({ chargeLbs: s.equipment.chargeLbs }).from(s.equipment).where(eq(s.equipment.id, equipmentId)).limit(1);
        fullCharge = unit?.chargeLbs ?? null;
      }
      const leakRate = fullCharge && fullCharge > 0 && body.lbsAdded > 0 ? Math.round((body.lbsAdded / fullCharge) * 1000) / 10 : null;
      const [user] = await tx.select({ title: s.users.title }).from(s.users).where(eq(s.users.id, session.userId)).limit(1);
      const [row] = await tx.insert(s.refrigerantLogs).values({ orgId: session.orgId, workOrderId: id, equipmentId, techId: session.userId, techCert: user?.title?.includes("608") ? user.title : "EPA 608 Universal", refrigerantType: body.refrigerantType, lbsAdded: body.lbsAdded, lbsRecovered: body.lbsRecovered, cylinderId: body.cylinderId ?? "", leakCheck: body.leakCheck, leakRatePercent: leakRate, fullChargeLbs: fullCharge, notes: body.notes ?? "" }).returning();
      return row!;
    });
    return c.json({ log }, 201);
  });

  r.put("/:id/permit", async (c) => {
    const id = c.req.param("id");
    const body = parse(permitUpsert, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [wo] = await tx.select({ siteId: s.workOrders.siteId }).from(s.workOrders).where(eq(s.workOrders.id, id)).limit(1);
      const [existing] = await tx.select().from(s.permits).where(eq(s.permits.workOrderId, id)).limit(1);
      const values = { jurisdiction: body.jurisdiction ?? "", permitNumber: body.permitNumber ?? "", status: body.status, tests: body.tests ?? {}, filedOn: body.filedOn ?? null, finalOn: body.finalOn ?? null, notes: body.notes ?? "" };
      if (existing) await tx.update(s.permits).set(values).where(eq(s.permits.id, existing.id));
      else await tx.insert(s.permits).values({ orgId: session.orgId, workOrderId: id, siteId: wo?.siteId ?? null, ...values });
    });
    return c.json({ ok: true });
  });

  /** A part taken from a van or the shop: records the use, moves the stock, and lands on the bill. */
  r.post("/:id/parts", async (c) => {
    const id = c.req.param("id");
    const body = parse(truckPartUse, await jsonBody(c));
    const part = await run(c, async (tx, session) => {
      const [org] = await tx.select({ timezone: s.orgs.timezone }).from(s.orgs).where(eq(s.orgs.id, session.orgId)).limit(1);
      const date = companyDay(new Date(), org?.timezone);
      let categoryId: string | null = null;
      if (body.itemId) {
        const [item] = await tx.select().from(s.inventoryItems).where(eq(s.inventoryItems.id, body.itemId)).limit(1);
        categoryId = item?.categoryId ?? null;
        await tx.update(s.inventoryStock).set({ onHand: sql`${s.inventoryStock.onHand} - ${body.quantity}`, lastUsedAt: nowIso() }).where(and(eq(s.inventoryStock.warehouseId, body.warehouseId), eq(s.inventoryStock.itemId, body.itemId)));
      }
      const [txn] = await tx.insert(s.inventoryTxns).values({ orgId: session.orgId, warehouseId: body.warehouseId, categoryId, itemId: body.itemId ?? null, kind: "used_on_wo", amount: -(body.quantity * body.unitCost), quantity: -body.quantity, workOrderId: id, description: body.description, userId: session.userId, date }).returning();
      const [row] = await tx.insert(s.truckParts).values({ orgId: session.orgId, workOrderId: id, warehouseId: body.warehouseId, itemId: body.itemId ?? null, categoryId, description: body.description, quantity: body.quantity, unitCost: body.unitCost, inventoryTxnId: txn!.id, addedBy: session.userId }).returning();
      return row!;
    });
    publish(c.get("session").orgId, "work_order.updated", id);
    return c.json({ part }, 201);
  });

  return r;
}
