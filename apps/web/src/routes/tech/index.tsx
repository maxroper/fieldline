import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "../../app/api";
import { dayLabel, elapsed, hoursText, minuteLabel, statusLabel, woTone, woNumber } from "../../app/format";
import { techDayQuery, useAction } from "../../app/queries";
import { useTechWho } from "../../app/shell/PhoneShell";
import { Button, Empty, Loading, Pill } from "../../design/components";

export const Route = createFileRoute("/tech/")({ component: TechToday });

function TechToday() {
  const who = useTechWho();
  const query = useQuery(techDayQuery(who));
  const readNotices = useAction(() => api.post(`/techs/${who}/notices/read`), { success: "Cleared" });
  const d = query.data;
  if (!d) return <Loading label="Loading your day" />;
  const now = Date.now();
  const paidMinutes = d.timeEntries.filter((e) => e.kind === "labor" || e.kind === "travel").reduce((sum, e) => sum + (e.startedAt ? Math.max(0, ((e.stoppedAt ? Date.parse(e.stoppedAt) : now) - Date.parse(e.startedAt)) / 60000) : e.hours * 60), 0);
  const current = d.visits.find((v) => v.techStatus === "en_route" || v.techStatus === "on_site" || v.techStatus === "paused");
  const next = d.visits.find((v) => v.status === "open" && !v.techStatus && v.id !== current?.id);
  return (
    <div className="ph-page">
      <div className="row between top">
        <div>
          <h1>Today</h1>
          <div className="small muted">{dayLabel(d.date, true)} · {d.tech.name}</div>
        </div>
        <div className="stack tight" style={{ alignItems: "flex-end" }}>
          <Pill tone="open" plain>{d.visits.length} visit{d.visits.length === 1 ? "" : "s"}</Pill>
          <span className="small muted">{hoursText(Math.round(paidMinutes / 6) / 10)} on the clock</span>
        </div>
      </div>
      {d.notices.length ? (
        <div className="ph-section">
          <div className="row between"><span className="eyebrow">From dispatch</span><Button size="sm" tone="ghost" onClick={() => readNotices.mutate()}>Got it</Button></div>
          {d.notices.map((n) => (
            <div key={n.id} className="notice">
              {n.body}
              {n.workOrderId ? <> · <Link to="/tech/work-orders/$id" params={{ id: n.workOrderId }} search={true} className="strong nav-link">Open</Link></> : null}
            </div>
          ))}
        </div>
      ) : null}
      {current ? (
        <div className="ph-section">
          <span className="eyebrow">Right now</span>
          <Link to="/tech/work-orders/$id" params={{ id: current.id }} search={true} className="ph-ticket now">
            <span className="t">{current.startMinute != null ? minuteLabel(current.startMinute) : ""}</span>
            <span>
              <div className="title"><span className="num">{woNumber(current)}</span> · {current.title}</div>
              <div className="sub">{current.siteName} · {statusLabel(current.techStatus)} {current.techStatusAt ? elapsed(current.techStatusAt) : ""}</div>
            </span>
            <Pill tone={woTone(current)}>{statusLabel(current.techStatus)}</Pill>
          </Link>
        </div>
      ) : null}
      <div className="ph-section">
        <span className="eyebrow">Schedule</span>
        {d.visits.length === 0 ? <Empty title="Nothing scheduled">Dispatch will add visits here. Pull down to refresh.</Empty> : null}
        {d.visits.map((v) => {
          const site = d.sites.find((s) => s.id === v.siteId);
          const done = v.status !== "open" || v.techStatus === "done";
          return (
            <Link key={v.id} to="/tech/work-orders/$id" params={{ id: v.id }} search={true} className={`ph-ticket${v.id === current?.id ? " now" : ""}${done ? " done" : ""}${v.id === next?.id ? "" : ""}`}>
              <span className="t">{v.startMinute != null ? minuteLabel(v.startMinute) : "—"}<br /><span className="small muted">{hoursText(v.allocatedHours)}</span></span>
              <span>
                <div className="title"><span className="num">{woNumber(v)}</span> · {v.title}</div>
                <div className="sub">{v.siteName}{site?.city ? ` · ${site.city}` : ""}{v.role === "helper" ? " · helping" : ""}{v.priority === "urgent" ? " · urgent" : ""}</div>
              </span>
              <Pill tone={woTone(v)}>{done ? "Done" : v.techStatus ? statusLabel(v.techStatus) : v.id === next?.id ? "Next" : statusLabel(v.callType)}</Pill>
            </Link>
          );
        })}
      </div>
      <div className="ph-section">
        <span className="eyebrow">End of day</span>
        <Link to="/tech/timesheet" search={true} className="ph-ticket">
          <span className="t">{hoursText(Math.round(paidMinutes / 6) / 10)}</span>
          <span><div className="title">Timesheet</div><div className="sub">{d.timesheet ? statusLabel(d.timesheet.status) : "Not submitted"} · meal and breaks</div></span>
          <Pill tone={d.timesheet?.status === "submitted" ? "site" : d.timesheet?.status === "approved" ? "done" : "open"} plain>{d.timesheet ? statusLabel(d.timesheet.status) : "Open"}</Pill>
        </Link>
        {d.van ? <Link to="/tech/vehicle" search={true} className="ph-ticket"><span className="t">Van</span><span><div className="title">{d.van.name}</div><div className="sub">Stock, counts, parts used</div></span><span /></Link> : null}
        {d.pendingUploads ? <div className="small muted">{d.pendingUploads} photo{d.pendingUploads === 1 ? "" : "s"} waiting to upload.</div> : null}
      </div>
    </div>
  );
}
