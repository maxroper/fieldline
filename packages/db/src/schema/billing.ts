import { CREDIT_REASONS, INVOICE_STATUSES, PAYMENT_METHODS } from "@fieldline/shared";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, idCol, money, percent, stamp, updatedAt } from "./_shared";
import { orgs, users } from "./core";
import { customers } from "./customers";
import { invoiceDeliveryEnum } from "./customers";
import { workOrders } from "./work";

export const invoiceStatusEnum = pgEnum("invoice_status", INVOICE_STATUSES);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
export const creditReasonEnum = pgEnum("credit_reason", CREDIT_REASONS);

/** A frozen line on an invoice. Totals never recompute after billing; revisions store a new snapshot. */
export interface FrozenLine {
  id: string;
  kind: "labor" | "travel" | "material" | "misc" | "vehicle" | "tax" | "flat";
  description: string;
  quantity: number | null;
  rate: number | null;
  amount: number;
}

export interface InvoiceSnapshot {
  lines: FrozenLine[];
  subtotal: number;
  tax: number;
  total: number;
  taxKind: "sales" | "use";
  nteAmount: number | null;
  travelSeparate: boolean;
}

/** One invoice per job (all trips). Created when the office marks the work order billed. */
export const invoices = pgTable(
  "invoices",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    number: integer("number").notNull(),
    workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id),
    customerId: uuid("customer_id").references(() => customers.id),
    status: invoiceStatusEnum("status").notNull().default("billed"),
    billedAt: stamp("billed_at").notNull().defaultNow(),
    dueDate: date("due_date", { mode: "string" }),
    amount: money("amount").notNull().default(0),
    laborMode: text("labor_mode").notNull().default("itemized"),
    materialMode: text("material_mode").notNull().default("itemized"),
    hideHourlyRate: boolean("hide_hourly_rate").notNull().default(false),
    descriptions: jsonb("descriptions").$type<Record<string, string>>().notNull().default({}),
    snapshot: jsonb("snapshot").$type<InvoiceSnapshot>().notNull(),
    taxableAmount: money("taxable_amount").notNull().default(0),
    taxRate: percent("tax_rate").notNull().default(0),
    salesTax: money("sales_tax").notNull().default(0),
    accruedUseTax: money("accrued_use_tax").notNull().default(0),
    paymentToken: text("payment_token"),
    qboId: text("qbo_id"),
    qboSyncedAt: stamp("qbo_synced_at"),
    qboError: text("qbo_error").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("invoices_number").on(t.orgId, t.number), uniqueIndex("invoices_wo").on(t.workOrderId), index("invoices_customer_idx").on(t.customerId, t.status)],
);

export const invoiceRevisions = pgTable(
  "invoice_revisions",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    rev: integer("rev").notNull(),
    reason: text("reason").notNull().default(""),
    snapshot: jsonb("snapshot").$type<InvoiceSnapshot>().notNull(),
    userId: uuid("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("invoice_revisions_invoice_idx").on(t.invoiceId)],
);

export const creditMemos = pgTable(
  "credit_memos",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    number: integer("number").notNull(),
    amount: money("amount").notNull(),
    reason: creditReasonEnum("reason").notNull().default("other"),
    note: text("note").notNull().default(""),
    lineIds: jsonb("line_ids").$type<string[]>().notNull().default([]),
    userId: uuid("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("credit_memos_invoice_idx").on(t.invoiceId)],
);

export const invoiceDeliveries = pgTable(
  "invoice_deliveries",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    method: invoiceDeliveryEnum("method").notNull(),
    emails: jsonb("emails").$type<string[]>().notNull().default([]),
    userId: uuid("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("invoice_deliveries_invoice_idx").on(t.invoiceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    invoiceId: uuid("invoice_id").references(() => invoices.id),
    customerId: uuid("customer_id").references(() => customers.id),
    amount: money("amount").notNull(),
    method: paymentMethodEnum("method").notNull(),
    reference: text("reference").notNull().default(""),
    providerId: text("provider_id"),
    receivedAt: stamp("received_at").notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId), index("payments_customer_idx").on(t.customerId)],
);
