import { schema as s, type Connection, type Tx } from "@fieldline/db";
import { automationToggle, messageSend, minuteLabel, type AutomationKey } from "@fieldline/shared";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { nowIso, scoped } from "../db";
import { env } from "../env";
import { jsonBody, notFound, parse } from "../http";
import { publish } from "../realtime";

/**
 * Outbound texting. With Twilio configured the message goes out over its REST API; without it the
 * "demo" provider marks the message delivered so the product flow can be exercised end to end.
 * Carrier registration (A2P 10DLC) is required before a real number can send; see docs/FEATURES.md F3.
 */
async function sendSms(to: string, body: string): Promise<{ status: "sent" | "delivered" | "failed"; providerId: string | null; error: string }> {
  if (!env.integrations.twilio) return { status: "delivered", providerId: `demo-${Date.now()}`, error: "" };
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_FROM_NUMBER!;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    const json = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) return { status: "failed", providerId: null, error: json.message ?? `Twilio ${res.status}` };
    return { status: "sent", providerId: json.sid ?? null, error: "" };
  } catch (err) {
    return { status: "failed", providerId: null, error: String(err) };
  }
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export type AutomationContext = { workOrderId: string | null; customerId: string | null; techId: string | null };

/**
 * Called by product events (tech taps On my way, a job is closed out). Looks up the automation switch,
 * renders the message, and either sends it now or queues a follow-up item for a delayed send.
 */
export async function queueAutomation(tx: Tx, orgId: string, key: AutomationKey | "photo_report", ctx: AutomationContext): Promise<void> {
  const [org] = await tx.select({ name: s.orgs.name, phone: s.orgs.phone }).from(s.orgs).where(eq(s.orgs.id, orgId)).limit(1);
  const automation = key === "photo_report" ? null : (await tx.select().from(s.automations).where(eq(s.automations.key, key)).limit(1))[0];
  if (key !== "photo_report" && (!automation || !automation.enabled)) return;
  const wo = ctx.workOrderId ? (await tx.select().from(s.workOrders).where(eq(s.workOrders.id, ctx.workOrderId)).limit(1))[0] : null;
  const site = wo?.siteId ? (await tx.select().from(s.sites).where(eq(s.sites.id, wo.siteId)).limit(1))[0] : null;
  const customer = ctx.customerId ? (await tx.select().from(s.customers).where(eq(s.customers.id, ctx.customerId)).limit(1))[0] : null;
  const tech = ctx.techId ? (await tx.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, ctx.techId)).limit(1))[0] : null;
  const to = normalizePhone(wo?.callerPhone || site?.contactPhone || customer?.phone || "");
  const siteName = site?.name || wo?.siteText || "your site";
  const techFirst = tech?.name.split(" ")[0] ?? "Your technician";
  const trackingUrl = wo?.trackingToken ? `${env.corsOrigins[0] ?? ""}/t/${wo.trackingToken}` : "";
  let body = "";
  let template = key;
  if (key === "on_my_way") body = `${org?.name ?? "Fieldline"}: ${techFirst} is on the way to ${siteName}${wo?.startMinute != null ? `, arriving about ${minuteLabel(wo.startMinute)}` : ""}. Track: ${trackingUrl}`;
  else if (key === "review_request") {
    const delayHours = Number((automation?.config as { delayHours?: number } | undefined)?.delayHours ?? 2);
    await tx.insert(s.followUpItems).values({ orgId, kind: "review_request", status: "open", title: `Review request · ${customer?.name ?? siteName}${wo ? ` (${wo.number})` : ""}`, detail: `Sends ${delayHours} hours after completion unless skipped.`, dueOn: wo?.closedAt?.slice(0, 10) ?? nowIso().slice(0, 10), customerId: ctx.customerId, workOrderId: ctx.workOrderId });
    return;
  } else if (key === "photo_report") body = `${org?.name ?? "Fieldline"}: your service report for ${siteName} is ready with photos and the work performed: ${env.corsOrigins[0] ?? ""}/portal/${customer?.portalToken ?? ""}`;
  else if (key === "confirmation") body = `${org?.name ?? "Fieldline"}: ${techFirst} is scheduled at ${siteName}${wo?.scheduledFor ? ` on ${wo.scheduledFor}` : ""}${wo?.startMinute != null ? ` at ${minuteLabel(wo.startMinute)}` : ""}. Reply C to confirm or call ${org?.phone ?? ""}.`;
  else return;
  if (!to) {
    await tx.insert(s.followUpItems).values({ orgId, kind: "eta_text_failed", status: "open", title: `Text failed · ${customer?.name ?? siteName}${wo ? ` (${wo.number})` : ""}`, detail: "No mobile number on the work order, site or customer. Add one or call.", dueOn: nowIso().slice(0, 10), customerId: ctx.customerId, workOrderId: ctx.workOrderId });
    return;
  }
  const result = await sendSms(to, body);
  await tx.insert(s.messages).values({ orgId, customerId: ctx.customerId, workOrderId: ctx.workOrderId, channel: "sms", direction: "out", fromAddress: process.env.TWILIO_FROM_NUMBER ?? org?.phone ?? "", toAddress: to, body, automated: true, template, status: result.status, providerId: result.providerId, error: result.error });
  if (automation) await tx.update(s.automations).set({ sentCount: sql`${s.automations.sentCount} + 1`, lastRunAt: nowIso() }).where(eq(s.automations.id, automation.id));
  if (result.status === "failed") {
    await tx.insert(s.followUpItems).values({ orgId, kind: "eta_text_failed", status: "open", title: `Text failed · ${customer?.name ?? siteName}${wo ? ` (${wo.number})` : ""}`, detail: result.error || "The carrier rejected the message.", dueOn: nowIso().slice(0, 10), customerId: ctx.customerId, workOrderId: ctx.workOrderId });
  }
}

export function messagesRoutes(conn: Connection) {
  const r = new Hono<AppEnv>();
  const run = scoped(conn);

  /** Threads: one per customer, newest first, with the unread count of inbound texts. */
  r.get("/", async (c) => {
    const threads = await run(c, async (tx) => {
      const rows = await tx
        .select({
          customerId: s.messages.customerId,
          customerName: s.customers.name,
          lastAt: sql<string>`max(${s.messages.createdAt})`,
          unread: sql<number>`count(*) filter (where ${s.messages.direction} = 'in' and ${s.messages.readAt} is null)`,
          total: sql<number>`count(*)`,
        })
        .from(s.messages)
        .leftJoin(s.customers, eq(s.customers.id, s.messages.customerId))
        .groupBy(s.messages.customerId, s.customers.name)
        .orderBy(desc(sql`max(${s.messages.createdAt})`));
      const out = [];
      for (const row of rows) {
        const [last] = await tx.select().from(s.messages).where(row.customerId ? eq(s.messages.customerId, row.customerId) : isNull(s.messages.customerId)).orderBy(desc(s.messages.createdAt)).limit(1);
        out.push({ ...row, unread: Number(row.unread), total: Number(row.total), last });
      }
      return out;
    });
    return c.json({ threads });
  });

  r.get("/automations", async (c) => {
    const rows = await run(c, (tx) => tx.select().from(s.automations).orderBy(s.automations.key));
    return c.json({ automations: rows, provider: env.integrations.twilio ? "twilio" : "demo" });
  });

  r.patch("/automations/:key", async (c) => {
    const key = c.req.param("key") as AutomationKey;
    const body = parse(automationToggle, await jsonBody(c));
    await run(c, async (tx, session) => {
      const [existing] = await tx.select().from(s.automations).where(eq(s.automations.key, key)).limit(1);
      if (existing) await tx.update(s.automations).set({ enabled: body.enabled }).where(eq(s.automations.id, existing.id));
      else await tx.insert(s.automations).values({ orgId: session.orgId, key, enabled: body.enabled });
    });
    return c.json({ ok: true });
  });

  r.get("/thread/:customerId", async (c) => {
    const customerId = c.req.param("customerId");
    const thread = await run(c, async (tx) => {
      const [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, customerId)).limit(1);
      if (!customer) notFound("Customer not found");
      const rows = await tx.select({ m: s.messages, senderName: s.users.name }).from(s.messages).leftJoin(s.users, eq(s.users.id, s.messages.sentBy)).where(eq(s.messages.customerId, customerId)).orderBy(s.messages.createdAt);
      await tx.update(s.messages).set({ readAt: nowIso() }).where(and(eq(s.messages.customerId, customerId), eq(s.messages.direction, "in"), isNull(s.messages.readAt)));
      const openWos = await tx.select({ id: s.workOrders.id, number: s.workOrders.number, trip: s.workOrders.trip, title: s.workOrders.title, status: s.workOrders.status, scheduledFor: s.workOrders.scheduledFor }).from(s.workOrders).where(and(eq(s.workOrders.customerId, customerId), inArray(s.workOrders.status, ["open"]))).orderBy(desc(s.workOrders.createdAt)).limit(5);
      return { customer, messages: rows, openWorkOrders: openWos };
    });
    return c.json(thread);
  });

  r.post("/", async (c) => {
    const body = parse(messageSend, await jsonBody(c));
    const message = await run(c, async (tx, session) => {
      const to = body.channel === "sms" ? normalizePhone(body.to) : body.to;
      if (!to) notFound("That is not a mobile number");
      const result = body.channel === "sms" ? await sendSms(to, body.body) : { status: "sent" as const, providerId: null, error: "" };
      const [row] = await tx.insert(s.messages).values({ orgId: session.orgId, customerId: body.customerId ?? null, workOrderId: body.workOrderId ?? null, channel: body.channel, direction: "out", fromAddress: process.env.TWILIO_FROM_NUMBER ?? "", toAddress: to, body: body.body, automated: false, template: body.template ?? "", status: result.status, providerId: result.providerId, error: result.error, sentBy: session.userId }).returning();
      return row!;
    });
    publish(c.get("session").orgId, "message.sent", message.id);
    return c.json({ message }, 201);
  });

  return r;
}
