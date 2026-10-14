import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../app/api";
import { dayLabel, minuteLabel, money, stampLabel, statusLabel, woNumber, woTone } from "../../app/format";
import { useAction } from "../../app/queries";
import type { AgreementRow, CustomerRow, EquipmentRow, FieldChange, RefrigerantLogRow, SiteRow, WorkOrderRow } from "../../app/types";
import { BackBar, Button, Card, Empty, ErrorBox, Field, Input, LinkButton, Loading, Pill, Select, Sheet, Tabs, Textarea } from "../../design/components";

interface SiteDetail {
  site: SiteRow;
  customer: CustomerRow | null;
  equipment: EquipmentRow[];
  agreement: (AgreementRow & { assetIds: string[] }) | null;
  openWorkOrders: WorkOrderRow[];
  history: WorkOrderRow[];
  refrigerantLogs: RefrigerantLogRow[];
  warrantyClaims: { id: string; equipmentId: string | null; manufacturer: string; claimStatus: string; partsReturnBy: string | null; notes: string }[];
  techs: { id: string; name: string }[];
  changes: FieldChange[];
}

export const Route = createFileRoute("/_office/sites/$id")({ component: SitePage });

type Tab = "equipment" | "work" | "compliance" | "details";

const emptyUnit = { tag: "", kind: "RTU", make: "", model: "", serial: "", tons: "", refrigerant: "R-410A", chargeLbs: "", installYear: "", warrantyPartsUntil: "", warrantyLaborUntil: "", locationNote: "" };

function SitePage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["site", id], queryFn: () => api.get<SiteDetail>(`/sites/${id}`) });
  const [tab, setTab] = useState<Tab>("equipment");
  if (query.isLoading) return <Loading label="Loading the site" />;
  if (query.error || !query.data) return <div className="page"><ErrorBox error={query.error ?? "Not found"} /></div>;
  const d = query.data;
  const site = d.site;
  const primary = d.techs.find((t) => t.id === site.primaryTechId);
  return (
    <>
      <BackBar to={d.customer ? "/customers/$id" : "/customers"} params={d.customer ? { id: d.customer.id } : undefined} place={d.customer?.name ?? "Customers"} />
      <div className="page">
        <div className="row top between wrap gap-3">
          <div className="stack tight">
            <h1 style={{ fontSize: 24 }}>{site.name || site.address}</h1>
            <div className="small muted">{site.address}{site.city ? `, ${site.city}` : ""}{d.customer ? <> · <Link to="/customers/$id" params={{ id: d.customer.id }} className="nav-link">{d.customer.name}</Link></> : null}</div>
            <div className="row wrap gap-2">
              {d.agreement ? <Pill tone="copper" plain>{d.agreement.name} · {d.agreement.visitsPerYear} visits{d.agreement.responseHours ? ` · ${d.agreement.responseHours} h response` : ""}</Pill> : null}
              {primary ? <Pill tone="sched" plain>{primary.name}, primary tech</Pill> : <Pill tone="hold" plain>No primary tech</Pill>}
              {d.customer?.contract ? <Pill tone="open" plain>Contract pricing</Pill> : null}
            </div>
            {site.accessNotes ? <div className="small"><b>Access:</b> {site.accessNotes}</div> : null}
          </div>
          <div className="row gap-2">
            <LinkButton to="/new/work-order" search={{ siteId: site.id } as never} tone="copper" size="sm" icon="plus">Work order here</LinkButton>
          </div>
        </div>
        <div className="mt-3">
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "equipment", label: "Equipment", count: d.equipment.length }, { value: "work", label: "Work", count: d.openWorkOrders.length }, { value: "compliance", label: "Compliance", count: d.refrigerantLogs.length + d.warrantyClaims.length }, { value: "details", label: "Site details" }]} />
        </div>
        <div className="mt-3">
          {tab === "equipment" ? <EquipmentTab d={d} /> : null}
          {tab === "work" ? <WorkTab d={d} /> : null}
          {tab === "compliance" ? <ComplianceTab d={d} /> : null}
          {tab === "details" ? <DetailsTab d={d} /> : null}
        </div>
      </div>
    </>
  );
}

function EquipmentTab({ d }: { d: SiteDetail }) {
  const [editing, setEditing] = useState<EquipmentRow | "new" | null>(null);
  const [form, setForm] = useState(emptyUnit);
  useEffect(() => {
    if (editing === "new") setForm(emptyUnit);
    else if (editing) setForm({ tag: editing.tag, kind: editing.kind, make: editing.make, model: editing.model, serial: editing.serial, tons: editing.tons?.toString() ?? "", refrigerant: editing.refrigerant, chargeLbs: editing.chargeLbs?.toString() ?? "", installYear: editing.installYear?.toString() ?? "", warrantyPartsUntil: editing.warrantyPartsUntil ?? "", warrantyLaborUntil: editing.warrantyLaborUntil ?? "", locationNote: editing.locationNote });
  }, [editing]);
  const body = () => ({ ...form, tons: form.tons === "" ? null : Number(form.tons), chargeLbs: form.chargeLbs === "" ? null : Number(form.chargeLbs), installYear: form.installYear === "" ? null : Number(form.installYear), warrantyPartsUntil: form.warrantyPartsUntil || null, warrantyLaborUntil: form.warrantyLaborUntil || null });
  const save = useAction(() => (editing === "new" ? api.post("/equipment", { siteId: d.site.id, ...body() }) : api.patch(`/equipment/${(editing as EquipmentRow).id}`, body())), { success: "Equipment saved", onSuccess: () => setEditing(null) });
  const upload = useAction((vars: { unit: EquipmentRow; file: File }) => { const fd = new FormData(); fd.append("file", vars.file); fd.append("kind", "nameplate"); fd.append("equipmentId", vars.unit.id); return api.upload("/files", fd); }, { success: "Nameplate photo saved" });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="stack">
      <div className="row between wrap">
        <span className="small muted">Every unit the tech will touch, with the data the refrigerant log and warranty checks need.</span>
        <Button size="sm" icon="plus" onClick={() => setEditing("new")}>Add unit</Button>
      </div>
      {d.equipment.length === 0 ? <Empty title="No equipment on file">Add the units, or let the tech photograph the nameplates on the first visit.</Empty> : (
        <div className="grid auto">
          {d.equipment.map((u) => {
            const underWarranty = u.warrantyPartsUntil && u.warrantyPartsUntil >= today;
            const onAgreement = d.agreement?.assetIds.includes(u.id);
            return (
              <Card key={u.id} title={<h3>{u.tag} <span className="muted" style={{ fontWeight: 400 }}>· {u.kind}</span></h3>} actions={<Button size="sm" tone="ghost" onClick={() => setEditing(u)}>Edit</Button>}>
                <div className="stack tight small">
                  <div><b>{u.make} {u.model}</b>{u.tons ? ` · ${u.tons} ton` : ""}</div>
                  <div className="muted">{[u.serial ? `SN ${u.serial}` : null, u.refrigerant ? `${u.refrigerant}${u.chargeLbs ? ` ${u.chargeLbs} lb` : ""}` : null, u.installYear ? `installed ${u.installYear}` : null].filter(Boolean).join(" · ")}</div>
                  {u.locationNote ? <div className="muted">{u.locationNote}</div> : null}
                  <div className="row wrap gap-2 mt-1">
                    {underWarranty ? <Pill tone="warranty" plain>Parts warranty to {dayLabel(u.warrantyPartsUntil)}</Pill> : null}
                    {onAgreement ? <Pill tone="copper" plain>On agreement</Pill> : null}
                    {u.stage !== "active" ? <Pill tone="hold" plain>{statusLabel(u.stage)}</Pill> : null}
                    {u.nameplateFileId ? <a className="pill plain open" href={api.fileUrl(u.nameplateFileId)} target="_blank" rel="noreferrer">Nameplate photo</a> : <label className="pill plain hold" style={{ cursor: "pointer" }}><input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate({ unit: u, file: e.target.files[0] })} />Add nameplate photo</label>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a unit" : `Edit ${(editing as EquipmentRow | null)?.tag ?? ""}`} footer={<><Button tone="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button tone="primary" onClick={() => save.mutate()} disabled={!form.tag}>Save</Button></>}>
        <div className="field-grid">
          <Field label="Tag" help="RTU-1, AHU-2, Split-1."><Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></Field>
          <Field label="Kind"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{["RTU", "Split system", "Heat pump", "Mini split", "Furnace", "Boiler", "Chiller", "Walk-in cooler", "Exhaust fan", "Make-up air", "Other"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
          <Field label="Make"><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
          <Field label="Model"><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
          <Field label="Serial"><Input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} /></Field>
          <Field label="Tons"><Input type="number" step="0.5" value={form.tons} onChange={(e) => setForm({ ...form, tons: e.target.value })} /></Field>
          <Field label="Refrigerant"><Input value={form.refrigerant} onChange={(e) => setForm({ ...form, refrigerant: e.target.value })} /></Field>
          <Field label="Full charge, lb" help="Needed for the leak-rate math."><Input type="number" step="0.1" value={form.chargeLbs} onChange={(e) => setForm({ ...form, chargeLbs: e.target.value })} /></Field>
          <Field label="Install year"><Input type="number" value={form.installYear} onChange={(e) => setForm({ ...form, installYear: e.target.value })} /></Field>
          <Field label="Parts warranty until"><Input type="date" value={form.warrantyPartsUntil} onChange={(e) => setForm({ ...form, warrantyPartsUntil: e.target.value })} /></Field>
          <Field label="Labor warranty until"><Input type="date" value={form.warrantyLaborUntil} onChange={(e) => setForm({ ...form, warrantyLaborUntil: e.target.value })} /></Field>
        </div>
        <Field label="Where it is" help="Roof, north side, behind the parapet."><Input value={form.locationNote} onChange={(e) => setForm({ ...form, locationNote: e.target.value })} /></Field>
      </Sheet>
    </div>
  );
}

function WorkTab({ d }: { d: SiteDetail }) {
  const list = (rows: WorkOrderRow[], empty: string) => rows.length === 0 ? <p className="small muted">{empty}</p> : (
    <div className="list">
      {rows.map((w) => (
        <Link key={w.id} to="/work-orders/$id" params={{ id: w.id }} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
          <div><div className="title"><span className="num">{woNumber(w)}</span> · {w.title}</div><div className="sub">{w.scheduledFor ? `${dayLabel(w.scheduledFor)}${w.startMinute != null ? ` ${minuteLabel(w.startMinute)}` : ""}` : "Not scheduled"} · {w.techName ?? "unassigned"}{w.quotedAmount ? ` · ${money(w.quotedAmount)}` : ""}</div></div>
          <Pill tone={woTone(w)}>{w.status === "open" && w.techStatus ? statusLabel(w.techStatus) : statusLabel(w.status)}</Pill>
        </Link>
      ))}
    </div>
  );
  return (
    <div className="two-col">
      <section className="section"><div className="section-head"><h3>Open</h3></div>{list(d.openWorkOrders, "Nothing open at this site.")}</section>
      <section className="section"><div className="section-head"><h3>History</h3></div>{list(d.history, "No completed visits yet.")}</section>
    </div>
  );
}

function ComplianceTab({ d }: { d: SiteDetail }) {
  const unitTag = (id: string | null) => d.equipment.find((u) => u.id === id)?.tag ?? "";
  return (
    <div className="stack loose">
      <section className="section">
        <div className="section-head"><h3>Refrigerant log</h3><span className="small muted">All units at this site</span></div>
        {d.refrigerantLogs.length === 0 ? <p className="small muted">No refrigerant handled here yet.</p> : (
          <div className="table-wrap"><table className="table dense"><thead><tr><th>When</th><th>Unit</th><th>Type</th><th className="num">Added</th><th className="num">Recovered</th><th>Leak check</th><th className="num">Leak rate</th></tr></thead><tbody>{d.refrigerantLogs.map((l) => <tr key={l.id}><td className="num">{stampLabel(l.loggedAt)}</td><td>{unitTag(l.equipmentId)}</td><td>{l.refrigerantType}</td><td className="num">{l.lbsAdded} lb</td><td className="num">{l.lbsRecovered} lb</td><td>{statusLabel(l.leakCheck)}</td><td className="num" style={{ color: (l.leakRatePercent ?? 0) > 10 ? "var(--red)" : undefined }}>{l.leakRatePercent != null ? `${l.leakRatePercent}%` : ""}</td></tr>)}</tbody></table></div>
        )}
      </section>
      <section className="section">
        <div className="section-head"><h3>Warranty claims</h3></div>
        {d.warrantyClaims.length === 0 ? <p className="small muted">No warranty claims.</p> : d.warrantyClaims.map((w) => <div key={w.id} className="small">{unitTag(w.equipmentId)} · {w.manufacturer} · {statusLabel(w.claimStatus)}{w.partsReturnBy ? ` · parts back by ${dayLabel(w.partsReturnBy)}` : ""} · {w.notes}</div>)}
      </section>
    </div>
  );
}

function DetailsTab({ d }: { d: SiteDetail }) {
  const s = d.site;
  const initial = { name: s.name, address: s.address, city: s.city, contact: s.contact, contactPhone: s.contactPhone, accessNotes: s.accessNotes, primaryTechId: s.primaryTechId ?? "", backupTechId: s.backupTechId ?? "", taxRate: s.taxRate?.toString() ?? "", invoiceDelivery: s.invoiceDelivery ?? "", lat: s.lat?.toString() ?? "", lng: s.lng?.toString() ?? "" };
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [s.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useAction(() => api.patch(`/sites/${s.id}`, { ...form, primaryTechId: form.primaryTechId || null, backupTechId: form.backupTechId || null, taxRate: form.taxRate === "" ? null : Number(form.taxRate), invoiceDelivery: form.invoiceDelivery || null, lat: form.lat === "" ? null : Number(form.lat), lng: form.lng === "" ? null : Number(form.lng) }), { success: "Site saved" });
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  return (
    <div className="two-col loose">
      <div className="stack loose">
        <div className="field-grid">
          <Field label="Site name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
        </div>
        <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <div className="field-grid">
          <Field label="On-site contact"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
          <Field label="Contact mobile" help="Gets the on-my-way text."><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
          <Field label="Primary tech"><Select value={form.primaryTechId} onChange={(e) => setForm({ ...form, primaryTechId: e.target.value })}><option value="">None</option>{d.techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Backup tech"><Select value={form.backupTechId} onChange={(e) => setForm({ ...form, backupTechId: e.target.value })}><option value="">None</option>{d.techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Sales tax %" help="Overrides the company rate."><Input type="number" step="0.01" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} /></Field>
          <Field label="Invoice delivery"><Select value={form.invoiceDelivery} onChange={(e) => setForm({ ...form, invoiceDelivery: e.target.value })}><option value="">Customer default</option><option value="email">Email</option><option value="print">Print and mail</option><option value="both">Email and print</option><option value="text">Text a link</option></Select></Field>
          <Field label="Latitude"><Input type="number" step="0.00001" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="Longitude"><Input type="number" step="0.00001" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
        </div>
        <Field label="Access notes" help="Shown to the tech before arrival."><Textarea value={form.accessNotes} onChange={(e) => setForm({ ...form, accessNotes: e.target.value })} rows={3} /></Field>
        <div className="row gap-2">
          <Button tone="primary" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>Save</Button>
          {dirty ? <span className="small muted">Unsaved changes</span> : null}
        </div>
      </div>
      <div className="stack tight">
        <span className="eyebrow">Change log</span>
        <div className="timeline">{d.changes.map((ch) => <div key={ch.f.id} className="tl steel"><div className="when">{stampLabel(ch.f.createdAt)}</div><div className="what">{ch.f.field}: {ch.f.fromValue ? `${ch.f.fromValue} → ` : ""}{ch.f.toValue}</div><div className="who">{ch.userName ?? "System"}</div></div>)}</div>
        {d.changes.length === 0 ? <p className="small muted">No changes recorded yet.</p> : null}
      </div>
    </div>
  );
}
