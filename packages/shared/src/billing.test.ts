import { describe, expect, it } from "vitest";
import { agingBucket, invoiceCreditStatus, invoiceNet, workOrderBill } from "./billing";
import { defaultCompanySettings } from "./money";

const settings = {
  ...defaultCompanySettings(),
  costRates: [
    { name: "Journeyman", rate: 64 },
    { name: "Apprentice", rate: 34 },
    { name: "Driver", rate: 30 },
  ],
  nonContractRates: [
    { name: "Journeyman", rate: 195 },
    { name: "Apprentice", rate: 120 },
    { name: "Driver", rate: 90 },
  ],
  contractRates: [
    { name: "Journeyman", rate: 185 },
    { name: "Apprentice", rate: 110 },
    { name: "Driver", rate: 85 },
  ],
  nonContractMargin: [
    { upTo: 100, divisor: 0.6 },
    { upTo: null, divisor: 0.75 },
  ],
  contractMargin: [{ upTo: null, divisor: 0.8 }],
};

const time = [
  { id: "t1", kind: "labor" as const, hours: 0, startedAt: "2026-10-14T16:31:00Z", arrivedAt: "2026-10-14T17:00:00Z", stoppedAt: "2026-10-14T19:00:00Z", visitLabel: "1058", techName: "Marcus Hale", date: "2026-10-14" },
];

describe("workOrderBill", () => {
  it("bills time and material with margin, misc, vehicle and sales tax", () => {
    const bill = workOrderBill({
      callType: "service",
      billingType: "tm",
      nteAmount: null,
      quotedAmount: null,
      agreementVisitAmount: null,
      customer: { contract: false, taxExempt: false },
      site: null,
      settings,
      time,
      materials: [{ id: "m1", source: "PO", description: "Capacitor 45/5", quantity: 1, unitCost: 40 }],
    });
    expect(bill.labor.map((l) => [l.kind, l.hours])).toEqual([
      ["Labor", 2],
      ["Travel", 0.48],
    ]);
    expect(bill.laborTotal).toBe(483.6); // 2.48 h at 195
    expect(bill.materialTotal).toBe(66.67); // 40 / 0.6
    expect(bill.vehicleAmount).toBe(125);
    expect(bill.miscAmount).toBe(5.5); // 1% of 550.27
    expect(bill.salesTax).toBe(5.17); // 7.75% of 66.67
    expect(bill.amount).toBe(685.94);
    expect(bill.taxKind).toBe("sales");
    expect(bill.overNte).toBeNull();
  });

  it("flags the amount over a not-to-exceed cap", () => {
    const bill = workOrderBill({ callType: "service", billingType: "nte", nteAmount: 500, quotedAmount: null, agreementVisitAmount: null, customer: { contract: false }, site: null, settings, time, materials: [] });
    expect(bill.nteAmount).toBe(500);
    expect(bill.overNte).toBe(113.44); // labor 483.60 + 1% misc 4.84 + vehicle 125 = 613.44
  });

  it("prices a quoted job at the quoted amount and tracks cost with use tax", () => {
    const bill = workOrderBill({ callType: "quoted", billingType: "quoted", nteAmount: null, quotedAmount: 3420, agreementVisitAmount: null, customer: { contract: true }, site: null, settings, time, materials: [{ id: "m1", source: "PO", description: "Motor", quantity: 1, unitCost: 1200 }] });
    expect(bill.amount).toBe(3420);
    expect(bill.taxKind).toBe("use");
    expect(bill.accruedUseTax).toBe(93);
    expect(bill.quoted?.laborCost).toBe(158.72); // 2.48 h at the 64 cost rate
    expect(bill.quoted?.actualCost).toBe(1465.31);
    expect(bill.quoted?.actualMargin).toBe(1954.69);
  });

  it("prices maintenance at the agreement visit amount", () => {
    const bill = workOrderBill({ callType: "maintenance", billingType: "tm", nteAmount: null, quotedAmount: null, agreementVisitAmount: 380, customer: { contract: true }, site: null, settings, time, materials: [] });
    expect(bill.amount).toBe(380);
    expect(bill.fixedPrice).toBe(true);
    expect(bill.jobCost).toBe(158.72);
  });

  it("reports missing bill rates and running clocks", () => {
    const bill = workOrderBill({ callType: "service", billingType: "tm", nteAmount: null, quotedAmount: null, agreementVisitAmount: null, customer: null, site: null, settings: { ...settings, nonContractRates: [] }, time: [{ ...time[0]!, stoppedAt: null, running: true }], materials: [], now: "2026-10-14T18:00:00Z" });
    expect(bill.rateMissing).toBe(true);
    expect(bill.clockRunning).toBe(true);
    expect(bill.amount).toBe(0); // nothing billed yet while the clock runs
  });

  it("nets credits and ages receivables", () => {
    expect(invoiceNet(100, 30)).toBe(70);
    expect(invoiceCreditStatus(100, 100)).toBe("credited");
    expect(invoiceCreditStatus(100, 30)).toBe("partially_credited");
    expect(agingBucket("2026-10-01", "2026-10-14")).toBe("1-30");
    expect(agingBucket("2026-06-01", "2026-10-14")).toBe("90+");
  });
});
