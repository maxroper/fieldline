import { QUOTE_REASONS, QUOTE_STATUSES, QUOTE_TIERS } from "@fieldline/shared";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, hours, idCol, money, percent, qty, stamp, updatedAt } from "./_shared";
import { orgs, users } from "./core";
import { customers, equipment, sites } from "./customers";
import { workOrders } from "./work";

export const quoteStatusEnum = pgEnum("quote_status", QUOTE_STATUSES);
export const quoteReasonEnum = pgEnum("quote_reason", QUOTE_REASONS);
export const quoteTierEnum = pgEnum("quote_tier", QUOTE_TIERS);

export interface QuoteLabor {
  journeymanHours: number;
  apprenticeHours: number;
  driverHours: number;
  journeymanRate: number | null;
  apprenticeRate: number | null;
  driverRate: number | null;
}

export const quotes = pgTable(
  "quotes",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    number: integer("number").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    siteId: uuid("site_id").references(() => sites.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    /** The visit the quote was found on. */
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    contactName: text("contact_name").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    reason: quoteReasonEnum("reason").notNull().default("service"),
    problemText: text("problem_text").notNull().default(""),
    scope: text("scope").notNull().default(""),
    scopeTemplateId: uuid("scope_template_id"),
    labor: jsonb("labor").$type<QuoteLabor>().notNull().default({ journeymanHours: 0, apprenticeHours: 0, driverHours: 0, journeymanRate: null, apprenticeRate: null, driverRate: null }),
    marginPercent: percent("margin_percent").notNull().default(45),
    status: quoteStatusEnum("status").notNull().default("draft"),
    sentAt: stamp("sent_at"),
    viewedAt: stamp("viewed_at"),
    viewCount: integer("view_count").notNull().default(0),
    approvedAt: stamp("approved_at"),
    declinedAt: stamp("declined_at"),
    lossReason: text("loss_reason").notNull().default(""),
    lossNote: text("loss_note").notNull().default(""),
    followUpDate: date("follow_up_date", { mode: "string" }),
    followUpKind: text("follow_up_kind").notNull().default(""),
    selectedOptionId: uuid("selected_option_id"),
    /** The quoted work order created on approval. */
    createdWorkOrderId: uuid("created_work_order_id"),
    approvalToken: text("approval_token"),
    signerName: text("signer_name").notNull().default(""),
    signatureFileId: uuid("signature_file_id"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("quotes_number").on(t.orgId, t.number), index("quotes_status_idx").on(t.orgId, t.status), index("quotes_customer_idx").on(t.customerId)],
);

/** Good / Better / Best (or a single option). The customer picks one. */
export const quoteOptions = pgTable(
  "quote_options",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id),
    tier: quoteTierEnum("tier").notNull().default("single"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    price: money("price").notNull().default(0),
    cost: money("cost"),
    financingMonthly: money("financing_monthly"),
    isRecommended: boolean("is_recommended").notNull().default(false),
    included: jsonb("included").$type<string[]>().notNull().default([]),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("quote_options_quote_idx").on(t.quoteId)],
);

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    quoteId: uuid("quote_id").notNull().references(() => quotes.id),
    optionId: uuid("option_id").references(() => quoteOptions.id),
    kind: text("kind").notNull().default("material"),
    description: text("description").notNull(),
    quantity: qty("quantity").notNull().default(1),
    unitCost: money("unit_cost").notNull().default(0),
    pricebookItemId: uuid("pricebook_item_id"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("quote_lines_quote_idx").on(t.quoteId)],
);

/** Reusable scopes of work with default labor. */
export const scopeTemplates = pgTable(
  "scope_templates",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    scope: text("scope").notNull().default(""),
    laborHours: hours("labor_hours").notNull().default(0),
    labor: jsonb("labor").$type<Partial<QuoteLabor>>().notNull().default({}),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("scope_templates_org_idx").on(t.orgId)],
);

/** Flat-rate repairs and catalog items with Good / Better / Best prices. */
export const pricebookItems = pgTable(
  "pricebook_items",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("Repairs"),
    description: text("description").notNull().default(""),
    partsCost: money("parts_cost").notNull().default(0),
    laborHours: hours("labor_hours").notNull().default(0),
    priceGood: money("price_good"),
    priceBetter: money("price_better"),
    priceBest: money("price_best"),
    marginPercent: percent("margin_percent"),
    imageFileId: uuid("image_file_id"),
    timesUsed: integer("times_used").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pricebook_code").on(t.orgId, t.code), index("pricebook_category_idx").on(t.orgId, t.category)],
);
