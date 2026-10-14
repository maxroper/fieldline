/**
 * Domain vocabulary shared by the database schema, the API and the web app.
 * Every enum here is also a Postgres enum in packages/db/src/schema (same values, same order).
 * Change a value in both places and write a migration; do not rename casually.
 */

export const ROLES = ["admin", "supervisor", "dispatcher", "customer_service", "billing", "tech"] as const;
export type Role = (typeof ROLES)[number];
/** Roles that use the office app. Everyone else uses the tech phone app. */
export const OFFICE_ROLES: readonly Role[] = ["admin", "supervisor", "dispatcher", "customer_service", "billing"];

export const WO_STATUSES = ["open", "closed", "billed"] as const;
export type WoStatus = (typeof WO_STATUSES)[number];

/** What the tech is doing on a visit. Null means not started. */
export const TECH_STATUSES = ["en_route", "on_site", "paused", "done"] as const;
export type TechStatus = (typeof TECH_STATUSES)[number];

export const PRIORITIES = ["urgent", "normal", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const CALL_TYPES = ["service", "maintenance", "quoted"] as const;
export type CallType = (typeof CALL_TYPES)[number];

export const BILLING_TYPES = ["tm", "nte", "quoted"] as const;
export type BillingType = (typeof BILLING_TYPES)[number];

export const WAIT_REASONS = ["parts", "quote_sent", "approved", "return", "no_access", "warranty"] as const;
export type WaitReason = (typeof WAIT_REASONS)[number];

export const TIME_KINDS = ["labor", "travel", "meal", "rest"] as const;
export type TimeKind = (typeof TIME_KINDS)[number];

export const TIMESHEET_STATUSES = ["open", "submitted", "approved"] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number];

export const QUOTE_STATUSES = ["draft", "sent", "viewed", "approved", "declined", "follow_up"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_REASONS = ["pm", "service", "customer"] as const;
export const QUOTE_TIERS = ["single", "good", "better", "best"] as const;
export type QuoteTier = (typeof QUOTE_TIERS)[number];
export const QUOTE_LOSS_REASONS = ["price", "timing", "competitor", "no_response", "not_needed", "other"] as const;

export const PO_STATUSES = ["draft", "issued", "partial", "received", "invoiced", "cancelled"] as const;
export type PoStatus = (typeof PO_STATUSES)[number];
export const SHIP_TO = ["work_order", "inventory"] as const;

export const WAREHOUSE_KINDS = ["main", "vehicle"] as const;
export const INVENTORY_TXN_KINDS = ["po_receipt", "used_on_wo", "transfer_in", "transfer_out", "count_adjust"] as const;
export type InventoryTxnKind = (typeof INVENTORY_TXN_KINDS)[number];

export const INVOICE_STATUSES = ["draft", "billed", "paid", "partially_credited", "credited", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const INVOICE_DELIVERY = ["email", "print", "both", "text"] as const;
export const PAYMENT_METHODS = ["card", "ach", "check", "cash", "link", "tap_to_pay", "autopay"] as const;
export const CREDIT_REASONS = ["complaint", "incorrect", "other"] as const;

export const AGREEMENT_TIERS = ["bronze", "silver", "gold", "custom"] as const;
export const AGREEMENT_STATUSES = ["pending", "active", "expired", "cancelled"] as const;
export const AGREEMENT_BILLING = ["monthly_card", "annual_invoice", "pre_billed", "on_demand"] as const;
export const VISIT_STATUSES = ["unscheduled", "scheduled", "done", "skipped"] as const;

export const MESSAGE_CHANNELS = ["sms", "email"] as const;
export const MESSAGE_DIRECTIONS = ["in", "out"] as const;
export const MESSAGE_STATUSES = ["queued", "sent", "delivered", "failed", "received"] as const;

export const AUTOMATION_KEYS = ["confirmation", "on_my_way", "review_request", "quote_followup", "permit_warranty", "pm_due", "missed_call"] as const;
export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export const FOLLOW_UP_KINDS = ["review_request", "permit_final", "warranty_registration", "eta_text_failed", "quote_touch", "custom"] as const;
export const FOLLOW_UP_STATUSES = ["open", "snoozed", "done", "skipped"] as const;

export const CHECK_RESULTS = ["pass", "flag", "fail", "na"] as const;
export const LEAK_CHECKS = ["passed", "failed", "na"] as const;
export const PERMIT_STATUSES = ["needed", "applied", "issued", "inspected", "final", "na"] as const;
export const EQUIPMENT_SOURCES = ["manual", "list_import", "nameplate_photo"] as const;
export const EQUIPMENT_STAGES = ["proposed", "active", "retired"] as const;
export const FILE_KINDS = ["photo", "nameplate", "signature", "document", "report", "vendor_invoice"] as const;

/** Labor classes the company prices and bills. Rates are stored per class name in org settings. */
export const LABOR_CLASSES = ["Journeyman", "Apprentice", "Driver"] as const;
export type LaborClass = (typeof LABOR_CLASSES)[number];

export interface HourlyRate {
  name: string;
  rate: number | null;
}

/** Margin band: unit costs up to `upTo` sell at cost / divisor. `upTo` null covers every higher cost. */
export interface MarkupBand {
  upTo: number | null;
  divisor: number;
}

/**
 * Company pricing settings, stored as JSON on the org row (`orgs.settings`).
 * Same meaning as the old prototype's CompanyCosts, without the mirrored legacy fields.
 */
export interface CompanySettings {
  /** What a tech hour costs the company, per labor class. Used for quotes, budgets and job cost. */
  costRates: HourlyRate[];
  /** What customers who are not on contract are charged per hour, per class. */
  nonContractRates: HourlyRate[];
  /** What contract customers are charged per hour, per class. */
  contractRates: HourlyRate[];
  /** Material margin bands for T&M bills, non-contract customers. */
  nonContractMargin: MarkupBand[];
  /** Material margin bands for contract customers. */
  contractMargin: MarkupBand[];
  /** Percent of labor plus material added as misc material. */
  miscPercent: number;
  /** Dollars per block of billed hours. */
  vehicleAmount: number;
  /** Hours in one vehicle block. */
  vehicleHours: number;
  /** Default margin percent for a new quote. */
  defaultQuoteMargin: number;
  /** Company sales tax percent on material sell. A site can override it. */
  salesTaxPercent: number;
  /** Travel appears as its own line on customer bills. */
  billTravelSeparately: boolean;
  /** Printed on quotes, invoices and purchase orders. */
  documents: { from: string; terms: string; signatureBlock: string };
  /** Compliance switches. */
  compliance: { refrigerantLogRequiredOverLbs: number; permitTrackingJobTypes: CallType[]; warrantyReminderDays: number };
}

export type Money = number;
export type IsoDate = string; // YYYY-MM-DD in the company's timezone
export type IsoStamp = string; // ISO 8601 with offset or Z (UTC instant)
