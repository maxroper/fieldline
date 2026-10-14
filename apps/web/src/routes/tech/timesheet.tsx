import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { addDays, dayLabel, statusLabel, timeLabel } from "../../app/format";
import { useAction } from "../../app/queries";
import { useTechWho } from "../../app/shell/PhoneShell";
import type { TechDay, TimeEntryRow, TimesheetRow } from "../../app/types";
import { Button, Field, Input, Loading, Notice, Pill, Select, Sheet } from "../../design/components";

type Payload = TechDay & { techId: string; date: string; timesheet: TimesheetRow | null };

export const Route = createFileRoute("/tech/timesheet")({ validateSearch: z.object({ as: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), component: TechTimesheet });

const h = (n: number) => `${Math.round(n * 100) / 100} h`;

function TechTimesheet() {
  const who = useTechWho();
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const today = new Date().toISOString().slice(0, 10);
  const date = params.date ?? today;
  const query = useQuery({ queryKey: ["time-entries", who, date], queryFn: () => api.get<Payload>(`/time/entries${qs({ techId: who, date })}`), refetchInterval: 30_000 });
  const [adding, setAdding] = useState<"meal" | "rest" | "labor" | null>(null);
  const [times, setTimes] = useState({ start: "12:00", stop: "12:30" });
  const [reason, setReason] = useState("");
  const add = useAction(() => api.post("/time/entries", { techId: who === "me" ? undefined : who, kind: adding, date, startedAt: new Date(`${date}T${times.start}:00`).toISOString(), stoppedAt: adding === "rest" ? undefined : new Date(`${date}T${times.stop}:00`).toISOString(), hours: adding === "rest" ? 0 : undefined, edited: true }), { success: adding === "meal" ? "Lunch added" : "Added", onSuccess: () => setAdding(null) });
  const fix = useAction((vars: { id: string; stoppedAt: string }) => api.patch(`/time/entries/${vars.id}`, { stoppedAt: vars.stoppedAt }), { success: "Fixed" });
  const submit = useAction(() => api.post("/time/timesheets/submit", { date, techId: who === "me" ? undefined : who, mealReason: reason || undefined }), { success: "Timesheet submitted" });
  const d = query.data;
  if (!d) return <Loading label="Loading your time" />;
  const status = d.timesheet?.status ?? "open";
  const lunchBlock = d.check.blocks.find((b) => b.fix === "add-lunch");
  const openRows = d.entries.filter((e) => e.startedAt && !e.stoppedAt && !e.running);
  return (
    <div className="ph-page">
      <div className="row between">
        <Button size="sm" tone="ghost" onClick={() => navigate({ search: (prev) => ({ ...prev, date: addDays(date, -1) }) })}>‹</Button>
        <div className="center"><h1 style={{ fontSize: 18 }}>{date === today ? "Today" : dayLabel(date)}</h1><div className="small muted">{dayLabel(date, true)}</div></div>
        <Button size="sm" tone="ghost" onClick={() => navigate({ search: (prev) => ({ ...prev, date: addDays(date, 1) }) })} disabled={date >= today}>›</Button>
      </div>
      <div className="row between">
        <Pill tone={status === "approved" ? "done" : status === "submitted" ? "site" : "open"} size="lg">{status === "open" ? "Not submitted" : statusLabel(status)}</Pill>
        <div className="small muted">Paid <b>{h(d.totals.paid)}</b>{d.overtime.overtime ? ` · ${d.overtime.overtime} h OT` : ""}{d.overtime.double ? ` · ${d.overtime.double} h DT` : ""}</div>
      </div>
      <div className="summary-line">
        <span><b>{h(d.totals.travel)}</b> driving</span>
        <span><b>{h(d.totals.onSite)}</b> on site</span>
        <span><b>{h(d.totals.meal)}</b> meal</span>
        <span><b>{d.check.restsLogged}</b> breaks</span>
      </div>
      {d.check.blocks.map((b) => (
        <Notice key={b.key} tone="red">
          {b.message}.
          {b.fix === "add-lunch" ? <> <Button size="sm" onClick={() => { setAdding("meal"); setTimes({ start: "12:00", stop: "12:30" }); }}>Add lunch</Button>{d.check.waiverOk ? <span className="small"> or note why it was waived below.</span> : null}</> : null}
          {b.fix === "fix-times" && openRows[0] ? <> <Button size="sm" onClick={() => fix.mutate({ id: openRows[0]!.id, stoppedAt: new Date().toISOString() })}>Stop it now</Button></> : null}
        </Notice>
      ))}
      <div className="ph-section">
        <span className="eyebrow">Entries</span>
        {d.entries.length === 0 ? <div className="small muted">Nothing on the clock yet. Your status buttons on each job write time here.</div> : null}
        <div className="list">
          {d.entries.map((e: TimeEntryRow) => (
            <div key={e.id} className="item" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div>
                <div className="title">{e.label ? <><span className="num">{e.label}</span> · {e.title}</> : statusLabel(e.kind)}</div>
                <div className="sub">{e.startedAt ? `${timeLabel(e.startedAt)}${e.arrivedAt ? ` · arrived ${timeLabel(e.arrivedAt)}` : ""} – ${e.running ? "now" : timeLabel(e.stoppedAt) || "?"}` : "Hours entered"}{e.siteName ? ` · ${e.siteName}` : ""}</div>
              </div>
              <div className="num strong">{e.running ? <span className="live">{h(e.hours)}</span> : h(e.hours)}</div>
            </div>
          ))}
        </div>
      </div>
      {status === "open" ? (
        <div className="big-actions">
          <Button onClick={() => { setAdding("meal"); setTimes({ start: "12:00", stop: "12:30" }); }}>Add lunch</Button>
          <Button onClick={() => { setAdding("rest"); setTimes({ start: "10:00", stop: "10:10" }); }}>Add break</Button>
          <Button onClick={() => { setAdding("labor"); setTimes({ start: "07:30", stop: "08:00" }); }}>Add shop time</Button>
        </div>
      ) : null}
      {status === "open" && lunchBlock && d.check.waiverOk ? <Field label="Meal waived because"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Shift under 6 hours, I chose to skip it" /></Field> : null}
      {status === "open" ? <div className="ph-bar"><Button tone="primary" size="lg" onClick={() => submit.mutate()} disabled={(!d.check.canSubmit && !(lunchBlock && d.check.waiverOk && reason.trim())) || submit.isPending}>Submit timesheet</Button></div> : <Notice tone="moss">Submitted{d.timesheet?.submittedAt ? ` · ${timeLabel(d.timesheet.submittedAt)}` : ""}. The office reviews it before payroll.</Notice>}
      <Sheet open={Boolean(adding)} onClose={() => setAdding(null)} title={adding === "meal" ? "Lunch" : adding === "rest" ? "Rest break" : "Shop time"} bottom footer={<Button tone="primary" block onClick={() => add.mutate()}>Save</Button>}>
        <div className="field-grid">
          <Field label="Start"><Input type="time" value={times.start} onChange={(e) => setTimes({ ...times, start: e.target.value })} /></Field>
          {adding !== "rest" ? <Field label="End"><Input type="time" value={times.stop} onChange={(e) => setTimes({ ...times, stop: e.target.value })} /></Field> : null}
        </div>
        {adding === "meal" ? <p className="small muted">California: an unpaid 30-minute meal before the end of your 5th hour, and a second before the 10th on long days.</p> : null}
        {adding === "rest" ? <p className="small muted">A paid 10-minute break for every 4 hours worked. Only the start time is recorded.</p> : null}
        {adding === "labor" ? <Select value="labor" onChange={() => undefined} style={{ display: "none" }} /> : null}
      </Sheet>
    </div>
  );
}
