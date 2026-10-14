import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../app/api";
import { dayLabel, minuteLabel, money, siteUrl, stampLabel, statusLabel, woNumber, woTone } from "../../app/format";
import { useAction, useSettings } from "../../app/queries";
import type { AgreementRow, AgreementVisitRow, CustomerRow, FieldChange, InvoiceRow, PaymentRow, SiteRow, WorkOrderRow } from "../../app/types";
import { BackBar, Button, Card, Empty, ErrorBox, Facts, Field, Input, Kpi, LinkButton, Loading, Pill, Select, Sheet, Switch, SummaryLine, Tabs, Textarea } from "../../design/components";

interface CustomerDetail {
  customer: CustomerRow;
  sites: { site: SiteRow; primaryTechName: string | null }[];
  agreements: (AgreementRow & { visits: AgreementVisitRow[] })[];
  invoices: InvoiceRow[];
  payments: PaymentRow[];
  credits: { id: string; invoiceId: string; number: number; amount: number; reason: string; note: string; createdAt: string }[];
  balance: { billed: number; paid: number; credited: number; open: number; oldestDue: string | null } | undefined;
  aging: Record<string, number>;
  openWorkOrders: WorkOrderRow[];
  recentVisits: WorkOrderRow[];
  changes: FieldChange[];
  yearToDate: number;
}

export const Route = createFileRoute("/_office/customers/$id")({ component: CustomerPage });

type Tab = "sites" | "work" | "billing" | "agreements" | "account";

function CustomerPage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["customer", id], queryFn: () => api.get<CustomerDetail>(`/customers/${id}`) });
  const [tab, setTab] = useState<Tab>("sites");
  if (query.isLoading) return <Loading label="Loading the customer" />;
  if (query.error || !query.data) return <div className="page"><ErrorBox error={query.error ?? "Not found"} /></div>;
  const d = query.data;
  const c = d.customer;
  const today = new Date().toISOString().slice(0, 10);
  const pastDue = (d.balance?.open ?? 0) > 0 && d.balance?.oldestDue && d.balance.oldestDue < today;
  return (
    <>
      <BackBar to="/customers" place="Customers" />
      <div className="page">
        <div className="row top between wrap gap-3">
          <div className="stack tight">
            <h1 style={{ fontSize: 24 }}>{c.name}</h1>
            <div className="row wrap gap-2">
              {c.contract ? <Pill tone="sched">Contract pricing</Pill> : <Pill tone="open" plain>Standard pricing</Pill>}
              {c.taxExempt ? <Pill tone="open" plain>Tax exempt{c.taxExemptNumber ? ` · ${c.taxExemptNumber}` : ""}</Pill> : null}
              {c.cardOnFile ? <Pill tone="site" plain>{c.cardOnFile.brand} ····{c.cardOnFile.last4}</Pill> : null}
              {c.portalEnabled && c.portalToken ? <a className="pill plain copper" href={siteUrl(`/portal/${c.portalToken}`)} target="_blank" rel="noreferrer">Customer portal</a> : null}
            </div>
            <div className="small muted">{[c.billingAddress, c.phone, c.email].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="row gap-2">
            <LinkButton to="/new/work-order" search={{ customerId: c.id } as never} tone="copper" size="sm" icon="plus">Work order</LinkButton>
            <LinkButton to="/messages" search={{ customer: c.id } as never} size="sm" icon="chat">Messages</LinkButton>
          </div>
        </div>
        <div className="kpis mt-3">
          <Kpi label="Open balance" value={<span style={{ color: pastDue ? "var(--red)" : undefined }}>{money(d.balance?.open ?? 0)}</span>} delta={pastDue ? `oldest due ${dayLabel(d.balance?.oldestDue)}` : d.balance?.open ? "current" : "nothing owed"} deltaTone={pastDue ? "down" : undefined} />
          <Kpi label="Billed this year" value={money(d.yearToDate)} />
          <Kpi label="Sites" value={d.sites.length} />
          <Kpi label="Agreements" value={d.agreements.filter((a) => a.status === "active").length} delta={d.agreements.some((a) => a.status === "active" && a.endsOn <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)) ? "renewal within 60 days" : undefined} />
        </div>
        <div className="mt-3">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "sites", label: "Sites", count: d.sites.length }, { value: "work", label: "Work", count: d.openWorkOrders.length }, { value: "billing", label: "Billing", count: d.invoices.filter((i) => i.status === "billed" || i.status === "partially_credited").length }, { value: "agreements", label: "Agreements", count: d.agreements.length }, { value: "account", label: "Account" }]} />
        </div>
        <div className="mt-3">
          {tab === "sites" ? <SitesTab d={d} /> : null}
          {tab === "work" ? <WorkTab d={d} /> : null}
          {tab === "billing" ? <BillingTab d={d} /> : null}
          {tab === "agreements" ? <AgreementsTab d={d} /> : null}
          {tab === "account" ? <AccountTab d={d} /> : null}
        </div>
      </div>
    </>
  );
}

function SitesTab({ d }: { d: CustomerDetail }) {
  const settings = useSettings();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", contact: "", contactPhone: "", accessNotes: "", primaryTechId: "" });
  const add = useAction(() => api.post("/sites", { customerId: d.customer.id, ...form, primaryTechId: form.primaryTechId || null }), { success: "Site added", onSuccess: () => setAdding(false) });
  const techs = settings.data?.users.filter((u) => u.role === "tech" && u.active) ?? [];
  return (
    <div className="stack">
      <div className="row between wrap">
        <span className="small muted">Each site has its own equipment, access notes, and primary tech.</span>
        <Button size="sm" onClick={() => setAdding(true)} icon="plus">Add site</Button>
      </div>
      {d.sites.length === 0 ? <Empty title="No sites yet">Add the first service address.</Empty> : (
        <div className="list">
          {d.sites.map(({ site, primaryTechName }) => (
            <Link key={site.id} to="/sites/$id" params={{ id: site.id }} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div>
                <div className="title">{site.name || site.address}</div>
                <div className="sub">{site.address}{site.city ? `, ${site.city}` : ""}{site.contact ? ` · ${site.contact} ${site.contactPhone}` : ""}</div>
              </div>
              <div className="small muted">{primaryTechName ? `${primaryTechName}, primary` : "No primary tech"}</div>
            </Link>
          ))}
        </div>
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="Add a site" footer={<><Button tone="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button tone="primary" onClick={() => add.mutate()} disabled={!form.address}>Add site</Button></>}>
        <Field label="Site name" help="Leave blank to use the address."><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="field-grid">
          <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="Primary tech"><Select value={form.primaryTechId} onChange={(e) => setForm({ ...form, primaryTechId: e.target.value })}><option value="">None</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="On-site contact"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
          <Field label="Contact mobile"><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
        </div>
        <Field label="Access notes" help="Gate codes, roof access, where to check in. Shown to the tech."><Textarea value={form.accessNotes} onChange={(e) => setForm({ ...form, accessNotes: e.target.value })} /></Field>
      </Sheet>
    </div>
  );
}

function WorkList({ rows, empty }: { rows: WorkOrderRow[]; empty: string }) {
  if (!rows.length) return <p className="small muted">{empty}</p>;
  return (
    <div className="list">
      {rows.map((w) => (
        <Link key={w.id} to="/work-orders/$id" params={{ id: w.id }} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
          <div>
            <div className="title"><span className="num">{woNumber(w)}</span> · {w.title}</div>
            <div className="sub">{w.siteName} · {w.scheduledFor ? `${dayLabel(w.scheduledFor)}${w.startMinute != null ? ` ${minuteLabel(w.startMinute)}` : ""}` : "Not scheduled"} · {w.techName ?? "unassigned"}</div>
          </div>
          <Pill tone={woTone(w)}>{w.status === "open" && w.techStatus ? statusLabel(w.techStatus) : statusLabel(w.status)}</Pill>
        </Link>
      ))}
    </div>
  );
}

function WorkTab({ d }: { d: CustomerDetail }) {
  return (
    <div className="two-col">
      <section className="section"><div className="section-head"><h3>Open work orders</h3><span className="small muted">{d.openWorkOrders.length}</span></div><WorkList rows={d.openWorkOrders} empty="Nothing open for this customer." /></section>
      <section className="section"><div className="section-head"><h3>Recent visits</h3></div><WorkList rows={d.recentVisits} empty="No completed visits yet." /></section>
    </div>
  );
}

function BillingTab({ d }: { d: CustomerDetail }) {
  const paidFor = (invoiceId: string) => d.payments.filter((p) => p.invoiceId === invoiceId).reduce((sum, p) => sum + p.amount, 0) + d.credits.filter((c) => c.invoiceId === invoiceId).reduce((sum, c) => sum + c.amount, 0);
  return (
    <div className="stack loose">
      <SummaryLine items={[{ value: money(d.aging.current ?? 0), label: "current" }, { dot: "amber", value: money(d.aging["1-30"] ?? 0), label: "1–30" }, { dot: "rust", value: money(d.aging["31-60"] ?? 0), label: "31–60" }, { dot: "red", value: money((d.aging["61-90"] ?? 0) + (d.aging["90+"] ?? 0)), label: "over 60" }]} />
      {d.invoices.length === 0 ? <Empty title="No invoices yet">Invoices appear here once a job is marked billed.</Empty> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Invoice</th><th>Billed</th><th>Due</th><th className="num">Amount</th><th className="num">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {d.invoices.map((inv) => {
                const balance = Math.max(0, inv.amount - paidFor(inv.id));
                return (
                  <tr key={inv.id}>
                    <td className="primary-cell"><Link to="/billing" search={{ invoice: inv.id } as never} className="nav-link num">{inv.number}</Link></td>
                    <td className="num">{dayLabel(inv.billedAt.slice(0, 10))}</td>
                    <td className="num">{inv.dueDate ? dayLabel(inv.dueDate) : ""}</td>
                    <td className="num">{money(inv.amount)}</td>
                    <td className="num">{balance > 0 ? money(balance) : ""}</td>
                    <td><Pill tone={inv.status === "paid" ? "done" : inv.status === "credited" ? "hold" : "sched"}>{statusLabel(inv.status)}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {d.payments.length ? (
        <section className="section">
          <div className="section-head"><h3>Payments</h3></div>
          <div className="table-wrap"><table className="table dense"><thead><tr><th>Received</th><th>Method</th><th>Reference</th><th className="num">Amount</th></tr></thead><tbody>{d.payments.map((p) => <tr key={p.id}><td className="num">{stampLabel(p.receivedAt)}</td><td>{statusLabel(p.method)}</td><td>{p.reference}</td><td className="num">{money(p.amount)}</td></tr>)}</tbody></table></div>
        </section>
      ) : null}
    </div>
  );
}

function AgreementsTab({ d }: { d: CustomerDetail }) {
  return (
    <div className="stack">
      <div className="row between wrap">
        <span className="small muted">Maintenance plans on this customer's sites.</span>
        <LinkButton to="/agreements" search={{ new: d.customer.id } as never} size="sm" icon="plus">New agreement</LinkButton>
      </div>
      {d.agreements.length === 0 ? <Empty title="No agreements">Offer a maintenance plan after the next visit.</Empty> : (
        <div className="list">
          {d.agreements.map((a) => {
            const next = a.visits.find((v) => v.status !== "done" && v.status !== "skipped");
            const site = d.sites.find((s) => s.site.id === a.siteId)?.site;
            return (
              <Link key={a.id} to="/agreements/$id" params={{ id: a.id }} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div>
                  <div className="title">{a.name} · {statusLabel(a.tier)}</div>
                  <div className="sub">{site?.name ?? ""} · {a.visitsPerYear} visits a year · {money(a.amount)}{a.billingMethod === "monthly_card" ? " a month" : " a year"} · ends {dayLabel(a.endsOn)}</div>
                </div>
                <Pill tone={a.status !== "active" ? "hold" : next?.status === "unscheduled" ? "parts" : "site"}>{a.status !== "active" ? statusLabel(a.status) : next ? `${statusLabel(next.season)} ${statusLabel(next.status).toLowerCase()}` : "Up to date"}</Pill>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountTab({ d }: { d: CustomerDetail }) {
  const c = d.customer;
  const settings = useSettings();
  const initial = { name: c.name, phone: c.phone, email: c.email, billingAddress: c.billingAddress, apContactName: c.apContactName, apContactPhone: c.apContactPhone, contract: c.contract, taxExempt: c.taxExempt, taxExemptNumber: c.taxExemptNumber, creditLimit: c.creditLimit ?? "", accountManagerId: c.accountManagerId ?? "", invoiceDelivery: c.invoiceDelivery ?? "", invoiceEmails: c.invoiceEmails.join(", "), portalEnabled: c.portalEnabled };
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [c.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction(() => api.patch(`/customers/${c.id}`, { ...form, creditLimit: form.creditLimit === "" ? null : Number(form.creditLimit), accountManagerId: form.accountManagerId || null, invoiceDelivery: form.invoiceDelivery || null, invoiceEmails: form.invoiceEmails.split(",").map((s) => s.trim()).filter(Boolean) }), { success: "Customer saved" });
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const office = settings.data?.users.filter((u) => u.role !== "tech" && u.active) ?? [];
  return (
    <div className="two-col loose">
      <div className="stack loose">
        <div className="field-grid">
          <Field label="Customer name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Main phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Account manager"><Select value={form.accountManagerId} onChange={(e) => setForm({ ...form, accountManagerId: e.target.value })}><option value="">None</option>{office.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        </div>
        <Field label="Billing address"><Input value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} /></Field>
        <div className="field-grid">
          <Field label="AP contact"><Input value={form.apContactName} onChange={(e) => setForm({ ...form, apContactName: e.target.value })} /></Field>
          <Field label="AP phone"><Input value={form.apContactPhone} onChange={(e) => setForm({ ...form, apContactPhone: e.target.value })} /></Field>
          <Field label="Invoice delivery"><Select value={form.invoiceDelivery} onChange={(e) => setForm({ ...form, invoiceDelivery: e.target.value })}><option value="">Ask each time</option><option value="email">Email</option><option value="print">Print and mail</option><option value="both">Email and print</option><option value="text">Text a link</option></Select></Field>
          <Field label="Invoice emails" help="Comma separated."><Input value={form.invoiceEmails} onChange={(e) => setForm({ ...form, invoiceEmails: e.target.value })} /></Field>
          <Field label="Credit limit"><Input type="number" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} /></Field>
          {form.taxExempt ? <Field label="Tax exempt number"><Input value={form.taxExemptNumber} onChange={(e) => setForm({ ...form, taxExemptNumber: e.target.value })} /></Field> : null}
        </div>
        <div className="row wrap gap-3">
          <Switch on={form.contract} onChange={(v) => setForm({ ...form, contract: v })} label="Contract customer: contract rates and margins" />
          <Switch on={form.taxExempt} onChange={(v) => setForm({ ...form, taxExempt: v })} label="Tax exempt" />
          <Switch on={form.portalEnabled} onChange={(v) => setForm({ ...form, portalEnabled: v })} label="Customer portal" />
        </div>
        <div className="row gap-2">
          <Button tone="primary" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>Save</Button>
          {dirty ? <span className="small muted">Unsaved changes</span> : null}
        </div>
      </div>
      <div className="stack loose">
        <Card title="Account" flat>
          <Facts tight rows={[["Billed, lifetime", money(d.balance?.billed ?? 0)], ["Paid", money(d.balance?.paid ?? 0)], ["Credited", money(d.balance?.credited ?? 0)], ["Customer since", dayLabel(c.createdAt.slice(0, 10))]]} />
        </Card>
        <div className="stack tight">
          <span className="eyebrow">Change log</span>
          <div className="timeline">{d.changes.map((ch) => <div key={ch.f.id} className="tl steel"><div className="when">{stampLabel(ch.f.createdAt)}</div><div className="what">{ch.f.field}: {ch.f.fromValue ? `${ch.f.fromValue} → ` : ""}{ch.f.toValue}</div><div className="who">{ch.userName ?? "System"}</div></div>)}</div>
        </div>
      </div>
    </div>
  );
}
