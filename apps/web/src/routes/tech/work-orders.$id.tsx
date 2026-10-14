import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, qs } from "../../app/api";
import { dayLabel, elapsed, minuteLabel, money, stampLabel, statusLabel, woNumber } from "../../app/format";
import { techDayQuery, useAction, workOrderQuery, type WorkOrderDetail } from "../../app/queries";
import { toast } from "../../app/store";
import { useTechWho } from "../../app/shell/PhoneShell";
import type { InventoryItemRow, StockRow } from "../../app/types";
import { Button, Check, Field, Input, Loading, Notice, Pill, Select, Sheet, StatusTrack, Textarea } from "../../design/components";
import { Icon } from "../../design/icons";
import { FilePhoto } from "../../features/files/FilePhoto";

export const Route = createFileRoute("/tech/work-orders/$id")({ component: TechJob });

/** Best-effort position for the status stamp; resolves to nothing after two seconds so the tap never waits. */
function position(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
    const timer = setTimeout(() => resolve({}), 2000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(timer); resolve({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => { clearTimeout(timer); resolve({}); },
      { maximumAge: 60_000, timeout: 1800 },
    );
  });
}

function TechJob() {
  const { id } = Route.useParams();
  const who = useTechWho();
  const navigate = useNavigate();
  const query = useQuery(workOrderQuery(id));
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 30_000); return () => clearInterval(t); }, []);
  const setStatus = useAction(async (techStatus: string) => api.post(`/work-orders/${id}/tech-status`, { techStatus, ...(await position()) }), { success: (r) => statusLabel((r as { techStatus: string }).techStatus) });
  const addNote = useAction((body: string) => api.post(`/work-orders/${id}/notes`, { body }), { success: "Note added" });
  const upload = useAction((file: File) => { const fd = new FormData(); fd.append("file", file); fd.append("kind", "photo"); fd.append("workOrderId", id); return api.upload("/files", fd); }, { success: "Photo saved" });
  const draftQuote = useAction(() => api.post<{ id: string }>("/quotes", { workOrderId: id, customerId: d?.customer?.id ?? null, siteId: d?.site?.id ?? null, equipmentId: d?.equipment?.id ?? null, problemText: quoteText, reason: wo?.callType === "maintenance" ? "pm" : "service", scope: "" }), { success: "Quote drafted for the office", onSuccess: () => { setQuoteOpen(false); setQuoteText(""); } });
  const [note, setNote] = useState("");
  const [partsOpen, setPartsOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [refOpen, setRefOpen] = useState(false);
  const d = query.data;
  const wo = d?.workOrder;
  if (!d || !wo) return <Loading label="Loading the job" />;
  void tick;
  const address = d.site?.address ? `${d.site.address}${d.site.city ? `, ${d.site.city}` : ""}` : "";
  const mapsUrl = address ? `https://maps.apple.com/?daddr=${encodeURIComponent(address)}` : null;
  const phone = d.site?.contactPhone || wo.callerPhone || d.customer?.phone || "";
  const done = wo.status !== "open" || wo.techStatus === "done";
  const steps = [{ key: "sched", label: "Scheduled", at: wo.startMinute != null ? minuteLabel(wo.startMinute) : undefined }, { key: "en_route", label: "En route" }, { key: "on_site", label: "On site" }, { key: "done", label: "Done" }];
  const current = done ? "done" : wo.techStatus === "on_site" || wo.techStatus === "paused" ? "on_site" : wo.techStatus === "en_route" ? "en_route" : "sched";
  const photos = d.files.filter((f) => f.kind === "photo");
  const templates = d.checklistTemplates.filter((t) => t.trigger.callTypes?.includes(wo.callType));
  return (
    <div className="ph-page">
      <Link to="/tech" search={true} className="small nav-link muted">‹ Today</Link>
      <div>
        <div className="row between top">
          <h1><span className="num">{woNumber(wo)}</span></h1>
          <Pill tone={wo.priority === "urgent" ? "urgent" : wo.callType === "quoted" ? "quote" : "open"}>{wo.priority === "urgent" ? "Urgent" : statusLabel(wo.callType)}{wo.warranty ? " · warranty" : ""}</Pill>
        </div>
        <div className="strong" style={{ fontSize: 17 }}>{wo.title}</div>
        <div className="small muted">{wo.customerName} · {d.site?.name}</div>
      </div>
      <StatusTrack steps={steps} current={current} />
      {wo.dispatchNote ? <div className="notice"><b>Dispatch:</b> {wo.dispatchNote}</div> : null}
      {d.site?.accessNotes ? <div className="notice steel"><b>Access:</b> {d.site.accessNotes}</div> : null}

      {!done ? (
        <div className="big-actions">
          {!wo.techStatus ? <Button tone="primary" className="hero" onClick={() => setStatus.mutate("en_route")} disabled={setStatus.isPending}>On my way</Button> : null}
          {wo.techStatus === "en_route" ? <Button tone="moss" className="hero" onClick={() => setStatus.mutate("on_site")} disabled={setStatus.isPending}>Arrived · {elapsed(wo.techStatusAt)} driving</Button> : null}
          {wo.techStatus === "on_site" ? <><Button tone="steel" onClick={() => setStatus.mutate("paused")} disabled={setStatus.isPending}>Pause clock</Button><Button tone="copper" onClick={() => navigate({ to: "/tech/work-orders/$id/complete", params: { id }, search: true })}>Complete job</Button></> : null}
          {wo.techStatus === "paused" ? <><Button tone="moss" onClick={() => setStatus.mutate("on_site")} disabled={setStatus.isPending}>Back on site</Button><Button tone="copper" onClick={() => navigate({ to: "/tech/work-orders/$id/complete", params: { id }, search: true })}>Complete job</Button></> : null}
          {mapsUrl ? <a className="btn" href={mapsUrl} target="_blank" rel="noreferrer"><Icon name="map" /> Navigate</a> : <span />}
          {phone ? <a className="btn" href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Icon name="phone" /> Call {d.site?.contact?.split(" ")[0] || "site"}</a> : <span />}
        </div>
      ) : (
        <Notice tone="moss">Completed{wo.closedAt ? ` ${stampLabel(wo.closedAt)}` : ""}.{wo.signerName ? ` Signed by ${wo.signerName}.` : ""}</Notice>
      )}
      {wo.techStatus === "on_site" ? <div className="small muted">On site {elapsed(wo.techStatusAt)} · the clock is running on this job.</div> : null}

      <div className="ph-section">
        <span className="eyebrow">The problem</span>
        <div className="small">{wo.description || wo.title}</div>
        {wo.callerName ? <div className="small muted">Called in by {wo.callerName} {wo.callerPhone}</div> : null}
        {wo.billingType === "nte" && wo.nteAmount ? <div className="small muted">Not to exceed {money(wo.nteAmount)} without approval.</div> : null}
      </div>

      {d.equipment ? (
        <div className="ph-section">
          <span className="eyebrow">Equipment</span>
          <div className="card flat">
            <div className="strong">{d.equipment.tag} · {d.equipment.make} {d.equipment.model}</div>
            <div className="small muted">{[d.equipment.serial ? `SN ${d.equipment.serial}` : null, d.equipment.refrigerant, d.equipment.chargeLbs ? `${d.equipment.chargeLbs} lb` : null, d.equipment.installYear ? `installed ${d.equipment.installYear}` : null].filter(Boolean).join(" · ")}</div>
            {d.equipment.warrantyPartsUntil && d.equipment.warrantyPartsUntil >= new Date().toISOString().slice(0, 10) ? <Pill tone="warranty" plain>Parts warranty to {dayLabel(d.equipment.warrantyPartsUntil)}</Pill> : null}
          </div>
        </div>
      ) : null}

      <div className="ph-section">
        <div className="row between"><span className="eyebrow">Photos</span><label className="btn sm"><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} /><Icon name="camera" /> Add</label></div>
        <div className="photo-grid">
          {photos.map((f) => <FilePhoto key={f.id} id={f.id} caption={f.caption} />)}
          <label className="photo add"><input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />Before / after</label>
        </div>
      </div>

      {templates.length ? templates.map((t) => <Checklist key={t.id} woId={id} template={t} existing={d.checklists.find((c) => c.r.templateId === t.id)?.r.items ?? []} />) : null}

      <div className="ph-section">
        <div className="row between"><span className="eyebrow">Parts used</span><Button size="sm" onClick={() => setPartsOpen(true)}>From the van</Button></div>
        {d.truckParts.length === 0 && d.purchaseOrders.length === 0 ? <div className="small muted">Nothing yet. Parts you take from the van land on the bill automatically.</div> : null}
        {d.truckParts.map((p) => <div key={p.id} className="row between small"><span>{p.description} ×{p.quantity}</span><span className="muted">{money(p.unitCost * p.quantity)} cost</span></div>)}
        {d.purchaseOrders.map((po) => <div key={po.id} className="row between small"><span>PO {po.number} · {po.vendorName}</span><Pill tone={po.status === "received" ? "site" : "parts"} plain>{statusLabel(po.status)}</Pill></div>)}
      </div>

      <div className="ph-section">
        <div className="row between"><span className="eyebrow">Found more work?</span></div>
        <div className="big-actions">
          <Button onClick={() => setQuoteOpen(true)}><Icon name="tag" /> Draft a quote</Button>
          <Button onClick={() => setRefOpen(true)}><Icon name="wrench" /> Log refrigerant</Button>
        </div>
      </div>

      <div className="ph-section">
        <span className="eyebrow">Notes</span>
        <div className="row gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for the office" onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) { addNote.mutate(note); setNote(""); } }} />
          <Button onClick={() => { if (note.trim()) { addNote.mutate(note); setNote(""); } }} disabled={!note.trim()}>Add</Button>
        </div>
        {d.notes.slice(0, 6).map((n) => <div key={n.n.id} className="small"><span className="muted">{stampLabel(n.n.createdAt)} · {n.userName ?? "System"}</span><br />{n.n.body}</div>)}
      </div>

      {d.history.length ? (
        <div className="ph-section">
          <span className="eyebrow">Last visits here</span>
          {d.history.slice(0, 3).map((h) => <div key={h.id} className="small"><span className="num">{woNumber(h)}</span> · {dayLabel(h.scheduledFor)} · {h.title} <span className="muted">· {h.techName}</span></div>)}
        </div>
      ) : null}

      {!done ? <div className="ph-bar"><Button tone="copper" size="lg" onClick={() => navigate({ to: "/tech/work-orders/$id/complete", params: { id }, search: true })}>Complete job</Button></div> : null}

      <PartsSheet open={partsOpen} onClose={() => setPartsOpen(false)} woId={id} who={who} />
      <Sheet open={quoteOpen} onClose={() => setQuoteOpen(false)} title="Draft a quote" bottom footer={<Button tone="copper" block onClick={() => draftQuote.mutate()} disabled={!quoteText.trim()}>Send to the office</Button>}>
        <p className="small muted">Describe what you found. The office prices it and sends the customer options.</p>
        <Textarea value={quoteText} onChange={(e) => setQuoteText(e.target.value)} rows={4} placeholder="Condenser fan motor is seized on RTU-2; blade is bent. Recommend motor and blade." autoFocus />
      </Sheet>
      <RefrigerantSheet open={refOpen} onClose={() => setRefOpen(false)} woId={id} refrigerant={d.equipment?.refrigerant ?? "R-410A"} />
    </div>
  );
}

function Checklist({ woId, template, existing }: { woId: string; template: WorkOrderDetail["checklistTemplates"][number]; existing: { key: string; result: string; note?: string }[] }) {
  const [items, setItems] = useState<Record<string, { result: string; note: string }>>(Object.fromEntries(existing.map((i) => [i.key, { result: i.result, note: i.note ?? "" }])));
  const [dirty, setDirty] = useState(false);
  const save = useAction(() => api.post(`/work-orders/${woId}/checklist`, { templateId: template.id, items: Object.entries(items).map(([key, v]) => ({ key, result: v.result, note: v.note || undefined })), completedAt: Object.keys(items).length >= template.items.length ? new Date().toISOString() : undefined }), { success: "Checklist saved", onSuccess: () => setDirty(false) });
  const answered = template.items.filter((i) => items[i.key]).length;
  return (
    <div className="ph-section">
      <div className="row between"><span className="eyebrow">{template.name}{template.requiredBeforeComplete ? " · required" : ""}</span><span className="small muted">{answered}/{template.items.length}</span></div>
      <div className="checklist">
        {template.items.map((it) => (
          <div key={it.key} className="stack tight" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="small strong">{it.label}</div>
            <div className="choice-row">
              {(["pass", "flag", "fail", "na"] as const).map((r) => <button key={r} type="button" className={`${r}${items[it.key]?.result === r ? " on" : ""}`} onClick={() => { setItems({ ...items, [it.key]: { result: r, note: items[it.key]?.note ?? "" } }); setDirty(true); }}>{r === "na" ? "N/A" : statusLabel(r)}</button>)}
            </div>
            {items[it.key] && items[it.key]!.result !== "pass" && items[it.key]!.result !== "na" ? <Input value={items[it.key]?.note ?? ""} onChange={(e) => { setItems({ ...items, [it.key]: { result: items[it.key]!.result, note: e.target.value } }); setDirty(true); }} placeholder="What you saw" /> : null}
          </div>
        ))}
      </div>
      {dirty ? <Button tone="primary" onClick={() => save.mutate()}>Save checklist</Button> : null}
    </div>
  );
}

function PartsSheet({ open, onClose, woId, who }: { open: boolean; onClose: () => void; woId: string; who: string }) {
  const day = useQuery({ ...techDayQuery(who), enabled: open && who !== "me" });
  const warehouseId = who === "me" ? "mine" : day.data?.van?.id;
  const stock = useQuery({ queryKey: ["stock", warehouseId], queryFn: () => api.get<{ warehouse: { id: string; name: string } | null; stock: (StockRow & { item: InventoryItemRow; status: string })[] }>(`/inventory/stock${qs({ warehouseId })}`), enabled: open && Boolean(warehouseId) });
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState({ description: "", quantity: "1", unitCost: "" });
  const use = useAction((vars: { itemId: string | null; description: string; quantity: number; unitCost: number }) => api.post(`/work-orders/${woId}/parts`, { warehouseId: stock.data?.warehouse?.id, ...vars }), { success: "Part added to the job", onSuccess: onClose });
  const rows = (stock.data?.stock ?? []).filter((s) => !q || `${s.item.sku} ${s.item.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet open={open} onClose={onClose} title={stock.data?.warehouse ? `From ${stock.data.warehouse.name}` : "Parts from the van"} bottom>
      {!stock.data?.warehouse ? <Notice>No van is assigned to you. Ask the office to set one up under Settings, Warehouses.</Notice> : null}
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your stock" />
      <div className="list">
        {rows.map((s) => (
          <div key={s.id} className="item" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div><div className="title">{s.item.name}</div><div className="sub">{s.item.sku} · {s.onHand} on hand · {money(s.item.unitCost)} cost</div></div>
            <Button size="sm" onClick={() => use.mutate({ itemId: s.itemId, description: s.item.name, quantity: 1, unitCost: s.item.unitCost })} disabled={s.onHand <= 0}>Use 1</Button>
          </div>
        ))}
      </div>
      <div className="stack tight">
        <span className="eyebrow">Not on the list</span>
        <Input value={custom.description} onChange={(e) => setCustom({ ...custom, description: e.target.value })} placeholder="Part description" />
        <div className="row gap-2">
          <Input type="number" value={custom.quantity} onChange={(e) => setCustom({ ...custom, quantity: e.target.value })} placeholder="Qty" />
          <Input type="number" step="0.01" value={custom.unitCost} onChange={(e) => setCustom({ ...custom, unitCost: e.target.value })} placeholder="Unit cost" />
          <Button onClick={() => use.mutate({ itemId: null, description: custom.description, quantity: Number(custom.quantity || 1), unitCost: Number(custom.unitCost || 0) })} disabled={!custom.description.trim() || !stock.data?.warehouse}>Add</Button>
        </div>
      </div>
    </Sheet>
  );
}

function RefrigerantSheet({ open, onClose, woId, refrigerant }: { open: boolean; onClose: () => void; woId: string; refrigerant: string }) {
  const [form, setForm] = useState({ refrigerantType: refrigerant, lbsAdded: "", lbsRecovered: "", cylinderId: "", leakCheck: "na", notes: "" });
  useEffect(() => setForm((f) => ({ ...f, refrigerantType: refrigerant })), [refrigerant]);
  const log = useAction(() => api.post(`/work-orders/${woId}/refrigerant`, { ...form, lbsAdded: Number(form.lbsAdded || 0), lbsRecovered: Number(form.lbsRecovered || 0) }), { success: "Logged", onSuccess: () => { onClose(); toast("Refrigerant log saved to the unit"); } });
  return (
    <Sheet open={open} onClose={onClose} title="Refrigerant" bottom footer={<Button tone="primary" block onClick={() => log.mutate()}>Save log</Button>}>
      <div className="field-grid">
        <Field label="Type"><Input value={form.refrigerantType} onChange={(e) => setForm({ ...form, refrigerantType: e.target.value })} /></Field>
        <Field label="Cylinder"><Input value={form.cylinderId} onChange={(e) => setForm({ ...form, cylinderId: e.target.value })} /></Field>
        <Field label="Added, lb"><Input type="number" step="0.1" inputMode="decimal" value={form.lbsAdded} onChange={(e) => setForm({ ...form, lbsAdded: e.target.value })} /></Field>
        <Field label="Recovered, lb"><Input type="number" step="0.1" inputMode="decimal" value={form.lbsRecovered} onChange={(e) => setForm({ ...form, lbsRecovered: e.target.value })} /></Field>
      </div>
      <Field label="Leak check"><Select value={form.leakCheck} onChange={(e) => setForm({ ...form, leakCheck: e.target.value })}><option value="na">Not done</option><option value="passed">Passed</option><option value="failed">Failed, leak found</option></Select></Field>
      <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Where the leak was, what was repaired" /></Field>
      <Check on={false} onChange={() => undefined} label="Your EPA 608 certification is recorded with the entry" />
    </Sheet>
  );
}
