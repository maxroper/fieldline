import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, minuteLabel, money, relativeLabel, statusLabel, woNumber } from "../../app/format";
import { useAction } from "../../app/queries";
import type { InventoryItemRow, InventoryTxnRow, StockRow, WarehouseRow } from "../../app/types";
import { Button, Empty, Field, Input, Loading, Pill, Seg, Select, Sheet, SummaryLine } from "../../design/components";

interface WarehousesPayload {
  warehouses: (WarehouseRow & { techName: string | null; value: number; belowMin: number; lastCount: string | null })[];
  categories: { id: string; name: string }[];
  byCategory: { warehouseId: string; categoryId: string | null; value: number }[];
  total: number;
}
interface StockPayload {
  warehouse: WarehouseRow | null;
  stock: (StockRow & { item: InventoryItemRow; categoryName: string | null; status: "ok" | "low" | "out"; value: number })[];
  value: number;
  txns: { t: InventoryTxnRow; userName: string | null; woNumber: number | null }[];
}
interface ReplenishPayload {
  items: (StockRow & { item: InventoryItemRow; warehouseName: string; techName: string | null; need: number })[];
}
interface PartsCheckPayload {
  date: string;
  jobs: { workOrder: { id: string; number: number; trip: number; title: string; callType: string; startMinute: number | null }; siteName: string | null; techName: string | null; van: string | null; parts: { description: string; sku?: string; quantity: number; onHand: number | null; status: string }[]; status: string }[];
}

const search = z.object({ view: z.enum(["stock", "replenish", "parts"]).default("stock"), warehouse: z.string().optional() });

export const Route = createFileRoute("/_office/inventory")({ validateSearch: search, component: InventoryPage });

function InventoryPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const warehouses = useQuery({ queryKey: ["warehouses"], queryFn: () => api.get<WarehousesPayload>("/inventory/warehouses") });
  const selectedId = params.warehouse ?? warehouses.data?.warehouses.find((w) => w.kind === "main")?.id ?? warehouses.data?.warehouses[0]?.id;
  const stock = useQuery({ queryKey: ["stock", selectedId], queryFn: () => api.get<StockPayload>(`/inventory/stock${qs({ warehouseId: selectedId })}`), enabled: Boolean(selectedId) && params.view === "stock" });
  const replenish = useQuery({ queryKey: ["replenishment"], queryFn: () => api.get<ReplenishPayload>("/inventory/replenishment") });
  const parts = useQuery({ queryKey: ["parts-check"], queryFn: () => api.get<PartsCheckPayload>("/inventory/parts-check"), enabled: params.view === "parts" });
  const data = warehouses.data;
  return (
    <>
      <div className="toolbar">
        <Seg value={params.view} options={[{ value: "stock", label: "Stock" }, { value: "replenish", label: "Van replenishment", count: replenish.data?.items.length }, { value: "parts", label: "Parts check, tomorrow" }]} onChange={(v) => setSearch({ view: v })} />
        <span className="grow" />
        {data ? <SummaryLine items={[{ value: money(data.total), label: "on hand" }, { value: data.warehouses.length, label: "locations" }, { dot: "rust", value: data.warehouses.reduce((s, w) => s + w.belowMin, 0), label: "items below min" }]} /> : null}
      </div>
      <div className="page">
        {warehouses.isLoading || !data ? <Loading label="Loading inventory" /> : null}
        {data && params.view === "stock" ? <StockView data={data} selectedId={selectedId} stock={stock.data} onSelect={(id) => setSearch({ warehouse: id })} /> : null}
        {params.view === "replenish" ? (replenish.data ? <ReplenishView data={replenish.data} warehouses={data?.warehouses ?? []} /> : <Loading />) : null}
        {params.view === "parts" ? (parts.data ? <PartsCheckView data={parts.data} /> : <Loading />) : null}
      </div>
    </>
  );
}

function StockView({ data, selectedId, stock, onSelect }: { data: WarehousesPayload; selectedId: string | undefined; stock: StockPayload | undefined; onSelect: (id: string) => void }) {
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [transfer, setTransfer] = useState<{ itemId: string; from: string } | null>(null);
  useEffect(() => { setCounting(false); setCounts({}); }, [selectedId]);
  const count = useAction(() => api.post<{ variances: { sku: string; diff: number }[] }>("/inventory/count", { warehouseId: selectedId, counts: Object.entries(counts).filter(([, v]) => v !== "").map(([itemId, v]) => ({ itemId, counted: Number(v) })) }), { success: (r) => `Count saved · ${r.variances.filter((v) => v.diff !== 0).length} adjustments`, onSuccess: () => setCounting(false) });
  return (
    <div className="stack loose">
      <div className="grid auto">
        {data.warehouses.map((w) => (
          <button key={w.id} type="button" className="card" style={{ textAlign: "left", cursor: "pointer", borderColor: w.id === selectedId ? "var(--copper)" : undefined, boxShadow: w.id === selectedId ? "0 0 0 2px var(--copper-tint)" : undefined }} onClick={() => onSelect(w.id)}>
            <div className="row between">
              <div><div className="strong">{w.name}</div><div className="small muted">{w.kind === "vehicle" ? w.techName ?? "No tech" : "Shop"}</div></div>
              <div className="num strong">{money(w.value)}</div>
            </div>
            <div className="row between small muted mt-1">
              <span>{w.belowMin ? <span style={{ color: "var(--rust)" }}>{w.belowMin} below min</span> : "Stocked"}</span>
              <span>{w.lastCount ? `counted ${relativeLabel(w.lastCount)}` : "never counted"}</span>
            </div>
            {w.targetValue ? <div className="small muted">Target {money(w.targetValue)}</div> : null}
          </button>
        ))}
      </div>
      {stock?.warehouse ? (
        <section className="section">
          <div className="section-head">
            <h3>{stock.warehouse.name} · {money(stock.value)}</h3>
            <div className="row gap-2">
              {counting ? <><Button size="sm" tone="ghost" onClick={() => setCounting(false)}>Cancel</Button><Button size="sm" tone="primary" onClick={() => count.mutate()}>Save count</Button></> : <Button size="sm" onClick={() => { setCounting(true); setCounts(Object.fromEntries(stock.stock.map((s) => [s.itemId, String(s.onHand)]))); }}>Cycle count</Button>}
            </div>
          </div>
          {stock.stock.length === 0 ? <Empty title="Nothing stocked here">Receive a PO to this location or transfer from the shop.</Empty> : (
            <div className="table-wrap">
              <table className="table dense">
                <thead><tr><th>SKU</th><th>Item</th><th>Category</th><th className="num">On hand</th><th className="num">Min / max</th><th>Status</th><th className="num">Value</th><th /></tr></thead>
                <tbody>
                  {stock.stock.map((s) => (
                    <tr key={s.id}>
                      <td className="num">{s.item.sku}</td>
                      <td className="primary-cell">{s.item.name}</td>
                      <td className="small muted">{s.categoryName}</td>
                      <td className="num">{counting ? <Input type="number" value={counts[s.itemId] ?? ""} onChange={(e) => setCounts({ ...counts, [s.itemId]: e.target.value })} style={{ width: 80, minHeight: 30, padding: "2px 8px", textAlign: "right" }} /> : `${s.onHand} ${s.item.unit}`}</td>
                      <td className="num small muted">{s.min} / {s.max}</td>
                      <td><Pill tone={s.status === "out" ? "urgent" : s.status === "low" ? "parts" : "site"} plain>{s.status === "out" ? "Out" : s.status === "low" ? "Low" : "OK"}</Pill></td>
                      <td className="num">{money(s.value)}</td>
                      <td className="num">{!counting ? <Button size="sm" tone="ghost" onClick={() => setTransfer({ itemId: s.itemId, from: stock.warehouse!.id })}>Transfer</Button> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="stack tight">
            <span className="eyebrow">Recent movement</span>
            {stock.txns.slice(0, 15).map((row) => <div key={row.t.id} className="row between small"><span>{dayLabel(row.t.date)} · {statusLabel(row.t.kind)} · {row.t.description}{row.woNumber ? ` · WO ${row.woNumber}` : ""}</span><span className="num" style={{ color: row.t.amount < 0 ? "var(--rust)" : "var(--moss-deep)" }}>{row.t.quantity != null ? `${row.t.quantity > 0 ? "+" : ""}${row.t.quantity} · ` : ""}{money(row.t.amount)}</span></div>)}
            {stock.txns.length === 0 ? <span className="small muted">No movement recorded yet.</span> : null}
          </div>
        </section>
      ) : null}
      <TransferSheet transfer={transfer} warehouses={data.warehouses} items={stock?.stock.map((s) => s.item) ?? []} onClose={() => setTransfer(null)} />
    </div>
  );
}

function TransferSheet({ transfer, warehouses, items, onClose }: { transfer: { itemId: string; from: string } | null; warehouses: WarehouseRow[]; items: InventoryItemRow[]; onClose: () => void }) {
  const [form, setForm] = useState({ to: "", quantity: "1", note: "" });
  useEffect(() => setForm({ to: warehouses.find((w) => w.id !== transfer?.from)?.id ?? "", quantity: "1", note: "" }), [transfer, warehouses]);
  const run = useAction(() => api.post("/inventory/transfer", { fromWarehouseId: transfer?.from, toWarehouseId: form.to, itemId: transfer?.itemId, quantity: Number(form.quantity), note: form.note || undefined }), { success: "Transferred", onSuccess: onClose });
  const item = items.find((i) => i.id === transfer?.itemId);
  return (
    <Sheet open={Boolean(transfer)} onClose={onClose} title={`Transfer ${item?.name ?? ""}`} footer={<><Button tone="ghost" onClick={onClose}>Cancel</Button><Button tone="primary" onClick={() => run.mutate()} disabled={!form.to}>Transfer</Button></>}>
      <div className="field-grid">
        <Field label="To"><Select value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>{warehouses.filter((w) => w.id !== transfer?.from).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
        <Field label="Quantity"><Input type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
      </div>
      <Field label="Note"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Morning restock" /></Field>
    </Sheet>
  );
}

function ReplenishView({ data, warehouses }: { data: ReplenishPayload; warehouses: WarehouseRow[] }) {
  const main = warehouses.find((w) => w.kind === "main");
  const transfer = useAction((row: ReplenishPayload["items"][number]) => api.post("/inventory/transfer", { fromWarehouseId: main?.id, toWarehouseId: row.warehouseId, itemId: row.itemId, quantity: row.need, note: "Replenishment" }), { success: "Moved to the van" });
  const byVan = new Map<string, ReplenishPayload["items"]>();
  for (const row of data.items) byVan.set(row.warehouseName, [...(byVan.get(row.warehouseName) ?? []), row]);
  if (!data.items.length) return <Empty title="Every van is above minimum">Nothing to pull from the shop this morning.</Empty>;
  return (
    <div className="stack loose">
      <p className="small muted">Everything under its minimum on a van, with the quantity to bring it back to max. Transfers come from {main?.name ?? "the shop"}.</p>
      {[...byVan.entries()].map(([van, rows]) => (
        <section key={van} className="section">
          <div className="section-head"><h3>{van}</h3><span className="small muted">{rows[0]?.techName}</span></div>
          <div className="table-wrap">
            <table className="table dense">
              <thead><tr><th>SKU</th><th>Item</th><th className="num">On hand</th><th className="num">Min</th><th className="num">Bring</th><th /></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.id}><td className="num">{r.item.sku}</td><td>{r.item.name}</td><td className="num" style={{ color: r.onHand <= 0 ? "var(--red)" : undefined }}>{r.onHand}</td><td className="num">{r.min}</td><td className="num strong">{r.need}</td><td className="num"><Button size="sm" onClick={() => transfer.mutate(r)} disabled={!main}>Transfer {r.need}</Button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function PartsCheckView({ data }: { data: PartsCheckPayload }) {
  const navigate = useNavigate();
  const tone = (s: string) => (s === "ready" ? "site" : s === "short" ? "parts" : s === "missing" ? "urgent" : "hold");
  return (
    <div className="stack loose">
      <SummaryLine items={[{ value: data.jobs.length, label: `jobs on ${dayLabel(data.date)}` }, { dot: "moss", value: data.jobs.filter((j) => j.status === "ready").length, label: "parts ready" }, { dot: "red", value: data.jobs.filter((j) => j.status === "missing").length, label: "missing parts" }]} />
      {data.jobs.length === 0 ? <Empty title="Nothing scheduled tomorrow yet">Place jobs on the board and this list fills in.</Empty> : (
        <div className="list">
          {data.jobs.map((j) => (
            <div key={j.workOrder.id} className="item tall" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <div>
                <div className="row wrap gap-2">
                  <Link to="/work-orders/$id" params={{ id: j.workOrder.id }} className="title nav-link"><span className="num">{woNumber(j.workOrder)}</span> · {j.workOrder.title}</Link>
                  <span className="small muted">{j.workOrder.startMinute != null ? minuteLabel(j.workOrder.startMinute) : ""} · {j.siteName} · {j.techName ?? "unassigned"}{j.van ? ` · ${j.van}` : ""}</span>
                </div>
                {j.parts.length ? <div className="small mt-1">{j.parts.map((p, i) => <span key={i} className={`pill plain ${tone(p.status)} ml-1`}>{p.description} ×{p.quantity}{p.onHand != null ? ` (${p.onHand} on van)` : ""}</span>)}</div> : <div className="small muted">No quoted parts on this job.</div>}
              </div>
              <div className="row gap-2">
                <Pill tone={tone(j.status)}>{j.status === "ready" ? "Ready" : j.status === "short" ? "Short" : "Missing"}</Pill>
                {j.status !== "ready" ? <Button size="sm" onClick={() => navigate({ to: "/purchasing", search: { newFor: j.workOrder.id } as never })}>Order</Button> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
