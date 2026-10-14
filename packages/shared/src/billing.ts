import { cents, laborBillRate, laborCostRate, lineSell, namedRate, pricingFor, taxRateFor, vehicleForHours } from "./money";
import { billPortions, type TimeRow } from "./time";
import type { BillingType, CallType, CompanySettings } from "./types";

export interface BillLaborLine {
  id: string;
  visit: string;
  kind: "Labor" | "Travel";
  who: string;
  date: string;
  hours: number;
  rate: number | null;
  total: number | null;
  running: boolean;
}

export type MaterialSource = "PO" | "Truck" | "Inventory" | "Direct";

export interface BillMaterialLine {
  id: string;
  source: MaterialSource;
  description: string;
  quantity: number;
  unitCost: number;
  /** Sell price for the line on a T&M bill. Null on quoted and maintenance jobs (cost only). */
  sell: number | null;
}

export interface QuotedCompare {
  amount: number | null;
  laborHours: number;
  travelHours: number;
  laborCost: number | null;
  materialCost: number;
  useTax: number;
  misc: number | null;
  actualCost: number | null;
  actualMargin: number | null;
}

export interface WorkOrderBill {
  labor: BillLaborLine[];
  materials: BillMaterialLine[];
  laborTotal: number | null;
  materialTotal: number | null;
  /** What the customer is charged before credits. Null while something needed is missing. */
  amount: number | null;
  clockRunning: boolean;
  overNte: number | null;
  nteAmount: number | null;
  quoted: QuotedCompare | null;
  quotedFlat: boolean;
  fixedPrice: boolean;
  rateMissing: boolean;
  miscPercent: number;
  miscAmount: number | null;
  vehicleAmount: number;
  materialCost: number;
  taxKind: "sales" | "use";
  taxRate: number;
  taxExempt: boolean;
  taxableAmount: number | null;
  salesTax: number | null;
  accruedUseTax: number;
  jobCost: number | null;
}

export interface ChargedTimeInput extends TimeRow {
  id: string;
  visitLabel: string;
  techName: string;
  date: string;
}

export interface MaterialInput {
  id: string;
  source: MaterialSource;
  description: string;
  quantity: number;
  unitCost: number;
}

function hasCharge(description: string, quantity: number, unitCost: number): boolean {
  return Boolean(description.trim()) || quantity > 0 || unitCost > 0;
}

/**
 * The bill for one job (all visits of a work order number).
 * T&M and NTE: labor at the customer's bill table, material through the margin bands, misc percent, vehicle charge, sales tax on material sell.
 * Quoted: the quoted amount is the price; labor and material are tracked at cost, with accrued use tax, to show the actual margin.
 * Maintenance: the agreement's visit amount is the price; costs are tracked the same way.
 */
export function workOrderBill(input: {
  callType: CallType;
  billingType: BillingType;
  nteAmount: number | null | undefined;
  quotedAmount: number | null | undefined;
  agreementVisitAmount: number | null | undefined;
  customer: { contract?: boolean | null; taxExempt?: boolean | null } | null | undefined;
  site: { taxRate?: number | null } | null | undefined;
  settings: CompanySettings;
  time: ChargedTimeInput[];
  materials: MaterialInput[];
  now?: string;
}): WorkOrderBill {
  const quotedJob = input.billingType === "quoted" || input.callType === "quoted";
  const maintenance = input.callType === "maintenance";
  const costRate = laborCostRate(input.settings, "Journeyman");
  const chargeRate = laborBillRate(input.customer, input.settings);
  const rate = quotedJob || maintenance ? costRate : chargeRate;
  const bands = pricingFor(input.customer, input.settings).margin;
  const sellFor = (quantity: number, unitCost: number) => (quotedJob || maintenance ? null : lineSell({ quantity, unitCost }, bands).sell);
  const now = input.now ?? new Date().toISOString();

  const labor: BillLaborLine[] = [];
  for (const row of input.time) {
    const parts = billPortions({ ...row, now });
    const push = (kind: "Labor" | "Travel", hours: number) => {
      const h = cents(hours);
      labor.push({
        id: `${row.id}:${kind.toLowerCase()}`,
        visit: row.visitLabel,
        kind,
        who: row.techName,
        date: row.date,
        hours: h,
        rate: row.running ? null : rate,
        total: row.running || rate == null ? null : cents(h * rate),
        running: Boolean(row.running),
      });
    };
    if (parts.travel > 0) push("Travel", parts.travel);
    if (parts.labor > 0) push("Labor", parts.labor);
    if (parts.travel === 0 && parts.labor === 0 && row.running) push(row.kind === "travel" ? "Travel" : "Labor", 0);
  }
  labor.sort((a, b) => a.date.localeCompare(b.date) || a.visit.localeCompare(b.visit, undefined, { numeric: true }) || a.kind.localeCompare(b.kind) || a.who.localeCompare(b.who));

  const materials: BillMaterialLine[] = input.materials
    .filter((m) => hasCharge(m.description || "", m.quantity || 0, m.unitCost || 0))
    .map((m) => ({
      id: m.id,
      source: m.source,
      description: m.description.trim() || (m.source === "Truck" ? "Truck part" : "Material"),
      quantity: cents(m.quantity || 0),
      unitCost: cents(m.unitCost || 0),
      sell: sellFor(m.quantity || 0, m.unitCost || 0),
    }));

  const billed = labor.filter((line) => !line.running);
  const laborHours = cents(billed.filter((l) => l.kind === "Labor").reduce((s, l) => s + l.hours, 0));
  const travelHours = cents(billed.filter((l) => l.kind === "Travel").reduce((s, l) => s + l.hours, 0));
  const loggedLabor = billed.some((l) => l.hours > 0);
  const laborCost = !loggedLabor ? 0 : rate == null ? null : cents(billed.reduce((s, l) => s + l.hours * (rate || 0), 0));
  const laborTotal = billed.length === 0 ? 0 : billed.some((l) => l.total == null) ? null : cents(billed.reduce((s, l) => s + (l.total || 0), 0));
  const materialCost = materials.length === 0 ? 0 : cents(materials.reduce((s, m) => s + cents(m.quantity * m.unitCost), 0));
  const materialTotal = quotedJob || maintenance ? materialCost : materials.length === 0 ? 0 : materials.some((m) => m.sell == null) ? null : cents(materials.reduce((s, m) => s + (m.sell || 0), 0));
  const billedHours = cents(laborHours + travelHours);
  const vehicleAmount = quotedJob || maintenance ? 0 : vehicleForHours(billedHours, input.settings);
  const miscPercent = input.settings.miscPercent || 0;
  const sellMisc = laborTotal == null || materialTotal == null ? null : cents((laborTotal + materialTotal) * (miscPercent / 100));
  const costMisc = laborCost == null ? null : cents((laborCost + materialCost) * (miscPercent / 100));
  const miscAmount = quotedJob ? costMisc : maintenance ? null : sellMisc;
  const tmAmount = laborTotal == null || materialTotal == null || miscAmount == null ? null : cents(laborTotal + materialTotal + miscAmount + vehicleAmount);
  const useTaxJob = quotedJob || maintenance;
  const taxRate = taxRateFor({ customer: input.customer, site: input.site, settings: input.settings });
  const taxExempt = Boolean(input.customer?.taxExempt);
  const salesTax = useTaxJob ? 0 : materialTotal == null ? null : cents((materialTotal * taxRate) / 100);
  const accruedUseTax = useTaxJob ? cents((materialCost * taxRate) / 100) : 0;
  const taxableAmount = taxRate === 0 ? 0 : useTaxJob ? materialCost : materialTotal;
  const quotedAmount = input.quotedAmount ?? null;
  const visitAmount = input.agreementVisitAmount ?? null;
  const amount = maintenance ? visitAmount : quotedJob ? quotedAmount : tmAmount == null || salesTax == null ? null : cents(tmAmount + salesTax);
  const nte = input.nteAmount;
  const nteAmount = !quotedJob && !maintenance && input.billingType === "nte" && nte != null && Number.isFinite(nte) ? cents(nte) : null;
  const overNte = nteAmount != null && amount != null && amount > nteAmount ? cents(amount - nteAmount) : null;
  const quotedActual = laborCost == null || miscAmount == null ? null : cents(laborCost + materialCost + accruedUseTax + miscAmount);
  const actualMargin = quotedAmount == null || quotedActual == null ? null : cents(quotedAmount - quotedActual);
  const quoted: QuotedCompare | null = quotedJob
    ? { amount: quotedAmount, laborHours, travelHours, laborCost, materialCost, useTax: accruedUseTax, misc: miscAmount, actualCost: quotedActual, actualMargin }
    : null;
  const billTable = input.customer?.contract ? input.settings.contractRates : input.settings.nonContractRates;
  const rateMissing = !quotedJob && !maintenance && ["Journeyman", "Apprentice", "Driver"].some((name) => {
    const r = namedRate(billTable, name);
    return r == null || !(r > 0);
  });
  const maintenanceCost = laborCost == null && loggedLabor ? null : cents(materialCost + (laborCost ?? 0) + accruedUseTax);
  const jobCost = maintenance ? maintenanceCost : quotedJob ? quotedActual : null;

  return {
    labor,
    materials,
    laborTotal: quotedJob ? laborCost : laborTotal,
    materialTotal: quotedJob ? materialCost : materialTotal,
    amount,
    clockRunning: labor.some((l) => l.running),
    overNte,
    nteAmount,
    quoted,
    quotedFlat: quotedJob,
    fixedPrice: maintenance,
    rateMissing,
    miscPercent,
    miscAmount,
    vehicleAmount,
    materialCost,
    taxKind: useTaxJob ? "use" : "sales",
    taxRate,
    taxExempt,
    taxableAmount,
    salesTax,
    accruedUseTax,
    jobCost,
  };
}

export function creditedAmount(credits: { amount?: number | null }[] | null | undefined): number {
  return cents((credits ?? []).reduce((sum, c) => sum + (c.amount || 0), 0));
}

export function invoiceNet(amount: number | null, credited: number): number | null {
  if (amount == null) return null;
  const left = Math.round((amount - credited) * 100) / 100;
  return left > 0 ? left : 0;
}

export function invoiceCreditStatus(amount: number | null, credited: number): "billed" | "partially_credited" | "credited" {
  if (amount == null || credited <= 0) return "billed";
  return credited >= amount ? "credited" : "partially_credited";
}

/** Aging buckets for open receivables as of a date. */
export function agingBucket(dueDate: string, asOf: string): "current" | "1-30" | "31-60" | "61-90" | "90+" {
  const days = Math.floor((Date.parse(asOf) - Date.parse(dueDate)) / 86400000);
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}
