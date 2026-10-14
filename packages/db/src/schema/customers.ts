import { EQUIPMENT_SOURCES, EQUIPMENT_STAGES, INVOICE_DELIVERY } from "@fieldline/shared";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, idCol, money, percent, qty, updatedAt } from "./_shared";
import { orgs, users } from "./core";

export const invoiceDeliveryEnum = pgEnum("invoice_delivery", INVOICE_DELIVERY);
export const equipmentSourceEnum = pgEnum("equipment_source", EQUIPMENT_SOURCES);
export const equipmentStageEnum = pgEnum("equipment_stage", EQUIPMENT_STAGES);

/** The bill-to parent. Sites hang off it. */
export const customers = pgTable(
  "customers",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    billingAddress: text("billing_address").notNull().default(""),
    apContactName: text("ap_contact_name").notNull().default(""),
    apContactPhone: text("ap_contact_phone").notNull().default(""),
    /** Contract customers use the contract rate and margin tables. */
    contract: boolean("contract").notNull().default(false),
    creditLimit: money("credit_limit"),
    accountManagerId: uuid("account_manager_id").references(() => users.id),
    taxExempt: boolean("tax_exempt").notNull().default(false),
    taxExemptNumber: text("tax_exempt_number").notNull().default(""),
    invoiceDelivery: invoiceDeliveryEnum("invoice_delivery"),
    invoiceEmails: jsonb("invoice_emails").$type<string[]>().notNull().default([]),
    /** Card on file lives at the payment provider; only the display data is here. */
    cardOnFile: jsonb("card_on_file").$type<{ brand: string; last4: string; providerId: string } | null>(),
    portalEnabled: boolean("portal_enabled").notNull().default(false),
    portalToken: text("portal_token"),
    qboId: text("qbo_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customers_org_idx").on(t.orgId), index("customers_name_idx").on(t.orgId, t.name)],
);

export const sites = pgTable(
  "sites",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    name: text("name").notNull().default(""),
    address: text("address").notNull(),
    city: text("city").notNull().default(""),
    contact: text("contact").notNull().default(""),
    contactPhone: text("contact_phone").notNull().default(""),
    /** Gate codes, roof access, where to check in. Shown to the tech. */
    accessNotes: text("access_notes").notNull().default(""),
    primaryTechId: uuid("primary_tech_id").references(() => users.id),
    backupTechId: uuid("backup_tech_id").references(() => users.id),
    /** Overrides the company sales tax percent. */
    taxRate: percent("tax_rate"),
    invoiceDelivery: invoiceDeliveryEnum("invoice_delivery"),
    invoiceEmails: jsonb("invoice_emails").$type<string[]>(),
    lat: percent("lat"),
    lng: percent("lng"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sites_org_idx").on(t.orgId), index("sites_customer_idx").on(t.customerId)],
);

export const equipment = pgTable(
  "equipment",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    siteId: uuid("site_id").notNull().references(() => sites.id),
    tag: text("tag").notNull(),
    kind: text("kind").notNull().default(""),
    make: text("make").notNull().default(""),
    model: text("model").notNull().default(""),
    serial: text("serial").notNull().default(""),
    tons: qty("tons"),
    refrigerant: text("refrigerant").notNull().default(""),
    /** Full charge in pounds. Needed for leak-rate math. */
    chargeLbs: qty("charge_lbs"),
    installYear: integer("install_year"),
    manufactureDate: date("manufacture_date", { mode: "string" }),
    warrantyPartsUntil: date("warranty_parts_until", { mode: "string" }),
    warrantyLaborUntil: date("warranty_labor_until", { mode: "string" }),
    locationNote: text("location_note").notNull().default(""),
    source: equipmentSourceEnum("source").notNull().default("manual"),
    stage: equipmentStageEnum("stage").notNull().default("active"),
    nameplateFileId: uuid("nameplate_file_id"),
    qrCode: text("qr_code"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("equipment_site_idx").on(t.siteId), index("equipment_org_idx").on(t.orgId)],
);
