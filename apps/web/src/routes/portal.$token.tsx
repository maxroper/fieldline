import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../app/api";
import { dayLabel, money, statusLabel } from "../app/format";
import { useAction } from "../app/queries";
import type { FrozenLine } from "../app/types";
import { Button, Empty, Field, Input, Loading, Notice, Pill, Select, Tabs, Textarea } from "../design/components";
import { FilePhoto } from "../features/files/FilePhoto";

interface Portal {
  company: { name: string; phone: string } | undefined;
  customer: { name: string; cardOnFile: { brand: string; last4: string } | null };
  sites: { id: string; name: string; address: string }[];
  quotes: { id: string; number: number; scope: string; problemText: string; sentAt: string | null; approvalToken: string | null; options: { id: string; tier: string; name: string; description: string; price: number; financingMonthly: number | null; isRecommended: boolean; included: string[] }[] }[];
  invoices: { id: string; number: number; billedAt: string; dueDate: string | null; amount: number; balance: number; paymentToken: string | null; lines: FrozenLine[] }[];
  visits: { id: string; number: number; title: string; date: string | null; siteName: string | null; techName: string | null; summary: string; photos: { id: string; caption: string }[] }[];
  equipment: { id: string; tag: string; make: string; model: string; siteId: string; installYear: number | null; warrantyPartsUntil: string | null }[];
}

export const Route = createFileRoute("/portal/$token")({ component: PortalPage });

type Tab = "quotes" | "invoices" | "visits" | "equipment" | "request";

/** The customer portal: approve quotes, pay invoices, read visit reports, ask for service. Token link, no password. */
function PortalPage() {
  const { token } = Route.useParams();
  const query = useQuery({ queryKey: ["portal", token], queryFn: () => api.get<Portal>(`/public/portal/${token}`), retry: false });
  const [tab, setTab] = useState<Tab>("quotes");
  if (query.isLoading) return <Loading label="Opening your account" />;
  if (query.error || !query.data) return <div className="public"><Notice tone="red">That link is not valid. Call the office for a new one.</Notice></div>;
  const d = query.data;
  const owed = d.invoices.reduce((s, i) => s + i.balance, 0);
  return (
    <div className="public">
      <div className="row between wrap">
        <div className="brand"><b>{d.company?.name ?? "Fieldline"}</b><span>Customer portal</span></div>
        <div className="small muted">{d.customer.name}</div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "quotes", label: "Quotes", count: d.quotes.length || undefined }, { value: "invoices", label: "Invoices", count: owed ? money(owed) : undefined }, { value: "visits", label: "Visits" }, { value: "equipment", label: "Equipment" }, { value: "request", label: "Request service" }]} />
      {tab === "quotes" ? <QuotesTab d={d} /> : null}
      {tab === "invoices" ? <InvoicesTab d={d} /> : null}
      {tab === "visits" ? (d.visits.length === 0 ? <Empty title="No visits yet" /> : d.visits.map((v) => <div key={v.id} className="public-card"><div className="row between wrap"><b>{v.title}</b><span className="small muted">{dayLabel(v.date)} · {v.siteName}{v.techName ? ` · ${v.techName.split(" ")[0]}` : ""}</span></div>{v.summary ? <p style={{ margin: 0 }}>{v.summary}</p> : null}{v.photos.length ? <div className="photo-grid">{v.photos.map((p) => <FilePhoto key={p.id} id={p.id} caption={p.caption} />)}</div> : null}</div>)) : null}
      {tab === "equipment" ? (
        <div className="public-card">
          {d.equipment.length === 0 ? <Empty title="No equipment on file" /> : d.equipment.map((u) => <div key={u.id} className="row between wrap small"><span><b>{u.tag}</b> · {u.make} {u.model}{u.installYear ? ` · ${u.installYear}` : ""} <span className="muted">· {d.sites.find((s) => s.id === u.siteId)?.name}</span></span>{u.warrantyPartsUntil && u.warrantyPartsUntil >= new Date().toISOString().slice(0, 10) ? <Pill tone="warranty" plain>Parts warranty to {dayLabel(u.warrantyPartsUntil)}</Pill> : null}</div>)}
        </div>
      ) : null}
      {tab === "request" ? <RequestTab d={d} token={token} /> : null}
      <div className="small muted">Questions? Call {d.company?.phone ? <a href={`tel:${d.company.phone.replace(/[^\d+]/g, "")}`}>{d.company.phone}</a> : "the office"}.</div>
    </div>
  );
}

function QuotesTab({ d }: { d: Portal }) {
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [signer, setSigner] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const approve = useAction((q: Portal["quotes"][number]) => api.post<{ workOrderNumber: number | null }>(`/public/quotes/${q.approvalToken}/approve`, { optionId: choice[q.id] || undefined, signerName: signer }), { success: (r) => `Approved. Work order ${r.workOrderNumber ?? ""} created; we will call to schedule.`, onSuccess: () => setApproving(null) });
  if (d.quotes.length === 0) return <Empty title="No quotes waiting">When we send a proposal it appears here for approval.</Empty>;
  return (
    <>
      {d.quotes.map((q) => (
        <div key={q.id} className="public-card">
          <div className="row between wrap"><b>Proposal {q.number}</b><span className="small muted">{q.sentAt ? `Sent ${dayLabel(q.sentAt.slice(0, 10))}` : ""}</span></div>
          {q.problemText ? <p className="small muted" style={{ margin: 0 }}>{q.problemText}</p> : null}
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{q.scope}</p>
          <div className="option-cards">
            {q.options.map((o) => (
              <button key={o.id} type="button" className={`option-card${(choice[q.id] ?? q.options.find((x) => x.isRecommended)?.id) === o.id ? " on" : ""}`} onClick={() => setChoice({ ...choice, [q.id]: o.id })}>
                <span className="tier">{o.tier === "single" ? "Option" : statusLabel(o.tier)}{o.isRecommended ? " · recommended" : ""}</span>
                <b>{o.name}</b>
                <span className="price">{money(o.price)}</span>
                {o.financingMonthly ? <span className="small muted">or about {money(o.financingMonthly)}/mo</span> : null}
                {o.description ? <span className="small">{o.description}</span> : null}
                {o.included.length ? <ul className="small" style={{ paddingLeft: 16, margin: 0, textAlign: "left" }}>{o.included.map((i, n) => <li key={n}>{i}</li>)}</ul> : null}
              </button>
            ))}
          </div>
          {approving === q.id ? (
            <div className="stack tight">
              <Field label="Type your name to approve"><Input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="Full name" autoFocus /></Field>
              <div className="row gap-2"><Button tone="moss" onClick={() => approve.mutate(q)} disabled={!signer.trim()}>Approve {money(q.options.find((o) => o.id === (choice[q.id] ?? q.options.find((x) => x.isRecommended)?.id))?.price ?? 0)}</Button><Button tone="ghost" onClick={() => setApproving(null)}>Cancel</Button></div>
              <p className="small muted">By approving you authorize the work described at the price shown. We will call to schedule.</p>
            </div>
          ) : <div><Button tone="primary" onClick={() => setApproving(q.id)} disabled={!q.approvalToken}>Approve this proposal</Button></div>}
        </div>
      ))}
    </>
  );
}

function InvoicesTab({ d }: { d: Portal }) {
  const pay = useAction((inv: Portal["invoices"][number]) => api.post<{ balance: number }>(`/public/invoices/${inv.paymentToken}/pay`, { amount: inv.balance }), { success: "Payment received. Thank you." });
  if (d.invoices.length === 0) return <Empty title="Nothing outstanding">Paid invoices stay in your records with the office.</Empty>;
  return (
    <>
      {d.invoices.map((inv) => (
        <div key={inv.id} className="public-card">
          <div className="row between wrap"><b>Invoice {inv.number}</b><span className="small muted">Billed {dayLabel(inv.billedAt.slice(0, 10))}{inv.dueDate ? ` · due ${dayLabel(inv.dueDate)}` : ""}</span></div>
          <table className="table dense"><tbody>{inv.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className="num">{money(l.amount)}</td></tr>)}</tbody><tfoot><tr><td className="strong">Balance due</td><td className="num strong">{money(inv.balance)}</td></tr></tfoot></table>
          {inv.balance > 0 ? <div className="row gap-2 wrap"><Button tone="primary" onClick={() => pay.mutate(inv)} disabled={!inv.paymentToken || pay.isPending}>{d.customer.cardOnFile ? `Pay ${money(inv.balance)} with ${d.customer.cardOnFile.brand} ····${d.customer.cardOnFile.last4}` : `Pay ${money(inv.balance)}`}</Button><span className="small muted">Card payments are processed by our payment provider.</span></div> : <Pill tone="done">Paid</Pill>}
        </div>
      ))}
    </>
  );
}

function RequestTab({ d, token }: { d: Portal; token: string }) {
  const [form, setForm] = useState({ problem: "", urgency: "this_week", window: "", contactPhone: "", siteId: d.sites[0]?.id ?? "" });
  const [sent, setSent] = useState<number | null>(null);
  const request = useAction(() => api.post<{ workOrderNumber: number }>(`/public/portal/${token}/request-service`, { ...form, siteId: form.siteId || undefined, contactPhone: form.contactPhone || undefined, window: form.window || undefined }), { success: "Request sent", onSuccess: (r) => setSent(r.workOrderNumber) });
  if (sent) return <Notice tone="moss">Thanks. Work order {sent} is in our queue{form.urgency === "today" ? " marked urgent" : ""}. We will text when a technician is assigned.</Notice>;
  return (
    <div className="public-card">
      <Field label="What is going on"><Textarea value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} rows={3} placeholder="Upstairs unit is blowing warm air since this morning." /></Field>
      <div className="field-grid">
        {d.sites.length > 1 ? <Field label="Site"><Select value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })}>{d.sites.map((s) => <option key={s.id} value={s.id}>{s.name || s.address}</option>)}</Select></Field> : null}
        <Field label="How soon"><Select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}><option value="today">Today, it is urgent</option><option value="this_week">This week</option><option value="whenever">Whenever convenient</option></Select></Field>
        <Field label="Best time"><Input value={form.window} onChange={(e) => setForm({ ...form, window: e.target.value })} placeholder="Mornings before 11" /></Field>
        <Field label="Mobile for updates"><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
      </div>
      <div><Button tone="primary" onClick={() => request.mutate()} disabled={!form.problem.trim() || request.isPending}>Send request</Button></div>
    </div>
  );
}
