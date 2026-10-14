import { schema as s, type Connection } from "@fieldline/db";
import { companySettings, settingsUpdate, userCreate, userUpdate } from "@fieldline/shared";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app";
import { requireRole } from "../auth";
import { nowIso, scoped } from "../db";
import { env } from "../env";
import { jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";

const teamBody = z.object({ name: z.string().trim().min(1), isHome: z.boolean().optional() });
const vendorBody = z.object({ name: z.string().trim().min(1), city: z.string().optional(), phone: z.string().optional(), email: z.string().optional(), active: z.boolean().optional() });
const templateBody = z.object({ name: z.string().trim().min(1), kind: z.string().default("custom"), items: z.array(z.object({ key: z.string(), label: z.string(), hint: z.string().optional() })), requiredBeforeComplete: z.boolean().default(false), trigger: z.object({ callTypes: z.array(z.string()).optional(), equipmentKinds: z.array(z.string()).optional() }).default({}), active: z.boolean().default(true) });
const warehouseBody = z.object({ name: z.string().trim().min(1), kind: z.enum(["main", "vehicle"]).default("vehicle"), techId: z.string().uuid().nullable().optional(), targetValue: z.number().min(0).nullable().optional(), active: z.boolean().optional() });

export function settingsRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  r.get("/", async (c) => {
    const data = await run(c, async (tx) => {
      const [org] = await tx.select().from(s.orgs).limit(1);
      if (!org) notFound("Organization not found");
      const teams = await tx.select().from(s.teams).orderBy(s.teams.name);
      const users = await tx.select().from(s.users).orderBy(s.users.role, s.users.name);
      const vendors = await tx.select().from(s.vendors).orderBy(s.vendors.name);
      const templates = await tx.select().from(s.checklistTemplates).orderBy(s.checklistTemplates.name);
      const automations = await tx.select().from(s.automations).orderBy(s.automations.key);
      const warehouses = await tx.select().from(s.warehouses).orderBy(s.warehouses.kind, s.warehouses.name);
      const scopeTemplates = await tx.select().from(s.scopeTemplates).orderBy(s.scopeTemplates.name);
      return {
        org: { ...org, settings: companySettings(org.settings) },
        teams,
        users,
        vendors,
        checklistTemplates: templates,
        automations,
        warehouses,
        scopeTemplates,
        integrations: {
          quickbooks: { connected: env.integrations.quickbooks, note: "QuickBooks Online: OAuth2 app keys in .env. Invoices, payments and customers sync by id." },
          sms: { connected: env.integrations.twilio, provider: env.integrations.twilio ? "twilio" : "demo", note: "Twilio with A2P 10DLC registration. Without keys, texts are recorded as delivered by the demo provider." },
          payments: { connected: env.integrations.stripe, note: "Stripe: card on file, payment links, Tap to Pay." },
          maps: { connected: env.integrations.maps, note: "Google Maps Routes for drive times. Without a key, distances are straight-line." },
          auth: { connected: env.integrations.clerk, note: "Clerk for sign-in and organizations. Without a key, the development user picker is used." },
        },
      };
    });
    return c.json(data);
  });

  r.patch("/", requireRole("admin", "supervisor"), async (c) => {
    const body = parse(settingsUpdate, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [org] = await tx.select().from(s.orgs).limit(1);
      if (!org) notFound("Organization not found");
      const merged = body.settings ? { ...companySettings(org.settings), ...(body.settings as Record<string, unknown>) } : undefined;
      await tx.update(s.orgs).set({ ...(body.name ? { name: body.name } : {}), ...(body.city != null ? { city: body.city } : {}), ...(body.timezone ? { timezone: body.timezone } : {}), ...(body.phone != null ? { phone: body.phone } : {}), ...(body.email != null ? { email: body.email } : {}), ...(body.address != null ? { address: body.address } : {}), ...(body.license != null ? { license: body.license } : {}), ...(merged ? { settings: merged } : {}), updatedAt: nowIso() }).where(eq(s.orgs.id, org.id));
      await tx.insert(s.fieldChanges).values({ orgId: session.orgId, entity: "org", entityId: org.id, field: "settings", fromValue: "", toValue: Object.keys(body.settings ?? {}).join(","), userId: session.userId });
    });
    publish(c.get("session").orgId, "settings.updated");
    return c.json({ ok: true });
  });

  r.post("/users", requireRole("admin"), async (c) => {
    const body = parse(userCreate, await jsonBody(c));
    const user = await run(c, async (tx, session) => (await tx.insert(s.users).values({ ...body, orgId: session.orgId }).returning())[0]!);
    return c.json({ user }, 201);
  });

  r.patch("/users/:id", requireRole("admin", "supervisor"), async (c) => {
    const id = c.req.param("id");
    const body = parse(userUpdate, await jsonBody(c));
    await run(c, async (tx, session) => {
      const { offDates, ...fields } = body;
      await tx.update(s.users).set({ ...fields, updatedAt: nowIso() }).where(eq(s.users.id, id));
      if (offDates) {
        await tx.delete(s.userOffDays).where(eq(s.userOffDays.userId, id));
        if (offDates.length) await tx.insert(s.userOffDays).values(offDates.map((date) => ({ orgId: session.orgId, userId: id, date })));
      }
    });
    return c.json({ ok: true });
  });

  r.post("/teams", requireRole("admin"), async (c) => {
    const body = parse(teamBody, await jsonBody(c));
    const team = await run(c, async (tx, session) => (await tx.insert(s.teams).values({ ...body, orgId: session.orgId }).returning())[0]!);
    return c.json({ team }, 201);
  });

  r.post("/vendors", async (c) => {
    const body = parse(vendorBody, await jsonBody(c));
    const vendor = await run(c, async (tx, session) => (await tx.insert(s.vendors).values({ ...body, orgId: session.orgId }).returning())[0]!);
    return c.json({ vendor }, 201);
  });

  r.patch("/vendors/:id", async (c) => {
    const body = parse(vendorBody.partial(), await jsonBody(c));
    await run(c, (tx) => tx.update(s.vendors).set(body).where(eq(s.vendors.id, c.req.param("id"))));
    return c.json({ ok: true });
  });

  r.post("/checklists", requireRole("admin", "supervisor"), async (c) => {
    const body = parse(templateBody, await jsonBody(c));
    const template = await run(c, async (tx, session) => (await tx.insert(s.checklistTemplates).values({ ...body, orgId: session.orgId }).returning())[0]!);
    return c.json({ template }, 201);
  });

  r.patch("/checklists/:id", requireRole("admin", "supervisor"), async (c) => {
    const body = parse(templateBody.partial(), await jsonBody(c));
    await run(c, (tx) => tx.update(s.checklistTemplates).set(body).where(eq(s.checklistTemplates.id, c.req.param("id"))));
    return c.json({ ok: true });
  });

  r.post("/warehouses", requireRole("admin"), async (c) => {
    const body = parse(warehouseBody, await jsonBody(c));
    const warehouse = await run(c, async (tx, session) => (await tx.insert(s.warehouses).values({ ...body, orgId: session.orgId }).returning())[0]!);
    return c.json({ warehouse }, 201);
  });

  r.patch("/warehouses/:id", requireRole("admin"), async (c) => {
    const body = parse(warehouseBody.partial(), await jsonBody(c));
    await run(c, (tx) => tx.update(s.warehouses).set(body).where(eq(s.warehouses.id, c.req.param("id"))));
    return c.json({ ok: true });
  });

  r.get("/changes", async (c) => {
    const rows = await run(c, (tx) => tx.select({ f: s.fieldChanges, userName: s.users.name }).from(s.fieldChanges).leftJoin(s.users, eq(s.users.id, s.fieldChanges.userId)).where(and(eq(s.fieldChanges.entity, "org"))).orderBy(desc(s.fieldChanges.createdAt)).limit(50));
    return c.json({ changes: rows });
  });

  return r;
}
