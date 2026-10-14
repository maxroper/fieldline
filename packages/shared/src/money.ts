import type { CompanySettings, HourlyRate, LaborClass, MarkupBand } from "./types";

/** Round to cents. Anything negative or not a number is 0. */
export function cents(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100) / 100;
}

export function money(value: number | null | undefined): string {
  return cents(value ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export const DEFAULT_MISC_PERCENT = 1;
export const DEFAULT_VEHICLE_AMOUNT = 125;
export const DEFAULT_VEHICLE_HOURS = 8;
export const MARGIN_PRESETS = [45, 40, 35, 30] as const;
export const DEFAULT_QUOTE_MARGIN = 45;
/** Orange County, California combined rate until the company saves its own. */
export const DEFAULT_SALES_TAX_PERCENT = 7.75;

export function defaultCompanySettings(): CompanySettings {
  return {
    costRates: [
      { name: "Journeyman", rate: null },
      { name: "Apprentice", rate: null },
      { name: "Driver", rate: null },
    ],
    nonContractRates: [
      { name: "Journeyman", rate: null },
      { name: "Apprentice", rate: null },
      { name: "Driver", rate: null },
    ],
    contractRates: [
      { name: "Journeyman", rate: null },
      { name: "Apprentice", rate: null },
      { name: "Driver", rate: null },
    ],
    nonContractMargin: [],
    contractMargin: [],
    miscPercent: DEFAULT_MISC_PERCENT,
    vehicleAmount: DEFAULT_VEHICLE_AMOUNT,
    vehicleHours: DEFAULT_VEHICLE_HOURS,
    defaultQuoteMargin: DEFAULT_QUOTE_MARGIN,
    salesTaxPercent: DEFAULT_SALES_TAX_PERCENT,
    billTravelSeparately: true,
    documents: { from: "", terms: DEFAULT_QUOTE_TERMS, signatureBlock: DEFAULT_SIGNATURE_BLOCK },
    compliance: { refrigerantLogRequiredOverLbs: 15, permitTrackingJobTypes: ["quoted"], warrantyReminderDays: 60 },
  };
}

export const DEFAULT_QUOTE_TERMS =
  "This quote is good for 30 days. The price covers the work described on the quote. Extra work is quoted before it starts. Work begins after this page is signed and returned. Payment is due on completion unless the account already has terms.";
export const DEFAULT_SIGNATURE_BLOCK = "Signature ______________________________\n\nPrinted name ___________________________\n\nDate ___________________________________";

/** Merge stored settings over the defaults so a new field never comes back undefined. */
export function companySettings(stored: Partial<CompanySettings> | null | undefined): CompanySettings {
  const base = defaultCompanySettings();
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    documents: { ...base.documents, ...(stored.documents ?? {}) },
    compliance: { ...base.compliance, ...(stored.compliance ?? {}) },
  };
}

function rateOrNull(rate: number | null | undefined): number | null {
  if (rate == null || !Number.isFinite(rate) || rate < 0) return null;
  return cents(rate);
}

export function namedRate(rates: HourlyRate[] | undefined, name: string): number | null {
  const row = (rates ?? []).find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
  return rateOrNull(row?.rate ?? null);
}

/** What one tech hour costs the company. Blank stays blank. */
export function laborCostRate(settings: CompanySettings, name: LaborClass = "Journeyman"): number | null {
  return namedRate(settings.costRates, name);
}

/** What we charge for a Journeyman hour. Contract customers use the contract table. */
export function laborBillRate(customer: { contract?: boolean | null } | null | undefined, settings: CompanySettings, name: LaborClass = "Journeyman"): number | null {
  const rates = customer?.contract ? settings.contractRates : settings.nonContractRates;
  return namedRate(rates, name);
}

/** Contract customers use the contract margin table and rates. Everyone else uses the non-contract ones. */
export function pricingFor(customer: { contract?: boolean | null } | null | undefined, settings: CompanySettings) {
  if (customer?.contract) return { margin: settings.contractMargin, rates: settings.contractRates };
  return { margin: settings.nonContractMargin, rates: settings.nonContractRates };
}

/** Sell = cost / (1 - margin). 45% divides by 0.55. A margin of 100% or more has no sell price. */
export function marginSell(cost: number, percent: number): number | null {
  if (!Number.isFinite(cost) || cost < 0) return null;
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) return null;
  return cents((cost * 100) / (100 - percent));
}

/**
 * Divisor from the margin table. The first ceiling that covers the unit cost wins; the ceiling is included.
 * A blank ceiling is "and above". A missing row, or a divisor of 0, means sell at cost.
 */
export function marginFor(unitCost: number, bands: MarkupBand[] | undefined): number {
  const rows = (bands ?? []).slice().sort((a, b) => {
    if (a.upTo == null) return 1;
    if (b.upTo == null) return -1;
    return a.upTo - b.upTo;
  });
  const hit = rows.find((band) => band.upTo == null || unitCost <= band.upTo);
  const divisor = hit?.divisor;
  if (divisor == null || !Number.isFinite(divisor) || divisor <= 0) return 0;
  return divisor;
}

/** Extended cost of a material line. */
export function lineCost(line: { quantity: number | null | undefined; unitCost: number | null | undefined }): number {
  return cents((line.quantity || 0) * (line.unitCost || 0));
}

/** Sell = extended cost / divisor. A divisor of 0 sells at cost. */
export function lineSell(line: { quantity: number; unitCost: number }, bands: MarkupBand[] | undefined) {
  const cost = lineCost(line);
  const divisor = marginFor(line.unitCost || 0, bands);
  return { cost, divisor, sell: divisor > 0 ? cents(cost / divisor) : cost };
}

/** Site override, then the company default. A tax-exempt customer is 0. */
export function taxRateFor(input: {
  customer?: { taxExempt?: boolean | null } | null;
  site?: { taxRate?: number | null } | null;
  settings?: { salesTaxPercent?: number | null } | null;
}): number {
  if (input.customer?.taxExempt) return 0;
  const siteRate = input.site?.taxRate;
  if (siteRate != null && Number.isFinite(siteRate) && siteRate >= 0) return cents(siteRate);
  const company = input.settings?.salesTaxPercent;
  if (company != null && Number.isFinite(company) && company >= 0) return cents(company);
  return DEFAULT_SALES_TAX_PERCENT;
}

/** $125 per 8 hours of billed labor, rounded up to whole blocks. 1 to 8 hours is one charge; 9 to 16 is two. */
export function vehicleForHours(hours: number, settings: Pick<CompanySettings, "vehicleAmount" | "vehicleHours">): number {
  if (!(hours > 0)) return 0;
  const span = settings.vehicleHours > 0 ? settings.vehicleHours : DEFAULT_VEHICLE_HOURS;
  const amount = settings.vehicleAmount >= 0 ? settings.vehicleAmount : DEFAULT_VEHICLE_AMOUNT;
  return cents(Math.ceil(hours / span) * amount);
}

export interface QuoteLaborInput {
  journeymanHours: number;
  apprenticeHours: number;
  driverHours: number;
  journeymanRate: number | null;
  apprenticeRate: number | null;
  driverRate: number | null;
}

export interface QuoteTotals {
  journeyman: number | null;
  apprentice: number | null;
  driver: number | null;
  /** Null until all three rates are typed. */
  laborTotal: number | null;
  materialCost: number;
  /** Use tax on material cost. Part of project cost, never a customer charge. */
  useTax: number;
  taxRate: number;
  hours: number;
  /** Labor plus material plus use tax. */
  cost: number | null;
  profit: number | null;
  sell: number | null;
}

function laborLineTotal(hours: number, rate: number | null | undefined): number | null {
  const typed = rateOrNull(rate);
  const booked = hours > 0 ? hours : 0;
  if (typed == null) return booked > 0 ? null : 0;
  return cents(booked * typed);
}

/**
 * Project cost is labor plus material plus use tax on that material.
 * The percent is margin: sell = cost / (1 - margin). Profit is sell minus cost.
 */
export function quoteTotals(input: {
  labor: QuoteLaborInput;
  materials: { quantity: number; unitCost: number }[];
  marginPercent: number;
  taxRate?: number;
}): QuoteTotals {
  const journeyman = laborLineTotal(input.labor.journeymanHours || 0, input.labor.journeymanRate);
  const apprentice = laborLineTotal(input.labor.apprenticeHours || 0, input.labor.apprenticeRate);
  const driver = laborLineTotal(input.labor.driverHours || 0, input.labor.driverRate);
  const laborTotal = journeyman == null || apprentice == null || driver == null ? null : cents(journeyman + apprentice + driver);
  const materialCost = cents(input.materials.reduce((sum, line) => sum + lineCost(line), 0));
  const rate = input.taxRate != null && Number.isFinite(input.taxRate) && input.taxRate > 0 ? cents(input.taxRate) : 0;
  const useTax = cents((materialCost * rate) / 100);
  const hours = cents((input.labor.journeymanHours || 0) + (input.labor.apprenticeHours || 0) + (input.labor.driverHours || 0));
  const cost = laborTotal == null ? null : cents(laborTotal + materialCost + useTax);
  const sell = cost == null ? null : marginSell(cost, input.marginPercent || 0);
  const profit = cost == null || sell == null ? null : cents(sell - cost);
  return { journeyman, apprentice, driver, laborTotal, materialCost, useTax, taxRate: rate, hours, cost, profit, sell };
}

/** Monthly figure shown on proposals: simple amortization at an APR over a term. Marketing figure, not a loan quote. */
export function financingMonthly(amount: number, aprPercent = 9.99, months = 84): number {
  if (!(amount > 0)) return 0;
  const r = aprPercent / 100 / 12;
  if (r === 0) return cents(amount / months);
  return cents((amount * r) / (1 - Math.pow(1 + r, -months)));
}
