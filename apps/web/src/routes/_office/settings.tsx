import { LABOR_CLASSES, type CompanySettings, type HourlyRate, type MarkupBand } from "@fieldline/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../app/api";
import { money, statusLabel } from "../../app/format";
import { useAction, useSettings } from "../../app/queries";
import type { SettingsPayload } from "../../app/types";
import { Button, Card, Check, Facts, Field, Input, Loading, Notice, Pill, Select, Sheet, Switch, Tabs, Textarea } from "../../design/components";

export const Route = createFileRoute("/_office/settings")({ component: SettingsPage });

type Tab = "company" | "pricing" | "documents" | "compliance" | "teams" | "checklists" | "warehouses" | "integrations";

function SettingsPage() {
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>("company");
  const data = settings.data;
  if (!data) return <Loading label="Loading settings" />;
  const cs = data.org.settings as unknown as CompanySettings;
  return (
    <div className="page">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "company", label: "Company" }, { value: "pricing", label: "Rates & margins" }, { value: "documents", label: "Documents" }, { value: "compliance", label: "Compliance" }, { value: "teams", label: "Teams & vendors" }, { value: "checklists", label: "Checklists", count: data.checklistTemplates.length }, { value: "warehouses", label: "Warehouses", count: data.warehouses.length }, { value: "integrations", label: "Integrations" }]} />
      <div className="mt-3" style={{ maxWidth: 960 }}>
        {tab === "company" ? <CompanyTab data={data} /> : null}
        {tab === "pricing" ? <PricingTab cs={cs} /> : null}
        {tab === "documents" ? <DocumentsTab cs={cs} /> : null}
        {tab === "compliance" ? <ComplianceTab cs={cs} /> : null}
        {tab === "teams" ? <TeamsTab data={data} /> : null}
        {tab === "checklists" ? <ChecklistsTab data={data} /> : null}
        {tab === "warehouses" ? <WarehousesTab data={data} /> : null}
        {tab === "integrations" ? <IntegrationsTab data={data} /> : null}
      </div>
    </div>
  );
}

function SaveRow({ dirty, pending, onSave }: { dirty: boolean; pending: boolean; onSave: () => void }) {
  return (
    <div className="row gap-2">
      <Button tone="primary" onClick={onSave} disabled={!dirty || pending}>Save</Button>
      {dirty ? <span className="small muted">Unsaved changes</span> : null}
    </div>
  );
}

function CompanyTab({ data }: { data: SettingsPayload }) {
  const o = data.org;
  const initial = { name: o.name, city: o.city, timezone: o.timezone, phone: o.phone, email: o.email, address: o.address, license: o.license };
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [o.name, o.city, o.timezone, o.phone, o.email, o.address, o.license]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction(() => api.patch("/settings", form), { success: "Company saved" });
  return (
    <div className="stack loose">
      <div className="field-grid">
        <Field label="Company name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        <Field label="Phone" help="Printed on documents and used as the texting reply number."><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Timezone" help="Every date in the app is the company day in this zone."><Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>{["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago", "America/New_York"].map((z) => <option key={z}>{z}</option>)}</Select></Field>
        <Field label="Contractor license"><Input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} /></Field>
      </div>
      <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
      <SaveRow dirty={JSON.stringify(form) !== JSON.stringify(initial)} pending={save.isPending} onSave={() => save.mutate()} />
    </div>
  );
}

function RatesTable({ title, help, rates, onChange }: { title: string; help: string; rates: HourlyRate[]; onChange: (rates: HourlyRate[]) => void }) {
  const row = (name: string) => rates.find((r) => r.name === name) ?? { name, rate: null };
  return (
    <Card title={title} flat>
      <p className="small muted" style={{ marginTop: -6 }}>{help}</p>
      <div className="field-grid">
        {LABOR_CLASSES.map((name) => (
          <Field key={name} label={name}>
            <Input type="number" step="0.01" value={row(name).rate ?? ""} onChange={(e) => onChange(LABOR_CLASSES.map((n) => (n === name ? { name: n, rate: e.target.value === "" ? null : Number(e.target.value) } : row(n))))} />
          </Field>
        ))}
      </div>
    </Card>
  );
}

function BandsTable({ title, bands, onChange }: { title: string; bands: MarkupBand[]; onChange: (bands: MarkupBand[]) => void }) {
  return (
    <Card title={title} flat actions={<Button size="sm" tone="ghost" icon="plus" onClick={() => onChange([...bands.slice(0, -1), { upTo: (bands[bands.length - 2]?.upTo ?? 0) + 500, divisor: 0.75 }, bands[bands.length - 1] ?? { upTo: null, divisor: 0.8 }])}>Band</Button>}>
      <p className="small muted" style={{ marginTop: -6 }}>Material sells at cost divided by the divisor for the band its unit cost falls in. A divisor of 0.55 is a 45% margin. The last band covers everything above.</p>
      <table className="table dense">
        <thead><tr><th>Unit cost up to</th><th className="num">Divisor</th><th className="num">Margin</th><th className="num">$100 sells for</th><th /></tr></thead>
        <tbody>
          {bands.map((b, i) => (
            <tr key={i}>
              <td>{b.upTo == null ? <span className="muted">Everything above</span> : <Input type="number" value={b.upTo} onChange={(e) => onChange(bands.map((x, j) => (j === i ? { ...x, upTo: Number(e.target.value) } : x)))} style={{ maxWidth: 140 }} />}</td>
              <td className="num"><Input type="number" step="0.01" value={b.divisor} onChange={(e) => onChange(bands.map((x, j) => (j === i ? { ...x, divisor: Number(e.target.value) } : x)))} style={{ maxWidth: 100, textAlign: "right" }} /></td>
              <td className="num">{b.divisor > 0 ? `${Math.round((1 - b.divisor) * 100)}%` : ""}</td>
              <td className="num">{b.divisor > 0 ? money(100 / b.divisor) : ""}</td>
              <td className="num">{b.upTo != null ? <Button size="sm" tone="ghost" icon="x" aria-label="Remove band" onClick={() => onChange(bands.filter((_, j) => j !== i))} /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function PricingTab({ cs }: { cs: CompanySettings }) {
  const [form, setForm] = useState<CompanySettings>(cs);
  useEffect(() => setForm(cs), [cs]);
  const save = useAction(() => api.patch("/settings", { settings: form }), { success: "Pricing saved" });
  const num = (key: "miscPercent" | "vehicleAmount" | "vehicleHours" | "defaultQuoteMargin" | "salesTaxPercent") => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(e.target.value) });
  return (
    <div className="stack loose">
      <Notice tone="plain">These numbers drive every bill and quote. Cost rates are what an hour costs you; bill rates are what customers pay. Contract customers use the contract tables.</Notice>
      <div className="grid cols-3">
        <RatesTable title="Cost rates" help="Per hour, loaded. Used for quotes, budgets and job cost." rates={form.costRates} onChange={(r) => setForm({ ...form, costRates: r })} />
        <RatesTable title="Standard bill rates" help="Customers not on contract." rates={form.nonContractRates} onChange={(r) => setForm({ ...form, nonContractRates: r })} />
        <RatesTable title="Contract bill rates" help="Customers flagged as contract." rates={form.contractRates} onChange={(r) => setForm({ ...form, contractRates: r })} />
      </div>
      <div className="grid cols-2">
        <BandsTable title="Material margin, standard" bands={form.nonContractMargin} onChange={(b) => setForm({ ...form, nonContractMargin: b })} />
        <BandsTable title="Material margin, contract" bands={form.contractMargin} onChange={(b) => setForm({ ...form, contractMargin: b })} />
      </div>
      <Card title="Other charges" flat>
        <div className="field-grid">
          <Field label="Misc material %" help="Of labor plus material on T&M bills."><Input type="number" step="0.1" value={form.miscPercent} onChange={num("miscPercent")} /></Field>
          <Field label="Vehicle charge"><Input type="number" step="1" value={form.vehicleAmount} onChange={num("vehicleAmount")} /></Field>
          <Field label="Per block of hours"><Input type="number" step="1" value={form.vehicleHours} onChange={num("vehicleHours")} /></Field>
          <Field label="Default quote margin %"><Input type="number" step="1" value={form.defaultQuoteMargin} onChange={num("defaultQuoteMargin")} /></Field>
          <Field label="Sales tax %" help="On material sell for T&M. Use tax on material cost for quoted and maintenance work. A site can override."><Input type="number" step="0.01" value={form.salesTaxPercent} onChange={num("salesTaxPercent")} /></Field>
        </div>
        <Switch on={form.billTravelSeparately} onChange={(v) => setForm({ ...form, billTravelSeparately: v })} label="Show travel as its own line on invoices" />
      </Card>
      <SaveRow dirty={JSON.stringify(form) !== JSON.stringify(cs)} pending={save.isPending} onSave={() => save.mutate()} />
    </div>
  );
}

function DocumentsTab({ cs }: { cs: CompanySettings }) {
  const [form, setForm] = useState(cs.documents);
  useEffect(() => setForm(cs.documents), [cs]);
  const save = useAction(() => api.patch("/settings", { settings: { documents: form } }), { success: "Document text saved" });
  return (
    <div className="stack loose">
      <Field label="From block" help="Top of quotes, invoices and purchase orders."><Textarea value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} rows={4} /></Field>
      <Field label="Terms"><Textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} rows={6} /></Field>
      <Field label="Signature block"><Textarea value={form.signatureBlock} onChange={(e) => setForm({ ...form, signatureBlock: e.target.value })} rows={5} /></Field>
      <SaveRow dirty={JSON.stringify(form) !== JSON.stringify(cs.documents)} pending={save.isPending} onSave={() => save.mutate()} />
    </div>
  );
}

function ComplianceTab({ cs }: { cs: CompanySettings }) {
  const [form, setForm] = useState(cs.compliance);
  useEffect(() => setForm(cs.compliance), [cs]);
  const save = useAction(() => api.patch("/settings", { settings: { compliance: form } }), { success: "Compliance settings saved" });
  const types = ["service", "maintenance", "quoted"] as const;
  return (
    <div className="stack loose">
      <div className="field-grid">
        <Field label="Refrigerant log required above, lb" help="Appliances with a full charge over this need the leak-rate log (EPA 608 uses 50 lb; California's RMP starts at 50 lb too)."><Input type="number" value={form.refrigerantLogRequiredOverLbs} onChange={(e) => setForm({ ...form, refrigerantLogRequiredOverLbs: Number(e.target.value) })} /></Field>
        <Field label="Warranty reminder, days" help="Follow-up lands this many days before a warranty window closes."><Input type="number" value={form.warrantyReminderDays} onChange={(e) => setForm({ ...form, warrantyReminderDays: Number(e.target.value) })} /></Field>
      </div>
      <Field label="Track permits on these job types">
        <div className="row wrap gap-3">{types.map((t) => <Check key={t} on={form.permitTrackingJobTypes.includes(t)} onChange={(v) => setForm({ ...form, permitTrackingJobTypes: v ? [...form.permitTrackingJobTypes, t] : form.permitTrackingJobTypes.filter((x) => x !== t) })} label={statusLabel(t)} />)}</div>
      </Field>
      <SaveRow dirty={JSON.stringify(form) !== JSON.stringify(cs.compliance)} pending={save.isPending} onSave={() => save.mutate()} />
    </div>
  );
}

function TeamsTab({ data }: { data: SettingsPayload }) {
  const [teamName, setTeamName] = useState("");
  const addTeam = useAction(() => api.post("/settings/teams", { name: teamName }), { success: "Team added", onSuccess: () => setTeamName("") });
  const [vendor, setVendor] = useState<{ id?: string; name: string; city: string; phone: string; email: string; active: boolean } | null>(null);
  const saveVendor = useAction(() => (vendor?.id ? api.patch(`/settings/vendors/${vendor.id}`, vendor) : api.post("/settings/vendors", vendor)), { success: "Vendor saved", onSuccess: () => setVendor(null) });
  return (
    <div className="two-col loose">
      <section className="section">
        <div className="section-head"><h3>Teams</h3></div>
        <div className="list">{data.teams.map((t) => <div key={t.id} className="item" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}><div><div className="title">{t.name}</div><div className="sub">{data.users.filter((u) => u.teamId === t.id && u.active).length} people</div></div>{t.isHome ? <Pill tone="open" plain>Home</Pill> : null}</div>)}</div>
        <div className="inline-form"><Field label="New team"><Input value={teamName} onChange={(e) => setTeamName(e.target.value)} /></Field><Button onClick={() => addTeam.mutate()} disabled={!teamName.trim()}>Add</Button></div>
      </section>
      <section className="section">
        <div className="section-head"><h3>Vendors</h3><Button size="sm" icon="plus" onClick={() => setVendor({ name: "", city: "", phone: "", email: "", active: true })}>Vendor</Button></div>
        <div className="list">{data.vendors.map((v) => <button key={v.id} type="button" className="item clickable" style={{ gridTemplateColumns: "minmax(0,1fr) auto", textAlign: "left" }} onClick={() => setVendor({ id: v.id, name: v.name, city: v.city, phone: v.phone, email: v.email, active: v.active })}><div><div className="title">{v.name}</div><div className="sub">{[v.city, v.phone, v.email].filter(Boolean).join(" · ")}</div></div>{!v.active ? <Pill tone="hold" plain>Inactive</Pill> : null}</button>)}</div>
      </section>
      <Sheet open={Boolean(vendor)} onClose={() => setVendor(null)} title={vendor?.id ? "Edit vendor" : "New vendor"} footer={<><Button tone="ghost" onClick={() => setVendor(null)}>Cancel</Button><Button tone="primary" onClick={() => saveVendor.mutate()} disabled={!vendor?.name.trim()}>Save</Button></>}>
        {vendor ? (
          <>
            <Field label="Name"><Input value={vendor.name} onChange={(e) => setVendor({ ...vendor, name: e.target.value })} /></Field>
            <div className="field-grid">
              <Field label="City"><Input value={vendor.city} onChange={(e) => setVendor({ ...vendor, city: e.target.value })} /></Field>
              <Field label="Phone"><Input value={vendor.phone} onChange={(e) => setVendor({ ...vendor, phone: e.target.value })} /></Field>
              <Field label="Email"><Input value={vendor.email} onChange={(e) => setVendor({ ...vendor, email: e.target.value })} /></Field>
            </div>
            <Switch on={vendor.active} onChange={(v) => setVendor({ ...vendor, active: v })} label="Active" />
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

type TemplateForm = { id?: string; name: string; kind: string; items: { key: string; label: string; hint: string }[]; requiredBeforeComplete: boolean; callTypes: string[]; active: boolean };

function ChecklistsTab({ data }: { data: SettingsPayload }) {
  const [tpl, setTpl] = useState<TemplateForm | null>(null);
  const save = useAction(() => {
    const body = { name: tpl!.name, kind: tpl!.kind, items: tpl!.items.filter((i) => i.label.trim()).map((i, n) => ({ key: i.key || `item-${n + 1}`, label: i.label, hint: i.hint || undefined })), requiredBeforeComplete: tpl!.requiredBeforeComplete, trigger: { callTypes: tpl!.callTypes }, active: tpl!.active };
    return tpl?.id ? api.patch(`/settings/checklists/${tpl.id}`, body) : api.post("/settings/checklists", body);
  }, { success: "Checklist saved", onSuccess: () => setTpl(null) });
  return (
    <div className="stack">
      <div className="row between wrap">
        <p className="small muted">Checklists the tech fills on the phone. A required checklist blocks completion until every item has a result.</p>
        <Button size="sm" icon="plus" onClick={() => setTpl({ name: "", kind: "custom", items: [{ key: "", label: "", hint: "" }], requiredBeforeComplete: false, callTypes: ["maintenance"], active: true })}>Checklist</Button>
      </div>
      <div className="list">
        {data.checklistTemplates.map((t) => (
          <button key={t.id} type="button" className="item clickable" style={{ gridTemplateColumns: "minmax(0,1fr) auto", textAlign: "left" }} onClick={() => setTpl({ id: t.id, name: t.name, kind: t.kind, items: t.items.map((i) => ({ key: i.key, label: i.label, hint: i.hint ?? "" })), requiredBeforeComplete: t.requiredBeforeComplete, callTypes: ((t.trigger as { callTypes?: string[] }).callTypes ?? []), active: t.active })}>
            <div><div className="title">{t.name}</div><div className="sub">{t.items.length} items · {((t.trigger as { callTypes?: string[] }).callTypes ?? []).map(statusLabel).join(", ") || "manual"}{t.requiredBeforeComplete ? " · required" : ""}</div></div>
            {!t.active ? <Pill tone="hold" plain>Off</Pill> : <Pill tone="site" plain>On</Pill>}
          </button>
        ))}
      </div>
      <Sheet open={Boolean(tpl)} onClose={() => setTpl(null)} title={tpl?.id ? "Edit checklist" : "New checklist"} wide footer={<><Button tone="ghost" onClick={() => setTpl(null)}>Cancel</Button><Button tone="primary" onClick={() => save.mutate()} disabled={!tpl?.name.trim()}>Save</Button></>}>
        {tpl ? (
          <>
            <div className="field-grid">
              <Field label="Name"><Input value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} /></Field>
              <Field label="Kind"><Select value={tpl.kind} onChange={(e) => setTpl({ ...tpl, kind: e.target.value })}><option value="pm">Maintenance</option><option value="startup">Start-up</option><option value="safety">Safety</option><option value="custom">Custom</option></Select></Field>
            </div>
            <Field label="Shown on these job types"><div className="row wrap gap-3">{["service", "maintenance", "quoted"].map((c) => <Check key={c} on={tpl.callTypes.includes(c)} onChange={(v) => setTpl({ ...tpl, callTypes: v ? [...tpl.callTypes, c] : tpl.callTypes.filter((x) => x !== c) })} label={statusLabel(c)} />)}</div></Field>
            <table className="table dense lines-table">
              <thead><tr><th>Item</th><th>Hint for the tech</th><th style={{ width: 40 }} /></tr></thead>
              <tbody>{tpl.items.map((it, i) => <tr key={i}><td><Input value={it.label} onChange={(e) => setTpl({ ...tpl, items: tpl.items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} /></td><td><Input value={it.hint} onChange={(e) => setTpl({ ...tpl, items: tpl.items.map((x, j) => (j === i ? { ...x, hint: e.target.value } : x)) })} /></td><td><Button size="sm" tone="ghost" icon="x" aria-label="Remove" onClick={() => setTpl({ ...tpl, items: tpl.items.filter((_, j) => j !== i) })} /></td></tr>)}</tbody>
            </table>
            <div><Button size="sm" tone="ghost" icon="plus" onClick={() => setTpl({ ...tpl, items: [...tpl.items, { key: "", label: "", hint: "" }] })}>Item</Button></div>
            <div className="row wrap gap-3">
              <Switch on={tpl.requiredBeforeComplete} onChange={(v) => setTpl({ ...tpl, requiredBeforeComplete: v })} label="Required before the job can be completed" />
              <Switch on={tpl.active} onChange={(v) => setTpl({ ...tpl, active: v })} label="Active" />
            </div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

function WarehousesTab({ data }: { data: SettingsPayload }) {
  const [w, setW] = useState<{ id?: string; name: string; kind: string; techId: string; targetValue: string; active: boolean } | null>(null);
  const save = useAction(() => {
    const body = { name: w!.name, kind: w!.kind, techId: w!.kind === "vehicle" ? w!.techId || null : null, targetValue: w!.targetValue ? Number(w!.targetValue) : null, active: w!.active };
    return w?.id ? api.patch(`/settings/warehouses/${w.id}`, body) : api.post("/settings/warehouses", body);
  }, { success: "Warehouse saved", onSuccess: () => setW(null) });
  const techs = data.users.filter((u) => u.role === "tech" && u.active);
  return (
    <div className="stack">
      <div className="row between wrap">
        <p className="small muted">The shop plus one van per tech. Van targets drive the replenishment list.</p>
        <Button size="sm" icon="plus" onClick={() => setW({ name: "", kind: "vehicle", techId: "", targetValue: "", active: true })}>Warehouse</Button>
      </div>
      <div className="list">
        {data.warehouses.map((x) => <button key={x.id} type="button" className="item clickable" style={{ gridTemplateColumns: "minmax(0,1fr) auto", textAlign: "left" }} onClick={() => setW({ id: x.id, name: x.name, kind: x.kind, techId: x.techId ?? "", targetValue: x.targetValue?.toString() ?? "", active: x.active })}><div><div className="title">{x.name}</div><div className="sub">{x.kind === "vehicle" ? `Van · ${techs.find((t) => t.id === x.techId)?.name ?? "no tech"}` : "Shop"}{x.targetValue ? ` · target ${money(x.targetValue)}` : ""}</div></div>{!x.active ? <Pill tone="hold" plain>Inactive</Pill> : null}</button>)}
      </div>
      <Sheet open={Boolean(w)} onClose={() => setW(null)} title={w?.id ? "Edit warehouse" : "New warehouse"} footer={<><Button tone="ghost" onClick={() => setW(null)}>Cancel</Button><Button tone="primary" onClick={() => save.mutate()} disabled={!w?.name.trim()}>Save</Button></>}>
        {w ? (
          <>
            <div className="field-grid">
              <Field label="Name"><Input value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} /></Field>
              <Field label="Kind"><Select value={w.kind} onChange={(e) => setW({ ...w, kind: e.target.value })}><option value="vehicle">Van</option><option value="main">Shop</option></Select></Field>
              {w.kind === "vehicle" ? <Field label="Tech"><Select value={w.techId} onChange={(e) => setW({ ...w, techId: e.target.value })}><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field> : null}
              <Field label="Target stock value"><Input type="number" value={w.targetValue} onChange={(e) => setW({ ...w, targetValue: e.target.value })} /></Field>
            </div>
            <Switch on={w.active} onChange={(v) => setW({ ...w, active: v })} label="Active" />
          </>
        ) : null}
      </Sheet>
    </div>
  );
}

function IntegrationsTab({ data }: { data: SettingsPayload }) {
  const labels: Record<string, string> = { quickbooks: "QuickBooks Online", sms: "Texting", payments: "Payments", maps: "Maps and drive times", auth: "Sign-in" };
  return (
    <div className="stack loose">
      <Notice tone="plain">Each integration is a provider behind an adapter. Keys go in the API's environment file; nothing is stored in the database. See docs/ARCHITECTURE.md for the adapter contracts.</Notice>
      <div className="grid cols-2">
        {Object.entries(data.integrations).map(([key, i]) => (
          <Card key={key} title={labels[key] ?? key} actions={<Pill tone={i.connected ? "site" : "hold"}>{i.connected ? "Connected" : "Not connected"}</Pill>}>
            <p className="small muted">{i.note}</p>
            {i.provider ? <Facts tight rows={[["Provider", i.provider]]} /> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
