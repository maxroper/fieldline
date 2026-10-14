import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { addDays, dayLabel, statusLabel, timeLabel } from "../../app/format";
import { useAction, useSettings } from "../../app/queries";
import type { TechDay, TimeEntryRow, TimesheetRow } from "../../app/types";
import { Button, Empty, Field, Input, Loading, Notice, Pill, Seg, Select, Sheet, SummaryLine } from "../../design/components";

interface TimesheetsPayload {
  date: string;
  techs: ({ tech: { id: string; name: string; teamId: string | null }; timesheet: TimesheetRow | null } & TechDay)[];
}

const search = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), team: z.string().optional() });

export const Route = createFileRoute("/_office/timesheets")({ validateSearch: search, component: TimesheetsPage });


/** HH:MM in the browser's zone for a time input. */
function toTime(stamp: string | null | undefined): string {
  if (!stamp) return "";
  const d = new Date(stamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fromTime(date: string, hhmm: string): string | null {
  if (!hhmm) return null;
  return new Date(`${date}T${hhmm}:00`).toISOString();
}
const h = (n: number) => `${Math.round(n * 100) / 100} h`;

function TimesheetsPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const settings = useSettings();
  const today = new Date().toISOString().slice(0, 10);
  const date = params.date ?? today;
  const query = useQuery({ queryKey: ["timesheets", date, params.team ?? ""], queryFn: () => api.get<TimesheetsPayload>(`/time/timesheets${qs({ date, teamId: params.team })}`) });
  const exceptions = useQuery({ queryKey: ["timesheet-exceptions"], queryFn: () => api.get<{ exceptions: { sheet: TimesheetRow; techName: string }[] }>("/time/timesheets/exceptions") });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ techId: string; entry: TimeEntryRow | null } | null>(null);
  const review = useAction((vars: { id: string; status: "approved" | "open"; comment?: string }) => api.post(`/time/timesheets/${vars.id}/review`, { status: vars.status, comment: vars.comment }), { success: "Timesheet updated" });
  const submitFor = useAction((techId: string) => api.post("/time/timesheets/submit", { date, techId, mealReason: "Submitted by the office" }), { success: "Submitted" });
  const remove = useAction((id: string) => api.delete(`/time/entries/${id}`), { success: "Entry removed" });
  const teams = settings.data?.teams ?? [];
  const data = query.data;
  const monthStart = date.slice(0, 8) + "01";
  return (
    <>
      <div className="toolbar">
        <div className="btn-group">
          <Button size="sm" tone="ghost" onClick={() => setSearch({ date: addDays(date, -1) })}>‹</Button>
          <Button size="sm" tone="ghost" onClick={() => setSearch({ date: today })}>Today</Button>
          <Button size="sm" tone="ghost" onClick={() => setSearch({ date: addDays(date, 1) })}>›</Button>
        </div>
        <Input type="date" value={date} onChange={(e) => setSearch({ date: e.target.value || undefined })} style={{ maxWidth: 170 }} />
        <span className="strong">{dayLabel(date, true)}</span>
        <Seg value={params.team ?? ""} options={[{ value: "", label: "All teams" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} onChange={(v) => setSearch({ team: v || undefined })} />
        <span className="grow" />
        <Button size="sm" tone="ghost" onClick={() => void api.download(`/time/timesheets/export?from=${monthStart}&to=${date}`, `timesheets-${monthStart}-${date}.csv`)}>Export payroll CSV</Button>
      </div>
      <div className="page">
        {query.isLoading || !data ? <Loading label="Loading timesheets" /> : (
          <div className="stack loose">
            <SummaryLine items={[{ value: data.techs.length, label: "techs with time" }, { dot: "amber", value: data.techs.filter((t) => t.timesheet?.status === "submitted").length, label: "to review" }, { dot: "moss", value: data.techs.filter((t) => t.timesheet?.status === "approved").length, label: "approved" }, { dot: "red", value: data.techs.filter((t) => t.check.blocks.length || t.timesheet?.missedMeal || t.timesheet?.missedRest).length, label: "with exceptions" }]} />
            {data.techs.length === 0 ? <Empty title="No time on this day">Techs' clocks write here as they work. Pick another day or add time to a work order.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Technician</th><th>Status</th><th className="num">Travel</th><th className="num">On site</th><th className="num">Meal</th><th className="num">Paid</th><th className="num">Reg / OT / DT</th><th>Checks</th><th /></tr>
                  </thead>
                  <tbody>
                    {data.techs.map((t) => {
                      const expanded = open === t.tech.id;
                      const flags = [...t.check.blocks.map((b) => b.message), t.timesheet?.missedMeal ? "Missed meal premium" : null, t.timesheet?.missedRest ? "Missed rest break" : null, t.check.mealsNeeded > t.check.mealsLogged && !t.timesheet ? `Meal not logged (${t.check.mealsNeeded} needed)` : null].filter(Boolean) as string[];
                      return (
                        <TechRows key={t.tech.id} t={t} expanded={expanded} flags={flags} onToggle={() => setOpen(expanded ? null : t.tech.id)} onEdit={(entry) => setEditing({ techId: t.tech.id, entry })} onAdd={() => setEditing({ techId: t.tech.id, entry: null })} onRemove={(id) => remove.mutate(id)} onReview={(status) => t.timesheet && review.mutate({ id: t.timesheet.id, status })} onSubmit={() => submitFor.mutate(t.tech.id)} />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {exceptions.data?.exceptions.length ? (
              <section className="section">
                <div className="section-head"><h3>Exceptions to resolve</h3><span className="small muted">Missed meals, missed rests, premium hours</span></div>
                <div className="list">
                  {exceptions.data.exceptions.map((x) => (
                    <button key={x.sheet.id} type="button" className="item clickable" style={{ gridTemplateColumns: "minmax(0,1fr) auto", textAlign: "left" }} onClick={() => { setSearch({ date: x.sheet.date }); setOpen(x.sheet.techId); }}>
                      <div>
                        <div className="title">{x.techName} · {dayLabel(x.sheet.date)}</div>
                        <div className="sub">{[x.sheet.missedMeal ? "missed meal" : null, x.sheet.missedRest ? "missed rest" : null, x.sheet.premiumHours ? `${x.sheet.premiumHours} h premium` : null].filter(Boolean).join(" · ")}{x.sheet.mealReason ? ` · "${x.sheet.mealReason}"` : ""}</div>
                      </div>
                      <Pill tone={x.sheet.status === "submitted" ? "parts" : "hold"}>{statusLabel(x.sheet.status)}</Pill>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
            <Notice tone="plain">California rules applied: a meal before the end of the 5th hour, a second before the 10th, a rest break per 4 hours, daily overtime over 8 and double time over 12, and a premium hour when a meal is missed without a valid waiver.</Notice>
          </div>
        )}
      </div>
      <EntrySheet editing={editing} date={date} onClose={() => setEditing(null)} />
    </>
  );
}

function TechRows({ t, expanded, flags, onToggle, onEdit, onAdd, onRemove, onReview, onSubmit }: { t: TimesheetsPayload["techs"][number]; expanded: boolean; flags: string[]; onToggle: () => void; onEdit: (entry: TimeEntryRow) => void; onAdd: () => void; onRemove: (id: string) => void; onReview: (status: "approved" | "open") => void; onSubmit: () => void }) {
  const status = t.timesheet?.status ?? "open";
  return (
    <>
      <tr className={`clickable${expanded ? " on" : ""}`} onClick={onToggle}>
        <td className="primary-cell">{t.tech.name}</td>
        <td><Pill tone={status === "approved" ? "done" : status === "submitted" ? "parts" : "open"}>{status === "open" ? "Not submitted" : statusLabel(status)}</Pill></td>
        <td className="num">{h(t.totals.travel)}</td>
        <td className="num">{h(t.totals.onSite)}</td>
        <td className="num">{t.totals.meal ? h(t.totals.meal) : <span className="muted">none</span>}</td>
        <td className="num strong">{h(t.totals.paid)}</td>
        <td className="num">{t.overtime.regular} / {t.overtime.overtime} / {t.overtime.double}</td>
        <td>{flags.length ? <span className="small" style={{ color: "var(--red)" }}>{flags.join(" · ")}</span> : <span className="small muted">Clean</span>}</td>
        <td className="num" onClick={(e) => e.stopPropagation()}>
          {status === "submitted" ? <Button size="sm" tone="moss" onClick={() => onReview("approved")}>Approve</Button> : status === "approved" ? <Button size="sm" tone="ghost" onClick={() => onReview("open")}>Reopen</Button> : <Button size="sm" tone="ghost" onClick={onSubmit}>Submit for them</Button>}
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={9} style={{ background: "var(--paper-2)" }}>
            <div className="stack">
              <div className="row between wrap">
                <span className="small muted">{t.entries.length} entries · {t.check.mealsLogged} of {t.check.mealsNeeded} meals · {t.check.restsLogged} of {t.check.restsNeeded} rests</span>
                <Button size="sm" onClick={onAdd}>Add entry</Button>
              </div>
              <table className="table dense">
                <thead><tr><th>Kind</th><th>Job</th><th className="num">Start</th><th className="num">Arrived</th><th className="num">Stop</th><th className="num">Hours</th><th>Source</th><th /></tr></thead>
                <tbody>
                  {t.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{e.arrivedAt ? "Drive + labor" : statusLabel(e.kind)}</td>
                      <td>{e.label ? <span><span className="num">{e.label}</span> {e.title} <span className="muted">· {e.siteName}</span></span> : <span className="muted">—</span>}</td>
                      <td className="num">{timeLabel(e.startedAt)}</td>
                      <td className="num">{timeLabel(e.arrivedAt)}</td>
                      <td className="num">{e.running ? <span className="live">running</span> : timeLabel(e.stoppedAt)}</td>
                      <td className="num">{h(e.hours)}</td>
                      <td className="small muted">{e.edited ? "Edited" : e.gpsVerified ? "GPS verified" : "Clock"}</td>
                      <td className="num"><Button size="sm" tone="ghost" onClick={() => onEdit(e)} disabled={status === "approved"}>Edit</Button> <Button size="sm" tone="ghost" onClick={() => onRemove(e.id)} disabled={status === "approved"}>Remove</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {t.timesheet?.mealReason ? <div className="small muted">Meal note from the tech: "{t.timesheet.mealReason}"</div> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function EntrySheet({ editing, date, onClose }: { editing: { techId: string; entry: TimeEntryRow | null } | null; date: string; onClose: () => void }) {
  const [form, setForm] = useState({ kind: "labor", start: "", arrived: "", stop: "", hours: "" });
  useEffect(() => {
    const e = editing?.entry;
    setForm({ kind: e?.kind ?? "labor", start: toTime(e?.startedAt), arrived: toTime(e?.arrivedAt), stop: toTime(e?.stoppedAt), hours: e && !e.startedAt ? String(e.hours) : "" });
  }, [editing]);
  const save = useAction(() => {
    const body = { kind: form.kind, startedAt: fromTime(date, form.start), arrivedAt: fromTime(date, form.arrived), stoppedAt: fromTime(date, form.stop), hours: form.start ? undefined : Number(form.hours || 0), edited: true };
    return editing?.entry ? api.patch(`/time/entries/${editing.entry.id}`, body) : api.post("/time/entries", { ...body, techId: editing?.techId, date, workOrderId: null });
  }, { success: "Time saved", onSuccess: onClose });
  return (
    <Sheet open={Boolean(editing)} onClose={onClose} title={editing?.entry ? "Edit time" : "Add time"} footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button tone="primary" onClick={() => save.mutate()}>Save</Button></>}>
      <Field label="Kind"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}><option value="labor">Labor</option><option value="travel">Travel</option><option value="meal">Meal</option><option value="rest">Rest break</option></Select></Field>
      <div className="field-grid">
        <Field label="Start"><Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
        <Field label="Arrived" help="Splits drive from labor."><Input type="time" value={form.arrived} onChange={(e) => setForm({ ...form, arrived: e.target.value })} /></Field>
        <Field label="Stop"><Input type="time" value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })} /></Field>
        <Field label="Or hours" help="When there is no clock."><Input type="number" step="0.25" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} disabled={Boolean(form.start)} /></Field>
      </div>
      <p className="small muted">Edits are logged with who changed them. Clock hours bill to two decimals; the timesheet rounds to the quarter hour.</p>
    </Sheet>
  );
}
