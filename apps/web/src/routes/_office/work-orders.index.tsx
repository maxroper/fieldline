import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { dayLabel, hoursText, minuteLabel, statusLabel, woNumber, woTone } from "../../app/format";
import { useSettings, workOrdersQuery } from "../../app/queries";
import { Button, Chip, Empty, Field, Input, Loading, Pill, Select, Sheet, SummaryLine } from "../../design/components";

const search = z.object({
  q: z.string().optional(),
  view: z.enum(["open", "mine", "waiting", "overdue", "warranty", "week", "all"]).default("open"),
  techId: z.string().optional(),
  callType: z.string().optional(),
  priority: z.string().optional(),
  sort: z.enum(["priority", "oldest", "newest"]).optional(),
});

export const Route = createFileRoute("/_office/work-orders/")({ validateSearch: search, component: WorkOrdersPage });

function WorkOrdersPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const settings = useSettings();
  const me = Route.useRouteContext().me;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  const apiParams: Record<string, string | undefined> = {
    q: params.q,
    status: params.view === "all" ? undefined : params.view === "waiting" || params.view === "overdue" || params.view === "warranty" ? "open" : params.view === "week" ? "open" : "open",
    techId: params.view === "mine" ? me.session?.userId : params.techId,
    callType: params.callType,
    priority: params.priority,
    sort: params.sort,
    wait: params.view === "waiting" ? "parts" : params.view === "warranty" ? "warranty" : undefined,
    from: params.view === "week" ? today : undefined,
    to: params.view === "week" ? weekEnd : undefined,
    limit: "300",
  };
  const query = useQuery(workOrdersQuery(apiParams));
  const rows = (query.data?.workOrders ?? []).filter((w) => (params.view === "overdue" ? w.scheduledFor && w.scheduledFor < today && w.status === "open" : true));
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const active = [params.techId, params.callType, params.priority, params.sort].filter(Boolean).length;
  const techs = settings.data?.users.filter((u) => u.role === "tech") ?? [];

  const exportCsv = () => {
    const lines = ["number,customer,site,city,type,priority,status,tech,date,start,hours,problem", ...rows.map((w) => [woNumber(w), w.customerName, w.siteName, w.siteCity, w.callType, w.priority, w.status, w.techName, w.scheduledFor, w.startMinute != null ? minuteLabel(w.startMinute) : "", w.allocatedHours, w.title].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "work-orders.csv";
    a.click();
  };

  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {([["open", "All open"], ["mine", "Mine"], ["waiting", "Waiting"], ["overdue", "Overdue"], ["warranty", "Warranty"], ["week", "This week"], ["all", "Everything"]] as const).map(([v, label]) => (
            <Chip key={v} on={params.view === v} onClick={() => setSearch({ view: v })}>
              {label}
            </Chip>
          ))}
        </div>
        <div className="search" style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <input className="input" id="wo-search" type="search" placeholder="Number, customer, site, or problem" defaultValue={params.q ?? ""} onKeyDown={(e) => e.key === "Enter" && setSearch({ q: (e.target as HTMLInputElement).value || undefined })} />
        </div>
        <Button size="sm" tone="ghost" icon="filter" onClick={() => setFiltersOpen(true)}>
          Filters{active ? ` · ${active}` : ""}
        </Button>
        <span className="grow" />
        <Button size="sm" tone="ghost" onClick={exportCsv}>
          Export
        </Button>
      </div>
      <div className="page">
        {query.isLoading ? <Loading /> : null}
        {query.data ? (
          <div className="stack loose">
            <SummaryLine items={[{ value: rows.length, label: "work orders" }, { dot: "red", value: rows.filter((w) => w.priority === "urgent").length, label: "urgent" }, { dot: "rust", value: rows.filter((w) => w.waitingOnParts).length, label: "waiting on parts" }, { dot: "steel", value: rows.filter((w) => !w.assignedTechId).length, label: "unassigned" }]} />
            {rows.length === 0 ? <Empty title="No work orders match">Change the view or clear the filters.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Number</th><th>Customer</th><th>Site</th><th>City</th><th>Type</th><th>Priority</th><th>Status</th><th>Wait</th><th>Tech</th><th>Date</th><th className="num">Hours</th><th>Problem</th>
                    </tr>
                  </thead>
                  <tbody className="stagger">
                    {rows.map((w) => (
                      <tr key={w.id} className="clickable" onClick={() => navigate({ to: "/work-orders/$id", params: { id: w.id } })}>
                        <td className="num primary-cell">{woNumber(w)}</td>
                        <td className="primary-cell">{w.customerName}</td>
                        <td>{w.siteName}</td>
                        <td>{w.siteCity}</td>
                        <td>{statusLabel(w.callType)}{w.billingType === "nte" ? " · NTE" : ""}</td>
                        <td>{w.priority === "urgent" ? <Pill tone="urgent">Urgent</Pill> : statusLabel(w.priority)}</td>
                        <td><Pill tone={woTone(w)}>{w.status === "open" && w.techStatus ? statusLabel(w.techStatus) : statusLabel(w.status)}</Pill></td>
                        <td>{w.followUp ? statusLabel(w.followUp.reason) : w.needReturn ? "Need to return" : ""}</td>
                        <td>{w.techName ?? <span className="muted">Unassigned</span>}</td>
                        <td className="num">{w.scheduledFor ? `${dayLabel(w.scheduledFor)}${w.startMinute != null ? ` ${minuteLabel(w.startMinute)}` : ""}` : ""}</td>
                        <td className="num">{hoursText(w.allocatedHours)}</td>
                        <td className="truncate" style={{ maxWidth: 260 }}>{w.title}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" footer={<><Button tone="ghost" onClick={() => setSearch({ techId: undefined, callType: undefined, priority: undefined, sort: undefined })}>Clear</Button><Button tone="primary" onClick={() => setFiltersOpen(false)}>Apply</Button></>}>
        <Field label="Technician"><Select value={params.techId ?? ""} onChange={(e) => setSearch({ techId: e.target.value || undefined })}><option value="">Any</option><option value="unassigned">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Type"><Select value={params.callType ?? ""} onChange={(e) => setSearch({ callType: e.target.value || undefined })}><option value="">Any</option><option value="service">Service</option><option value="maintenance">Maintenance</option><option value="quoted">Quoted job</option></Select></Field>
        <Field label="Priority"><Select value={params.priority ?? ""} onChange={(e) => setSearch({ priority: e.target.value || undefined })}><option value="">Any</option><option value="urgent">Urgent</option><option value="normal">Normal</option><option value="low">Low</option></Select></Field>
        <Field label="Sort"><Select value={params.sort ?? "priority"} onChange={(e) => setSearch({ sort: e.target.value as "priority" })}><option value="priority">Priority, then age</option><option value="oldest">Oldest first</option><option value="newest">Newest first</option></Select></Field>
        <Field label="Search"><Input defaultValue={params.q ?? ""} onBlur={(e) => setSearch({ q: e.target.value || undefined })} placeholder="Number, customer, site, or problem" /></Field>
      </Sheet>
    </>
  );
}
