import type { TimeKind } from "./types";

const HOUR = 60 * 60 * 1000;

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function quarterHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.round(hours * 4) / 4;
}

/** Quarter-hour span between two stamps. An end at or before the start is read as the next day. */
export function hoursBetween(startedAt: string | null | undefined, stoppedAt: string | null | undefined): number | null {
  if (!startedAt || !stoppedAt) return null;
  const start = Date.parse(startedAt);
  let end = Date.parse(stoppedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end <= start) end += 24 * HOUR;
  return quarterHours((end - start) / HOUR);
}

/** Two-decimal hours between two stamps. A span that rounds to nothing is 0. */
export function clockHoursBetween(startedAt: string | null | undefined, stoppedAt: string | null | undefined): number {
  if (!startedAt || !stoppedAt) return 0;
  const ms = Date.parse(stoppedAt) - Date.parse(startedAt);
  if (!(ms > 0)) return 0;
  return Math.round((ms / HOUR) * 100) / 100;
}

export interface TimeRow {
  kind: TimeKind;
  hours: number;
  startedAt?: string | null;
  arrivedAt?: string | null;
  stoppedAt?: string | null;
  edited?: boolean | null;
  running?: boolean;
  now?: string | null;
}

/**
 * Drive is En route to On site; labor is On site to stop. A line with no arrival stays one kind.
 * A zero portion is left out by the caller.
 */
export function billPortions(row: TimeRow): { travel: number; labor: number } {
  const end = row.running ? (row.now ?? null) : (row.stoppedAt ?? null);
  if (row.arrivedAt !== undefined && row.startedAt && end) {
    const travel = row.arrivedAt ? clockHoursBetween(row.startedAt, row.arrivedAt) : clockHoursBetween(row.startedAt, end);
    const labor = row.arrivedAt ? clockHoursBetween(row.arrivedAt, end) : 0;
    if (travel > 0 || labor > 0) return { travel, labor };
    if (row.hours > 0) return row.arrivedAt ? { travel: 0, labor: round2(row.hours) } : { travel: round2(row.hours), labor: 0 };
    return { travel, labor };
  }
  if (row.kind === "travel") return { travel: row.hours > 0 ? round2(row.hours) : 0, labor: 0 };
  return { travel: 0, labor: row.hours > 0 ? round2(row.hours) : 0 };
}

/** Hours on a time entry. A typed value wins after an edit; otherwise stop minus start. */
export function entryHours(row: Pick<TimeRow, "startedAt" | "stoppedAt" | "hours" | "edited" | "arrivedAt">): number {
  if (row.edited && row.hours > 0) return row.hours;
  if (row.arrivedAt !== undefined && row.startedAt && row.stoppedAt) {
    const span = clockHoursBetween(row.startedAt, row.stoppedAt);
    if (span > 0) return span;
    return row.hours > 0 ? row.hours : 0;
  }
  if (row.startedAt && row.stoppedAt) {
    const span = hoursBetween(row.startedAt, row.stoppedAt);
    if (span != null) return span;
  }
  return row.hours > 0 ? row.hours : 0;
}

/** Paid hours on a day: labor, travel and paid rest. Meals are unpaid. */
export function paidHours(rows: Pick<TimeRow, "kind" | "hours">[]): number {
  return round2(rows.filter((row) => row.kind !== "meal").reduce((sum, row) => sum + (row.hours > 0 ? row.hours : 0), 0));
}

/** California: one 30-minute meal by the end of the 5th hour, a second by the end of the 10th. */
export function mealsRequired(shiftHours: number): number {
  if (shiftHours >= 10) return 2;
  if (shiftHours >= 5) return 1;
  return 0;
}

/** California: one paid 10-minute rest for each 4 hours worked or major fraction thereof (3.5 h rounds up). */
export function restsRequired(paid: number): number {
  if (!(paid >= 3.5)) return 0;
  return Math.max(1, Math.round(paid / 4));
}

export interface DailyOvertime {
  regular: number;
  /** Over 8 in a day, up to 12, at 1.5x. */
  overtime: number;
  /** Over 12 in a day, at 2x. */
  double: number;
}

/** California daily overtime for one day of paid hours. The caller applies the seventh-day rule with `seventhDay`. */
export function californiaDaily(paid: number, seventhDay = false): DailyOvertime {
  const hours = paid > 0 ? round2(paid) : 0;
  if (seventhDay) {
    // Seventh consecutive day in a workweek: first 8 at 1.5x, over 8 at 2x.
    return { regular: 0, overtime: round2(Math.min(hours, 8)), double: round2(Math.max(0, hours - 8)) };
  }
  return {
    regular: round2(Math.min(hours, 8)),
    overtime: round2(Math.max(0, Math.min(hours, 12) - 8)),
    double: round2(Math.max(0, hours - 12)),
  };
}

export interface WeeklyOvertime extends DailyOvertime {
  paid: number;
}

/**
 * California weekly totals from per-day paid hours (Sunday..Saturday order not required; pass the days worked in sequence).
 * Daily overtime first, then weekly: regular hours past 40 in the week move to 1.5x.
 */
export function californiaWeekly(days: number[]): WeeklyOvertime {
  const worked = days.filter((h) => h > 0);
  let regular = 0;
  let overtime = 0;
  let double = 0;
  days.forEach((paid, index) => {
    const seventh = worked.length === 7 && index === 6;
    const d = californiaDaily(paid, seventh);
    regular += d.regular;
    overtime += d.overtime;
    double += d.double;
  });
  if (regular > 40) {
    overtime += regular - 40;
    regular = 40;
  }
  const paid = round2(days.reduce((sum, h) => sum + (h > 0 ? h : 0), 0));
  return { paid, regular: round2(regular), overtime: round2(overtime), double: round2(double) };
}

export interface SheetBlock {
  key: string;
  message: string;
  fix: "add-lunch" | "add-time" | "fix-overlap" | "fix-times";
}

export interface SheetCheckResult {
  paidHours: number;
  mealsNeeded: number;
  restsNeeded: number;
  mealsLogged: number;
  restsLogged: number;
  blocks: SheetBlock[];
  canSubmit: boolean;
  /** A shift of 6 hours or less may waive the meal. */
  waiverOk: boolean;
  overtime: DailyOvertime;
}

export interface SheetRow extends TimeRow {
  id: string;
  workOrderId?: string | null;
}

/** Everything that stops a timesheet from being submitted, and the day's totals. */
export function sheetCheck(rows: SheetRow[], scheduledHours = 0): SheetCheckResult {
  const paid = paidHours(rows.map((row) => ({ kind: row.kind, hours: entryHours(row) })));
  const shiftHours = Math.max(paid, scheduledHours > 0 ? scheduledHours : 0);
  const mealsNeeded = mealsRequired(shiftHours);
  const restsNeeded = restsRequired(paid);
  const mealsLogged = rows.filter((row) => row.kind === "meal" && row.startedAt && row.stoppedAt).length;
  const restsLogged = rows.filter((row) => row.kind === "rest").length;
  const blocks: SheetBlock[] = [];
  for (const row of rows) {
    if ((row.kind === "labor" || row.kind === "travel") && row.startedAt && !row.stoppedAt && !row.running) {
      blocks.push({ key: `open-${row.id}`, message: "A time row has a start and no stop", fix: "fix-times" });
    }
  }
  const overlaps = sheetOverlaps(rows);
  if (overlaps.length) blocks.push({ key: "overlap", message: "These times overlap", fix: "fix-overlap" });
  if (mealsNeeded > 0 && mealsLogged < mealsNeeded && shiftHours > 6) {
    blocks.push({ key: "lunch", message: "Add your lunch to submit your timesheet", fix: "add-lunch" });
  }
  return {
    paidHours: paid,
    mealsNeeded,
    restsNeeded,
    mealsLogged,
    restsLogged,
    blocks,
    canSubmit: blocks.length === 0,
    waiverOk: shiftHours <= 6,
    overtime: californiaDaily(paid),
  };
}

/** Pairs of row ids whose spans overlap. */
export function sheetOverlaps(rows: SheetRow[]): [string, string][] {
  const spans = rows
    .filter((row) => row.startedAt && row.stoppedAt)
    .map((row) => ({ id: row.id, start: Date.parse(row.startedAt!), end: Date.parse(row.stoppedAt!) }))
    .filter((s) => !Number.isNaN(s.start) && !Number.isNaN(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);
  const out: [string, string][] = [];
  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1]!;
    const cur = spans[i]!;
    if (cur.start < prev.end) out.push([prev.id, cur.id]);
  }
  return out;
}

/** Minutes from midnight to "9:30 AM" style text. */
export function minuteLabel(minute: number | null | undefined): string {
  if (minute == null || !Number.isFinite(minute)) return "";
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** The company's calendar day for an instant, in its timezone. */
export function companyDay(date: Date, timeZone = "America/Los_Angeles"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Minutes since midnight for an instant in the company's timezone. */
export function companyMinute(date: Date, timeZone = "America/Los_Angeles"): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return get("hour") * 60 + get("minute");
}
