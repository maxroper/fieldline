import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, minuteLabel, money, statusLabel, woNumber } from "../../app/format";
import { useAction, useSettings } from "../../app/queries";
import type { AgreementRow, EquipmentRow, SiteRow, WorkOrderRow } from "../../app/types";
import { BackBar, Button, Card, Check, Empty, Field, Input, LinkButton, Notice, Pill, Select, Sheet, Textarea } from "../../design/components";

interface Match {
  site: SiteRow;
  customerName: string;
  customerId: string;
  contract: boolean;
  primaryTechName: string | null;
  openWorkOrders: WorkOrderRow[];
  lastVisit: WorkOrderRow | null;
  equipment: EquipmentRow[];
  agreement: AgreementRow | null;
  balance: number;
}

interface Suggestion {
  techId: string;
  techName: string;
  day: string;
  startMinute: number;
  freeHours: number;
  distanceKm: number | null;
  reason: string;
}

const search = z.object({ siteId: z.string().optional(), customerId: z.string().optional(), q: z.string().optional() });

export const Route = createFileRoute("/_office/new/work-order")({ validateSearch: search, component: NewWorkOrderPage });

const START_OPTIONS = Array.from({ length: 44 }, (_, i) => 6 * 60 + i * 15);

/**
 * Call intake. Find the site first (caller-ID style), see what is already open there, then describe the
 * problem and either place the job from the suggestions or leave it in the queue.
 */
function NewWorkOrderPage() {
  const params = Route.useSearch();
  const navigate = useNavigate();
  const settings = useSettings();
  const [q, setQ] = useState(params.q ?? "");
  const [needle, setNeedle] = useState(params.q ?? "");
  useEffect(() => {
    const t = setTimeout(() => setNeedle(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const digits = needle.replace(/\D/g, "");
  const lookup = useQuery({ queryKey: ["lookup", needle], queryFn: () => api.get<{ matches: Match[] }>(`/customers/lookup${qs(digits.length >= 7 ? { phone: digits } : { q: needle })}`), enabled: needle.length >= 2 });
  const preset = useQuery({ queryKey: ["lookup-site", params.siteId], queryFn: () => api.get<{ site: SiteRow; customer: { id: string; name: string; contract: boolean } | null; equipment: EquipmentRow[]; agreement: (AgreementRow & { assetIds: string[] }) | null; openWorkOrders: WorkOrderRow[]; history: WorkOrderRow[]; techs: { id: string; name: string }[] }>(`/sites/${params.siteId}`), enabled: Boolean(params.siteId) });
  const presetCustomer = useQuery({ queryKey: ["customer", params.customerId], queryFn: () => api.get<{ customer: { id: string; name: string; contract: boolean }; sites: { site: SiteRow; primaryTechName: string | null }[] }>(`/customers/${params.customerId}`), enabled: Boolean(params.customerId) && !params.siteId });
  const [selected, setSelected] = useState<Match | null>(null);
  useEffect(() => {
    if (preset.data && !selected) {
      const d = preset.data;
      setSelected({ site: d.site, customerName: d.customer?.name ?? "", customerId: d.customer?.id ?? d.site.customerId, contract: d.customer?.contract ?? false, primaryTechName: d.techs.find((t) => t.id === d.site.primaryTechId)?.name ?? null, openWorkOrders: d.openWorkOrders, lastVisit: d.history[0] ?? null, equipment: d.equipment, agreement: d.agreement, balance: 0 });
    }
  }, [preset.data, selected]);

  const [form, setForm] = useState({ title: "", description: "", equipmentId: "", callType: "service", billingType: "tm", nteAmount: "", priority: "normal", callerName: "", callerPhone: "", customerPo: "", signatureRequired: true, warranty: false, dispatchNote: "", siteText: "", scheduledFor: "", startMinute: "", allocatedHours: "2", assignedTechId: "" });
  const unit = selected?.equipment.find((u) => u.id === form.equipmentId);
  const today = new Date().toISOString().slice(0, 10);
  const underWarranty = Boolean(unit?.warrantyPartsUntil && unit.warrantyPartsUntil >= today);
  const [created, setCreated] = useState<{ id: string; number: number } | null>(null);
  const create = useAction(
    () =>
      api.post<{ id?: string; number?: number; workOrder?: { id: string; number: number } }>("/work-orders", {
        customerId: selected?.customerId ?? null,
        siteId: selected?.site.id ?? null,
        equipmentId: form.equipmentId || null,
        siteText: selected ? undefined : form.siteText,
        title: form.title,
        description: form.description,
        callType: form.callType,
        billingType: form.callType === "quoted" ? "quoted" : form.billingType,
        nteAmount: form.billingType === "nte" && form.nteAmount ? Number(form.nteAmount) : null,
        priority: form.priority,
        callerName: form.callerName,
        callerPhone: form.callerPhone,
        customerPo: form.customerPo,
        signatureRequired: form.signatureRequired,
        warranty: form.warranty,
        dispatchNote: form.dispatchNote,
        agreementId: selected?.agreement?.id ?? null,
        scheduledFor: form.scheduledFor || null,
        startMinute: form.startMinute ? Number(form.startMinute) : null,
        allocatedHours: form.allocatedHours ? Number(form.allocatedHours) : null,
        assignedTechId: form.assignedTechId || null,
      }),
    {
      success: (r) => `Work order ${r.workOrder?.number ?? r.number} created`,
      onSuccess: (r) => {
        const id = r.workOrder?.id ?? r.id;
        const number = r.workOrder?.number ?? r.number;
        if (!id) return;
        if (form.assignedTechId && form.scheduledFor) navigate({ to: "/dispatch", search: { day: form.scheduledFor } as never });
        else setCreated({ id, number: number ?? 0 });
      },
    },
  );
  const suggestions = useQuery({ queryKey: ["suggestions", created?.id], queryFn: () => api.get<{ suggestions: Suggestion[] }>(`/dispatch/suggestions${qs({ workOrderId: created?.id })}`), enabled: Boolean(created) });
  const assign = useAction((s: Suggestion) => api.post(`/work-orders/${created!.id}/assign`, { techId: s.techId, scheduledFor: s.day, startMinute: s.startMinute, allocatedHours: Number(form.allocatedHours || 2) }), { success: "Placed on the board", onSuccess: (_r, s) => navigate({ to: "/dispatch", search: { day: s.day } as never }) });
  const techs = settings.data?.users.filter((u) => u.role === "tech" && u.active) ?? [];
  const matches = lookup.data?.matches ?? [];
  const duplicates = selected?.openWorkOrders ?? [];
  const ready = form.title.trim() && (selected || form.siteText.trim());

  return (
    <>
      <BackBar to="/dispatch" place="Dispatch board" />
      <div className="page" style={{ maxWidth: 1100 }}>
        <div className="page-head">
          <div>
            <h1 style={{ fontSize: 24 }}>New work order</h1>
            <div className="sub">Who is calling, what is wrong, and where it goes.</div>
          </div>
        </div>
        <div className="two-col loose">
          <div className="stack loose">
            <Card title="1 · Who and where" flat actions={selected ? <Button size="sm" tone="ghost" onClick={() => { setSelected(null); setForm({ ...form, equipmentId: "" }); }}>Change</Button> : null}>
              {selected ? (
                <div className="stack tight">
                  <div className="row wrap gap-2">
                    <b>{selected.site.name || selected.site.address}</b>
                    <span className="muted">· {selected.customerName}</span>
                    {selected.contract ? <Pill tone="sched" plain>Contract</Pill> : null}
                    {selected.agreement ? <Pill tone="copper" plain>{selected.agreement.name}{selected.agreement.responseHours ? ` · ${selected.agreement.responseHours} h response` : ""}</Pill> : null}
                    {selected.balance > 0 ? <Pill tone="urgent" plain>Owes {money(selected.balance)}</Pill> : null}
                  </div>
                  <div className="small muted">{selected.site.address}{selected.site.city ? `, ${selected.site.city}` : ""} · {selected.site.contact} {selected.site.contactPhone} · {selected.primaryTechName ? `${selected.primaryTechName}, primary` : "no primary tech"}</div>
                  {selected.site.accessNotes ? <div className="small">{selected.site.accessNotes}</div> : null}
                  {selected.lastVisit ? <div className="small muted">Last visit {dayLabel(selected.lastVisit.scheduledFor)} · {woNumber(selected.lastVisit)} {selected.lastVisit.title} · {selected.lastVisit.techName}</div> : null}
                  {duplicates.length ? (
                    <Notice tone="red">
                      Already open here: {duplicates.map((w) => <Link key={w.id} to="/work-orders/$id" params={{ id: w.id }} className="nav-link strong" style={{ marginRight: 8 }}>{woNumber(w)} {w.title}</Link>)}. Add to one of those instead of a duplicate?
                    </Notice>
                  ) : null}
                </div>
              ) : (
                <div className="stack">
                  <Field label="Phone, name, or address" help="Matches the site contact, the customer, and the address.">
                    <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="(949) 555-0142 or Harbor Pointe" className="lg" />
                  </Field>
                  {needle.length >= 2 && lookup.data ? (
                    matches.length ? (
                      <div className="list">
                        {matches.map((m) => (
                          <button key={m.site.id} type="button" className="item clickable" style={{ gridTemplateColumns: "minmax(0,1fr) auto", textAlign: "left" }} onClick={() => setSelected(m)}>
                            <div>
                              <div className="title">{m.site.name || m.site.address} <span className="muted">· {m.customerName}</span></div>
                              <div className="sub">{m.site.address}{m.site.city ? `, ${m.site.city}` : ""} · {m.site.contact} {m.site.contactPhone}{m.openWorkOrders.length ? ` · ${m.openWorkOrders.length} open` : ""}</div>
                            </div>
                            <div className="row gap-2">{m.agreement ? <Pill tone="copper" plain>Agreement</Pill> : null}{m.contract ? <Pill tone="sched" plain>Contract</Pill> : null}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Empty title="No site matches">
                        <div className="row gap-2 mt-1" style={{ justifyContent: "center" }}>
                          <LinkButton to="/new/customer" search={{ q: needle, then: "work-order" } as never} size="sm" tone="copper">New customer</LinkButton>
                          <Button size="sm" onClick={() => setForm({ ...form, siteText: needle })}>Use as a one-off address</Button>
                        </div>
                      </Empty>
                    )
                  ) : null}
                  {form.siteText ? <Field label="One-off address" help="No customer record; the job bills to whoever pays on site."><Input value={form.siteText} onChange={(e) => setForm({ ...form, siteText: e.target.value })} /></Field> : null}
                  {params.customerId && presetCustomer.data ? (
                    <div className="stack tight">
                      <span className="eyebrow">{presetCustomer.data.customer.name}'s sites</span>
                      <div className="list">{presetCustomer.data.sites.map((s) => <button key={s.site.id} type="button" className="item clickable" style={{ textAlign: "left" }} onClick={() => setSelected({ site: s.site, customerName: presetCustomer.data!.customer.name, customerId: presetCustomer.data!.customer.id, contract: presetCustomer.data!.customer.contract, primaryTechName: s.primaryTechName, openWorkOrders: [], lastVisit: null, equipment: [], agreement: null, balance: 0 })}><div><div className="title">{s.site.name || s.site.address}</div><div className="sub">{s.site.address}</div></div></button>)}</div>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>

            <Card title="2 · What is wrong" flat>
              <div className="stack">
                <Field label="Problem, one line" help="This is the title on the board and the tech's phone."><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="RTU-2 not cooling, breaker trips" className="lg" /></Field>
                <Field label="Details"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What the caller said, when it started, what they tried." /></Field>
                <div className="field-grid">
                  {selected?.equipment.length ? <Field label="Equipment"><Select value={form.equipmentId} onChange={(e) => setForm({ ...form, equipmentId: e.target.value })}><option value="">Not sure yet</option>{selected.equipment.map((u) => <option key={u.id} value={u.id}>{u.tag} · {u.make} {u.model}</option>)}</Select></Field> : null}
                  <Field label="Type"><Select value={form.callType} onChange={(e) => setForm({ ...form, callType: e.target.value })}><option value="service">Service call</option><option value="maintenance">Maintenance</option><option value="quoted">Quoted job</option></Select></Field>
                  {form.callType !== "quoted" ? <Field label="Billing"><Select value={form.billingType} onChange={(e) => setForm({ ...form, billingType: e.target.value })}><option value="tm">Time and material</option><option value="nte">T&M, not to exceed</option></Select></Field> : null}
                  {form.billingType === "nte" && form.callType !== "quoted" ? <Field label="NTE amount"><Input type="number" value={form.nteAmount} onChange={(e) => setForm({ ...form, nteAmount: e.target.value })} /></Field> : null}
                  <Field label="Priority"><Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="urgent">Urgent, today</option><option value="normal">Normal</option><option value="low">Low, when convenient</option></Select></Field>
                  <Field label="Caller"><Input value={form.callerName} onChange={(e) => setForm({ ...form, callerName: e.target.value })} placeholder={selected?.site.contact || "Name"} /></Field>
                  <Field label="Caller mobile" help="Gets the on-my-way text."><Input value={form.callerPhone} onChange={(e) => setForm({ ...form, callerPhone: e.target.value })} placeholder={selected?.site.contactPhone || digits || "(949) 555-0100"} /></Field>
                  <Field label="Customer PO"><Input value={form.customerPo} onChange={(e) => setForm({ ...form, customerPo: e.target.value })} /></Field>
                </div>
                {underWarranty ? <Notice tone="moss">{unit?.tag} is under parts warranty until {dayLabel(unit?.warrantyPartsUntil)}. Flag the job so parts go on a claim, not the customer's bill.</Notice> : null}
                <div className="row wrap gap-3">
                  <Check on={form.warranty} onChange={(v) => setForm({ ...form, warranty: v })} label="Warranty job" />
                  <Check on={form.signatureRequired} onChange={(v) => setForm({ ...form, signatureRequired: v })} label="Signature required at completion" />
                </div>
                <Field label="Note to the technician" help="Pinned at the top of the tech's phone for this job."><Input value={form.dispatchNote} onChange={(e) => setForm({ ...form, dispatchNote: e.target.value })} placeholder="Call the manager 15 minutes before arrival." /></Field>
              </div>
            </Card>

            <Card title="3 · When" flat>
              <div className="stack">
                <p className="small muted">Leave the date blank to put it in the open queue and place it from the board, or pick a tech and a time now.</p>
                <div className="field-grid">
                  <Field label="Date"><Input type="date" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} /></Field>
                  <Field label="Start"><Select value={form.startMinute} onChange={(e) => setForm({ ...form, startMinute: e.target.value })}><option value="">Not set</option>{START_OPTIONS.map((m) => <option key={m} value={m}>{minuteLabel(m)}</option>)}</Select></Field>
                  <Field label="Estimated hours"><Input type="number" step="0.25" value={form.allocatedHours} onChange={(e) => setForm({ ...form, allocatedHours: e.target.value })} /></Field>
                  <Field label="Technician"><Select value={form.assignedTechId} onChange={(e) => setForm({ ...form, assignedTechId: e.target.value })}><option value="">Decide on the board</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}{selected?.site.primaryTechId === t.id ? " · knows the site" : ""}</option>)}</Select></Field>
                </div>
              </div>
            </Card>

            <div className="row gap-2">
              <Button tone="primary" size="lg" onClick={() => create.mutate()} disabled={!ready || create.isPending}>{form.assignedTechId && form.scheduledFor ? "Create and put on the board" : "Create and find a slot"}</Button>
              {!ready ? <span className="small muted">Pick a site and give the problem a title.</span> : null}
            </div>
          </div>

          <aside className="stack loose">
            {selected?.equipment.length ? (
              <div className="stack tight">
                <span className="eyebrow">Equipment at this site</span>
                {selected.equipment.map((u) => <div key={u.id} className="small"><b>{u.tag}</b> {u.make} {u.model}{u.installYear ? ` · ${u.installYear}` : ""}{u.warrantyPartsUntil && u.warrantyPartsUntil >= today ? <Pill tone="warranty" plain className="ml-1">Warranty</Pill> : null}</div>)}
              </div>
            ) : null}
            {selected?.agreement ? (
              <div className="stack tight">
                <span className="eyebrow">Agreement</span>
                <div className="small"><b>{selected.agreement.name}</b> · {statusLabel(selected.agreement.tier)}</div>
                <div className="small muted">{selected.agreement.includedServices.join(", ")}</div>
                {selected.agreement.responseHours ? <div className="small">Promised response: {selected.agreement.responseHours} hours</div> : null}
              </div>
            ) : null}
            <div className="stack tight small muted">
              <span className="eyebrow">Tips</span>
              <p>Urgent calls jump to the top of the queue and the board's suggestions look at today first.</p>
              <p>A quoted job needs an approved quote; start one from Quoting if the price is not set yet.</p>
            </div>
          </aside>
        </div>
      </div>

      <Sheet open={Boolean(created)} onClose={() => created && navigate({ to: "/work-orders/$id", params: { id: created.id } })} title={created ? `Place work order ${created.number}` : ""} footer={created ? <><Button tone="ghost" onClick={() => navigate({ to: "/work-orders/$id", params: { id: created.id } })}>Leave in the queue</Button><LinkButton to="/dispatch" search={{ wo: created.id } as never} tone="primary">Open the board</LinkButton></> : null}>
        {suggestions.isLoading ? <p className="small muted">Looking at who is free and close…</p> : null}
        {suggestions.data?.suggestions.length ? (
          <div className="list">
            {suggestions.data.suggestions.map((s, i) => (
              <button key={`${s.techId}-${s.day}`} type="button" className="item clickable" style={{ gridTemplateColumns: "minmax(0,1fr) auto", textAlign: "left" }} onClick={() => assign.mutate(s)}>
                <div>
                  <div className="title">{s.techName} · {dayLabel(s.day)} {minuteLabel(s.startMinute)}{i === 0 ? <Pill tone="site" plain className="ml-1">Best fit</Pill> : null}</div>
                  <div className="sub">{s.reason}</div>
                </div>
                <span className="btn sm">Assign</span>
              </button>
            ))}
          </div>
        ) : suggestions.data ? <Empty title="No open slot in the next three days">Leave it in the queue and place it from the week view.</Empty> : null}
      </Sheet>
    </>
  );
}
