import { BILLING_TYPES, CALL_TYPES, FILE_KINDS, FOLLOW_UP_KINDS, FOLLOW_UP_STATUSES, PRIORITIES, TECH_STATUSES, TIMESHEET_STATUSES, TIME_KINDS, WAIT_REASONS, WO_STATUSES } from "@fieldline/shared";
import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, hours, idCol, money, percent, stamp, updatedAt } from "./_shared";
import { orgs, users } from "./core";
import { customers, equipment, sites } from "./customers";

export const woStatusEnum = pgEnum("wo_status", WO_STATUSES);
export const techStatusEnum = pgEnum("tech_status", TECH_STATUSES);
export const priorityEnum = pgEnum("priority", PRIORITIES);
export const callTypeEnum = pgEnum("call_type", CALL_TYPES);
export const billingTypeEnum = pgEnum("billing_type", BILLING_TYPES);
export const waitReasonEnum = pgEnum("wait_reason", WAIT_REASONS);
export const timeKindEnum = pgEnum("time_kind", TIME_KINDS);
export const timesheetStatusEnum = pgEnum("timesheet_status", TIMESHEET_STATUSES);
export const fileKindEnum = pgEnum("file_kind", FILE_KINDS);
export const followUpKindEnum = pgEnum("follow_up_kind", FOLLOW_UP_KINDS);
export const followUpStatusEnum = pgEnum("follow_up_status", FOLLOW_UP_STATUSES);

export interface FollowUp {
  reason: (typeof WAIT_REASONS)[number];
  date: string | null;
  note: string;
  part: string;
  expectedDate: string | null;
}

/**
 * One visit of a job. A return visit is a new row with the same `number` and a higher `trip`,
 * so "1042-2" is number 1042, trip 2. The job's bill covers every trip.
 */
export const workOrders = pgTable(
  "work_orders",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    number: integer("number").notNull(),
    trip: integer("trip").notNull().default(1),
    customerId: uuid("customer_id").references(() => customers.id),
    siteId: uuid("site_id").references(() => sites.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    /** Free text when the site is not in the system yet. */
    siteText: text("site_text").notNull().default(""),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    callType: callTypeEnum("call_type").notNull().default("service"),
    billingType: billingTypeEnum("billing_type").notNull().default("tm"),
    nteAmount: money("nte_amount"),
    quotedAmount: money("quoted_amount"),
    materialBudget: money("material_budget"),
    laborBudgetHours: hours("labor_budget_hours"),
    priority: priorityEnum("priority").notNull().default("normal"),
    status: woStatusEnum("status").notNull().default("open"),
    techStatus: techStatusEnum("tech_status"),
    techStatusAt: stamp("tech_status_at"),
    assignedTechId: uuid("assigned_tech_id").references(() => users.id),
    scheduledFor: date("scheduled_for", { mode: "string" }),
    /** Minutes from midnight in the company timezone. */
    startMinute: integer("start_minute"),
    allocatedHours: hours("allocated_hours"),
    dispatchNote: text("dispatch_note").notNull().default(""),
    needReturn: boolean("need_return").notNull().default(false),
    waitingOnParts: boolean("waiting_on_parts").notNull().default(false),
    warranty: boolean("warranty").notNull().default(false),
    callerName: text("caller_name").notNull().default(""),
    callerPhone: text("caller_phone").notNull().default(""),
    customerPo: text("customer_po").notNull().default(""),
    signatureRequired: boolean("signature_required").notNull().default(false),
    workPerformed: text("work_performed").notNull().default(""),
    signerName: text("signer_name").notNull().default(""),
    signatureFileId: uuid("signature_file_id"),
    /** AI or dictated summary written at closeout; editable. */
    summary: text("summary").notNull().default(""),
    followUp: jsonb("follow_up").$type<FollowUp | null>(),
    agreementId: uuid("agreement_id"),
    agreementVisitId: uuid("agreement_visit_id"),
    /** Public token for the customer tracking page. */
    trackingToken: text("tracking_token"),
    closedAt: stamp("closed_at"),
    createdBy: uuid("created_by").references(() => users.id),
    /** Optimistic lock: a write must carry the version it read, or it gets a 409. */
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("work_orders_number_trip").on(t.orgId, t.number, t.trip),
    index("work_orders_day_idx").on(t.orgId, t.scheduledFor),
    index("work_orders_tech_idx").on(t.assignedTechId, t.scheduledFor),
    index("work_orders_site_idx").on(t.siteId),
    index("work_orders_status_idx").on(t.orgId, t.status),
  ],
);

/** Extra techs on a visit (helpers) or extra days of the same visit. */
export const workOrderHelpers = pgTable(
  "work_order_helpers",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    workOrderId: uuid("work_order_id").notNull().references(() => workOrders.id),
    techId: uuid("tech_id").notNull().references(() => users.id),
    role: text("role").notNull().default("helper"),
    scheduledFor: date("scheduled_for", { mode: "string" }),
    startMinute: integer("start_minute"),
    allocatedHours: hours("allocated_hours"),
    techStatus: techStatusEnum("tech_status"),
    createdAt: createdAt(),
  },
  (t) => [index("wo_helpers_wo_idx").on(t.workOrderId), index("wo_helpers_tech_idx").on(t.techId, t.scheduledFor)],
);

export const notes = pgTable(
  "notes",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    siteId: uuid("site_id").references(() => sites.id),
    userId: uuid("user_id").references(() => users.id),
    kind: text("kind").notNull().default("note"),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("notes_wo_idx").on(t.workOrderId)],
);

/** Photos, nameplates, signatures, PDFs. Bytes live in file storage; this is the record. */
export const files = pgTable(
  "files",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    kind: fileKindEnum("kind").notNull().default("photo"),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    equipmentId: uuid("equipment_id").references(() => equipment.id),
    relatedId: uuid("related_id"),
    caption: text("caption").notNull().default(""),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull().default("application/octet-stream"),
    bytes: integer("bytes").notNull().default(0),
    includeInReport: boolean("include_in_report").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("files_wo_idx").on(t.workOrderId), index("files_equipment_idx").on(t.equipmentId)],
);

/**
 * One punch: travel, labor, meal or rest. The single source of truth for hours.
 * A tech's status buttons write these (en route starts travel; on site stamps arrival; done stops).
 */
export const timeEntries = pgTable(
  "time_entries",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    techId: uuid("tech_id").notNull().references(() => users.id),
    kind: timeKindEnum("kind").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    startedAt: stamp("started_at"),
    /** Set when the tech taps On site; splits the row into drive and labor. */
    arrivedAt: stamp("arrived_at"),
    stoppedAt: stamp("stopped_at"),
    /** Typed hours win after an edit. */
    hours: hours("hours").notNull().default(0),
    edited: boolean("edited").notNull().default(false),
    editedBy: uuid("edited_by").references(() => users.id),
    source: text("source").notNull().default("clock"),
    gpsVerified: boolean("gps_verified").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("time_entries_tech_day_idx").on(t.techId, t.date), index("time_entries_wo_idx").on(t.workOrderId)],
);

/** The day header: submission and review state for one tech's day. Lines are the time entries. */
export const timesheets = pgTable(
  "timesheets",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    techId: uuid("tech_id").notNull().references(() => users.id),
    date: date("date", { mode: "string" }).notNull(),
    status: timesheetStatusEnum("status").notNull().default("open"),
    submittedAt: stamp("submitted_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: stamp("reviewed_at"),
    reviewComment: text("review_comment").notNull().default(""),
    mealReason: text("meal_reason").notNull().default(""),
    missedMeal: boolean("missed_meal").notNull().default(false),
    missedRest: boolean("missed_rest").notNull().default(false),
    premiumHours: hours("premium_hours").notNull().default(0),
    payrollSyncedAt: stamp("payroll_synced_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("timesheets_tech_day").on(t.techId, t.date), index("timesheets_org_day_idx").on(t.orgId, t.date)],
);

/** In-app notices to a tech: new assignment, updated job. */
export const notifications = pgTable(
  "notifications",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    kind: text("kind").notNull().default("assignment"),
    body: text("body").notNull(),
    readAt: stamp("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/** Last known positions reported by the tech app. Feeds the live map and geofence checks. */
export const techLocations = pgTable(
  "tech_locations",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    techId: uuid("tech_id").notNull().references(() => users.id),
    lat: percent("lat").notNull(),
    lng: percent("lng").notNull(),
    accuracyM: integer("accuracy_m"),
    recordedAt: stamp("recorded_at").notNull(),
  },
  (t) => [index("tech_locations_tech_idx").on(t.techId, t.recordedAt)],
);

/**
 * Follow-up items that are not derived from a work order's wait reason: review requests,
 * permit finals, warranty registration deadlines, failed ETA texts, quote touches.
 */
export const followUpItems = pgTable(
  "follow_up_items",
  {
    id: idCol(),
    orgId: uuid("org_id").notNull().references(() => orgs.id),
    kind: followUpKindEnum("kind").notNull(),
    status: followUpStatusEnum("status").notNull().default("open"),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    dueOn: date("due_on", { mode: "string" }),
    customerId: uuid("customer_id").references(() => customers.id),
    workOrderId: uuid("work_order_id").references(() => workOrders.id),
    relatedId: uuid("related_id"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    snoozedUntil: date("snoozed_until", { mode: "string" }),
    doneAt: stamp("done_at"),
    createdAt: createdAt(),
  },
  (t) => [index("follow_up_items_org_idx").on(t.orgId, t.status, t.dueOn)],
);
