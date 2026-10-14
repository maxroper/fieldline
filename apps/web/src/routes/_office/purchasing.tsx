import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, money, stampLabel, statusLabel, woNumber } from "../../app/format";
import { useAction, workOrdersQuery } from "../../app/queries";
import type { PoLineRow, PurchaseOrderRow, WarehouseRow } from "../../app/types";
import { Button, Check, Chip, Empty, Facts, Field, Input, Loading, Notice, Pill, Select, Sheet, SummaryLine } from "../../design/components";

type PoListRow = PurchaseOrderRow & { workOrderNumber: number | null; workOrderTrip: number | null; workOrderTitle: string | null; siteName: string | null; warehouseName: string | null; lines: PoLineRow[]; cost: number; received: number };

interface PurchasingPayload {
  purchaseOrders: PoListRow[];
  summary: { open: number; awaitingInvoice: number; lumpReminders: number; openValue: number };
}

const search = z.object({ view: z.enum(["open", "awaiting", "lump", "all"]).default("open"), q: z.string().optional(), po: z.string().optional(), newFor: z.string().optional() });

export const Route = createFileRoute("/_office/purchasing")({ validateSearch: search, component: PurchasingPage });

const poTone = (status: string) => (status === "received" || status === "invoiced" ? "site" : status === "partial" ? "parts" : status === "cancelled" ? "hold" : status === "draft" ? "open" : "sched");

function PurchasingPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const apiParams = { q: params.q, status: params.view === "open" ? "draft,issued,partial" : params.view === "awaiting" ? "received" : undefined, lines: params.view === "lump" ? "lump" : undefined };
  const query = useQuery({ queryKey: ["purchasing", apiParams], queryFn: () => api.get<PurchasingPayload>(`/purchasing${qs(apiParams)}`) });
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => { if (params.newFor) setNewOpen(true); }, [params.newFor]);
  const data = query.data;
  const rows = data?.purchaseOrders ?? [];
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {([["open", "Open"], ["awaiting", "Awaiting vendor invoice"], ["lump", "Lump sum"], ["all", "All"]] as const).map(([v, label]) => <Chip key={v} on={params.view === v} onClick={() => setSearch({ view: v })}>{label}</Chip>)}
        </div>
        <div className="search" style={{ flex: "1 1 200px", maxWidth: 320 }}>
          <input className="input" type="search" placeholder="PO, vendor, or work order number" defaultValue={params.q ?? ""} onKeyDown={(e) => e.key === "Enter" && setSearch({ q: (e.target as HTMLInputElement).value || undefined })} />
        </div>
        <span className="grow" />
        <Button tone="copper" size="sm" icon="plus" onClick={() => setNewOpen(true)}>Purchase order</Button>
      </div>
      <div className="page">
        {query.isLoading || !data ? <Loading label="Loading purchase orders" /> : (
          <div className="stack loose">
            <SummaryLine items={[{ dot: "steel", value: data.summary.open, label: "open" }, { dot: "moss", value: data.summary.awaitingInvoice, label: "awaiting invoice" }, { dot: "rust", value: data.summary.lumpReminders, label: "lump sums need lines" }, { value: money(data.summary.openValue), label: "on order" }]} />
            {rows.length === 0 ? <Empty title="No purchase orders in this view">Issue one for a job's parts or to restock a van.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>PO</th><th>Vendor</th><th>For</th><th>Lines</th><th className="num">Cost</th><th>Expected</th><th>Status</th></tr></thead>
                  <tbody className="stagger">
                    {rows.map((po) => (
                      <tr key={po.id} className={`clickable${params.po === po.id ? " on" : ""}`} onClick={() => setSearch({ po: po.id })}>
                        <td className="num primary-cell">{po.number}</td>
                        <td className="primary-cell">{po.vendorName}</td>
                        <td>{po.workOrderNumber ? <span><span className="num">{woNumber({ number: po.workOrderNumber, trip: po.workOrderTrip })}</span> {po.workOrderTitle} <span className="muted small">· {po.siteName}</span></span> : <span className="muted">Stock · {po.warehouseName}</span>}</td>
                        <td className="small">{po.lumpSum ? <Pill tone="parts" plain>Lump sum</Pill> : `${po.lines.length} line${po.lines.length === 1 ? "" : "s"}${po.lines.some((l) => l.receivedQty > 0 && l.receivedQty < l.quantity) ? " · partial" : ""}`}</td>
                        <td className="num">{money(po.cost)}</td>
                        <td className="num">{po.expectedDate ? dayLabel(po.expectedDate) : ""}</td>
                        <td><Pill tone={poTone(po.status)}>{statusLabel(po.status)}</Pill></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <PoSheet id={params.po} onClose={() => setSearch({ po: undefined })} />
      <NewPoSheet open={newOpen} workOrderId={params.newFor} onClose={() => { setNewOpen(false); if (params.newFor) setSearch({ newFor: undefined }); }} onCreated={(id) => { setNewOpen(false); setSearch({ po: id, newFor: undefined, view: "open" }); }} />
    </>
  );
}

function PoSheet({ id, onClose }: { id: string | undefined; onClose: () => void }) {
  const query = useQuery({ queryKey: ["purchase-order", id], queryFn: () => api.get<{ purchaseOrder: PurchaseOrderRow; lines: PoLineRow[]; files: { id: string; kind: string; caption: string; createdAt: string }[]; workOrder: { id: string; number: number; trip: number; title: string } | null }>(`/purchasing/${id}`), enabled: Boolean(id) });
  const [recv, setRecv] = useState<Record<string, string>>({});
  const [inv, setInv] = useState({ number: "", date: "", amount: "" });
  useEffect(() => {
    if (query.data) {
      setRecv(Object.fromEntries(query.data.lines.map((l) => [l.id, String(l.receivedQty)])));
      setInv({ number: query.data.purchaseOrder.vendorInvoiceNumber, date: query.data.purchaseOrder.vendorInvoiceDate ?? "", amount: query.data.purchaseOrder.vendorInvoiceAmount?.toString() ?? "" });
    }
  }, [query.data]);
  const receive = useAction((lines: { lineId: string; receivedQty: number }[]) => api.post(`/purchasing/${id}/receive`, { lines }), { success: "Received" });
  const vendorInvoice = useAction(() => api.post(`/purchasing/${id}/vendor-invoice`, { number: inv.number, date: inv.date || null, amount: inv.amount === "" ? null : Number(inv.amount) }), { success: "Vendor invoice recorded" });
  const upload = useAction((file: File) => { const fd = new FormData(); fd.append("file", file); fd.append("kind", "vendor_invoice"); fd.append("relatedId", id ?? ""); return api.upload("/files", fd); }, { success: "Document attached" });
  const d = query.data;
  const po = d?.purchaseOrder;
  const lineTotal = d ? d.lines.reduce((s, l) => s + l.quantity * l.unitCost, 0) : 0;
  return (
    <Sheet open={Boolean(id)} onClose={onClose} title={po ? `PO ${po.number} · ${po.vendorName}` : "Purchase order"} wide>
      {!d || !po ? <Loading /> : (
        <div className="stack loose">
          <div className="row wrap gap-2">
            <Pill tone={poTone(po.status)}>{statusLabel(po.status)}</Pill>
            {po.lumpSum ? <Pill tone="parts" plain>Lump sum {money(po.lumpSumAmount ?? 0)}</Pill> : null}
            {d.workOrder ? <Link to="/work-orders/$id" params={{ id: d.workOrder.id }} className="pill plain open nav-link">WO {woNumber(d.workOrder)} · {d.workOrder.title}</Link> : <Pill tone="open" plain>Ship to stock</Pill>}
          </div>
          <Facts tight rows={[["Ordered", stampLabel(po.orderedAt)], ["Expected", po.expectedDate ? dayLabel(po.expectedDate) : "—"], ["Received", po.receivedAt ? stampLabel(po.receivedAt) : "—"], ["Vendor invoice", po.vendorInvoiceNumber ? `${po.vendorInvoiceNumber} · ${money(po.vendorInvoiceAmount ?? 0)}` : "—"]]} />
          {po.lumpSum && po.status !== "invoiced" ? <Notice>Lump-sum PO. Upload the pack list or vendor invoice and add the lines so the parts land on the customer's bill at cost plus margin.</Notice> : null}
          <section className="section">
            <div className="section-head"><h3>Lines</h3>{po.status !== "invoiced" && po.status !== "cancelled" && d.lines.length ? <div className="row gap-2"><Button size="sm" tone="ghost" onClick={() => receive.mutate(d.lines.map((l) => ({ lineId: l.id, receivedQty: l.quantity })))}>Receive all</Button><Button size="sm" tone="primary" onClick={() => receive.mutate(d.lines.map((l) => ({ lineId: l.id, receivedQty: Number(recv[l.id] ?? l.receivedQty) })))}>Save received</Button></div> : null}</div>
            {d.lines.length === 0 ? <p className="small muted">No lines yet.</p> : (
              <table className="table dense">
                <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Total</th><th className="num">Received</th></tr></thead>
                <tbody>{d.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className="num">{l.quantity}</td><td className="num">{money(l.unitCost)}</td><td className="num">{money(l.quantity * l.unitCost)}</td><td className="num"><Input type="number" min={0} value={recv[l.id] ?? ""} onChange={(e) => setRecv({ ...recv, [l.id]: e.target.value })} style={{ width: 80, minHeight: 30, padding: "2px 8px", textAlign: "right" }} disabled={po.status === "invoiced"} /></td></tr>)}</tbody>
              </table>
            )}
          </section>
          <section className="section">
            <div className="section-head"><h3>Vendor invoice</h3></div>
            <div className="inline-form">
              <Field label="Invoice number"><Input value={inv.number} onChange={(e) => setInv({ ...inv, number: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={inv.date} onChange={(e) => setInv({ ...inv, date: e.target.value })} /></Field>
              <Field label="Amount"><Input type="number" step="0.01" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} /></Field>
              <Button onClick={() => vendorInvoice.mutate()} disabled={po.status === "invoiced"}>Record</Button>
            </div>
            {inv.amount && d.lines.length && Math.abs(Number(inv.amount) - lineTotal) > 0.5 ? <Notice tone="red">The vendor invoice differs from the PO lines by {money(Number(inv.amount) - lineTotal)}. Fix the lines before the job bills.</Notice> : null}
          </section>
          <section className="section">
            <div className="section-head"><h3>Documents</h3><label className="btn sm"><input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />Attach pack list or invoice</label></div>
            {d.files.length === 0 ? <p className="small muted">Nothing attached.</p> : <div className="stack tight small">{d.files.map((f) => <a key={f.id} href={api.fileUrl(f.id)} target="_blank" rel="noreferrer">{statusLabel(f.kind)} · {stampLabel(f.createdAt)}{f.caption ? ` · ${f.caption}` : ""}</a>)}</div>}
          </section>
        </div>
      )}
    </Sheet>
  );
}

function NewPoSheet({ open, workOrderId, onClose, onCreated }: { open: boolean; workOrderId: string | undefined; onClose: () => void; onCreated: (id: string) => void }) {
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => api.get<{ vendors: { id: string; name: string }[] }>("/purchasing/vendors"), enabled: open });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: () => api.get<{ warehouses: (WarehouseRow & { techName: string | null })[] }>("/inventory/warehouses"), enabled: open });
  const [form, setForm] = useState({ vendorId: "", vendorName: "", shipTo: "work_order", warehouseId: "", lumpSum: false, lumpSumAmount: "", expectedDate: "", draft: false });
  const [lines, setLines] = useState([{ description: "", quantity: "1", unitCost: "" }]);
  const [wo, setWo] = useState<{ id: string; number: number; trip: number; title: string; siteName?: string | null } | null>(null);
  const [woSearch, setWoSearch] = useState("");
  const preset = useQuery({ queryKey: ["work-order", workOrderId], queryFn: () => api.get<{ workOrder: { id: string; number: number; trip: number; title: string; siteName: string | null } }>(`/work-orders/${workOrderId}`), enabled: Boolean(workOrderId) && open });
  useEffect(() => { if (preset.data) setWo(preset.data.workOrder); }, [preset.data]);
  const results = useQuery({ ...workOrdersQuery({ q: woSearch, status: "open", limit: "8" }), enabled: woSearch.trim().length >= 2 });
  const create = useAction(
    () => api.post<{ id: string; number: number }>("/purchasing", { vendorId: form.vendorId || null, vendorName: form.vendorName || vendors.data?.vendors.find((v) => v.id === form.vendorId)?.name || "", workOrderId: form.shipTo === "work_order" ? wo?.id ?? null : null, shipTo: form.shipTo, warehouseId: form.shipTo === "inventory" ? form.warehouseId || null : null, lumpSum: form.lumpSum, lumpSumAmount: form.lumpSum && form.lumpSumAmount ? Number(form.lumpSumAmount) : null, expectedDate: form.expectedDate || null, draft: form.draft, lines: form.lumpSum ? [] : lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description, quantity: Number(l.quantity || 0), unitCost: Number(l.unitCost || 0) })) }),
    { success: (r) => `PO ${r.number} issued`, onSuccess: (r) => onCreated(r.id) },
  );
  const total = form.lumpSum ? Number(form.lumpSumAmount || 0) : lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);
  const ready = (form.vendorId || form.vendorName.trim()) && (form.shipTo === "inventory" ? form.warehouseId : wo) && (form.lumpSum ? form.lumpSumAmount : lines.some((l) => l.description.trim()));
  return (
    <Sheet open={open} onClose={onClose} title="New purchase order" wide footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button tone="copper" onClick={() => create.mutate()} disabled={!ready || create.isPending}>Issue PO · {money(total)}</Button></>}>
      <div className="field-grid">
        <Field label="Vendor"><Select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}><option value="">Other, type below</option>{vendors.data?.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
        {!form.vendorId ? <Field label="Vendor name"><Input value={form.vendorName} onChange={(e) => setForm({ ...form, vendorName: e.target.value })} /></Field> : null}
        <Field label="Ship to"><Select value={form.shipTo} onChange={(e) => setForm({ ...form, shipTo: e.target.value })}><option value="work_order">A job</option><option value="inventory">Stock (shop or van)</option></Select></Field>
        {form.shipTo === "inventory" ? <Field label="Warehouse"><Select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}><option value="">Pick</option>{warehouses.data?.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.techName ? ` · ${w.techName}` : ""}</option>)}</Select></Field> : null}
        <Field label="Expected"><Input type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} /></Field>
      </div>
      {form.shipTo === "work_order" ? (
        <Field label="Work order">
          {wo ? <div className="row between"><span><span className="num strong">{woNumber(wo)}</span> {wo.title}{wo.siteName ? <span className="muted"> · {wo.siteName}</span> : null}</span><Button size="sm" tone="ghost" onClick={() => setWo(null)}>Change</Button></div> : (
            <div className="stack tight">
              <Input value={woSearch} onChange={(e) => setWoSearch(e.target.value)} placeholder="Number, customer, or site" />
              {results.data?.workOrders.length ? <div className="list">{results.data.workOrders.map((w) => <button key={w.id} type="button" className="item clickable" style={{ textAlign: "left" }} onClick={() => setWo({ id: w.id, number: w.number, trip: w.trip, title: w.title, siteName: w.siteName })}><div><div className="title"><span className="num">{woNumber(w)}</span> · {w.title}</div><div className="sub">{w.customerName} · {w.siteName}</div></div></button>)}</div> : null}
            </div>
          )}
        </Field>
      ) : null}
      <div className="row wrap gap-3">
        <Check on={form.lumpSum} onChange={(v) => setForm({ ...form, lumpSum: v })} label="Lump sum for now; add lines when the pack list arrives" />
        <Check on={form.draft} onChange={(v) => setForm({ ...form, draft: v })} label="Save as draft" />
      </div>
      {form.lumpSum ? <Field label="Lump sum amount"><Input type="number" step="0.01" value={form.lumpSumAmount} onChange={(e) => setForm({ ...form, lumpSumAmount: e.target.value })} /></Field> : (
        <div className="stack tight">
          <table className="table dense lines-table">
            <thead><tr><th>Description</th><th className="num" style={{ width: 80 }}>Qty</th><th className="num" style={{ width: 120 }}>Unit cost</th><th className="num" style={{ width: 100 }}>Total</th><th style={{ width: 40 }} /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td><Input value={l.description} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Part and model number" /></td>
                  <td><Input type="number" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} /></td>
                  <td><Input type="number" step="0.01" value={l.unitCost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))} /></td>
                  <td className="num">{money(Number(l.quantity || 0) * Number(l.unitCost || 0))}</td>
                  <td><Button size="sm" tone="ghost" icon="x" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div><Button size="sm" tone="ghost" icon="plus" onClick={() => setLines([...lines, { description: "", quantity: "1", unitCost: "" }])}>Add line</Button></div>
        </div>
      )}
    </Sheet>
  );
}
