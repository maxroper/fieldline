import { AGREEMENT_BILLING, AGREEMENT_TIERS } from "@fieldline/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, money, statusLabel } from "../../app/format";
import { useAction } from "../../app/queries";
import type { AgreementRow, AgreementVisitRow, CustomerRow, EquipmentRow, SiteRow } from "../../app/types";
import { Button, Check, Chip, Empty, Field, Input, Kpi, Loading, Meter, Pill, Select, Sheet, Textarea } from "../../design/components";

type AgreementListRow = AgreementRow & { customerName: string; siteName: string; siteCity: string; primaryTechName: string | null; assetCount: number; visits: AgreementVisitRow[]; nextVisit: AgreementVisitRow | null; renewalSoon: boolean };

interface AgreementsPayload {
  agreements: AgreementListRow[];
  kpis: { active: number; annualValue: number; renewalsDue: number; renewalValue: number; season: { total: number; done: number; scheduled: number; unscheduled: number } };
  today: string;
}

const search = z.object({ view: z.enum(["active", "renewals", "unscheduled", "all"]).default("active"), new: z.string().optional() });

export const Route = createFileRoute("/_office/agreements/")({ validateSearch: search, component: AgreementsPage });

function AgreementsPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const query = useQuery({ queryKey: ["agreements"], queryFn: () => api.get<AgreementsPayload>("/agreements") });
  const generate = useAction((season: string) => api.post<{ created: number }>("/agreements/generate", { season }), { success: (r) => `${r.created} visits created` });
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => { if (params.new) setNewOpen(true); }, [params.new]);
  const data = query.data;
  const month = Number((data?.today ?? new Date().toISOString()).slice(5, 7));
  const season = month >= 8 || month <= 1 ? "fall" : "spring";
  const rows = (data?.agreements ?? []).filter((a) => (params.view === "active" ? a.status === "active" : params.view === "renewals" ? a.status === "active" && a.renewalSoon : params.view === "unscheduled" ? a.nextVisit?.status === "unscheduled" : true));
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {([["active", "Active"], ["renewals", "Renewals due"], ["unscheduled", "Visits to schedule"], ["all", "All"]] as const).map(([v, label]) => <Chip key={v} on={params.view === v} onClick={() => setSearch({ view: v })}>{label}</Chip>)}
        </div>
        <span className="grow" />
        <Button size="sm" tone="ghost" onClick={() => generate.mutate(season)}>Generate {season} visits</Button>
        <Button size="sm" tone="copper" icon="plus" onClick={() => setNewOpen(true)}>Agreement</Button>
      </div>
      <div className="page">
        {!data ? <Loading label="Loading agreements" /> : (
          <div className="stack loose">
            <div className="kpis">
              <Kpi label="Active agreements" value={data.kpis.active} />
              <Kpi label="Annual value" value={money(data.kpis.annualValue)} delta="recurring revenue" deltaTone="up" />
              <Kpi label="Renewals in 60 days" value={data.kpis.renewalsDue} delta={money(data.kpis.renewalValue)} deltaTone={data.kpis.renewalsDue ? "down" : undefined} />
              <Kpi label="Season progress" value={data.kpis.season.total ? Math.round((data.kpis.season.done / data.kpis.season.total) * 100) : 0} unit="%"><Meter value={data.kpis.season.total ? (data.kpis.season.done / data.kpis.season.total) * 100 : 0} tone="moss" /><div className="small muted mt-1">{data.kpis.season.done} done · {data.kpis.season.scheduled} scheduled · {data.kpis.season.unscheduled} to book</div></Kpi>
            </div>
            {rows.length === 0 ? <Empty title="No agreements in this view">Sell a maintenance plan after the next service call; the pricebook has the tiers.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Customer · site</th><th>Plan</th><th className="num">Units</th><th className="num">Visits / yr</th><th>Next visit</th><th>Ends</th><th className="num">Amount</th><th>Tech</th></tr></thead>
                  <tbody className="stagger">
                    {rows.map((a) => (
                      <tr key={a.id} className="clickable" onClick={() => navigate({ to: "/agreements/$id", params: { id: a.id } })}>
                        <td className="primary-cell"><div>{a.customerName}</div><div className="small muted">{a.siteName}{a.siteCity ? ` · ${a.siteCity}` : ""}</div></td>
                        <td><Pill tone={a.tier === "gold" ? "copper" : a.tier === "silver" ? "sched" : "open"} plain>{statusLabel(a.tier)}</Pill> <span className="small">{a.name}</span></td>
                        <td className="num">{a.assetCount}</td>
                        <td className="num">{a.visitsPerYear}</td>
                        <td>{a.nextVisit ? <span className="row gap-2"><span className={`visit-dot ${a.nextVisit.status}`} /><span className="small">{statusLabel(a.nextVisit.season)} · {statusLabel(a.nextVisit.status)} · due {dayLabel(a.nextVisit.dueOn)}</span></span> : <span className="small muted">None generated</span>}</td>
                        <td className="num" style={{ color: a.renewalSoon ? "var(--rust)" : undefined }}>{dayLabel(a.endsOn)}{a.autoRenew ? "" : " · no auto-renew"}</td>
                        <td className="num">{money(a.amount)}<span className="small muted">{a.billingMethod === "monthly_card" ? "/mo" : "/yr"}</span></td>
                        <td className="small">{a.primaryTechName ?? <span className="muted">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <NewAgreementSheet open={newOpen} customerId={params.new} onClose={() => { setNewOpen(false); if (params.new) setSearch({ new: undefined }); }} />
    </>
  );
}

function NewAgreementSheet({ open, customerId, onClose }: { open: boolean; customerId: string | undefined; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const customers = useQuery({ queryKey: ["customers", q], queryFn: () => api.get<{ customers: CustomerRow[] }>(`/customers${qs({ q })}`), enabled: open && q.length >= 2 && !customer });
  const preset = useQuery({ queryKey: ["customer", customerId], queryFn: () => api.get<{ customer: CustomerRow }>(`/customers/${customerId}`), enabled: open && Boolean(customerId) });
  useEffect(() => { if (preset.data) setCustomer({ id: preset.data.customer.id, name: preset.data.customer.name }); }, [preset.data]);
  const detail = useQuery({ queryKey: ["customer", customer?.id], queryFn: () => api.get<{ sites: { site: SiteRow }[] }>(`/customers/${customer?.id}`), enabled: Boolean(customer) });
  const year = new Date().getFullYear();
  const [form, setForm] = useState({ siteId: "", tier: "silver", name: "", startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, autoRenew: true, billingMethod: "annual_invoice", amount: "", visitAmount: "", visitsPerYear: "2", responseHours: "", includedServices: "Spring and fall tune-ups\nFilter changes each visit\nPriority scheduling\n10% off repairs", equipmentIds: [] as string[] });
  const site = useQuery({ queryKey: ["site", form.siteId], queryFn: () => api.get<{ equipment: EquipmentRow[] }>(`/sites/${form.siteId}`), enabled: Boolean(form.siteId) });
  useEffect(() => { if (site.data) setForm((f) => ({ ...f, equipmentIds: site.data!.equipment.map((u) => u.id) })); }, [site.data]);
  const create = useAction(() => api.post<{ id: string }>("/agreements", { customerId: customer?.id, siteId: form.siteId, tier: form.tier, name: form.name || undefined, startsOn: form.startsOn, endsOn: form.endsOn, autoRenew: form.autoRenew, billingMethod: form.billingMethod, amount: Number(form.amount || 0), visitAmount: form.visitAmount ? Number(form.visitAmount) : null, visitsPerYear: Number(form.visitsPerYear), responseHours: form.responseHours ? Number(form.responseHours) : null, includedServices: form.includedServices.split("\n").map((s) => s.trim()).filter(Boolean), equipmentIds: form.equipmentIds }), { success: "Agreement created", onSuccess: (r) => { onClose(); navigate({ to: "/agreements/$id", params: { id: r.id } }); } });
  const sites = detail.data?.sites ?? [];
  return (
    <Sheet open={open} onClose={onClose} title="New maintenance agreement" wide footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button tone="copper" onClick={() => create.mutate()} disabled={!customer || !form.siteId || create.isPending}>Create agreement</Button></>}>
      <Field label="Customer">
        {customer ? <div className="row between"><b>{customer.name}</b><Button size="sm" tone="ghost" onClick={() => { setCustomer(null); setForm({ ...form, siteId: "", equipmentIds: [] }); }}>Change</Button></div> : (
          <div className="stack tight">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers" autoFocus />
            {customers.data?.customers.length ? <div className="list">{customers.data.customers.slice(0, 8).map((c) => <button key={c.id} type="button" className="item clickable" style={{ textAlign: "left" }} onClick={() => setCustomer({ id: c.id, name: c.name })}><div><div className="title">{c.name}</div><div className="sub">{c.billingAddress}</div></div></button>)}</div> : null}
          </div>
        )}
      </Field>
      {customer ? (
        <>
          <div className="field-grid">
            <Field label="Site"><Select value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}><option value="">Pick a site</option>{sites.map((s) => <option key={s.site.id} value={s.site.id}>{s.site.name || s.site.address}</option>)}</Select></Field>
            <Field label="Tier"><Select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>{AGREEMENT_TIERS.map((t) => <option key={t} value={t}>{statusLabel(t)}</option>)}</Select></Field>
            <Field label="Plan name" help="Blank uses the tier name."><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Visits a year"><Input type="number" min={1} max={12} value={form.visitsPerYear} onChange={(e) => setForm({ ...form, visitsPerYear: e.target.value })} /></Field>
            <Field label="Starts"><Input type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} /></Field>
            <Field label="Ends"><Input type="date" value={form.endsOn} onChange={(e) => setForm({ ...form, endsOn: e.target.value })} /></Field>
            <Field label="Billing"><Select value={form.billingMethod} onChange={(e) => setForm({ ...form, billingMethod: e.target.value })}>{AGREEMENT_BILLING.map((b) => <option key={b} value={b}>{statusLabel(b)}</option>)}</Select></Field>
            <Field label={form.billingMethod === "monthly_card" ? "Monthly amount" : "Annual amount"}><Input type="number" step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Per-visit price" help="When visits bill one at a time."><Input type="number" step="1" value={form.visitAmount} onChange={(e) => setForm({ ...form, visitAmount: e.target.value })} /></Field>
            <Field label="Response promise, hours"><Input type="number" value={form.responseHours} onChange={(e) => setForm({ ...form, responseHours: e.target.value })} placeholder="24" /></Field>
          </div>
          <Field label="What is included" help="One per line; printed on the agreement and the PM work orders."><Textarea value={form.includedServices} onChange={(e) => setForm({ ...form, includedServices: e.target.value })} rows={4} /></Field>
          {site.data ? (
            <Field label="Covered equipment">
              <div className="stack tight">{site.data.equipment.map((u) => <Check key={u.id} on={form.equipmentIds.includes(u.id)} onChange={(v) => setForm({ ...form, equipmentIds: v ? [...form.equipmentIds, u.id] : form.equipmentIds.filter((x) => x !== u.id) })} label={`${u.tag} · ${u.make} ${u.model}`} />)}{site.data.equipment.length === 0 ? <span className="small muted">No equipment on this site yet.</span> : null}</div>
            </Field>
          ) : null}
          <Check on={form.autoRenew} onChange={(v) => setForm({ ...form, autoRenew: v })} label="Auto-renew" />
        </>
      ) : null}
    </Sheet>
  );
}
