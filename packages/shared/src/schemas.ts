import { z } from "zod";
import {
  AGREEMENT_BILLING,
  AGREEMENT_TIERS,
  BILLING_TYPES,
  CALL_TYPES,
  CHECK_RESULTS,
  EQUIPMENT_SOURCES,
  EQUIPMENT_STAGES,
  INVOICE_DELIVERY,
  LEAK_CHECKS,
  PAYMENT_METHODS,
  PERMIT_STATUSES,
  PRIORITIES,
  QUOTE_REASONS,
  QUOTE_STATUSES,
  QUOTE_TIERS,
  ROLES,
  SHIP_TO,
  TECH_STATUSES,
  TIME_KINDS,
  WAIT_REASONS,
  WO_STATUSES,
} from "./types";

/**
 * Zod schemas for every API payload. The API validates with these; the web app uses the inferred
 * types for forms. Keep them the single source of truth for request shapes.
 */

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const isoStamp = z.string().datetime({ offset: true });
export const id = z.string().uuid();
export const moneyAmount = z.number().finite().min(0);
export const hours = z.number().finite().min(0).max(24);

export const paging = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const customerCreate = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  billingAddress: z.string().trim().optional(),
  apContactName: z.string().trim().optional(),
  apContactPhone: z.string().trim().optional(),
  contract: z.boolean().default(false),
  creditLimit: moneyAmount.nullable().optional(),
  accountManagerId: id.nullable().optional(),
  taxExempt: z.boolean().default(false),
  taxExemptNumber: z.string().trim().optional(),
  invoiceDelivery: z.enum(INVOICE_DELIVERY).nullable().optional(),
  invoiceEmails: z.array(z.string().email()).default([]),
  site: z
    .object({
      name: z.string().trim().optional(),
      address: z.string().trim().min(1),
      city: z.string().trim().optional(),
      contact: z.string().trim().optional(),
      contactPhone: z.string().trim().optional(),
      accessNotes: z.string().trim().optional(),
      primaryTechId: id.nullable().optional(),
      backupTechId: id.nullable().optional(),
      taxRate: z.number().min(0).max(20).nullable().optional(),
    })
    .optional(),
});
export const customerUpdate = customerCreate.omit({ site: true }).partial();

export const siteCreate = z.object({
  customerId: id,
  name: z.string().trim().optional(),
  address: z.string().trim().min(1),
  city: z.string().trim().optional(),
  contact: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  accessNotes: z.string().trim().optional(),
  primaryTechId: id.nullable().optional(),
  backupTechId: id.nullable().optional(),
  taxRate: z.number().min(0).max(20).nullable().optional(),
  invoiceDelivery: z.enum(INVOICE_DELIVERY).nullable().optional(),
  invoiceEmails: z.array(z.string().email()).optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});
export const siteUpdate = siteCreate.omit({ customerId: true }).partial();

export const equipmentCreate = z.object({
  siteId: id,
  tag: z.string().trim().min(1),
  kind: z.string().trim().optional(),
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  serial: z.string().trim().optional(),
  tons: z.number().min(0).nullable().optional(),
  refrigerant: z.string().trim().optional(),
  chargeLbs: z.number().min(0).nullable().optional(),
  installYear: z.number().int().min(1950).max(2100).nullable().optional(),
  warrantyPartsUntil: isoDate.nullable().optional(),
  warrantyLaborUntil: isoDate.nullable().optional(),
  locationNote: z.string().trim().optional(),
  source: z.enum(EQUIPMENT_SOURCES).default("manual"),
  stage: z.enum(EQUIPMENT_STAGES).default("active"),
});
export const equipmentUpdate = equipmentCreate.omit({ siteId: true }).partial();

export const workOrderCreate = z.object({
  customerId: id.nullable().optional(),
  siteId: id.nullable().optional(),
  equipmentId: id.nullable().optional(),
  siteText: z.string().trim().optional(),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  callType: z.enum(CALL_TYPES).default("service"),
  billingType: z.enum(BILLING_TYPES).default("tm"),
  nteAmount: moneyAmount.nullable().optional(),
  quotedAmount: moneyAmount.nullable().optional(),
  materialBudget: moneyAmount.nullable().optional(),
  laborBudgetHours: hours.nullable().optional(),
  priority: z.enum(PRIORITIES).default("normal"),
  assignedTechId: id.nullable().optional(),
  scheduledFor: isoDate.nullable().optional(),
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  allocatedHours: hours.nullable().optional(),
  dispatchNote: z.string().trim().optional(),
  callerName: z.string().trim().optional(),
  callerPhone: z.string().trim().optional(),
  customerPo: z.string().trim().optional(),
  signatureRequired: z.boolean().default(false),
  warranty: z.boolean().default(false),
  agreementId: id.nullable().optional(),
});
export const workOrderUpdate = workOrderCreate.partial().extend({
  needReturn: z.boolean().optional(),
  waitingOnParts: z.boolean().optional(),
  workPerformed: z.string().trim().optional(),
  signerName: z.string().trim().optional(),
  version: z.number().int().optional(),
});

export const workOrderStatus = z.object({ status: z.enum(WO_STATUSES), version: z.number().int().optional() });
export const workOrderAssign = z.object({
  techId: id.nullable(),
  scheduledFor: isoDate.nullable().optional(),
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  allocatedHours: hours.nullable().optional(),
  role: z.enum(["lead", "helper"]).default("lead"),
  version: z.number().int().optional(),
});
export const techStatusChange = z.object({
  techStatus: z.enum(TECH_STATUSES),
  at: isoStamp.optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export const followUpSet = z.object({
  reason: z.enum(WAIT_REASONS).nullable(),
  date: isoDate.nullable().optional(),
  note: z.string().trim().optional(),
  part: z.string().trim().optional(),
  expectedDate: isoDate.nullable().optional(),
});
export const returnVisitCreate = z.object({
  scheduledFor: isoDate.nullable().optional(),
  startMinute: z.number().int().min(0).max(1439).nullable().optional(),
  allocatedHours: hours.nullable().optional(),
  techId: id.nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  waitingOnParts: z.boolean().optional(),
  warranty: z.boolean().optional(),
  note: z.string().trim().optional(),
});

export const noteCreate = z.object({ body: z.string().trim().min(1), kind: z.enum(["note", "dispatch", "access"]).default("note") });

export const timeEntryCreate = z.object({
  workOrderId: id.nullable().optional(),
  techId: id.optional(),
  kind: z.enum(TIME_KINDS),
  date: isoDate,
  startedAt: isoStamp.nullable().optional(),
  arrivedAt: isoStamp.nullable().optional(),
  stoppedAt: isoStamp.nullable().optional(),
  hours: hours.optional(),
  edited: z.boolean().optional(),
  gpsVerified: z.boolean().optional(),
});
export const timeEntryUpdate = timeEntryCreate.partial();
export const timesheetSubmit = z.object({ date: isoDate, techId: id.optional(), mealReason: z.string().trim().optional() });
export const timesheetReview = z.object({ status: z.enum(["approved", "open"]), comment: z.string().trim().optional() });

export const checklistResult = z.object({
  templateId: id,
  items: z.array(z.object({ key: z.string(), result: z.enum(CHECK_RESULTS), note: z.string().optional() })),
  completedAt: isoStamp.optional(),
});
export const refrigerantLogCreate = z.object({
  equipmentId: id.nullable().optional(),
  refrigerantType: z.string().trim().min(1),
  lbsAdded: z.number().min(0).default(0),
  lbsRecovered: z.number().min(0).default(0),
  cylinderId: z.string().trim().optional(),
  leakCheck: z.enum(LEAK_CHECKS).default("na"),
  fullChargeLbs: z.number().min(0).nullable().optional(),
  notes: z.string().trim().optional(),
});
export const permitUpsert = z.object({
  jurisdiction: z.string().trim().optional(),
  permitNumber: z.string().trim().optional(),
  status: z.enum(PERMIT_STATUSES).default("needed"),
  tests: z.record(z.string(), z.string()).optional(),
  filedOn: isoDate.nullable().optional(),
  finalOn: isoDate.nullable().optional(),
  notes: z.string().trim().optional(),
});
export const closeout = z.object({
  workPerformed: z.string().trim().min(1),
  signerName: z.string().trim().optional(),
  signatureDataUrl: z.string().optional(),
  needReturn: z.boolean().default(false),
  sendPhotoReport: z.boolean().default(false),
});

export const quoteLine = z.object({
  kind: z.enum(["material", "labor", "scope"]).default("material"),
  description: z.string().trim().min(1),
  quantity: z.number().min(0).default(1),
  unitCost: moneyAmount.default(0),
  pricebookItemId: id.nullable().optional(),
});
export const quoteOption = z.object({
  tier: z.enum(QUOTE_TIERS).default("single"),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  price: moneyAmount,
  cost: moneyAmount.nullable().optional(),
  isRecommended: z.boolean().default(false),
  included: z.array(z.string()).default([]),
});
export const quoteCreate = z.object({
  customerId: id.nullable().optional(),
  siteId: id.nullable().optional(),
  equipmentId: id.nullable().optional(),
  workOrderId: id.nullable().optional(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  reason: z.enum(QUOTE_REASONS).default("service"),
  problemText: z.string().trim().optional(),
  scope: z.string().trim().optional(),
  scopeTemplateId: id.nullable().optional(),
  labor: z
    .object({
      journeymanHours: hours.default(0),
      apprenticeHours: hours.default(0),
      driverHours: hours.default(0),
      journeymanRate: moneyAmount.nullable().default(null),
      apprenticeRate: moneyAmount.nullable().default(null),
      driverRate: moneyAmount.nullable().default(null),
    })
    .default({ journeymanHours: 0, apprenticeHours: 0, driverHours: 0, journeymanRate: null, apprenticeRate: null, driverRate: null }),
  marginPercent: z.number().min(0).max(99).optional(),
  lines: z.array(quoteLine).default([]),
  options: z.array(quoteOption).default([]),
  followUpDate: isoDate.nullable().optional(),
});
export const quoteUpdate = quoteCreate.partial().extend({
  status: z.enum(QUOTE_STATUSES).optional(),
  selectedOptionId: id.nullable().optional(),
  lossReason: z.string().optional(),
});

export const pricebookItemCreate = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().optional(),
  partsCost: moneyAmount.default(0),
  laborHours: hours.default(0),
  priceGood: moneyAmount.nullable().optional(),
  priceBetter: moneyAmount.nullable().optional(),
  priceBest: moneyAmount.nullable().optional(),
  marginPercent: z.number().min(0).max(99).nullable().optional(),
  active: z.boolean().default(true),
});

export const poLine = z.object({
  description: z.string().trim().min(1),
  quantity: z.number().min(0).default(1),
  unitCost: moneyAmount.default(0),
  categoryId: id.nullable().optional(),
  inventoryItemId: id.nullable().optional(),
});
export const poCreate = z.object({
  vendorId: id.nullable().optional(),
  vendorName: z.string().trim().min(1),
  workOrderId: id.nullable().optional(),
  equipmentId: id.nullable().optional(),
  shipTo: z.enum(SHIP_TO).default("work_order"),
  warehouseId: id.nullable().optional(),
  lumpSum: z.boolean().default(false),
  lumpSumAmount: moneyAmount.nullable().optional(),
  expectedDate: isoDate.nullable().optional(),
  lines: z.array(poLine).default([]),
  draft: z.boolean().default(false),
});
export const poReceive = z.object({ lines: z.array(z.object({ lineId: id, receivedQty: z.number().min(0) })), receivedOn: isoDate.optional() });
export const poVendorInvoice = z.object({ number: z.string().trim().optional(), date: isoDate.nullable().optional(), amount: moneyAmount.nullable().optional() });

export const inventoryTransfer = z.object({ fromWarehouseId: id, toWarehouseId: id, itemId: id.nullable().optional(), categoryId: id.nullable().optional(), quantity: z.number().min(0).optional(), amount: moneyAmount.optional(), note: z.string().optional() });
export const inventoryCount = z.object({ warehouseId: id, counts: z.array(z.object({ itemId: id, counted: z.number().min(0) })) });
export const truckPartUse = z.object({ warehouseId: id, itemId: id.nullable().optional(), description: z.string().trim().min(1), quantity: z.number().min(0), unitCost: moneyAmount });

export const invoiceCreate = z.object({
  laborMode: z.enum(["itemized", "one"]).default("itemized"),
  materialMode: z.enum(["itemized", "one"]).default("itemized"),
  hideHourlyRate: z.boolean().default(false),
  descriptions: z.record(z.string(), z.string()).default({}),
  dueInDays: z.number().int().min(0).max(120).default(30),
});
export const paymentCreate = z.object({ amount: moneyAmount.min(0.01), method: z.enum(PAYMENT_METHODS), reference: z.string().trim().optional(), receivedAt: isoStamp.optional() });
export const creditCreate = z.object({ amount: moneyAmount.min(0.01), reason: z.enum(["complaint", "incorrect", "other"]), note: z.string().trim().optional(), lineIds: z.array(z.string()).default([]) });
export const invoiceDeliver = z.object({ method: z.enum(INVOICE_DELIVERY), emails: z.array(z.string().email()).optional() });

export const agreementCreate = z.object({
  customerId: id,
  siteId: id,
  tier: z.enum(AGREEMENT_TIERS).default("silver"),
  name: z.string().trim().optional(),
  startsOn: isoDate,
  endsOn: isoDate,
  autoRenew: z.boolean().default(true),
  billingMethod: z.enum(AGREEMENT_BILLING).default("annual_invoice"),
  amount: moneyAmount.default(0),
  visitAmount: moneyAmount.nullable().optional(),
  visitsPerYear: z.number().int().min(1).max(12).default(2),
  responseHours: z.number().int().min(1).max(168).nullable().optional(),
  includedServices: z.array(z.string()).default([]),
  equipmentIds: z.array(id).default([]),
});
export const agreementUpdate = agreementCreate.partial();

export const messageSend = z.object({
  customerId: id.nullable().optional(),
  workOrderId: id.nullable().optional(),
  to: z.string().trim().min(3),
  body: z.string().trim().min(1),
  channel: z.enum(["sms", "email"]).default("sms"),
  template: z.string().optional(),
});
export const automationToggle = z.object({ enabled: z.boolean() });

export const userCreate = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  role: z.enum(ROLES),
  title: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  teamId: id.nullable().optional(),
  homeTeamId: id.nullable().optional(),
  canEditCustomers: z.boolean().optional(),
  canBill: z.boolean().optional(),
});
export const userUpdate = userCreate.partial().extend({ active: z.boolean().optional(), offDates: z.array(isoDate).optional(), shiftHours: hours.optional() });

export const settingsUpdate = z.object({
  name: z.string().trim().min(1).optional(),
  city: z.string().trim().optional(),
  timezone: z.string().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  license: z.string().trim().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const devLogin = z.object({ userId: id });

export type CustomerCreate = z.infer<typeof customerCreate>;
export type WorkOrderCreate = z.infer<typeof workOrderCreate>;
export type WorkOrderUpdate = z.infer<typeof workOrderUpdate>;
export type QuoteCreate = z.infer<typeof quoteCreate>;
export type PoCreate = z.infer<typeof poCreate>;
export type AgreementCreate = z.infer<typeof agreementCreate>;
