import { AGREEMENT_BILLING, AGREEMENT_STATUSES, AGREEMENT_TIERS } from "@fieldline/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../app/api";
import { dayLabel, minuteLabel, money, statusLabel, woNumber } from "../../app/format";
import { useAction, useSettings } from "../../app/queries";
import type { AgreementRow, AgreementVisitRow, CustomerRow, EquipmentRow, InvoiceRow, SiteRow } from "../../app/types";
import { BackBar, Button, Card, Check, ErrorBox, Facts, Field, Input, Loading, Pill, Select, Sheet, Textarea } from "../../design/components";

interface AgreementDetail {
  agreement: AgreementRow;
  customer: CustomerRow | null;
  site: SiteRow | null;
  assets: { asset: { id: string; equipmentId: string }; unit: EquipmentRow }[];
  visits: { v: AgreementVisitRow; woNumber: number | null; woTrip: number | null; techName: string | null; scheduledFor: string | null }[];
  invoices: InvoiceRow[];
  siteEquipment: EquipmentRow[];
}

export const Route = createFileRoute("/_office/agreements/$id")({ component: AgreementPage });

function AgreementPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["agreement", id], queryFn: () => api.get<AgreementDetail>(`/agreements/${id}`) });
  const navigate = useNavigate();
  const settings = useSettings();
  const [editing, setEditing] = useState(false);
  const [scheduling, setScheduling] = useState<AgreementVisitRow | null>(null);
  const [sched, setSched] = useState({ scheduledFor: "", techId: "", startMinute: "480", allocatedHours: "" });
  const generate = useAction((season: string) => api.post<{ created: number }>("/agreements/generate", { season, agreementId: id }), { success: (r) => (r.created ? `${r.created} visit${r.created === 1 ? "" : "s"} added` : "Visits already exist for that season") });
  const schedule = useAction(() => api.post<{ workOrderId: string; number: number }>(`/agreements/visits/${scheduling?.id}/schedule`, { scheduledFor: sched.scheduledFor, techId: sched.techId || null, startMinute: Number(sched.startMinute), allocatedHours: sched.allocatedHours ? Number(sched.allocatedHours) : undefined }), { success: (r) => `Work order ${r.number} created`, onSuccess: (r) => { setScheduling(null); navigate({ to: "/work-orders/$id", params: { id: r.workOrderId } }); } });
  const setAssets = useAction((equipmentIds: string[]) => api.patch(`/agreements/${id}`, { equipmentIds }), { success: "Covered equipment updated" });
  if (query.isLoading) return <Loading label="Loading the agreement" />;
  if (query.error || !query.data) return <div className="page"><ErrorBox error={query.error ?? "Not found"} /></div>;
  const d = query.data;
  const a = d.agreement;
  const techs = settings.data?.users.filter((u) => u.role === "tech" && u.active) ?? [];
  const covered = new Set(d.assets.map((x) => x.asset.equipmentId));
  const today = new Date().toISOString().slice(0, 10);
  const renewalSoon = a.endsOn <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  return (
    <>
      <BackBar to="/agreements" place="Agreements" />
      <div className="page">
        <div className="row top between wrap gap-3">
          <div className="stack tight">
            <h1 style={{ fontSize: 24 }}>{a.name}</h1>
            <div className="row wrap gap-2">
              <Pill tone={a.status === "active" ? "site" : "hold"}>{statusLabel(a.status)}</Pill>
              <Pill tone={a.tier === "gold" ? "copper" : "sched"} plain>{statusLabel(a.tier)}</Pill>
              {renewalSoon && a.status === "active" ? <Pill tone="parts" plain>Renews {dayLabel(a.endsOn)}{a.autoRenew ? " automatically" : ", needs a call"}</Pill> : null}
              {a.responseHours ? <Pill tone="open" plain>{a.responseHours} h response promise</Pill> : null}
            </div>
            <div className="small muted">
              {d.customer ? <Link to="/customers/$id" params={{ id: d.customer.id }} className="nav-link">{d.customer.name}</Link> : null}
              {d.site ? <> · <Link to="/sites/$id" params={{ id: d.site.id }} className="nav-link">{d.site.name || d.site.address}</Link></> : null}
            </div>
          </div>
          <div className="row gap-2">
            <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
          </div>
        </div>
        <div className="two-col loose mt-3">
          <div className="stack loose">
            <section className="section">
              <div className="section-head">
                <h3>Visits</h3>
                <div className="row gap-2"><Button size="sm" tone="ghost" onClick={() => generate.mutate("spring")}>Add spring</Button><Button size="sm" tone="ghost" onClick={() => generate.mutate("fall")}>Add fall</Button></div>
              </div>
              {d.visits.length === 0 ? <p className="small muted">No visits generated yet. Add a season to create the planned visits; scheduling one creates the maintenance work order.</p> : (
                <div className="list">
                  {d.visits.map(({ v, woNumber: n, woTrip, techName, scheduledFor }) => (
                    <div key={v.id} className="item" style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}>
                      <span className={`visit-dot ${v.status}`} />
                      <div>
                        <div className="title">{statusLabel(v.season)} visit · due {dayLabel(v.dueOn)}</div>
                        <div className="sub">{v.workOrderId && n ? <Link to="/work-orders/$id" params={{ id: v.workOrderId }} className="nav-link">WO {woNumber({ number: n, trip: woTrip })}{scheduledFor ? ` · ${dayLabel(scheduledFor)}` : ""}{techName ? ` · ${techName}` : ""}</Link> : v.status === "unscheduled" && v.dueOn < today ? <span style={{ color: "var(--red)" }}>Past due, not scheduled</span> : statusLabel(v.status)}</div>
                      </div>
                      {v.status === "unscheduled" ? <Button size="sm" tone="copper" onClick={() => { setScheduling(v); setSched({ scheduledFor: v.dueOn, techId: d.site?.primaryTechId ?? "", startMinute: "480", allocatedHours: String(Math.max(1, d.assets.length * 1.25)) }); }}>Schedule</Button> : <Pill tone={v.status === "done" ? "done" : "sched"}>{statusLabel(v.status)}</Pill>}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="section">
              <div className="section-head"><h3>Covered equipment</h3><span className="small muted">{d.assets.length} of {d.siteEquipment.length} units at the site</span></div>
              <div className="grid auto">
                {d.siteEquipment.map((u) => (
                  <div key={u.id} className="card flat">
                    <Check on={covered.has(u.id)} onChange={(v) => setAssets.mutate(v ? [...covered, u.id] : [...covered].filter((x) => x !== u.id))} label={<span><b>{u.tag}</b> · {u.make} {u.model}{u.installYear ? ` · ${u.installYear}` : ""}</span>} />
                  </div>
                ))}
                {d.siteEquipment.length === 0 ? <p className="small muted">No equipment on this site yet. Add units on the site page.</p> : null}
              </div>
            </section>
            <section className="section">
              <div className="section-head"><h3>What is included</h3></div>
              <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>{a.includedServices.map((s, i) => <li key={i}>{s}</li>)}</ul>
              {a.notes ? <p className="small muted">{a.notes}</p> : null}
            </section>
          </div>
          <aside className="stack loose">
            <Card title="Terms" flat>
              <Facts tight rows={[["Term", `${dayLabel(a.startsOn)} – ${dayLabel(a.endsOn)}`], ["Billing", statusLabel(a.billingMethod)], ["Amount", `${money(a.amount)}${a.billingMethod === "monthly_card" ? " a month" : " a year"}`], ["Per visit", a.visitAmount != null ? money(a.visitAmount) : "Included"], ["Visits a year", a.visitsPerYear], ["Auto-renew", a.autoRenew ? "Yes" : "No"]]} />
            </Card>
            {d.invoices.length ? (
              <div className="stack tight">
                <span className="eyebrow">Recent invoices for this customer</span>
                {d.invoices.slice(0, 6).map((inv) => <Link key={inv.id} to="/billing" search={{ invoice: inv.id } as never} className="row between small nav-link"><span>Invoice {inv.number} · {dayLabel(inv.billedAt.slice(0, 10))}</span><span className="num">{money(inv.amount)} · {statusLabel(inv.status)}</span></Link>)}
              </div>
            ) : null}
          </aside>
        </div>
      </div>
      <Sheet open={Boolean(scheduling)} onClose={() => setScheduling(null)} title={scheduling ? `Schedule the ${statusLabel(scheduling.season).toLowerCase()} visit` : ""} footer={<><Button tone="ghost" onClick={() => setScheduling(null)}>Cancel</Button><Button tone="copper" onClick={() => schedule.mutate()} disabled={!sched.scheduledFor}>Create the work order</Button></>}>
        <p className="small muted">Creates a maintenance work order for {d.assets.length} unit{d.assets.length === 1 ? "" : "s"} and puts it on the board.</p>
        <div className="field-grid">
          <Field label="Date"><Input type="date" value={sched.scheduledFor} onChange={(e) => setSched({ ...sched, scheduledFor: e.target.value })} /></Field>
          <Field label="Start"><Select value={sched.startMinute} onChange={(e) => setSched({ ...sched, startMinute: e.target.value })}>{Array.from({ length: 44 }, (_, i) => 6 * 60 + i * 15).map((m) => <option key={m} value={m}>{minuteLabel(m)}</option>)}</Select></Field>
          <Field label="Technician"><Select value={sched.techId} onChange={(e) => setSched({ ...sched, techId: e.target.value })}><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}{d.site?.primaryTechId === t.id ? " · primary" : ""}</option>)}</Select></Field>
          <Field label="Hours"><Input type="number" step="0.25" value={sched.allocatedHours} onChange={(e) => setSched({ ...sched, allocatedHours: e.target.value })} /></Field>
        </div>
      </Sheet>
      <EditSheet open={editing} a={a} onClose={() => setEditing(false)} />
    </>
  );
}

function EditSheet({ open, a, onClose }: { open: boolean; a: AgreementRow; onClose: () => void }) {
  const [form, setForm] = useState({ name: a.name, tier: a.tier, status: a.status, startsOn: a.startsOn, endsOn: a.endsOn, autoRenew: a.autoRenew, billingMethod: a.billingMethod, amount: String(a.amount), visitAmount: a.visitAmount?.toString() ?? "", visitsPerYear: String(a.visitsPerYear), responseHours: a.responseHours?.toString() ?? "", includedServices: a.includedServices.join("\n") });
  useEffect(() => setForm({ name: a.name, tier: a.tier, status: a.status, startsOn: a.startsOn, endsOn: a.endsOn, autoRenew: a.autoRenew, billingMethod: a.billingMethod, amount: String(a.amount), visitAmount: a.visitAmount?.toString() ?? "", visitsPerYear: String(a.visitsPerYear), responseHours: a.responseHours?.toString() ?? "", includedServices: a.includedServices.join("\n") }), [a, open]);
  const save = useAction(() => api.patch(`/agreements/${a.id}`, { ...form, amount: Number(form.amount || 0), visitAmount: form.visitAmount ? Number(form.visitAmount) : null, visitsPerYear: Number(form.visitsPerYear), responseHours: form.responseHours ? Number(form.responseHours) : null, includedServices: form.includedServices.split("\n").map((s) => s.trim()).filter(Boolean) }), { success: "Agreement saved", onSuccess: onClose });
  return (
    <Sheet open={open} onClose={onClose} title="Edit agreement" footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button tone="primary" onClick={() => save.mutate()}>Save</Button></>}>
      <div className="field-grid">
        <Field label="Plan name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Tier"><Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>{AGREEMENT_TIERS.map((t) => <option key={t} value={t}>{statusLabel(t)}</option>)}</Select></Field>
        <Field label="Status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{AGREEMENT_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select></Field>
        <Field label="Visits a year"><Input type="number" min={1} max={12} value={form.visitsPerYear} onChange={(e) => setForm({ ...form, visitsPerYear: e.target.value })} /></Field>
        <Field label="Starts"><Input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
        <Field label="Ends"><Input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></Field>
        <Field label="Billing"><Select value={form.billingMethod} onChange={(e) => setForm({ ...form, billingMethod: e.target.value })}>{AGREEMENT_BILLING.map((b) => <option key={b} value={b}>{statusLabel(b)}</option>)}</Select></Field>
        <Field label="Amount"><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        <Field label="Per-visit price"><Input type="number" value={form.visitAmount} onChange={(e) => setForm({ ...form, visitAmount: e.target.value })} /></Field>
        <Field label="Response hours"><Input type="number" value={form.responseHours} onChange={(e) => setForm({ ...form, responseHours: e.target.value })} /></Field>
      </div>
      <Field label="What is included"><Textarea value={form.includedServices} onChange={(e) => setForm({ ...form, includedServices: e.target.value })} rows={4} /></Field>
      <Check on={form.autoRenew} onChange={(v) => setForm({ ...form, autoRenew: v })} label="Auto-renew" />
    </Sheet>
  );
}
