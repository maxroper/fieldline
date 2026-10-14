import { AUTOMATION_KEYS, MESSAGE_CHANNELS, MESSAGE_DIRECTIONS, MESSAGE_STATUSES } from "@fieldline/shared";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, idCol, stamp } from "./_shared";
import { orgs, users } from "./core";
import { customers } from "./customers";
import { workOrders } from "./work";

export const messageChannelEnum = pgEnum("message_channel", MESSAGE_CHANNELS);
export const messageDirectionEnum = pgEnum("message_direction", MESSAGE_DIRECTIONS);
export const messageStatusEnum = pgEnum("message_status", MESSAGE_STATUSES);
export const automationKeyEnum = pgEnum("automation_key", AUTOMATION_KEYS);

/** Every text or email with a customer, sent by a person or by an automation. Threads are grouped by customer. */
export const messages = pgTable(
  "messages",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    customerId: uuid("customer_id").references(() => customers.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    channel: messageChannelEnum("channel").notNull().default("sms"),
    direction: messageDirectionEnum("direction").notNull(),
    fromAddress: text("from_address").notNull().default(""),
    toAddress: text("to_address").notNull().default(""),
    body: text("body").notNull(),
    automated: boolean("automated").notNull().default(false),
    template: text("template").notNull().default(""),
    status: messageStatusEnum("status").notNull().default("queued"),
    providerId: text("provider_id"),
    error: text("error").notNull().default(""),
    sentBy: uuid("sent_by").references(() => users.id),
    readAt: stamp("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_customer_idx").on(t.customerId, t.createdAt), index("messages_org_idx").on(t.orgId, t.createdAt)],
);

/** Switches for the automatic messages and follow-ups, with their counters. */
export const automations = pgTable(
  "automations",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    key: automationKeyEnum("key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    sentCount: integer("sent_count").notNull().default(0),
    lastRunAt: stamp("last_run_at"),
  },
  (t) => [uniqueIndex("automations_key").on(t.orgId, t.key)],
);
