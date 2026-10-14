import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../app/api";
import { dayLabel, elapsed, hoursText, minuteLabel, money, siteUrl, stampLabel, statusLabel, timeLabel, woNumber, woTone } from "../../app/format";
import { useAction, useSettings, workOrderQuery, type WorkOrderDetail } from "../../app/queries";
import { BackBar, Button, Card, Check, Empty, ErrorBox, Facts, Field, Input, Loading, Pill, Select, Sheet, StatusTrack, Tabs, Textarea } from "../../design/components";
import { BillPreview } from "../../features/billing/BillPreview";
import { FilePhoto } from "../../features/files/FilePhoto";

export const Route = createFileRoute("/_office/work-orders/$id")({ component: WorkOrderPage });

type Tab = "overview" | "time" | "parts" | "quotes" | "compliance" | "photos" | "billing";

function WorkOrderPage() {
  const { id } = Route.useParams();
  const query = useQuery(workOrderQuery(id));
  const [tab, setTab] = useState<Tab>("overview");
  if (query.isLoading) return <Loading label="Loading the work order" />;
  if (query.error || !query.data) return <div className="page"><ErrorBox error={query.error ?? "Not found"} /></div>;
  const d = query.data;
  const wo = d.workOrder;
  const counts = { time: d.timeEntries.filter((e) => e.e.kind === "labor" || e.e.kind === "travel").length, parts: d.purchaseOrders.length + d.truckParts.length, quotes: d.quotes.length, compliance: d.refrigerantLogs.length + d.checklists.length + d.permits.length, photos: d.files.filter((f) => f.kind === "photo").length + d.notes.length };
  return (
    <>
      <BackBar to="/dispatch" place="Dispatch board" />
      <div className="page">
        <Header d={d} />
        <div className="two-col loose mt-3" style={{ gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 32 }}>
          <div className="stack loose">
            <Tabs value={tab} onChange={setTab} tabs={[{ value: "overview", label: "Overview" }, { value: "time", label: "Time", count: counts.time }, { value: "parts", label: "Parts & POs", count: counts.parts }, { value: "quotes", label: "Quotes", count: counts.quotes }, { value: "compliance", label: "Compliance", count: counts.compliance }, { value: "photos", label: "Photos & notes", count: counts.photos }, { value: "billing", label: "Billing", count: wo.status === "billed" ? "Billed" : wo.billingType.toUpperCase() }]} />
            {tab === "overview" ? <OverviewTab d={d} /> : null}
            {tab === "time" ? <TimeTab d={d} /> : null}
            {tab === "parts" ? <PartsTab d={d} /> : null}
            {tab === "quotes" ? <QuotesTab d={d} /> : null}
            {tab === "compliance" ? <ComplianceTab d={d} /> : null}
            {tab === "photos" ? <PhotosTab d={d} /> : null}
            {tab === "billing" ? <BillingTab d={d} /> : null}
          </div>
          <SideColumn d={d} />
        </div>
      </div>
    </>
  );
}

function Header({ d }: { d: WorkOrderDetail }) {
  const wo = d.workOrder;
  const setStatus = useAction((status: "open" | "closed") => api.post(`/work-orders/${wo.id}/status`, { status, version: wo.version }), { success: "Status updated" });
  const steps = [{ key: "sched", label: "Scheduled", at: wo.scheduledFor ? minuteLabel(wo.startMinute) : undefined }, { key: "en_route", label: "En route" }, { key: "on_site", label: "On site" }, { key: "done", label: "Done" }, { key: "billed", label: "Billed" }];
  const current = wo.status === "billed" ? "billed" : wo.status === "closed" || wo.techStatus === "done" ? "done" : wo.techStatus === "on_site" || wo.techStatus === "paused" ? "on_site" : wo.techStatus === "en_route" ? "en_route" : wo.scheduledFor ? "sched" : null;
  return (
    <div className="stack">
      <div className="row top between wrap gap-3">
        <div className="stack tight">
          <div className="row wrap gap-2">
            <span className="num strong" style={{ fontSize: 26 }}>{woNumber(wo)}</span>
            <h1 style={{ fontSize: 22 }}>{wo.title}</h1>
          </div>
          <div className="row wrap gap-2">
            <Pill tone={woTone(wo)}>{wo.status === "open" && wo.techStatus ? `${statusLabel(wo.techStatus)}${wo.techStatusAt && wo.techStatus !== "done" ? ` · ${elapsed(wo.techStatusAt)}` : ""}` : statusLabel(wo.status)}</Pill>
            {wo.warranty ? <Pill tone="warranty" plain>Warranty</Pill> : null}
            {wo.priority === "urgent" ? <Pill tone="urgent" plain>Urgent</Pill> : null}
            <Pill tone="open" plain>{statusLabel(wo.callType)} · {wo.billingType.toUpperCase()}{wo.nteAmount ? ` ${money(wo.nteAmount)}` : ""}{wo.quotedAmount ? ` ${money(wo.quotedAmount)}` : ""}</Pill>
            {d.agreement ? <Pill tone="copper" plain>{d.agreement.name}{d.agreement.responseHours ? ` · ${d.agreement.responseHours} h response` : ""}</Pill> : null}
          </div>
          <div className="small muted">
            {[wo.customerName, wo.siteName, d.site?.address, wo.techName ? `${wo.techName}, lead` : "Unassigned", wo.scheduledFor ? `${dayLabel(wo.scheduledFor)}${wo.startMinute != null ? ` ${minuteLabel(wo.startMinute)}` : ""}` : null, wo.allocatedHours ? `est. ${hoursText(wo.allocatedHours)}` : null].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="stack tight">
          <span className="eyebrow">Work order status</span>
          <div className="btn-group">
            <Button size="sm" tone={wo.status === "open" ? "primary" : "default"} onClick={() => wo.status !== "open" && setStatus.mutate("open")} disabled={wo.status === "billed"}>Open</Button>
            <Button size="sm" tone={wo.status === "closed" ? "primary" : "default"} onClick={() => wo.status !== "closed" && setStatus.mutate("closed")} disabled={wo.status === "billed"}>Completed</Button>
            <Button size="sm" disabled>{wo.status === "billed" ? "Billed" : "Billed from Billing"}</Button>
          </div>
        </div>
      </div>
      <StatusTrack steps={steps} current={current} />
    </div>
  );
}

function OverviewTab({ d }: { d: WorkOrderDetail }) {
  const wo = d.workOrder;
  const settings = useSettings();
  const [form, setForm] = useState({ description: wo.description, dispatchNote: wo.dispatchNote, priority: wo.priority, callType: wo.callType, billingType: wo.billingType, nteAmount: wo.nteAmount ?? "", assignedTechId: wo.assignedTechId ?? "", scheduledFor: wo.scheduledFor ?? "", startMinute: wo.startMinute ?? "", allocatedHours: wo.allocatedHours ?? "" });
  useEffect(() => setForm({ description: wo.description, dispatchNote: wo.dispatchNote, priority: wo.priority, callType: wo.callType, billingType: wo.billingType, nteAmount: wo.nteAmount ?? "", assignedTechId: wo.assignedTechId ?? "", scheduledFor: wo.scheduledFor ?? "", startMinute: wo.startMinute ?? "", allocatedHours: wo.allocatedHours ?? "" }), [wo]);
  const save = useAction(() => api.patch(`/work-orders/${wo.id}`, { description: form.description, dispatchNote: form.dispatchNote, priority: form.priority, callType: form.callType, billingType: form.billingType, nteAmount: form.nteAmount === "" ? null : Number(form.nteAmount), assignedTechId: form.assignedTechId || null, scheduledFor: form.scheduledFor || null, startMinute: form.startMinute === "" ? null : Number(form.startMinute), allocatedHours: form.allocatedHours === "" ? null : Number(form.allocatedHours), version: wo.version }), { success: "Saved" });
  const [followUp, setFollowUp] = useState({ reason: wo.followUp?.reason ?? "", date: wo.followUp?.date ?? "", note: wo.followUp?.note ?? "", part: wo.followUp?.part ?? "", expectedDate: wo.followUp?.expectedDate ?? "" });
  const setFollow = useAction(() => api.post(`/work-orders/${wo.id}/follow-up`, { reason: followUp.reason || null, date: followUp.date || null, note: followUp.note, part: followUp.part, expectedDate: followUp.expectedDate || null }), { success: "Follow-up saved" });
  const navigate = useNavigate();
  const [returnOpen, setReturnOpen] = useState(false);
  const [ret, setRet] = useState({ scheduledFor: "", startMinute: "480", allocatedHours: "2", techId: wo.assignedTechId ?? "", note: "", waitingOnParts: false });
  const createReturn = useAction(() => api.post<{ workOrder: { id: string } }>(`/work-orders/${wo.id}/return-visit`, { scheduledFor: ret.scheduledFor || null, startMinute: Number(ret.startMinute), allocatedHours: Number(ret.allocatedHours), techId: ret.techId || null, note: ret.note, waitingOnParts: ret.waitingOnParts }), { success: "Return visit created", onSuccess: (r) => navigate({ to: "/work-orders/$id", params: { id: r.workOrder.id } }) });
  const techs = settings.data?.users.filter((u) => u.role === "tech" && u.active) ?? [];
  const dirty = JSON.stringify(form) !== JSON.stringify({ description: wo.description, dispatchNote: wo.dispatchNote, priority: wo.priority, callType: wo.callType, billingType: wo.billingType, nteAmount: wo.nteAmount ?? "", assignedTechId: wo.assignedTechId ?? "", scheduledFor: wo.scheduledFor ?? "", startMinute: wo.startMinute ?? "", allocatedHours: wo.allocatedHours ?? "" });
  return (
    <div className="stack loose">
      <Field label="Problem"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></Field>
      <Field label="Dispatcher notes to technician" help={wo.techName ? `Shown pinned at the top of ${wo.techName.split(" ")[0]}'s phone.` : undefined}><Textarea value={form.dispatchNote} onChange={(e) => setForm({ ...form, dispatchNote: e.target.value })} rows={3} /></Field>
      <div className="field-grid">
        <Field label="WO type"><Select value={form.callType} onChange={(e) => setForm({ ...form, callType: e.target.value as typeof form.callType, billingType: e.target.value === "quoted" ? "quoted" : form.billingType === "quoted" ? "tm" : form.billingType })}><option value="service">Service</option><option value="maintenance">Maintenance</option><option value="quoted">Quoted job</option></Select></Field>
        <Field label="Billing"><Select value={form.billingType} onChange={(e) => setForm({ ...form, billingType: e.target.value as typeof form.billingType })} disabled={form.callType === "quoted"}><option value="tm">T&M</option><option value="nte">T&M, not to exceed</option><option value="quoted">Quoted</option></Select></Field>
        {form.billingType === "nte" ? <Field label="NTE amount"><Input type="number" value={form.nteAmount} onChange={(e) => setForm({ ...form, nteAmount: e.target.value })} /></Field> : null}
        <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as typeof form.priority })}><option value="urgent">Urgent</option><option value="normal">Normal</option><option value="low">Low</option></Select></Field>
        <Field label="Technician"><Select value={form.assignedTechId} onChange={(e) => setForm({ ...form, assignedTechId: e.target.value })}><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Date"><Input type="date" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} /></Field>
        <Field label="Start"><Select value={form.startMinute} onChange={(e) => setForm({ ...form, startMinute: e.target.value })}><option value="">Not set</option>{Array.from({ length: 44 }, (_, i) => 6 * 60 + i * 15).map((m) => <option key={m} value={m}>{minuteLabel(m)}</option>)}</Select></Field>
        <Field label="Estimated hours"><Input type="number" step="0.25" value={form.allocatedHours} onChange={(e) => setForm({ ...form, allocatedHours: e.target.value })} /></Field>
      </div>
      <div className="row gap-2">
        <Button tone="primary" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>Save</Button>
        {dirty ? <span className="small muted">Unsaved changes</span> : null}
      </div>
      <hr className="divider" />
      <div className="two-col">
        <Card title="Follow-up" flat>
          <div className="stack">
            <Field label="Wait reason"><Select value={followUp.reason} onChange={(e) => setFollowUp({ ...followUp, reason: e.target.value })}><option value="">None</option><option value="parts">Waiting on parts</option><option value="quote_sent">Quote sent</option><option value="approved">Approved, not scheduled</option><option value="return">Need to return</option><option value="no_access">No access</option><option value="warranty">Warranty pending</option></Select></Field>
            <div className="field-grid">
              <Field label="Follow-up date"><Input type="date" value={followUp.date} onChange={(e) => setFollowUp({ ...followUp, date: e.target.value })} /></Field>
              {followUp.reason === "parts" ? <Field label="Part expected"><Input type="date" value={followUp.expectedDate} onChange={(e) => setFollowUp({ ...followUp, expectedDate: e.target.value })} /></Field> : null}
            </div>
            {followUp.reason === "parts" ? <Field label="Part"><Input value={followUp.part} onChange={(e) => setFollowUp({ ...followUp, part: e.target.value })} /></Field> : null}
            <Field label="Note"><Input value={followUp.note} onChange={(e) => setFollowUp({ ...followUp, note: e.target.value })} /></Field>
            <div><Button size="sm" onClick={() => setFollow.mutate()}>Set follow-up</Button></div>
          </div>
        </Card>
        <Card title="Return visit" flat>
          <p className="small muted">A return visit keeps the number and gets the next trip: {wo.number}-{Math.max(...d.trips.map((t) => t.trip)) + 1}. The job bills as one.</p>
          <div className="mt-2"><Button size="sm" onClick={() => setReturnOpen(true)}>Schedule return trip</Button></div>
          {d.trips.length > 1 ? (
            <div className="stack tight mt-2 small">
              {d.trips.map((t) => (
                <Link key={t.id} to="/work-orders/$id" params={{ id: t.id }} className="nav-link">
                  {woNumber(t)} · {statusLabel(t.status)}{t.id === wo.id ? " (this one)" : ""}
                </Link>
              ))}
            </div>
          ) : null}
        </Card>
      </div>
      <Sheet open={returnOpen} onClose={() => setReturnOpen(false)} title={`Return visit ${wo.number}-${Math.max(...d.trips.map((t) => t.trip)) + 1}`} footer={<><Button tone="ghost" onClick={() => setReturnOpen(false)}>Cancel</Button><Button tone="copper" onClick={() => createReturn.mutate()}>Create {wo.number}-{Math.max(...d.trips.map((t) => t.trip)) + 1}</Button></>}>
        <div className="field-grid">
          <Field label="Date"><Input type="date" value={ret.scheduledFor} onChange={(e) => setRet({ ...ret, scheduledFor: e.target.value })} /></Field>
          <Field label="Start"><Select value={ret.startMinute} onChange={(e) => setRet({ ...ret, startMinute: e.target.value })}>{Array.from({ length: 44 }, (_, i) => 6 * 60 + i * 15).map((m) => <option key={m} value={m}>{minuteLabel(m)}</option>)}</Select></Field>
          <Field label="Hours"><Input type="number" step="0.25" value={ret.allocatedHours} onChange={(e) => setRet({ ...ret, allocatedHours: e.target.value })} /></Field>
          <Field label="Technician"><Select value={ret.techId} onChange={(e) => setRet({ ...ret, techId: e.target.value })}><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        </div>
        <Field label="Note for the tech"><Textarea value={ret.note} onChange={(e) => setRet({ ...ret, note: e.target.value })} /></Field>
        <Check on={ret.waitingOnParts} onChange={(v) => setRet({ ...ret, waitingOnParts: v })} label="Waiting on parts" />
      </Sheet>
    </div>
  );
}

function TimeTab({ d }: { d: WorkOrderDetail }) {
  const wo = d.workOrder;
  const settings = useSettings();
  const [adding, setAdding] = useState(false);
  const [entry, setEntry] = useState({ techId: wo.assignedTechId ?? "", kind: "labor", date: wo.scheduledFor ?? new Date().toISOString().slice(0, 10), hours: "1" });
  const add = useAction(() => api.post("/time/entries", { workOrderId: wo.id, techId: entry.techId, kind: entry.kind, date: entry.date, hours: Number(entry.hours), edited: true }), { success: "Time added", onSuccess: () => setAdding(false) });
  const techs = settings.data?.users.filter((u) => u.role === "tech") ?? [];
  const rows = d.timeEntries.filter((e) => e.e.kind === "labor" || e.e.kind === "travel");
  return (
    <div className="stack loose">
      <div className="row between wrap">
        <div className="summary-line"><span><b>{hoursText(d.bill.labor.filter((l) => l.kind === "Labor").reduce((s, l) => s + l.hours, 0))}</b> labor</span><span><b>{hoursText(d.bill.labor.filter((l) => l.kind === "Travel").reduce((s, l) => s + l.hours, 0))}</b> travel</span>{d.bill.clockRunning ? <span className="live">clock running</span> : null}</div>
        <Button size="sm" onClick={() => setAdding(true)}>Add time</Button>
      </div>
      {rows.length === 0 ? <Empty title="No time charged yet">The tech's status buttons write time here; the office can add a line too.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Who</th><th>Kind</th><th>Start</th><th>Arrived</th><th>Stop</th><th className="num">Hours</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.e.id}>
                  <td className="num">{dayLabel(row.e.date)}</td>
                  <td>{row.techName}</td>
                  <td>{row.e.arrivedAt ? "Drive + labor" : statusLabel(row.e.kind)}</td>
                  <td className="num">{timeLabel(row.e.startedAt)}</td>
                  <td className="num">{timeLabel(row.e.arrivedAt)}</td>
                  <td className="num">{row.e.stoppedAt ? timeLabel(row.e.stoppedAt) : row.e.startedAt ? <span className="live">running</span> : ""}</td>
                  <td className="num">{row.e.edited ? row.e.hours : ""}</td>
                  <td className="small muted">{row.e.edited ? "Edited" : row.e.gpsVerified ? "GPS verified" : "Clock"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add time" footer={<><Button tone="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button tone="primary" onClick={() => add.mutate()}>Add</Button></>}>
        <div className="field-grid">
          <Field label="Technician"><Select value={entry.techId} onChange={(e) => setEntry({ ...entry, techId: e.target.value })}>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Kind"><Select value={entry.kind} onChange={(e) => setEntry({ ...entry, kind: e.target.value })}><option value="labor">Labor</option><option value="travel">Travel</option></Select></Field>
          <Field label="Date"><Input type="date" value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} /></Field>
          <Field label="Hours"><Input type="number" step="0.25" value={entry.hours} onChange={(e) => setEntry({ ...entry, hours: e.target.value })} /></Field>
        </div>
      </Sheet>
    </div>
  );
}

function PartsTab({ d }: { d: WorkOrderDetail }) {
  return (
    <div className="stack loose">
      <div className="row between wrap">
        <h3>Purchase orders</h3>
        <Link to="/purchasing" search={{ newFor: d.workOrder.id } as never} className="btn sm nav-link">Issue PO for this work order</Link>
      </div>
      {d.purchaseOrders.length === 0 ? <Empty title="No purchase orders">Parts bought for this job show here and land on the bill when received.</Empty> : (
        <div className="list">
          {d.purchaseOrders.map((po) => (
            <Link key={po.id} to="/purchasing" search={{ po: po.id } as never} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div>
                <div className="title">PO {po.number} · {po.vendorName}</div>
                <div className="sub">{po.lumpSum ? `Lump sum ${money(po.lumpSumAmount ?? 0)}` : po.lines.map((l) => `${l.description} ×${l.quantity}${l.receivedQty < l.quantity ? ` (${l.receivedQty} received)` : ""}`).join(" · ")}{po.expectedDate ? ` · expected ${dayLabel(po.expectedDate)}` : ""}</div>
              </div>
              <Pill tone={po.status === "received" || po.status === "invoiced" ? "site" : po.status === "partial" ? "parts" : "sched"}>{statusLabel(po.status)}</Pill>
            </Link>
          ))}
        </div>
      )}
      <h3>Parts from the truck</h3>
      {d.truckParts.length === 0 ? <p className="small muted">Nothing taken from a van yet. Techs add parts from their phone; the office can add direct material at billing.</p> : (
        <div className="table-wrap"><table className="table dense"><thead><tr><th>Part</th><th className="num">Qty</th><th className="num">Unit cost</th><th>Source</th></tr></thead><tbody>{d.truckParts.map((p) => <tr key={p.id}><td>{p.description}</td><td className="num">{p.quantity}</td><td className="num">{money(p.unitCost)}</td><td>{p.direct ? "Direct" : "Truck"}</td></tr>)}</tbody></table></div>
      )}
    </div>
  );
}

function QuotesTab({ d }: { d: WorkOrderDetail }) {
  return (
    <div className="stack loose">
      <div className="row between wrap">
        <h3>Quotes</h3>
        <Link to="/quoting/new" search={{ workOrderId: d.workOrder.id } as never} className="btn sm copper nav-link">New quote for something found</Link>
      </div>
      {d.quotes.length === 0 ? <Empty title="No quotes on this work order">Found something while on site? Start a quote; the customer can approve it from their phone.</Empty> : (
        <div className="list">
          {d.quotes.map((q) => (
            <Link key={q.id} to="/quoting/$id" params={{ id: q.id }} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div><div className="title">Quote {q.number} · {q.scope}</div><div className="sub">{q.createdWorkOrderId === d.workOrder.id ? "This job came from this quote" : "Found on this visit"}</div></div>
              <Pill tone={q.status === "approved" ? "site" : q.status === "declined" ? "hold" : "quote"}>{statusLabel(q.status)}</Pill>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ComplianceTab({ d }: { d: WorkOrderDetail }) {
  const wo = d.workOrder;
  const [log, setLog] = useState({ refrigerantType: d.equipment?.refrigerant || "R-410A", lbsAdded: "0", lbsRecovered: "0", cylinderId: "", leakCheck: "na", notes: "" });
  const addLog = useAction(() => api.post(`/work-orders/${wo.id}/refrigerant`, { ...log, lbsAdded: Number(log.lbsAdded), lbsRecovered: Number(log.lbsRecovered) }), { success: "Refrigerant logged" });
  const permit = d.permits[0];
  const [permitForm, setPermitForm] = useState({ jurisdiction: permit?.jurisdiction ?? "", permitNumber: permit?.permitNumber ?? "", status: permit?.status ?? "needed", notes: permit?.notes ?? "", filedOn: permit?.filedOn ?? "", finalOn: permit?.finalOn ?? "" });
  const savePermit = useAction(() => api.put(`/work-orders/${wo.id}/permit`, { ...permitForm, filedOn: permitForm.filedOn || null, finalOn: permitForm.finalOn || null }), { success: "Permit saved" });
  return (
    <div className="stack loose">
      <section className="section">
        <div className="section-head"><h3>Refrigerant log</h3><span className="small muted">EPA 608 · 40 CFR 84.106 · CARB</span></div>
        {d.refrigerantLogs.length ? (
          <div className="table-wrap"><table className="table dense"><thead><tr><th>When</th><th>Type</th><th className="num">Added</th><th className="num">Recovered</th><th>Cylinder</th><th>Leak check</th><th className="num">Leak rate</th><th>Cert</th></tr></thead><tbody>{d.refrigerantLogs.map((l) => <tr key={l.id}><td className="num">{stampLabel(l.loggedAt)}</td><td>{l.refrigerantType}</td><td className="num">{l.lbsAdded} lb</td><td className="num">{l.lbsRecovered} lb</td><td>{l.cylinderId}</td><td>{l.leakCheck === "failed" ? <Pill tone="urgent">Failed</Pill> : statusLabel(l.leakCheck)}</td><td className="num">{l.leakRatePercent != null ? <span style={{ color: l.leakRatePercent > 10 ? "var(--red)" : undefined }}>{l.leakRatePercent}%{l.leakRatePercent > 10 ? " · over 10% threshold" : ""}</span> : ""}</td><td className="small">{l.techCert}</td></tr>)}</tbody></table></div>
        ) : <p className="small muted">No refrigerant handled on this job yet.</p>}
        <div className="inline-form">
          <Field label="Type"><Input value={log.refrigerantType} onChange={(e) => setLog({ ...log, refrigerantType: e.target.value })} /></Field>
          <Field label="Added lb"><Input type="number" step="0.1" value={log.lbsAdded} onChange={(e) => setLog({ ...log, lbsAdded: e.target.value })} /></Field>
          <Field label="Recovered lb"><Input type="number" step="0.1" value={log.lbsRecovered} onChange={(e) => setLog({ ...log, lbsRecovered: e.target.value })} /></Field>
          <Field label="Cylinder"><Input value={log.cylinderId} onChange={(e) => setLog({ ...log, cylinderId: e.target.value })} /></Field>
          <Field label="Leak check"><Select value={log.leakCheck} onChange={(e) => setLog({ ...log, leakCheck: e.target.value })}><option value="na">Not done</option><option value="passed">Passed</option><option value="failed">Failed</option></Select></Field>
          <Button onClick={() => addLog.mutate()}>Log</Button>
        </div>
      </section>
      <section className="section">
        <div className="section-head"><h3>Checklists</h3></div>
        {d.checklists.length === 0 ? <p className="small muted">{d.checklistTemplates.filter((t) => t.trigger.callTypes?.includes(wo.callType)).map((t) => t.name).join(", ") || "No checklist"} is filled in by the tech on the phone.</p> : d.checklists.map((c) => (
          <Card key={c.r.id} title={c.template.name} flat actions={<span className="small muted">{c.r.items.filter((i) => i.result === "pass").length} pass · {c.r.items.filter((i) => i.result === "flag").length} flagged · {c.r.items.filter((i) => i.result === "fail").length} fail</span>}>
            <div className="stack tight small">
              {c.template.items.map((item) => {
                const answer = c.r.items.find((a) => a.key === item.key);
                return <div key={item.key} className="row between"><span>{item.label}{answer?.note ? <span className="muted"> · {answer.note}</span> : null}</span><Pill tone={answer?.result === "pass" ? "site" : answer?.result === "flag" ? "parts" : answer?.result === "fail" ? "urgent" : "hold"}>{answer ? statusLabel(answer.result) : "Open"}</Pill></div>;
              })}
            </div>
          </Card>
        ))}
      </section>
      <section className="section">
        <div className="section-head"><h3>Permit and Title 24</h3></div>
        <div className="field-grid">
          <Field label="Status"><Select value={permitForm.status} onChange={(e) => setPermitForm({ ...permitForm, status: e.target.value })}><option value="na">Not needed</option><option value="needed">Needed</option><option value="applied">Applied</option><option value="issued">Issued</option><option value="inspected">Inspected</option><option value="final">Final</option></Select></Field>
          <Field label="Jurisdiction"><Input value={permitForm.jurisdiction} onChange={(e) => setPermitForm({ ...permitForm, jurisdiction: e.target.value })} placeholder="City of Irvine" /></Field>
          <Field label="Permit number"><Input value={permitForm.permitNumber} onChange={(e) => setPermitForm({ ...permitForm, permitNumber: e.target.value })} /></Field>
          <Field label="Filed"><Input type="date" value={permitForm.filedOn} onChange={(e) => setPermitForm({ ...permitForm, filedOn: e.target.value })} /></Field>
          <Field label="Final"><Input type="date" value={permitForm.finalOn} onChange={(e) => setPermitForm({ ...permitForm, finalOn: e.target.value })} /></Field>
          <Field label="Notes"><Input value={permitForm.notes} onChange={(e) => setPermitForm({ ...permitForm, notes: e.target.value })} /></Field>
        </div>
        <div><Button size="sm" onClick={() => savePermit.mutate()}>Save permit</Button></div>
      </section>
      {d.warrantyClaims.length ? (
        <section className="section">
          <div className="section-head"><h3>Warranty</h3></div>
          {d.warrantyClaims.map((w) => <div key={w.id} className="small">{w.manufacturer} · {statusLabel(w.claimStatus)}{w.partsReturnBy ? ` · parts back by ${dayLabel(w.partsReturnBy)}` : ""} · {w.notes}</div>)}
        </section>
      ) : null}
    </div>
  );
}

function PhotosTab({ d }: { d: WorkOrderDetail }) {
  const wo = d.workOrder;
  const [note, setNote] = useState("");
  const addNote = useAction(() => api.post(`/work-orders/${wo.id}/notes`, { body: note }), { success: "Note added", onSuccess: () => setNote("") });
  const upload = useAction((file: File) => { const form = new FormData(); form.append("file", file); form.append("kind", "photo"); form.append("workOrderId", wo.id); return api.upload("/files", form); }, { success: "Photo added" });
  const photos = d.files.filter((f) => f.kind === "photo" || f.kind === "nameplate");
  return (
    <div className="stack loose">
      <section className="section">
        <div className="section-head"><h3>Photos</h3><label className="btn sm"><input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />Add photo</label></div>
        {photos.length === 0 ? <p className="small muted">No photos yet.</p> : (
          <div className="photo-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {photos.map((f) => <FilePhoto key={f.id} id={f.id} caption={f.caption} />)}
          </div>
        )}
      </section>
      {wo.summary ? <section className="section"><div className="section-head"><h3>Work performed</h3></div><p className="small">{wo.summary}</p>{wo.signerName ? <p className="small muted">Signed by {wo.signerName}</p> : null}</section> : null}
      <section className="section">
        <div className="section-head"><h3>Notes</h3></div>
        <div className="inline-form"><Field label="Add a note"><Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && note && addNote.mutate()} /></Field><Button onClick={() => addNote.mutate()} disabled={!note}>Add</Button></div>
        <div className="timeline">
          {d.notes.map((n) => <div key={n.n.id} className={`tl ${n.n.kind === "dispatch" ? "copper" : ""}`}><div className="when">{stampLabel(n.n.createdAt)}</div><div className="what">{n.n.body}</div><div className="who">{n.userName ?? "System"}</div></div>)}
        </div>
      </section>
      <section className="section">
        <div className="section-head"><h3>Change log</h3></div>
        <div className="timeline">{d.changes.map((c) => <div key={c.f.id} className="tl steel"><div className="when">{stampLabel(c.f.createdAt)}</div><div className="what">{c.f.field}: {c.f.fromValue ? `${c.f.fromValue} → ` : ""}{c.f.toValue}</div><div className="who">{c.userName ?? "System"}</div></div>)}</div>
      </section>
      {d.history.length ? (
        <section className="section">
          <div className="section-head"><h3>Site history</h3></div>
          <div className="list">{d.history.map((h) => <Link key={h.id} to="/work-orders/$id" params={{ id: h.id }} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}><div><div className="title">{woNumber(h)} · {h.title}</div><div className="sub">{dayLabel(h.scheduledFor)} · {h.techName ?? "unassigned"}</div></div><Pill tone={woTone(h)}>{statusLabel(h.status)}</Pill></Link>)}</div>
        </section>
      ) : null}
    </div>
  );
}

function BillingTab({ d }: { d: WorkOrderDetail }) {
  const wo = d.workOrder;
  const navigate = useNavigate();
  const createInvoice = useAction(() => api.post<{ id: string; number: number }>(`/billing/work-orders/${wo.id}/invoice`, { laborMode: "itemized", materialMode: "itemized", hideHourlyRate: false, descriptions: {}, dueInDays: 30 }), { success: (r) => `Invoice ${r.number} created`, onSuccess: () => navigate({ to: "/billing" }) });
  return (
    <div className="stack loose">
      {d.invoice ? (
        <Card title={`Invoice ${d.invoice.number}`} flat>
          <Facts rows={[["Status", statusLabel(d.invoice.status)], ["Billed", stampLabel(d.invoice.billedAt)], ["Due", dayLabel(d.invoice.dueDate)], ["Total", money(d.invoice.amount)]]} />
          <div className="mt-2"><Link to="/billing" search={{ invoice: d.invoice.id } as never} className="btn sm nav-link">Open in Billing</Link></div>
        </Card>
      ) : null}
      <BillPreview bill={d.bill} />
      {!d.invoice && wo.status === "closed" ? (
        <div className="row gap-2">
          <Button tone="copper" onClick={() => createInvoice.mutate()} disabled={d.bill.clockRunning || d.bill.amount == null}>Mark billed · {money(d.bill.amount ?? 0)}</Button>
          {d.bill.rateMissing ? <Link to="/settings" className="small nav-link" style={{ color: "var(--red)" }}>Set labor bill rates first</Link> : null}
        </div>
      ) : null}
      {!d.invoice && wo.status === "open" ? <p className="small muted">Set the work order to Completed when the tech is done; then it can be billed.</p> : null}
    </div>
  );
}

function SideColumn({ d }: { d: WorkOrderDetail }) {
  const wo = d.workOrder;
  const text = useAction((body: string) => api.post("/messages", { customerId: wo.customerId, workOrderId: wo.id, to: d.site?.contactPhone || d.customer?.phone || "", body }), { success: "Text sent" });
  const events = [
    ...d.changes.map((c) => ({ at: c.f.createdAt, what: `${c.f.field}: ${c.f.toValue}`, who: c.userName ?? "System", tone: "steel" })),
    ...d.notes.map((n) => ({ at: n.n.createdAt, what: n.n.body, who: n.userName ?? "", tone: "copper" })),
    ...d.messages.map((m) => ({ at: m.createdAt, what: `${m.direction === "out" ? "Text sent" : "Text received"}: ${m.body.slice(0, 80)}`, who: m.automated ? "Automatic" : "", tone: "amber" })),
    ...d.timeEntries.filter((e) => e.e.startedAt).map((e) => ({ at: e.e.startedAt!, what: `${e.e.arrivedAt ? "Drive and labor" : statusLabel(e.e.kind)} started`, who: e.techName, tone: "moss" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return (
    <aside className="stack loose">
      <div className="stack tight">
        <span className="eyebrow">Customer</span>
        <div className="strong">{wo.customerName}</div>
        {d.site ? <div className="small muted">{d.site.name} · {d.site.address}</div> : null}
        {d.site?.contact ? <div className="small">{d.site.contact} · <span className="num">{d.site.contactPhone}</span></div> : null}
        {wo.callerName ? <div className="small muted">Called in by {wo.callerName} {wo.callerPhone}</div> : null}
        {d.site?.accessNotes ? <div className="small">{d.site.accessNotes}</div> : null}
        <div className="row gap-2 mt-1">
          <Button size="sm" onClick={() => text.mutate(`Hi${d.site?.contact ? ` ${d.site.contact.split(" ")[0]}` : ""}, this is Harbor Coast Mechanical about ${woNumber(wo)}. ${wo.techName ? `${wo.techName.split(" ")[0]} ${wo.techStatus === "on_site" ? "is on site now" : wo.techStatus === "en_route" ? "is on the way" : `is scheduled ${wo.scheduledFor ? dayLabel(wo.scheduledFor) : "soon"}`}.` : "We will text when a technician is on the way."}`)}>Text customer</Button>
          {wo.customerId ? <Link to="/customers/$id" params={{ id: wo.customerId }} className="btn sm ghost nav-link">Customer</Link> : null}
          {wo.siteId ? <Link to="/sites/$id" params={{ id: wo.siteId }} className="btn sm ghost nav-link">Site</Link> : null}
        </div>
      </div>
      {d.equipment ? (
        <div className="stack tight">
          <span className="eyebrow">Equipment</span>
          <div className="strong">{d.equipment.tag} · {d.equipment.make} {d.equipment.model}</div>
          <div className="small muted">{[d.equipment.serial ? `SN ${d.equipment.serial}` : null, d.equipment.refrigerant, d.equipment.chargeLbs ? `${d.equipment.chargeLbs} lb charge` : null, d.equipment.installYear ? `installed ${d.equipment.installYear}` : null].filter(Boolean).join(" · ")}</div>
          {d.equipment.warrantyPartsUntil ? <Pill tone="warranty" plain>Parts warranty to {d.equipment.warrantyPartsUntil.slice(0, 4)}</Pill> : null}
        </div>
      ) : null}
      {d.helpers.length ? <div className="stack tight"><span className="eyebrow">Crew</span>{d.helpers.map((h) => <div key={h.h.id} className="small">{h.techName} · helper{h.h.scheduledFor ? ` · ${dayLabel(h.h.scheduledFor)}` : ""}</div>)}</div> : null}
      <div className="stack tight">
        <span className="eyebrow">Timeline</span>
        <div className="timeline">{events.map((e, i) => <div key={i} className={`tl ${e.tone}`}><div className="when">{stampLabel(e.at)}</div><div className="what">{e.what}</div><div className="who">{e.who}</div></div>)}</div>
      </div>
      {wo.trackingToken ? <div className="small muted">Customer tracking link: <a href={siteUrl(`/t/${wo.trackingToken}`)} target="_blank" rel="noreferrer">/t/{wo.trackingToken}</a></div> : null}
    </aside>
  );
}
