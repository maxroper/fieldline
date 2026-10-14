import { ROLES, type CompanySettings } from "@fieldline/shared";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, hours, idCol, stamp, updatedAt } from "./_shared";

export const roleEnum = pgEnum("role", ROLES);

/** A company. Every other row carries org_id and is isolated by row-level security. */
export const orgs = pgTable("orgs", {
  id: idCol(),
  name: text("name").notNull(),
  city: text("city").notNull().default(""),
  timezone: text("timezone").notNull().default("America/Los_Angeles"),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  license: text("license").notNull().default(""),
  /** Pricing, tax, documents and compliance settings. See CompanySettings in @fieldline/shared. */
  settings: jsonb("settings").$type<Partial<CompanySettings>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const teams = pgTable(
  "teams",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    isHome: boolean("is_home").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("teams_org_idx").on(t.orgId)],
);

export const users = pgTable(
  "users",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    name: text("name").notNull(),
    email: text("email"),
    role: roleEnum("role").notNull(),
    title: text("title").notNull().default(""),
    phone: text("phone").notNull().default(""),
    /** Techs belong to a team; office users have a home team. */
    teamId: uuid("team_id").references(() => teams.id),
    homeTeamId: uuid("home_team_id").references(() => teams.id),
    canEditCustomers: boolean("can_edit_customers"),
    canBill: boolean("can_bill"),
    shiftHours: hours("shift_hours").notNull().default(8),
    active: boolean("active").notNull().default(true),
    /** External identity (Clerk user id) once real sign-in is connected. */
    authSubject: text("auth_subject"),
    lastActiveAt: stamp("last_active_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("users_org_idx").on(t.orgId), uniqueIndex("users_auth_subject_idx").on(t.authSubject)],
);

export const userOffDays = pgTable(
  "user_off_days",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [uniqueIndex("user_off_days_unique").on(t.userId, t.date)],
);

/** Per-org business numbers: work order, quote, PO, invoice, credit. Incremented atomically. */
export const counters = pgTable(
  "counters",
  {
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    key: text("key").notNull(),
    value: integer("value").notNull().default(1000),
  },
  (t) => [uniqueIndex("counters_unique").on(t.orgId, t.key)],
);

/** Who changed which field, for customers, sites, work orders and settings. */
export const fieldChanges = pgTable(
  "field_changes",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    field: text("field").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    userId: uuid("user_id").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("field_changes_entity_idx").on(t.entity, t.entityId)],
);
