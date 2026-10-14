import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, elapsed, hoursText, minuteLabel, relativeLabel, statusLabel, woNumber, woTone } from "../../app/format";
import { useAction, useSettings } from "../../app/queries";
import type { WorkOrderRow } from "../../app/types";
import { Avatar, Button, Input, Loading, Meter, Pill, Seg, SummaryLine } from "../../design/components";

interface TechStatusRow {
  id: string;
  name: string;
  title: string;
  teamId: string | null;
  phone: string;
  shiftHours: number;
  visits: WorkOrderRow[];
  todayVisits: WorkOrderRow[];
  weekHours: { date: string; scheduled: number; charged: number; off: boolean }[];
  backlog: { hours: number; count: number };
  offDays: string[];
  location: { lat: number; lng: number; recordedAt: string } | null;
  current: WorkOrderRow | null;
  month: { jobs: number; callbacks: number };
}

interface TechStatusPayload {
  day: string;
  today: string;
  weekDays: string[];
  techs: TechStatusRow[];
}

const search = z.object({ team: z.string().optional(), view: z.enum(["cards", "week"]).default("cards") });

export const Route = createFileRoute("/_office/tech-status")({ validateSearch: search, component: TechStatusPage });

function TechStatusPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const settings = useSettings();
  const query = useQuery({ queryKey: ["tech-status", params.team ?? ""], queryFn: () => api.get<TechStatusPayload>(`/techs${qs({ teamId: params.team })}`), refetchInterval: 30_000 });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const data = query.data;
  if (query.isLoading || !data) return <Loading label="Loading the crew" />;
  const teams = settings.data?.teams ?? [];
  const onSite = data.techs.filter((t) => t.current?.techStatus === "on_site").length;
  const enRoute = data.techs.filter((t) => t.current?.techStatus === "en_route").length;
  const off = data.techs.filter((t) => t.offDays.includes(data.today)).length;
  const free = data.techs.length - onSite - enRoute - off;
  return (
    <>
      <div className="toolbar">
        <Seg value={params.team ?? ""} options={[{ value: "", label: "All teams" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} onChange={(v) => setSearch({ team: v || undefined })} />
        <Seg value={params.view} options={[{ value: "cards", label: "Crew" }, { value: "week", label: "Week" }]} onChange={(v) => setSearch({ view: v })} />
        <span className="grow" />
        <SummaryLine items={[{ dot: "moss", value: onSite, label: "on site" }, { dot: "amber", value: enRoute, label: "en route" }, { dot: "steel", value: free, label: "free" }, { value: off, label: "off today" }]} />
      </div>
      <div className="page">
        {params.view === "cards" ? (
          <div className="grid auto stagger">
            {data.techs.map((t) => <TechCard key={t.id} t={t} today={data.today} />)}
          </div>
        ) : (
          <WeekGrid data={data} />
        )}
      </div>
    </>
  );
}

function TechCard({ t, today }: { t: TechStatusRow; today: string }) {
  const [offDate, setOffDate] = useState("");
  const addOff = useAction(() => api.post(`/techs/${t.id}/off-days`, { date: offDate }), { success: "Day off saved", onSuccess: () => setOffDate("") });
  const removeOff = useAction((date: string) => api.delete(`/techs/${t.id}/off-days/${date}`), { success: "Day off removed" });
  const offToday = t.offDays.includes(today);
  const todayHours = t.todayVisits.reduce((sum, w) => sum + Number(w.allocatedHours || 0), 0);
  const tone = t.current?.techStatus === "on_site" ? "moss" : t.current?.techStatus === "en_route" ? "amber" : offToday ? undefined : "ink";
  const status = t.current ? <Pill tone={woTone(t.current)}>{statusLabel(t.current.techStatus)}{t.current.techStatusAt ? ` · ${elapsed(t.current.techStatusAt)}` : ""}</Pill> : offToday ? <Pill tone="hold">Off today</Pill> : <Pill tone="open" plain>Free</Pill>;
  return (
    <div className="card tech-card">
      <div className="row between top gap-2">
        <div className="row gap-2">
          <Avatar name={t.name} tone={tone} />
          <div>
            <div className="strong">{t.name}</div>
            <div className="small muted">{t.title}{t.phone ? ` · ${t.phone}` : ""}</div>
          </div>
        </div>
        {status}
      </div>
      {t.current ? (
        <Link to="/work-orders/$id" params={{ id: t.current.id }} className="small nav-link mt-2" style={{ display: "block" }}>
          <span className="num strong">{woNumber(t.current)}</span> {t.current.title} <span className="muted">· {t.current.siteName}</span>
        </Link>
      ) : null}
      <div className="mt-2 stack tight">
        <div className="row between small"><span className="muted">Today</span><span><b>{t.todayVisits.length}</b> visits · {hoursText(todayHours)} of {t.shiftHours} h</span></div>
        <Meter value={(todayHours / Math.max(1, t.shiftHours)) * 100} tone={todayHours > t.shiftHours ? "red" : "steel"} />
      </div>
      <div className="mt-2 week-strip">
        {t.weekHours.map((d) => (
          <div key={d.date} className={d.off ? "off" : ""} title={`${dayLabel(d.date)}: ${d.scheduled} h scheduled, ${d.charged} h charged`}>
            <span>{dayLabel(d.date).slice(0, 2)}</span>
            <div className="bar-h">
              <i className="s" style={{ height: `${Math.min(100, (d.scheduled / Math.max(8, t.shiftHours)) * 100)}%` }} />
              <i className="c" style={{ height: `${Math.min(100, (d.charged / Math.max(8, t.shiftHours)) * 100)}%` }} />
            </div>
            <span className="num">{d.off ? "off" : d.scheduled ? d.scheduled : ""}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 small muted row between wrap">
        <span>Backlog <b>{t.backlog.count}</b> jobs · {hoursText(t.backlog.hours)}</span>
        <span>This month <b>{t.month.jobs}</b> done{t.month.callbacks ? <span style={{ color: "var(--red)" }}> · {t.month.callbacks} callbacks</span> : null}</span>
      </div>
      <div className="mt-2 row wrap gap-2 small">
        <span className="muted">Off:</span>
        {t.offDays.length === 0 ? <span className="muted">none planned</span> : t.offDays.map((d) => <button key={d} type="button" className="chip" onClick={() => removeOff.mutate(d)} title="Remove">{dayLabel(d)} ×</button>)}
        <Input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} style={{ maxWidth: 150, minHeight: 30, padding: "2px 8px" }} />
        <Button size="sm" tone="ghost" onClick={() => addOff.mutate()} disabled={!offDate}>Add</Button>
      </div>
      <div className="mt-2 row between small muted">
        <span>{t.location ? `Last seen ${relativeLabel(t.location.recordedAt)}` : "No location yet"}</span>
        <Link to="/tech" search={{ as: t.id } as never} className="nav-link">Open their phone</Link>
      </div>
    </div>
  );
}

function WeekGrid({ data }: { data: TechStatusPayload }) {
  return (
    <div className="table-wrap">
      <div className="week-grid">
        <div className="wk-head" />
        {data.weekDays.map((d) => <div key={d} className={`wk-head${d === data.today ? " today" : ""}`}>{dayLabel(d)}</div>)}
        {data.techs.map((t) => (
          <div key={t.id} style={{ display: "contents" }}>
            <div className="wk-tech">
              <span>{t.name}</span>
              <span className="small muted">{hoursText(t.weekHours.reduce((sum, d) => sum + d.scheduled, 0))} scheduled</span>
            </div>
            {data.weekDays.map((d) => {
              const day = t.weekHours.find((x) => x.date === d);
              const visits = t.visits.filter((w) => w.scheduledFor === d);
              return (
                <div key={d} className={`wk-cell${day?.off ? " off" : ""}`}>
                  {visits.map((w) => (
                    <Link key={w.id} to="/work-orders/$id" params={{ id: w.id }} className={`ticket compact nav-link ${w.priority === "urgent" ? "t-red" : w.callType === "quoted" ? "t-plum" : w.callType === "maintenance" ? "t-steel" : ""}`}>
                      <div className="ticket-title"><span className="num">{w.startMinute != null ? minuteLabel(w.startMinute) : ""}</span> {woNumber(w)} · {w.title}</div>
                    </Link>
                  ))}
                  {day?.charged ? <span className="small muted">{day.charged} h charged</span> : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
