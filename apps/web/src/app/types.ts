/** Shapes of the API responses the screens read. Kept loose on purpose; the API is the source of truth. */

export interface WorkOrderRow {
  id: string;
  number: number;
  trip: number;
  title: string;
  description: string;
  callType: "service" | "maintenance" | "quoted";
  billingType: "tm" | "nte" | "quoted";
  priority: "urgent" | "normal" | "low";
  status: "open" | "closed" | "billed";
  techStatus: "en_route" | "on_site" | "paused" | "done" | null;
  techStatusAt: string | null;
  assignedTechId: string | null;
  techName: string | null;
  scheduledFor: string | null;
  startMinute: number | null;
  allocatedHours: number | null;
  needReturn: boolean;
  waitingOnParts: boolean;
  warranty: boolean;
  followUp: { reason: string; date: string | null; note: string; part: string; expectedDate: string | null } | null;
  nteAmount: number | null;
  quotedAmount: number | null;
  customerId: string | null;
  customerName: string | null;
  siteId: string | null;
  siteName: string | null;
  siteAddress: string | null;
  siteCity: string | null;
  siteLat: number | null;
  siteLng: number | null;
  sitePrimaryTechId: string | null;
  agreementId: string | null;
  dispatchNote: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  role?: "lead" | "helper";
}

export interface TechRow {
  id: string;
  name: string;
  title: string;
  teamId: string | null;
  shiftHours: number;
  phone: string;
  offToday: boolean;
  location: { lat: number; lng: number; recordedAt: string } | null;
  current: { id: string; number: number; trip: number; title: string; techStatus: string | null; techStatusAt: string | null; siteName: string | null } | null;
  load: { hours: number; visits: number };
}

export interface DispatchDay {
  day: string;
  today: string;
  nowMinute: number;
  techs: TechRow[];
  slots: WorkOrderRow[];
  helperSlots: { h: { id: string; workOrderId: string; techId: string; startMinute: number | null; allocatedHours: number | null; techStatus: string | null }; number: number; trip: number; title: string; siteName: string | null }[];
  queue: WorkOrderRow[];
  readyToClose: WorkOrderRow[];
  completed: WorkOrderRow[];
  summary: { visits: number; unassigned: number; late: number; capacity: number; bookedHours: number; capacityHours: number };
}

export interface Team {
  id: string;
  name: string;
  isHome: boolean;
}

export interface UserRow {
  id: string;
  name: string;
  role: string;
  title: string;
  phone: string;
  email: string | null;
  teamId: string | null;
  homeTeamId: string | null;
  active: boolean;
  canBill: boolean | null;
  canEditCustomers: boolean | null;
  shiftHours: number;
  lastActiveAt: string | null;
}

export interface SettingsPayload {
  org: { id: string; name: string; city: string; timezone: string; phone: string; email: string; address: string; license: string; settings: Record<string, unknown> };
  teams: Team[];
  users: UserRow[];
  vendors: { id: string; name: string; city: string; phone: string; email: string; active: boolean }[];
  checklistTemplates: { id: string; name: string; kind: string; items: { key: string; label: string; hint?: string }[]; requiredBeforeComplete: boolean; trigger: Record<string, unknown>; active: boolean }[];
  automations: { id: string; key: string; enabled: boolean; config: Record<string, unknown>; sentCount: number; lastRunAt: string | null }[];
  warehouses: { id: string; name: string; kind: string; techId: string | null; targetValue: number | null; active: boolean }[];
  scopeTemplates: { id: string; name: string; scope: string; laborHours: number }[];
  integrations: Record<string, { connected: boolean; note: string; provider?: string }>;
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  billingAddress: string;
  apContactName: string;
  apContactPhone: string;
  contract: boolean;
  creditLimit: number | null;
  accountManagerId: string | null;
  taxExempt: boolean;
  taxExemptNumber: string;
  invoiceDelivery: string | null;
  invoiceEmails: string[];
  cardOnFile: { brand: string; last4: string } | null;
  portalEnabled: boolean;
  portalToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SiteRow {
  id: string;
  customerId: string;
  name: string;
  address: string;
  city: string;
  contact: string;
  contactPhone: string;
  accessNotes: string;
  primaryTechId: string | null;
  backupTechId: string | null;
  taxRate: number | null;
  invoiceDelivery: string | null;
  invoiceEmails: string[] | null;
  lat: number | null;
  lng: number | null;
}

export interface EquipmentRow {
  id: string;
  siteId: string;
  tag: string;
  kind: string;
  make: string;
  model: string;
  serial: string;
  tons: number | null;
  refrigerant: string;
  chargeLbs: number | null;
  installYear: number | null;
  warrantyPartsUntil: string | null;
  warrantyLaborUntil: string | null;
  locationNote: string;
  source: string;
  stage: string;
  nameplateFileId: string | null;
  qrCode: string | null;
}

export interface AgreementRow {
  id: string;
  customerId: string;
  siteId: string;
  tier: string;
  name: string;
  status: string;
  startsOn: string;
  endsOn: string;
  autoRenew: boolean;
  billingMethod: string;
  amount: number;
  visitAmount: number | null;
  visitsPerYear: number;
  responseHours: number | null;
  includedServices: string[];
  notes: string;
}

export interface AgreementVisitRow {
  id: string;
  agreementId: string;
  season: string;
  dueOn: string;
  status: string;
  workOrderId: string | null;
}

export interface FrozenLine {
  id: string;
  kind: string;
  description: string;
  quantity: number | null;
  rate: number | null;
  amount: number;
}

export interface InvoiceRow {
  id: string;
  number: number;
  workOrderId: string;
  customerId: string | null;
  status: string;
  billedAt: string;
  dueDate: string | null;
  amount: number;
  laborMode: string;
  materialMode: string;
  hideHourlyRate: boolean;
  descriptions: Record<string, string>;
  snapshot: { lines: FrozenLine[]; subtotal: number; tax: number; total: number; taxKind: string; nteAmount: number | null; travelSeparate: boolean };
  taxRate: number;
  salesTax: number;
  accruedUseTax: number;
  paymentToken: string | null;
  qboError: string;
}

export interface PaymentRow {
  id: string;
  invoiceId: string | null;
  customerId: string | null;
  amount: number;
  method: string;
  reference: string;
  receivedAt: string;
}

export interface RefrigerantLogRow {
  id: string;
  workOrderId: string | null;
  equipmentId: string | null;
  refrigerantType: string;
  lbsAdded: number;
  lbsRecovered: number;
  cylinderId: string;
  leakCheck: string;
  leakRatePercent: number | null;
  fullChargeLbs: number | null;
  notes: string;
  loggedAt: string;
  techCert: string;
}

export interface FieldChange {
  f: { id: string; field: string; fromValue: string | null; toValue: string | null; createdAt: string };
  userName: string | null;
}

export interface TimeEntryRow {
  id: string;
  techId: string;
  workOrderId: string | null;
  kind: "labor" | "travel" | "meal" | "rest";
  date: string;
  startedAt: string | null;
  arrivedAt: string | null;
  stoppedAt: string | null;
  hours: number;
  edited: boolean;
  gpsVerified: boolean;
  running?: boolean;
  label?: string | null;
  title?: string | null;
  siteName?: string | null;
}

export interface TimesheetRow {
  id: string;
  techId: string;
  date: string;
  status: "open" | "submitted" | "approved";
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewComment: string;
  mealReason: string;
  missedMeal: boolean;
  missedRest: boolean;
  premiumHours: number;
}

export interface SheetCheck {
  paidHours: number;
  mealsNeeded: number;
  restsNeeded: number;
  mealsLogged: number;
  restsLogged: number;
  blocks: { key: string; message: string; fix: string }[];
  canSubmit: boolean;
  waiverOk: boolean;
  overtime: { paid: number; regular: number; overtime: number; double: number };
}

export interface TechDay {
  entries: TimeEntryRow[];
  check: SheetCheck;
  totals: { travel: number; onSite: number; meal: number; rest: number; paid: number };
  overtime: { paid: number; regular: number; overtime: number; double: number };
}

export interface QuoteLabor {
  journeymanHours: number;
  apprenticeHours: number;
  driverHours: number;
  journeymanRate: number | null;
  apprenticeRate: number | null;
  driverRate: number | null;
}

export interface QuoteRow {
  id: string;
  number: number;
  customerId: string | null;
  siteId: string | null;
  equipmentId: string | null;
  workOrderId: string | null;
  contactName: string;
  contactPhone: string;
  reason: string;
  problemText: string;
  scope: string;
  scopeTemplateId: string | null;
  labor: QuoteLabor;
  marginPercent: number;
  status: string;
  followUpDate: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  viewCount: number;
  approvedAt: string | null;
  declinedAt: string | null;
  lossReason: string;
  lossNote: string;
  selectedOptionId: string | null;
  createdWorkOrderId: string | null;
  signerName: string;
  approvalToken: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteOptionRow {
  id: string;
  quoteId: string;
  tier: string;
  name: string;
  description: string;
  price: number;
  cost: number | null;
  financingMonthly: number | null;
  isRecommended: boolean;
  included: string[];
  sort: number;
}

export interface QuoteLineRow {
  id: string;
  quoteId: string;
  kind: string;
  description: string;
  quantity: number;
  unitCost: number;
  pricebookItemId: string | null;
  sort: number;
}

export interface PricebookItem {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  partsCost: number;
  laborHours: number;
  priceGood: number | null;
  priceBetter: number | null;
  priceBest: number | null;
  marginPercent: number | null;
  active: boolean;
  timesUsed: number;
}

export interface PurchaseOrderRow {
  id: string;
  number: number;
  vendorId: string | null;
  vendorName: string;
  workOrderId: string | null;
  equipmentId: string | null;
  siteId: string | null;
  shipTo: string;
  warehouseId: string | null;
  lumpSum: boolean;
  lumpSumAmount: number | null;
  expectedDate: string | null;
  status: string;
  orderedAt: string | null;
  receivedAt: string | null;
  vendorInvoiceNumber: string;
  vendorInvoiceDate: string | null;
  vendorInvoiceAmount: number | null;
  remindAt: string | null;
  createdAt: string;
}

export interface PoLineRow {
  id: string;
  purchaseOrderId: string;
  description: string;
  quantity: number;
  unitCost: number;
  categoryId: string | null;
  inventoryItemId: string | null;
  receivedQty: number;
  receivedOn: string | null;
  sort: number;
}

export interface WarehouseRow {
  id: string;
  name: string;
  kind: string;
  techId: string | null;
  targetValue: number | null;
  active: boolean;
}

export interface InventoryItemRow {
  id: string;
  sku: string;
  name: string;
  categoryId: string | null;
  unitCost: number;
  unit: string;
  active: boolean;
}

export interface StockRow {
  id: string;
  warehouseId: string;
  itemId: string;
  onHand: number;
  min: number;
  max: number;
  lastCountedAt: string | null;
}

export interface InventoryTxnRow {
  id: string;
  warehouseId: string;
  categoryId: string | null;
  itemId: string | null;
  kind: string;
  amount: number;
  quantity: number | null;
  purchaseOrderId: string | null;
  workOrderId: string | null;
  description: string;
  userId: string | null;
  date: string;
  createdAt: string;
}

export interface MessageRow {
  id: string;
  customerId: string | null;
  workOrderId: string | null;
  channel: string;
  direction: "in" | "out";
  fromAddress: string;
  toAddress: string;
  body: string;
  automated: boolean;
  template: string;
  status: string;
  providerId: string | null;
  error: string;
  sentBy: string | null;
  readAt: string | null;
  createdAt: string;
}
