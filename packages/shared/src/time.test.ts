import { describe, expect, it } from "vitest";
import { billPortions, californiaDaily, californiaWeekly, clockHoursBetween, entryHours, hoursBetween, mealsRequired, quarterHours, restsRequired, sheetCheck } from "./time";

describe("time", () => {
  it("rounds timesheet spans to quarter hours and clocks to two decimals", () => {
    expect(quarterHours(2.1)).toBe(2);
    expect(quarterHours(2.13)).toBe(2.25);
    expect(hoursBetween("2026-10-14T08:00:00Z", "2026-10-14T10:30:00Z")).toBe(2.5);
    expect(hoursBetween("2026-10-14T23:00:00Z", "2026-10-14T01:00:00Z")).toBe(2);
    expect(clockHoursBetween("2026-10-14T08:00:00Z", "2026-10-14T08:40:00Z")).toBe(0.67);
  });

  it("splits a clock into drive and labor at the arrival stamp", () => {
    const row = { kind: "labor" as const, hours: 0, startedAt: "2026-10-14T09:31:00Z", arrivedAt: "2026-10-14T10:02:00Z", stoppedAt: "2026-10-14T12:00:00Z" };
    expect(billPortions(row)).toEqual({ travel: 0.52, labor: 1.97 });
    expect(billPortions({ kind: "travel", hours: 0.5 })).toEqual({ travel: 0.5, labor: 0 });
    expect(billPortions({ kind: "labor", hours: 2 })).toEqual({ travel: 0, labor: 2 });
  });

  it("prefers typed hours after an edit", () => {
    expect(entryHours({ startedAt: "2026-10-14T08:00:00Z", stoppedAt: "2026-10-14T10:00:00Z", hours: 3, edited: true })).toBe(3);
    expect(entryHours({ startedAt: "2026-10-14T08:00:00Z", stoppedAt: "2026-10-14T10:00:00Z", hours: 0 })).toBe(2);
  });

  it("applies the California meal and rest rules", () => {
    expect(mealsRequired(4.9)).toBe(0);
    expect(mealsRequired(5)).toBe(1);
    expect(mealsRequired(10)).toBe(2);
    expect(restsRequired(3)).toBe(0);
    expect(restsRequired(3.5)).toBe(1);
    expect(restsRequired(8)).toBe(2);
    expect(restsRequired(10)).toBe(3);
  });

  it("computes California daily and weekly overtime", () => {
    expect(californiaDaily(8)).toEqual({ regular: 8, overtime: 0, double: 0 });
    expect(californiaDaily(9.25)).toEqual({ regular: 8, overtime: 1.25, double: 0 });
    expect(californiaDaily(13)).toEqual({ regular: 8, overtime: 4, double: 1 });
    expect(californiaDaily(10, true)).toEqual({ regular: 0, overtime: 8, double: 2 });
    const week = californiaWeekly([9, 9, 9, 9, 9, 0, 0]);
    expect(week).toEqual({ paid: 45, regular: 40, overtime: 5, double: 0 });
  });

  it("blocks a submit until lunch is on a long day", () => {
    const rows = [
      { id: "a", kind: "travel" as const, hours: 0, startedAt: "2026-10-14T07:00:00Z", stoppedAt: "2026-10-14T07:30:00Z" },
      { id: "b", kind: "labor" as const, hours: 0, startedAt: "2026-10-14T07:30:00Z", stoppedAt: "2026-10-14T15:30:00Z" },
    ];
    const check = sheetCheck(rows);
    expect(check.paidHours).toBe(8.5);
    expect(check.mealsNeeded).toBe(1);
    expect(check.canSubmit).toBe(false);
    expect(check.blocks.map((b) => b.fix)).toContain("add-lunch");
    const withLunch = sheetCheck([...rows, { id: "c", kind: "meal" as const, hours: 0.5, startedAt: "2026-10-14T12:00:00Z", stoppedAt: "2026-10-14T12:30:00Z" }]);
    expect(withLunch.blocks.map((b) => b.fix)).toContain("fix-overlap");
  });
});
