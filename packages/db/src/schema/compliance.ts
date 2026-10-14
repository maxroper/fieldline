import { CHECK_RESULTS, LEAK_CHECKS, PERMIT_STATUSES } from "@fieldline/shared";
import { boolean, date, index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, idCol, percent, qty, stamp } from "./_shared";
import { orgs, users } from "./core";
import { equipment, sites } from "./customers";
import { workOrders } from "./work";

export const leakCheckEnum = pgEnum("leak_check", LEAK_CHECKS);
export const permitStatusEnum = pgEnum("permit_status", PERMIT_STATUSES);

export interface ChecklistItem {
  key: string;
  label: string;
  hint?: string;
}

export interface ChecklistAnswer {
  key: string;
  result: (typeof CHECK_RESULTS)[number];
  note?: string;
}

/** PM inspection, safety, or custom forms. `trigger` says which jobs get it automatically. */
export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    kind: text("kind").notNull().default("custom"),
    items: jsonb("items").$type<ChecklistItem[]>().notNull().default([]),
    requiredBeforeComplete: boolean("required_before_complete").notNull().default(false),
    trigger: jsonb("trigger").$type<{ callTypes?: string[]; equipmentKinds?: string[] }>().notNull().default({}),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("checklist_templates_org_idx").on(t.orgId)],
);

export const checklistResults = pgTable(
  "checklist_results",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id),
    templateId: uuid("template_id").notNull().references(() => checklistTemplates.id),
    techId: uuid("tech_id").references(() => users.id),
    items: jsonb("items").$type<ChecklistAnswer[]>().notNull().default([]),
    completedAt: stamp("completed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("checklist_results_wo_idx").on(t.workOrderId)],
);

/**
 * Refrigerant handled on a job. Feeds EPA Section 608 records, the 40 CFR 84.106 service record for appliances
 * of 15 lb or more, and CARB records for systems over 50 lb. Leak rate = added / full charge, annualized by the caller.
 */
export const refrigerantLogs = pgTable(
  "refrigerant_logs",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    techId: uuid("tech_id").references(() => users.id),
    techCert: text("tech_cert").notNull().default(""),
    refrigerantType: text("refrigerant_type").notNull(),
    lbsAdded: qty("lbs_added").notNull().default(0),
    lbsRecovered: qty("lbs_recovered").notNull().default(0),
    cylinderId: text("cylinder_id").notNull().default(""),
    leakCheck: leakCheckEnum("leak_check").notNull().default("na"),
    leakRatePercent: percent("leak_rate_percent"),
    fullChargeLbs: qty("full_charge_lbs"),
    notes: text("notes").notNull().default(""),
    loggedAt: stamp("logged_at").notNull().defaultNow(),
  },
  (t) => [index("refrigerant_logs_wo_idx").on(t.workOrderId), index("refrigerant_logs_equipment_idx").on(t.equipmentId)],
);

/** Permit and Title 24 test status per job. */
export const permits = pgTable(
  "permits",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id),
    siteId: uuid("site_id").references(() => sites.id),
    jurisdiction: text("jurisdiction").notNull().default(""),
    permitNumber: text("permit_number").notNull().default(""),
    status: permitStatusEnum("status").notNull().default("needed"),
    tests: jsonb("tests").$type<Record<string, string>>().notNull().default({}),
    filedOn: date("filed_on", { mode: "string" }),
    finalOn: date("final_on", { mode: "string" }),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("permits_wo_idx").on(t.workOrderId)],
);

/** Manufacturer warranty registration and claims per unit. */
export const warrantyClaims = pgTable(
  "warranty_claims",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    equipmentId: uuid("equipment_id").notNull().references(() => equipment.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    manufacturer: text("manufacturer").notNull().default(""),
    registeredOn: date("registered_on", { mode: "string" }),
    registrationDeadline: date("registration_deadline", { mode: "string" }),
    claimStatus: text("claim_status").notNull().default("none"),
    claimNumber: text("claim_number").notNull().default(""),
    partsReturnBy: date("parts_return_by", { mode: "string" }),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("warranty_claims_equipment_idx").on(t.equipmentId)],
);
