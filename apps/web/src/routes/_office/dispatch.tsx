import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type DragEvent } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { addDays, dayLabel, elapsed, hoursText, minuteLabel, money, statusLabel, ticketTone, woNumber, woTone } from "../../app/format";
import { dispatchQuery, useAction, useSettings } from "../../app/queries";
import { toast } from "../../app/store";
import type { DispatchDay, WorkOrderRow } from "../../app/types";
import { Avatar, Button, Chip, Empty, ErrorBox, Facts, Loading, Pill, Seg, Sheet, SummaryLine } from "../../design/components";
import { Icon } from "../../design/icons";
import { MapPanel } from "../../features/dispatch/MapPanel";

const search = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  view: z.enum(["day", "week", "month"]).default("day"),
  team: z.string().optional(),
  wo: z.string().optional(),
});

export const Route = createFileRoute("/_office/dispatch")({ validateSearch: search, component: DispatchPage });

const DAY_START = 7 * 60;
const DAY_END = 18 * 60;
const ROW_MINUTES = 30;
const ROW_PX = 36;
const ROWS = (DAY_END - DAY_START) / ROW_MINUTES;

function DispatchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const settings = useSettings();
  const query = useQuery(dispatchQuery(params.day, params.team));
  const [queueTab, setQueueTab] = useState<"open" | "ready" | "done">("open");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<{ types: string[]; priorities: string[]; flags: string[]; sort: "priority" | "oldest" | "newest" }>({ types: [], priorities: [], flags: [], sort: "priority" });
  const [showMap, setShowMap] = useState(false);
  const [dragging, setDragging] = useState<WorkOrderRow | null>(null);
  const [hotCol, setHotCol] = useState<string | null>(null);
  const [queueSearch, setQueueSearch] = useState("");

  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const data = query.data;
  const day = data?.day ?? params.day ?? "";

  const assign = useAction((vars: { id: string; techId: string | null; scheduledFor: string | null; startMinute: number | null; version?: number }) => api.post(`/work-orders/${vars.id}/assign`, { techId: vars.techId, scheduledFor: vars.scheduledFor, startMinute: vars.startMinute, version: vars.version }), { success: "Board updated" });

  const queue = useMemo(() => {
    if (!data) return [];
    const list = queueTab === "open" ? data.queue : queueTab === "ready" ? data.readyToClose : data.completed;
    const needle = queueSearch.trim().toLowerCase();
    return list
      .filter((w) => !needle || `${w.number} ${w.title} ${w.customerName ?? ""} ${w.siteAddress ?? ""}`.toLowerCase().includes(needle))
      .filter((w) => !filters.types.length || filters.types.includes(w.callType))
      .filter((w) => !filters.priorities.length || filters.priorities.includes(w.priority))
      .filter((w) => !filters.flags.length || filters.flags.every((f) => (f === "assigned" ? Boolean(w.assignedTechId) : f === "unassigned" ? !w.assignedTechId : f === "return" ? w.needReturn : f === "parts" ? w.waitingOnParts : f === "warranty" ? w.warranty : true)))
      .sort((a, b) => (filters.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : filters.sort === "newest" ? b.createdAt.localeCompare(a.createdAt) : 0));
  }, [data, queueTab, queueSearch, filters]);

  const activeFilters = filters.types.length + filters.priorities.length + filters.flags.length + (filters.sort !== "priority" ? 1 : 0);

  const onDropOnTech = (techId: string, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setHotCol(null);
    const id = e.dataTransfer.getData("text/wo");
    if (!id || !data) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const minute = DAY_START + Math.max(0, Math.round((e.clientY - rect.top) / (ROW_PX / 2))) * 15;
    const wo = [...data.queue, ...data.slots, ...data.readyToClose].find((w) => w.id === id);
    assign.mutate({ id, techId, scheduledFor: day, startMinute: Math.min(minute, DAY_END - 60), version: wo?.version });
  };
  const onDropOnQueue = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/wo");
    if (!id || !data) return;
    const wo = data.slots.find((w) => w.id === id);
    if (wo) assign.mutate({ id, techId: null, scheduledFor: null, startMinute: null, version: wo.version });
  };
  const dragStart = (wo: WorkOrderRow) => (e: DragEvent) => {
    e.dataTransfer.setData("text/wo", wo.id);
    e.dataTransfer.effectAllowed = "move";
    setDragging(wo);
  };

  const teams = settings.data?.teams ?? [];
  const selectedTeam = params.team ?? "";

  return (
    <>
      <div className="toolbar">
        {teams.length > 1 ? <Seg value={selectedTeam} options={[{ value: "", label: "All" }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} onChange={(v) => setSearch({ team: v || undefined })} /> : null}
        <div className="row">
          <Button icon="chevron" size="sm" tone="ghost" aria-label="Previous day" onClick={() => setSearch({ day: addDays(day, -1) })} />
          <b className="num" style={{ minWidth: "7.5rem", textAlign: "center" }}>{dayLabel(day)}</b>
          <Button size="sm" tone="ghost" aria-label="Next day" onClick={() => setSearch({ day: addDays(day, 1) })}>
            ›
          </Button>
          {data && day !== data.today ? (
            <Button size="sm" tone="subtle" onClick={() => setSearch({ day: undefined })}>
              Today
            </Button>
          ) : null}
        </div>
        <Seg value={params.view} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} onChange={(view) => setSearch({ view })} />
        <span className="grow" />
        {data ? (
          <div className="hide-narrow">
            <SummaryLine items={[{ value: data.summary.visits, label: "visits" }, { dot: "red", value: data.summary.unassigned, label: "unassigned" }, { dot: "amber", value: data.summary.late, label: "late" }, { dot: "steel", value: `${data.summary.capacity}%`, label: "capacity" }]} />
          </div>
        ) : null}
        <Button size="sm" tone={showMap ? "primary" : "ghost"} icon="map" onClick={() => setShowMap((v) => !v)}>
          Map
        </Button>
      </div>

      {query.isLoading ? <Loading label="Loading the board" /> : null}
      {query.error ? (
        <div className="page">
          <ErrorBox error={query.error} />
        </div>
      ) : null}

      {data && params.view === "day" ? (
        <div className="split narrow-rail">
          <aside className="rail" onDragOver={(e) => e.preventDefault()} onDrop={onDropOnQueue}>
            <div className="search">
              <input className="input" id="dispatch-search" type="search" placeholder="Customer, address, or work order" value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)} />
            </div>
            <Seg light value={queueTab} options={[{ value: "open", label: "Open", count: data.queue.length }, { value: "ready", label: "Ready", count: data.readyToClose.length }, { value: "done", label: "Done", count: data.completed.length }]} onChange={setQueueTab} />
            <div className="row between">
              <span className="eyebrow">{queueTab === "open" ? "Queue · drag onto the board" : queueTab === "ready" ? "Tech done · ready to close" : "Completed today"}</span>
              <Button size="sm" tone="ghost" icon="filter" onClick={() => setFiltersOpen(true)}>
                Filters{activeFilters ? ` · ${activeFilters}` : ""}
              </Button>
            </div>
            <div className="stack stagger">
              {queue.length === 0 ? <Empty title="Nothing here">{queueTab === "open" ? "Every open job is on the board." : "Nothing to show for this day."}</Empty> : null}
              {queue.map((wo) => (
                <button key={wo.id} type="button" className={`ticket draggable ${ticketTone(wo)}${params.wo === wo.id ? " on" : ""}`} draggable={queueTab === "open"} onDragStart={dragStart(wo)} onDragEnd={() => setDragging(null)} onClick={() => setSearch({ wo: wo.id })}>
                  <div className="ticket-head">
                    <span className="ticket-no">{woNumber(wo)}</span>
                    <Pill tone={woTone(wo)}>{wo.status === "open" ? (wo.techStatus ? statusLabel(wo.techStatus) : wo.waitingOnParts ? "Parts" : wo.priority === "urgent" ? "Urgent" : wo.callType === "quoted" ? "Quoted" : wo.assignedTechId ? "Assigned" : "Open") : statusLabel(wo.status)}</Pill>
                  </div>
                  <div className="ticket-title">{wo.customerName ?? wo.siteName ?? wo.title}</div>
                  <div className="ticket-sub">
                    {wo.siteCity ? `${wo.siteCity} · ` : ""}
                    {wo.title}
                  </div>
                  <div className="ticket-meta">
                    <span>{statusLabel(wo.callType) || wo.callType}</span>
                    {wo.allocatedHours ? <span>· {hoursText(wo.allocatedHours)}</span> : null}
                    {wo.assignedTechId ? <span>· {wo.techName}</span> : <span>· Unassigned</span>}
                    {wo.scheduledFor ? <span>· {dayLabel(wo.scheduledFor)}</span> : <span className="num">· {Math.max(0, Math.floor((Date.now() - Date.parse(wo.createdAt)) / 86400000))} d old</span>}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="canvas">
            <div className={`dispatch-canvas${showMap ? " show-map" : ""}`} style={{ display: "grid", gridTemplateColumns: showMap ? "minmax(0, 1fr) 340px" : "minmax(0, 1fr)" }}>
              <div className="board-scroll" style={{ overflow: "auto", minWidth: 0 }}>
                <div className="day-grid" style={{ ["--techs" as string]: String(Math.max(1, data.techs.length)), minWidth: 180 * data.techs.length + 56, gridTemplateRows: `44px repeat(${ROWS}, ${ROW_PX}px)`, position: "relative" }}>
                  <div className="tech-head" style={{ gridColumn: 1, gridRow: 1 }} />
                  {data.techs.map((tech, i) => (
                    <div key={tech.id} className="tech-head" style={{ gridColumn: i + 2, gridRow: 1 }}>
                      <Avatar name={tech.name} size="sm" tone={tech.current?.techStatus === "on_site" ? "moss" : tech.current?.techStatus === "en_route" ? "amber" : undefined} />
                      <span className="name">{tech.name}</span>
                      <span className="sub">
                        {tech.offToday ? <Pill tone="hold" plain>Off</Pill> : tech.current ? <Pill tone={woTone({ status: "open", techStatus: tech.current.techStatus })} plain>{statusLabel(tech.current.techStatus)}</Pill> : <Pill tone="open" plain>Free</Pill>}
                        <span className="load num">
                          {tech.load.hours} / {tech.shiftHours} h
                        </span>
                      </span>
                    </div>
                  ))}
                  {data.techs.map((tech, i) => (
                    <div key={`col-${tech.id}`} className={`col-bg${tech.offToday ? " off" : ""}${hotCol === tech.id ? " drop-hot" : ""}`} style={{ gridColumn: i + 2 }} onDragOver={(e) => { e.preventDefault(); if (hotCol !== tech.id) setHotCol(tech.id); }} onDragLeave={() => setHotCol(null)} onDrop={(e) => onDropOnTech(tech.id, e)} />
                  ))}
                  {Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, h) => (
                    <div key={h} className="time" style={{ gridRow: 2 + h * 2 }}>
                      {minuteLabel(DAY_START + h * 60).replace(":00", "").replace(" ", "")}
                    </div>
                  ))}
                  {data.slots.map((wo) => {
                    const col = data.techs.findIndex((t) => t.id === wo.assignedTechId);
                    if (col < 0 || wo.startMinute == null) return null;
                    const row = 2 + Math.max(0, Math.round((wo.startMinute - DAY_START) / ROW_MINUTES));
                    const span = Math.max(1, Math.round(((wo.allocatedHours ?? 1) * 60) / ROW_MINUTES));
                    const tone = wo.status !== "open" ? "done" : wo.techStatus === "on_site" ? "site" : wo.techStatus === "en_route" ? "route" : wo.techStatus === "done" ? "done" : wo.waitingOnParts ? "parts" : wo.priority === "urgent" ? "urgent" : wo.callType === "quoted" ? "quote" : "";
                    return (
                      <button key={wo.id} type="button" className={`slot draggable ${tone}${wo.techStatus === "on_site" ? " now-job" : ""}`} style={{ ["--c" as string]: String(col + 2), gridRow: `${row} / span ${span}` }} draggable={wo.status === "open"} onDragStart={dragStart(wo)} onDragEnd={() => setDragging(null)} onClick={() => setSearch({ wo: wo.id })}>
                        <b>
                          {woNumber(wo)} · {wo.customerName ?? wo.siteName}
                        </b>
                        <span className="t">
                          {minuteLabel(wo.startMinute)}–{minuteLabel(wo.startMinute + (wo.allocatedHours ?? 1) * 60)} · {wo.title}
                        </span>
                        {wo.techStatus && wo.status === "open" ? (
                          <Pill tone={woTone(wo)} className="mt-1">
                            {statusLabel(wo.techStatus)}
                            {wo.techStatusAt && wo.techStatus !== "done" ? ` · ${elapsed(wo.techStatusAt)}` : ""}
                          </Pill>
                        ) : null}
                      </button>
                    );
                  })}
                  {data.helperSlots.map((hs) => {
                    const col = data.techs.findIndex((t) => t.id === hs.h.techId);
                    if (col < 0 || hs.h.startMinute == null) return null;
                    const row = 2 + Math.max(0, Math.round((hs.h.startMinute - DAY_START) / ROW_MINUTES));
                    const span = Math.max(1, Math.round(((hs.h.allocatedHours ?? 1) * 60) / ROW_MINUTES));
                    return (
                      <Link key={hs.h.id} to="/work-orders/$id" params={{ id: hs.h.workOrderId }} className="slot" style={{ ["--c" as string]: String(col + 2), gridRow: `${row} / span ${span}` }}>
                        <b>
                          {woNumber(hs)} · helper
                        </b>
                        <span className="t">{hs.siteName}</span>
                      </Link>
                    );
                  })}
                  {day === data.today && data.nowMinute >= DAY_START && data.nowMinute <= DAY_END ? <div className="now" style={{ top: 44 + ((data.nowMinute - DAY_START) / ROW_MINUTES) * ROW_PX }} /> : null}
                </div>
              </div>
              {showMap ? (
                <aside className="map-side" style={{ display: "block", borderLeft: "1px solid var(--line)", background: "var(--card)", padding: 12 }}>
                  <div className="row between" style={{ marginBottom: 8 }}>
                    <b>Live map</b>
                    <span className="live small muted">{data.techs.filter((t) => t.location).length} trucks reporting</span>
                  </div>
                  <MapPanel techs={data.techs} jobs={[...data.slots, ...data.queue]} />
                </aside>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {data && params.view === "week" ? <WeekView start={day} teamId={params.team} onPick={(id) => setSearch({ wo: id })} /> : null}
      {data && params.view === "month" ? <MonthView month={day.slice(0, 7)} onPickDay={(d) => setSearch({ day: d, view: "day" })} /> : null}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" footer={<><Button tone="ghost" onClick={() => setFilters({ types: [], priorities: [], flags: [], sort: "priority" })}>Clear</Button><Button tone="primary" onClick={() => setFiltersOpen(false)}>Apply</Button></>}>
        <div className="chip-group">
          <span className="eyebrow">Sort</span>
          <div className="chips">
            {(["priority", "oldest", "newest"] as const).map((s) => (
              <Chip key={s} on={filters.sort === s} onClick={() => setFilters({ ...filters, sort: s })}>{s === "priority" ? "Priority" : s === "oldest" ? "Oldest" : "Newest"}</Chip>
            ))}
          </div>
        </div>
        <ChipGroup label="Type" options={[["service", "Service"], ["maintenance", "Maintenance"], ["quoted", "Quoted job"]]} value={filters.types} onChange={(types) => setFilters({ ...filters, types })} />
        <ChipGroup label="Priority" options={[["urgent", "Urgent"], ["normal", "Normal"], ["low", "Low"]]} value={filters.priorities} onChange={(priorities) => setFilters({ ...filters, priorities })} />
        <ChipGroup label="Flags" options={[["assigned", "Assigned"], ["unassigned", "Unassigned"], ["return", "Need to return"], ["parts", "Waiting on parts"], ["warranty", "Warranty"]]} value={filters.flags} onChange={(flags) => setFilters({ ...filters, flags })} />
      </Sheet>

      <QuickSheet id={params.wo} day={day} onClose={() => setSearch({ wo: undefined })} />
      {dragging ? <span className="sr-only">Dragging {woNumber(dragging)}</span> : null}
    </>
  );
}

function ChipGroup({ label, options, value, onChange }: { label: string; options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="chip-group">
      <span className="eyebrow">{label}</span>
      <div className="chips">
        {options.map(([key, text]) => (
          <Chip key={key} on={value.includes(key)} onClick={() => onChange(value.includes(key) ? value.filter((v) => v !== key) : [...value, key])}>
            {text}
          </Chip>
        ))}
      </div>
    </div>
  );
}

/** Quick view of one job from the board, with assignment suggestions and the customer text button. */
function QuickSheet({ id, day, onClose }: { id: string | undefined; day: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["work-order", id], queryFn: () => api.get<import("../../app/queries").WorkOrderDetail>(`/work-orders/${id}`), enabled: Boolean(id) });
  const suggestions = useQuery({ queryKey: ["suggestions", id], queryFn: () => api.get<{ suggestions: { techId: string; techName: string; day: string; startMinute: number; reason: string }[] }>(`/dispatch/suggestions${qs({ workOrderId: id })}`), enabled: Boolean(id) && detail.data?.workOrder.status === "open" });
  const assign = useAction((vars: { techId: string; day: string; startMinute: number }) => api.post(`/work-orders/${id}/assign`, { techId: vars.techId, scheduledFor: vars.day, startMinute: vars.startMinute, version: detail.data?.workOrder.version }), { success: "Placed on the board", onSuccess: onClose });
  const text = useAction((body: string) => api.post("/messages", { customerId: detail.data?.workOrder.customerId, workOrderId: id, to: detail.data?.site?.contactPhone || detail.data?.customer?.phone || "", body }), { success: "Text sent" });
  const wo = detail.data?.workOrder;
  return (
    <Sheet open={Boolean(id)} onClose={onClose} title={wo ? <><span className="num strong" style={{ fontSize: 18 }}>{woNumber(wo)}</span><Pill tone={woTone(wo)}>{wo.techStatus ? statusLabel(wo.techStatus) : statusLabel(wo.status)}</Pill>{wo.warranty ? <Pill tone="warranty">Warranty</Pill> : null}</> : "Work order"} footer={wo ? <><Button tone="ghost" onClick={onClose}>Close</Button><Link to="/work-orders/$id" params={{ id: wo.id }} className="btn primary nav-link">Open full work order</Link></> : undefined}>
      {detail.isLoading ? <Loading /> : null}
      {wo ? (
        <>
          <div>
            <h2>{wo.customerName ?? wo.siteName ?? wo.title}</h2>
            <div className="muted">{[wo.siteName, detail.data?.site?.address, detail.data?.site?.contact, detail.data?.site?.contactPhone].filter(Boolean).join(" · ")}</div>
          </div>
          {wo.priority === "urgent" && !wo.assignedTechId ? <div className="notice red"><b>Urgent and unassigned.</b> {Math.floor((Date.now() - Date.parse(wo.createdAt)) / 86400000)} days in the queue.</div> : null}
          <Facts rows={[["Problem", wo.description || wo.title], ["Type", `${statusLabel(wo.callType)} · ${wo.billingType.toUpperCase()}${wo.nteAmount ? ` · NTE ${money(wo.nteAmount)}` : ""}${wo.quotedAmount ? ` · ${money(wo.quotedAmount)}` : ""}`], ["Technician", wo.techName ? `${wo.techName}${wo.scheduledFor ? ` · ${dayLabel(wo.scheduledFor)} ${minuteLabel(wo.startMinute)}` : ""}` : "Unassigned"], ["Equipment", detail.data?.equipment ? `${detail.data.equipment.tag} · ${detail.data.equipment.make} ${detail.data.equipment.model}` : "Not set"]]} />
          {wo.status === "open" && suggestions.data?.suggestions.length ? (
            <div>
              <span className="eyebrow">Place on the board</span>
              <div className="option-cards mt-1" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                {suggestions.data.suggestions.slice(0, 4).map((sug, i) => (
                  <button key={`${sug.techId}-${sug.day}`} type="button" className={`option-card${i === 0 ? " on" : ""}`} onClick={() => assign.mutate({ techId: sug.techId, day: sug.day, startMinute: sug.startMinute })}>
                    <span className="tier">{i === 0 ? "Suggested" : "Alternative"}</span>
                    <div className="strong">
                      {sug.techName} · {sug.day === day ? "today" : dayLabel(sug.day)} {minuteLabel(sug.startMinute)}
                    </div>
                    <div className="small muted">{sug.reason}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="btn-group">
            <Button onClick={() => text.mutate(`${detail.data?.site?.contact ? `Hi ${detail.data.site.contact.split(" ")[0]}, ` : ""}this is Harbor Coast Mechanical about work order ${woNumber(wo)}. ${wo.techName ? `${wo.techName.split(" ")[0]} is scheduled ${wo.scheduledFor ? dayLabel(wo.scheduledFor) : "soon"}${wo.startMinute != null ? ` at ${minuteLabel(wo.startMinute)}` : ""}.` : "We will text when a technician is on the way."}`)} disabled={text.isPending}>
              Text customer
            </Button>
            {wo.status === "open" && wo.assignedTechId ? (
              <Button tone="ghost" onClick={() => assign.mutate({ techId: wo.assignedTechId!, day, startMinute: wo.startMinute ?? 8 * 60 })} disabled>
                On the board
              </Button>
            ) : null}
          </div>
          {detail.data?.changes.length ? (
            <div>
              <span className="eyebrow">Recent</span>
              <div className="timeline mt-1">
                {detail.data.changes.slice(0, 5).map((ch) => (
                  <div key={ch.f.id} className="tl steel">
                    <div className="when">{new Date(ch.f.createdAt).toLocaleString()}</div>
                    <div className="what">
                      {ch.f.field}: {ch.f.toValue}
                    </div>
                    <div className="who">{ch.userName ?? "System"}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

function WeekView({ start, teamId, onPick }: { start: string; teamId: string | undefined; onPick: (id: string) => void }) {
  const weekStart = useMemo(() => {
    const d = new Date(`${start}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  }, [start]);
  const query = useQuery({ queryKey: ["dispatch-week", weekStart, teamId], queryFn: () => api.get<{ days: string[]; techs: DispatchDay["techs"]; slots: WorkOrderRow[]; offDays: { userId: string; date: string }[] }>(`/dispatch/week${qs({ start: weekStart, teamId })}`) });
  if (!query.data) return <Loading label="Loading the week" />;
  const { days, techs, slots, offDays } = query.data;
  return (
    <div className="scroll-x page" style={{ paddingTop: 12 }}>
      <div className="week-grid">
        <div className="wk-head" />
        {days.map((d) => (
          <div key={d} className={`wk-head${d === start ? " today" : ""}`}>{dayLabel(d)}</div>
        ))}
        {techs.map((tech) => {
          const mine = slots.filter((s) => s.assignedTechId === tech.id);
          const hours = mine.reduce((sum, s) => sum + Number(s.allocatedHours ?? 0), 0);
          return (
            <div key={tech.id} style={{ display: "contents" }}>
              <div className="wk-tech">
                <span>{tech.name}</span>
                <span className="load-bar">
                  <i className="a" style={{ width: `${Math.min(100, (hours / 40) * 100)}%` }} />
                </span>
                <span className="tiny muted num">{hours} / 40 h</span>
              </div>
              {days.map((d) => (
                <div key={d} className={`wk-cell${offDays.some((o) => o.userId === tech.id && o.date === d) ? " off" : ""}`}>
                  {mine
                    .filter((s) => s.scheduledFor === d)
                    .map((s) => (
                      <button key={s.id} type="button" className={`ticket compact ${ticketTone(s)}`} onClick={() => onPick(s.id)}>
                        <span className="ticket-title">
                          {woNumber(s)} · {s.customerName ?? s.siteName}
                        </span>
                        <span className="ticket-time">
                          {minuteLabel(s.startMinute)} · {hoursText(s.allocatedHours)}
                        </span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ month, onPickDay }: { month: string; onPickDay: (day: string) => void }) {
  const query = useQuery({ queryKey: ["dispatch-month", month], queryFn: () => api.get<{ month: string; today: string; capacityPerDay: number; days: { day: string; open: number; assigned: number; hours: number; returns: number; parts: number; unassigned: number }[] }>(`/dispatch/month${qs({ month })}`) });
  if (!query.data) return <Loading label="Loading the month" />;
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) => (i < offset ? null : `${month}-${String(i - offset + 1).padStart(2, "0")}`));
  return (
    <div className="page">
      <div className="row between wrap" style={{ marginBottom: 12 }}>
        <h2>{new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
        <div className="legend">
          <span><span className="dot steel" />Scheduled</span>
          <span><span className="dot copper" />Over capacity</span>
          <span><span className="dot red" />Unassigned</span>
        </div>
      </div>
      <div className="month-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="dow">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`pad-${i}`} />;
          const row = query.data.days.find((x) => x.day === day);
          const pct = query.data.capacityPerDay ? Math.round(((row?.hours ?? 0) / query.data.capacityPerDay) * 100) : 0;
          return (
            <button key={day} type="button" className={`mday${day === query.data.today ? " today" : ""}`} onClick={() => onPickDay(day)} style={{ textAlign: "left" }}>
              <span className="d">{Number(day.slice(8))}</span>
              {row ? (
                <span className="small">
                  {row.assigned} assigned{row.unassigned ? <span style={{ color: "var(--red)" }}> · {row.unassigned} open</span> : null}
                  {row.parts ? ` · ${row.parts} parts` : ""}
                </span>
              ) : null}
              <div className="load">
                <i className={pct > 95 ? "hot" : ""} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { Icon };
