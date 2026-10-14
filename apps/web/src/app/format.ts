import { minuteLabel, money } from "@fieldline/shared";

export { minuteLabel, money };

export function moneyK(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return money(value);
}

export function hoursText(hours: number | null | undefined): string {
  if (hours == null) return "";
  return `${Math.round(hours * 100) / 100} h`;
}

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const longDayFmt = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const stampFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "Wed, Oct 14" for a YYYY-MM-DD. */
export function dayLabel(date: string | null | undefined, long = false): string {
  if (!date) return "Not scheduled";
  const d = new Date(`${date}T12:00:00`);
  return (long ? longDayFmt : dayFmt).format(d);
}

export function timeLabel(stamp: string | null | undefined): string {
  if (!stamp) return "";
  return timeFmt.format(new Date(stamp));
}

export function stampLabel(stamp: string | null | undefined): string {
  if (!stamp) return "";
  return stampFmt.format(new Date(stamp));
}

export function relativeLabel(stamp: string | null | undefined): string {
  if (!stamp) return "";
  const diff = Date.now() - Date.parse(stamp);
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** "0:38" elapsed since a stamp. */
export function elapsed(stamp: string | null | undefined, now = Date.now()): string {
  if (!stamp) return "";
  const minutes = Math.max(0, Math.floor((now - Date.parse(stamp)) / 60000));
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function woNumber(wo: { number: number; trip?: number | null }): string {
  return wo.trip && wo.trip > 1 ? `${wo.number}-${wo.trip}` : String(wo.number);
}

export function statusLabel(status: string | null | undefined): string {
  const map: Record<string, string> = { open: "Open", closed: "Completed", billed: "Billed", en_route: "En route", on_site: "On site", paused: "Paused", done: "Done", draft: "Draft", sent: "Sent", viewed: "Viewed", approved: "Approved", declined: "Declined", follow_up: "Follow-up", issued: "Issued", partial: "Partial", received: "Received", invoiced: "Vendor invoiced", cancelled: "Cancelled", paid: "Paid", partially_credited: "Partially credited", credited: "Credited", void: "Void", submitted: "Submitted", unscheduled: "Unscheduled", scheduled: "Scheduled", skipped: "Skipped", parts: "Waiting on parts", quote_sent: "Quote sent", return: "Need to return", no_access: "No access", warranty: "Warranty pending" };
  return status ? (map[status] ?? status.replace(/_/g, " ")) : "";
}

/** Pill class for a work order's state in the shared color language. */
export function woTone(wo: { status: string; techStatus?: string | null; priority?: string; waitingOnParts?: boolean; callType?: string; warranty?: boolean }): string {
  if (wo.status === "billed") return "done";
  if (wo.status === "closed") return "ready";
  if (wo.techStatus === "on_site") return "site";
  if (wo.techStatus === "en_route") return "route";
  if (wo.techStatus === "done") return "ready";
  if (wo.waitingOnParts) return "parts";
  if (wo.priority === "urgent") return "urgent";
  if (wo.callType === "quoted") return "quote";
  return "sched";
}

export function ticketTone(wo: { status: string; techStatus?: string | null; priority?: string; waitingOnParts?: boolean; callType?: string }): string {
  if (wo.status !== "open") return "";
  if (wo.priority === "urgent") return "t-red";
  if (wo.waitingOnParts) return "t-rust";
  if (wo.callType === "quoted") return "t-plum";
  if (wo.techStatus === "on_site") return "t-moss";
  if (wo.techStatus === "en_route") return "t-amber";
  return "";
}
