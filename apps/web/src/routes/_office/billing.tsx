import { INVOICE_DELIVERY, PAYMENT_METHODS, type WorkOrderBill } from "@fieldline/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, money, stampLabel, statusLabel, woNumber } from "../../app/format";
import { useAction } from "../../app/queries";
import type { InvoiceRow, PaymentRow, WorkOrderRow } from "../../app/types";
import { Button, Check, Chip, Empty, Facts, Field, Input, Kpi, Loading, Notice, Pill, Seg, Select, Sheet, SummaryLine } from "../../design/components";
import { BillPreview } from "../../features/billing/BillPreview";

interface WaitingRow {
  workOrder: WorkOrderRow;
  bill: WorkOrderBill;
  allTripsClosed: boolean;
  flags: { clockRunning: boolean; overNte: number | null; rateMissing: boolean; amountMissing: boolean };
}
type InvoiceListRow = InvoiceRow & { customerName: string | null; workOrderNumber: number | null; workOrderTrip: number | null; workOrderTitle: string | null; siteName: string | null; callType: string | null; paid: number; credited: number; balance: number; bucket: string | null; daysPastDue: number; lastDelivery: { method: string; createdAt: string } | null };
interface InvoicesPayload {
  invoices: InvoiceListRow[];
  aging: Record<string, number>;
  kpis: { billedThisMonth: number; billedCount: number; arOver30: number; arTotal: number; collectedThisWeek: number; collectedCount: number; qboAlerts: number };
  quickbooks: { connected: boolean; lastSync: string | null };
}
interface InvoiceDetail {
  invoice: InvoiceRow;
  payments: PaymentRow[];
  credits: { id: string; number: number; amount: number; reason: string; note: string; createdAt: string }[];
  deliveries: { d: { id: string; method: string; emails: string[]; createdAt: string }; userName: string | null }[];
  revisions: { id: string; rev: number; reason: string; createdAt: string }[];
  paid: number;
  credited: number;
  balance: number;
  workOrder: WorkOrderRow | null;
  customer: { id: string; name: string; phone: string; email: string; invoiceEmails: string[]; invoiceDelivery: string | null; cardOnFile: { brand: string; last4: string } | null; portalToken: string | null; portalEnabled: boolean } | null;
  site: { name: string; address: string } | null;
  liveBill: WorkOrderBill | null;
}
interface AgingPayload {
  customers: { customerId: string | null; customerName: string | null; cardOnFile: { brand: string; last4: string } | null; buckets: Record<string, number>; total: number; oldest: number }[];
}

const search = z.object({ view: z.enum(["waiting", "invoices", "aging"]).default("waiting"), status: z.string().optional(), invoice: z.string().optional() });

export const Route = createFileRoute("/_office/billing")({ validateSearch: search, component: BillingPage });

const invoiceTone = (status: string) => (status === "paid" ? "done" : status === "credited" || status === "void" ? "hold" : status === "partially_credited" ? "parts" : "sched");

function BillingPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const waiting = useQuery({ queryKey: ["billing-waiting"], queryFn: () => api.get<{ waiting: WaitingRow[]; total: number }>("/billing/waiting") });
  const invoices = useQuery({ queryKey: ["invoices"], queryFn: () => api.get<InvoicesPayload>("/billing/invoices") });
  const aging = useQuery({ queryKey: ["aging"], queryFn: () => api.get<AgingPayload>("/billing/aging"), enabled: params.view === "aging" });
  const [billing, setBilling] = useState<WaitingRow | null>(null);
  const k = invoices.data?.kpis;
  return (
    <>
      <div className="toolbar">
        <Seg value={params.view} options={[{ value: "waiting", label: "Waiting to bill", count: waiting.data?.waiting.length }, { value: "invoices", label: "Invoices" }, { value: "aging", label: "Aging" }]} onChange={(v) => setSearch({ view: v })} />
        <span className="grow" />
        {invoices.data ? <span className={`pill plain ${invoices.data.quickbooks.connected ? "site" : "hold"}`}>{invoices.data.quickbooks.connected ? "QuickBooks connected" : "QuickBooks not connected"}</span> : null}
      </div>
      <div className="page">
        <div className="stack loose">
          {k ? (
            <div className="kpis">
              <Kpi label="Waiting to bill" value={money(waiting.data?.total ?? 0)} delta={`${waiting.data?.waiting.length ?? 0} closed jobs`} />
              <Kpi label="Billed this month" value={money(k.billedThisMonth)} delta={`${k.billedCount} invoices`} />
              <Kpi label="A/R over 30 days" value={money(k.arOver30)} delta={`${money(k.arTotal)} outstanding`} deltaTone={k.arOver30 > 0 ? "down" : undefined} />
              <Kpi label="Collected this week" value={money(k.collectedThisWeek)} delta={`${k.collectedCount} payments`} deltaTone="up" />
            </div>
          ) : null}
          {params.view === "waiting" ? <WaitingView rows={waiting.data?.waiting} onBill={setBilling} /> : null}
          {params.view === "invoices" ? <InvoicesView data={invoices.data} status={params.status} onStatus={(s) => setSearch({ status: s })} onOpen={(id) => setSearch({ invoice: id })} /> : null}
          {params.view === "aging" ? (aging.data ? <AgingView data={aging.data} /> : <Loading />) : null}
        </div>
      </div>
      <BillSheet row={billing} onClose={() => setBilling(null)} onBilled={(id) => { setBilling(null); setSearch({ view: "invoices", invoice: id }); }} />
      <InvoiceSheet id={params.invoice} onClose={() => setSearch({ invoice: undefined })} />
    </>
  );
}

function WaitingView({ rows, onBill }: { rows: WaitingRow[] | undefined; onBill: (row: WaitingRow) => void }) {
  if (!rows) return <Loading label="Building the bills" />;
  if (!rows.length) return <Empty title="Nothing waiting">Jobs appear here when the office marks them completed.</Empty>;
  return (
    <div className="list">
      {rows.map((r) => {
        const problems = [r.flags.clockRunning ? "clock running" : null, r.flags.rateMissing ? "bill rate missing" : null, r.flags.overNte != null ? `over NTE by ${money(r.flags.overNte)}` : null, !r.allTripsClosed ? "a return trip is still open" : null].filter(Boolean) as string[];
        return (
          <div key={r.workOrder.id} className="item tall" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div>
              <div className="row wrap gap-2">
                <Link to="/work-orders/$id" params={{ id: r.workOrder.id }} className="title nav-link"><span className="num">{woNumber(r.workOrder)}</span> · {r.workOrder.customerName}</Link>
                <Pill tone="open" plain>{statusLabel(r.workOrder.callType)} · {r.workOrder.billingType.toUpperCase()}</Pill>
                {r.workOrder.warranty ? <Pill tone="warranty" plain>Warranty</Pill> : null}
              </div>
              <div className="sub">{r.workOrder.title} · {r.workOrder.siteName} · {r.workOrder.techName} · done {dayLabel(r.workOrder.scheduledFor)}</div>
              {problems.length ? <div className="small mt-1" style={{ color: "var(--red)" }}>{problems.join(" · ")}</div> : null}
            </div>
            <div className="row gap-2">
              <span className="num strong" style={{ fontSize: 18 }}>{r.bill.amount != null ? money(r.bill.amount) : "—"}</span>
              <Button tone={problems.length ? "default" : "copper"} size="sm" onClick={() => onBill(r)}>Review and bill</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InvoicesView({ data, status, onStatus, onOpen }: { data: InvoicesPayload | undefined; status: string | undefined; onStatus: (s: string | undefined) => void; onOpen: (id: string) => void }) {
  if (!data) return <Loading label="Loading invoices" />;
  const rows = data.invoices.filter((i) => (status === "open" ? i.balance > 0 : status === "paid" ? i.status === "paid" : status === "past_due" ? i.daysPastDue > 0 : true));
  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="chips">
          {([["all", "All"], ["open", "Open balance"], ["past_due", "Past due"], ["paid", "Paid"]] as const).map(([v, label]) => <Chip key={v} on={(status ?? "all") === v} onClick={() => onStatus(v === "all" ? undefined : v)}>{label}</Chip>)}
        </div>
        <SummaryLine items={[{ value: money(data.aging.current ?? 0), label: "current" }, { dot: "amber", value: money(data.aging["1-30"] ?? 0), label: "1–30" }, { dot: "rust", value: money(data.aging["31-60"] ?? 0), label: "31–60" }, { dot: "red", value: money((data.aging["61-90"] ?? 0) + (data.aging["90+"] ?? 0)), label: "over 60" }]} />
      </div>
      {rows.length === 0 ? <Empty title="No invoices in this view" /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Invoice</th><th>Customer</th><th>Job</th><th>Billed</th><th>Due</th><th className="num">Amount</th><th className="num">Balance</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody className="stagger">
              {rows.map((inv) => (
                <tr key={inv.id} className="clickable" onClick={() => onOpen(inv.id)}>
                  <td className="num primary-cell">{inv.number}</td>
                  <td className="primary-cell">{inv.customerName}</td>
                  <td className="small">{inv.workOrderNumber ? <><span className="num">{woNumber({ number: inv.workOrderNumber, trip: inv.workOrderTrip })}</span> {inv.workOrderTitle}</> : ""}</td>
                  <td className="num">{dayLabel(inv.billedAt.slice(0, 10))}</td>
                  <td className="num" style={{ color: inv.daysPastDue > 0 ? "var(--red)" : undefined }}>{inv.dueDate ? dayLabel(inv.dueDate) : ""}{inv.daysPastDue > 0 ? ` · ${inv.daysPastDue} d` : ""}</td>
                  <td className="num">{money(inv.amount)}</td>
                  <td className="num strong">{inv.balance > 0 ? money(inv.balance) : ""}</td>
                  <td><Pill tone={invoiceTone(inv.status)}>{statusLabel(inv.status)}</Pill>{inv.qboError ? <Pill tone="urgent" plain className="ml-1">QBO error</Pill> : null}</td>
                  <td className="small muted">{inv.lastDelivery ? `${statusLabel(inv.lastDelivery.method)} ${dayLabel(inv.lastDelivery.createdAt.slice(0, 10))}` : "Not sent"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AgingView({ data }: { data: AgingPayload }) {
  if (!data.customers.length) return <Empty title="Nothing outstanding">Every invoice is paid or credited.</Empty>;
  const buckets = ["current", "1-30", "31-60", "61-90", "90+"];
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Customer</th>{buckets.map((b) => <th key={b} className="num">{b === "current" ? "Current" : b}</th>)}<th className="num">Total</th><th>Oldest</th><th /></tr></thead>
        <tbody>
          {data.customers.map((c) => (
            <tr key={c.customerId ?? "none"}>
              <td className="primary-cell">{c.customerId ? <Link to="/customers/$id" params={{ id: c.customerId }} className="nav-link">{c.customerName}</Link> : "No customer"}</td>
              {buckets.map((b) => <td key={b} className="num" style={{ color: (c.buckets[b] ?? 0) > 0 && (b === "61-90" || b === "90+") ? "var(--red)" : undefined }}>{(c.buckets[b] ?? 0) > 0 ? money(c.buckets[b] ?? 0) : ""}</td>)}
              <td className="num strong">{money(c.total)}</td>
              <td className="num">{c.oldest > 0 ? `${c.oldest} days` : "current"}</td>
              <td>{c.cardOnFile ? <Pill tone="site" plain>{c.cardOnFile.brand} ····{c.cardOnFile.last4}</Pill> : <span className="small muted">No card on file</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BillSheet({ row, onClose, onBilled }: { row: WaitingRow | null; onClose: () => void; onBilled: (id: string) => void }) {
  const [opts, setOpts] = useState({ laborMode: "itemized", materialMode: "itemized", hideHourlyRate: false, dueInDays: "30" });
  const create = useAction(() => api.post<{ id: string; number: number }>(`/billing/work-orders/${row?.workOrder.id}/invoice`, { laborMode: opts.laborMode, materialMode: opts.materialMode, hideHourlyRate: opts.hideHourlyRate, descriptions: {}, dueInDays: Number(opts.dueInDays) }), { success: (r) => `Invoice ${r.number} created`, onSuccess: (r) => onBilled(r.id) });
  const blocked = row ? row.flags.clockRunning || row.flags.amountMissing : true;
  return (
    <Sheet open={Boolean(row)} onClose={onClose} title={row ? `Bill ${woNumber(row.workOrder)} · ${row.workOrder.customerName}` : ""} wide footer={<><Button tone="ghost" onClick={onClose}>Not yet</Button><Button tone="copper" onClick={() => create.mutate()} disabled={blocked || create.isPending}>Mark billed · {row?.bill.amount != null ? money(row.bill.amount) : "—"}</Button></>}>
      {row ? (
        <div className="stack loose">
          <div className="small muted">{row.workOrder.title} · {row.workOrder.siteName} · {statusLabel(row.workOrder.callType)} · {row.workOrder.billingType.toUpperCase()}</div>
          <BillPreview bill={row.bill} />
          <section className="section">
            <div className="section-head"><h3>How the customer sees it</h3></div>
            <div className="field-grid">
              <Field label="Labor"><Select value={opts.laborMode} onChange={(e) => setOpts({ ...opts, laborMode: e.target.value })}><option value="itemized">Each visit and tech</option><option value="one">One labor line</option></Select></Field>
              <Field label="Material"><Select value={opts.materialMode} onChange={(e) => setOpts({ ...opts, materialMode: e.target.value })}><option value="itemized">Each part</option><option value="one">One material line</option></Select></Field>
              <Field label="Due in"><Select value={opts.dueInDays} onChange={(e) => setOpts({ ...opts, dueInDays: e.target.value })}><option value="0">On receipt</option><option value="15">15 days</option><option value="30">30 days</option><option value="45">45 days</option><option value="60">60 days</option></Select></Field>
            </div>
            <Check on={opts.hideHourlyRate} onChange={(v) => setOpts({ ...opts, hideHourlyRate: v })} label="Hide the hourly rate on the invoice" />
          </section>
          {!row.allTripsClosed ? <Notice>A return trip on this job is still open. Billing now freezes the amount for the whole job.</Notice> : null}
        </div>
      ) : null}
    </Sheet>
  );
}

function InvoiceSheet({ id, onClose }: { id: string | undefined; onClose: () => void }) {
  const query = useQuery({ queryKey: ["invoice", id], queryFn: () => api.get<InvoiceDetail>(`/billing/invoices/${id}`), enabled: Boolean(id) });
  const [pay, setPay] = useState({ amount: "", method: "check", reference: "" });
  const [credit, setCredit] = useState({ amount: "", reason: "complaint", note: "" });
  const [send, setSend] = useState({ method: "email", emails: "" });
  const [reviseReason, setReviseReason] = useState("");
  const [panel, setPanel] = useState<"payment" | "credit" | "send" | "revise" | null>(null);
  const d = query.data;
  useEffect(() => {
    if (d) {
      setPay({ amount: String(d.balance), method: d.customer?.cardOnFile ? "card" : "check", reference: "" });
      setSend({ method: d.customer?.invoiceDelivery ?? "email", emails: (d.customer?.invoiceEmails ?? []).join(", ") || d.customer?.email || "" });
      setPanel(null);
    }
  }, [d]);
  const payment = useAction(() => api.post(`/billing/invoices/${id}/payments`, { amount: Number(pay.amount), method: pay.method, reference: pay.reference }), { success: "Payment recorded", onSuccess: () => setPanel(null) });
  const creditMemo = useAction(() => api.post(`/billing/invoices/${id}/credits`, { amount: Number(credit.amount), reason: credit.reason, note: credit.note }), { success: "Credit issued", onSuccess: () => setPanel(null) });
  const deliver = useAction(() => api.post(`/billing/invoices/${id}/deliveries`, { method: send.method, emails: send.emails.split(",").map((s) => s.trim()).filter(Boolean) }), { success: "Invoice sent", onSuccess: () => setPanel(null) });
  const revise = useAction(() => api.post(`/billing/invoices/${id}/revise`, { laborMode: d?.invoice.laborMode, materialMode: d?.invoice.materialMode, hideHourlyRate: d?.invoice.hideHourlyRate, descriptions: d?.invoice.descriptions ?? {}, dueInDays: 30, reason: reviseReason }), { success: "Invoice revised", onSuccess: () => setPanel(null) });
  const inv = d?.invoice;
  return (
    <Sheet open={Boolean(id)} onClose={onClose} title={inv ? `Invoice ${inv.number}` : "Invoice"} wide>
      {!d || !inv ? <Loading /> : (
        <div className="stack loose">
          <div className="row wrap gap-2">
            <Pill tone={invoiceTone(inv.status)}>{statusLabel(inv.status)}</Pill>
            {d.workOrder ? <Link to="/work-orders/$id" params={{ id: d.workOrder.id }} className="pill plain open nav-link">WO {woNumber(d.workOrder)} · {d.workOrder.title}</Link> : null}
            {d.customer ? <Link to="/customers/$id" params={{ id: d.customer.id }} className="pill plain open nav-link">{d.customer.name}</Link> : null}
            {d.customer?.portalEnabled && d.customer.portalToken ? <a className="pill plain copper" href={`/portal/${d.customer.portalToken}`} target="_blank" rel="noreferrer">Customer portal, pay online</a> : null}
          </div>
          <Facts tight rows={[["Billed", stampLabel(inv.billedAt)], ["Due", inv.dueDate ? dayLabel(inv.dueDate) : "—"], ["Amount", money(inv.amount)], ["Paid", money(d.paid)], ["Credited", money(d.credited)], ["Balance", <b key="b">{money(d.balance)}</b>]]} />
          <table className="table dense">
            <thead><tr><th>Line</th><th className="num">Qty</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
            <tbody>{inv.snapshot.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className="num">{l.quantity ?? ""}</td><td className="num">{l.rate != null ? money(l.rate) : ""}</td><td className="num">{money(l.amount)}</td></tr>)}</tbody>
            <tfoot><tr><td className="strong">Total</td><td /><td /><td className="num strong">{money(inv.snapshot.total)}</td></tr></tfoot>
          </table>
          <div className="row wrap gap-2">
            {d.balance > 0 ? <Button tone="moss" size="sm" onClick={() => setPanel("payment")}>Record payment</Button> : null}
            <Button size="sm" onClick={() => setPanel("send")}>Send</Button>
            {inv.status !== "credited" ? <Button size="sm" onClick={() => setPanel("credit")}>Credit</Button> : null}
            {d.liveBill ? <Button size="sm" tone="ghost" onClick={() => setPanel("revise")}>Revise from the live bill</Button> : null}
          </div>
          {panel === "payment" ? (
            <div className="inline-form">
              <Field label="Amount"><Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></Field>
              <Field label="Method"><Select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{statusLabel(m)}</option>)}</Select></Field>
              <Field label="Reference"><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Check number" /></Field>
              <Button tone="primary" onClick={() => payment.mutate()} disabled={!pay.amount}>Save payment</Button>
            </div>
          ) : null}
          {panel === "credit" ? (
            <div className="inline-form">
              <Field label="Credit amount"><Input type="number" step="0.01" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} /></Field>
              <Field label="Reason"><Select value={credit.reason} onChange={(e) => setCredit({ ...credit, reason: e.target.value })}><option value="complaint">Customer complaint</option><option value="incorrect">Billed incorrectly</option><option value="other">Other</option></Select></Field>
              <Field label="Note"><Input value={credit.note} onChange={(e) => setCredit({ ...credit, note: e.target.value })} /></Field>
              <Button tone="primary" onClick={() => creditMemo.mutate()} disabled={!credit.amount}>Issue credit</Button>
            </div>
          ) : null}
          {panel === "send" ? (
            <div className="inline-form">
              <Field label="How"><Select value={send.method} onChange={(e) => setSend({ ...send, method: e.target.value })}>{INVOICE_DELIVERY.map((m) => <option key={m} value={m}>{statusLabel(m)}</option>)}</Select></Field>
              <Field label="Emails"><Input value={send.emails} onChange={(e) => setSend({ ...send, emails: e.target.value })} /></Field>
              <Button tone="primary" onClick={() => deliver.mutate()}>Send invoice</Button>
            </div>
          ) : null}
          {panel === "revise" ? (
            <div className="stack">
              <Notice>Revising re-freezes the invoice from today's bill ({d.liveBill?.amount != null ? money(d.liveBill.amount) : "—"}) and keeps the old version in the revision history.</Notice>
              <div className="inline-form">
                <Field label="Reason"><Input value={reviseReason} onChange={(e) => setReviseReason(e.target.value)} placeholder="Missed the second visit's labor" /></Field>
                <Button tone="primary" onClick={() => revise.mutate()} disabled={!reviseReason}>Revise</Button>
              </div>
            </div>
          ) : null}
          {d.payments.length || d.credits.length || d.deliveries.length || d.revisions.length ? (
            <div className="timeline">
              {d.payments.map((p) => <div key={p.id} className="tl moss"><div className="when">{stampLabel(p.receivedAt)}</div><div className="what">Payment {money(p.amount)} · {statusLabel(p.method)}{p.reference ? ` · ${p.reference}` : ""}</div></div>)}
              {d.credits.map((c) => <div key={c.id} className="tl copper"><div className="when">{stampLabel(c.createdAt)}</div><div className="what">Credit {c.number} · {money(c.amount)} · {statusLabel(c.reason)}{c.note ? ` · ${c.note}` : ""}</div></div>)}
              {d.deliveries.map((x) => <div key={x.d.id} className="tl steel"><div className="when">{stampLabel(x.d.createdAt)}</div><div className="what">Sent by {statusLabel(x.d.method)}{x.d.emails.length ? ` to ${x.d.emails.join(", ")}` : ""}</div><div className="who">{x.userName}</div></div>)}
              {d.revisions.map((r) => <div key={r.id} className="tl"><div className="when">{stampLabel(r.createdAt)}</div><div className="what">Revision {r.rev} · {r.reason}</div></div>)}
            </div>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
