import { describe, expect, it } from "vitest";
import { cents, defaultCompanySettings, financingMonthly, lineSell, marginFor, marginSell, quoteTotals, taxRateFor, vehicleForHours } from "./money";

describe("money", () => {
  it("rounds to cents and never goes negative", () => {
    expect(cents(0.125)).toBe(0.13);
    expect(cents(19.999)).toBe(20);
    expect(cents(-4)).toBe(0);
    expect(cents(Number.NaN)).toBe(0);
  });

  it("sells at cost divided by one minus the margin", () => {
    expect(marginSell(100, 45)).toBe(181.82);
    expect(marginSell(100, 0)).toBe(100);
    expect(marginSell(100, 100)).toBeNull();
  });

  it("picks the first margin band whose ceiling covers the unit cost, ceiling included", () => {
    const bands = [
      { upTo: 5, divisor: 0.5 },
      { upTo: 50, divisor: 0.65 },
      { upTo: null, divisor: 0.8 },
    ];
    expect(marginFor(5, bands)).toBe(0.5);
    expect(marginFor(5.01, bands)).toBe(0.65);
    expect(marginFor(500, bands)).toBe(0.8);
    expect(marginFor(10, [])).toBe(0);
    expect(lineSell({ quantity: 2, unitCost: 10 }, bands)).toEqual({ cost: 20, divisor: 0.65, sell: 30.77 });
    expect(lineSell({ quantity: 2, unitCost: 10 }, []).sell).toBe(20);
  });

  it("charges one vehicle block per 8 hours, rounded up", () => {
    const s = { vehicleAmount: 125, vehicleHours: 8 };
    expect(vehicleForHours(0, s)).toBe(0);
    expect(vehicleForHours(1, s)).toBe(125);
    expect(vehicleForHours(8, s)).toBe(125);
    expect(vehicleForHours(8.25, s)).toBe(250);
  });

  it("uses the site tax rate, then the company rate, and zero for tax-exempt customers", () => {
    expect(taxRateFor({ customer: { taxExempt: true }, site: { taxRate: 9 }, settings: { salesTaxPercent: 7.75 } })).toBe(0);
    expect(taxRateFor({ site: { taxRate: 9.25 }, settings: { salesTaxPercent: 7.75 } })).toBe(9.25);
    expect(taxRateFor({ settings: { salesTaxPercent: 8.5 } })).toBe(8.5);
    expect(taxRateFor({})).toBe(7.75);
  });

  it("totals a quote: labor plus material plus use tax, then margin", () => {
    const t = quoteTotals({
      labor: { journeymanHours: 7.5, apprenticeHours: 7.5, driverHours: 0.8, journeymanRate: 64, apprenticeRate: 34, driverRate: 30 },
      materials: [{ quantity: 1, unitCost: 1200 }],
      marginPercent: 40,
      taxRate: 7.75,
    });
    expect(t.laborTotal).toBe(759);
    expect(t.materialCost).toBe(1200);
    expect(t.useTax).toBe(93);
    expect(t.cost).toBe(2052);
    expect(t.sell).toBe(3420);
    expect(t.profit).toBe(1368);
  });

  it("has no sell price until every labor rate with hours is typed", () => {
    const t = quoteTotals({
      labor: { journeymanHours: 2, apprenticeHours: 0, driverHours: 0, journeymanRate: null, apprenticeRate: null, driverRate: null },
      materials: [],
      marginPercent: 45,
    });
    expect(t.journeyman).toBeNull();
    expect(t.apprentice).toBe(0);
    expect(t.sell).toBeNull();
  });

  it("gives a monthly financing figure", () => {
    expect(financingMonthly(3420, 9.99, 36)).toBeGreaterThan(100);
    expect(financingMonthly(0)).toBe(0);
    expect(defaultCompanySettings().salesTaxPercent).toBe(7.75);
  });
});
