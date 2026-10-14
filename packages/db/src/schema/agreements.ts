import { AGREEMENT_BILLING, AGREEMENT_STATUSES, AGREEMENT_TIERS, VISIT_STATUSES } from "@fieldline/shared";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, idCol, money, updatedAt } from "./_shared";
import { orgs, users } from "./core";
import { customers, equipment, sites } from "./customers";

export const agreementTierEnum = pgEnum("agreement_tier", AGREEMENT_TIERS);
export const agreementStatusEnum = pgEnum("agreement_status", AGREEMENT_STATUSES);
export const agreementBillingEnum = pgEnum("agreement_billing", AGREEMENT_BILLING);
export const visitStatusEnum = pgEnum("visit_status", VISIT_STATUSES);

/** A maintenance agreement on a site: which units, how many visits a year, how it is billed, what response time is promised. */
export const agreements = pgTable(
  "agreements",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    siteId: uuid("site_id").notNull().references(() => sites.id),
    tier: agreementTierEnum("tier").notNull().default("silver"),
    name: text("name").notNull().default(""),
    status: agreementStatusEnum("status").notNull().default("active"),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    autoRenew: boolean("auto_renew").notNull().default(true),
    billingMethod: agreementBillingEnum("billing_method").notNull().default("annual_invoice"),
    /** Annual value, or the monthly amount when billed monthly. */
    amount: money("amount").notNull().default(0),
    /** Price of one maintenance visit when visits are billed individually. */
    visitAmount: money("visit_amount"),
    visitsPerYear: integer("visits_per_year").notNull().default(2),
    /** Promised response time in hours for service calls under this agreement. */
    responseHours: integer("response_hours"),
    includedServices: jsonb("included_services").$type<string[]>().notNull().default([]),
    notes: text("notes").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("agreements_site_idx").on(t.siteId), index("agreements_org_status_idx").on(t.orgId, t.status, t.endsOn)],
);

export const agreementAssets = pgTable(
  "agreement_assets",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    agreementId: uuid("agreement_id").notNull().references(() => agreements.id),
    equipmentId: uuid("equipment_id").notNull().references(() => equipment.id),
  },
  (t) => [index("agreement_assets_agreement_idx").on(t.agreementId)],
);

/** One planned maintenance visit. Generating a season creates these; scheduling one creates the work order. */
export const agreementVisits = pgTable(
  "agreement_visits",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    agreementId: uuid("agreement_id").notNull().references(() => agreements.id),
    season: text("season").notNull(),
    dueOn: date("due_on", { mode: "string" }).notNull(),
    status: visitStatusEnum("status").notNull().default("unscheduled"),
    workOrderId: uuid("work_order_id"),
    createdAt: createdAt(),
  },
  (t) => [index("agreement_visits_agreement_idx").on(t.agreementId), index("agreement_visits_due_idx").on(t.orgId, t.status, t.dueOn)],
);
