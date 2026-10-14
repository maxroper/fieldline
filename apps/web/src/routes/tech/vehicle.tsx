import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api, qs } from "../../app/api";
import { money, relativeLabel } from "../../app/format";
import { techDayQuery, useAction } from "../../app/queries";
import { useTechWho } from "../../app/shell/PhoneShell";
import type { InventoryItemRow, StockRow, WarehouseRow } from "../../app/types";
import { Button, Empty, Input, Loading, Notice, Pill } from "../../design/components";

interface StockPayload {
  warehouse: WarehouseRow | null;
  stock: (StockRow & { item: InventoryItemRow; categoryName: string | null; status: "ok" | "low" | "out"; value: number })[];
  value: number;
}

export const Route = createFileRoute("/tech/vehicle")({ component: TechVehicle });

/** The van: what is on it, what is low, and a cycle count that writes adjustments. */
function TechVehicle() {
  const who = useTechWho();
  const day = useQuery({ ...techDayQuery(who), enabled: who !== "me" });
  const warehouseId = who === "me" ? "mine" : day.data?.van?.id;
  const query = useQuery({ queryKey: ["stock", warehouseId], queryFn: () => api.get<StockPayload>(`/inventory/stock${qs({ warehouseId })}`), enabled: Boolean(warehouseId) });
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const count = useAction(() => api.post<{ variances: { diff: number }[] }>("/inventory/count", { warehouseId: query.data?.warehouse?.id, counts: Object.entries(counts).filter(([, v]) => v !== "").map(([itemId, v]) => ({ itemId, counted: Number(v) })) }), { success: (r) => `Count saved · ${r.variances.filter((v) => v.diff !== 0).length} adjusted`, onSuccess: () => setCounting(false) });
  const d = query.data;
  if (who !== "me" && day.data && !day.data.van) return <div className="ph-page"><h1>Van</h1><Notice>This tech has no van assigned.</Notice></div>;
  if (!d) return <Loading label="Loading the van" />;
  if (!d.warehouse) return <div className="ph-page"><h1>Van</h1><Notice>No van is assigned to you yet. The office sets that up under Settings, Warehouses.</Notice></div>;
  const rows = d.stock.filter((s) => !q || `${s.item.sku} ${s.item.name} ${s.categoryName ?? ""}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (a.status === b.status ? a.item.name.localeCompare(b.item.name) : a.status === "out" ? -1 : b.status === "out" ? 1 : a.status === "low" ? -1 : 1));
  const low = d.stock.filter((s) => s.status !== "ok");
  const lastCount = d.stock.map((s) => s.lastCountedAt).filter(Boolean).sort().pop() ?? null;
  return (
    <div className="ph-page">
      <div className="row between top">
        <div><h1>{d.warehouse.name}</h1><div className="small muted">{money(d.value)} on board · {lastCount ? `counted ${relativeLabel(lastCount)}` : "never counted"}</div></div>
        {counting ? <div className="row gap-2"><Button size="sm" tone="ghost" onClick={() => setCounting(false)}>Cancel</Button><Button size="sm" tone="primary" onClick={() => count.mutate()}>Save</Button></div> : <Button size="sm" onClick={() => { setCounting(true); setCounts(Object.fromEntries(d.stock.map((s) => [s.itemId, String(s.onHand)]))); }}>Count</Button>}
      </div>
      {low.length ? <Notice>{low.length} item{low.length === 1 ? " is" : "s are"} below minimum. The shop sees the same list for the morning restock.</Notice> : null}
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a part" inputMode="search" />
      {rows.length === 0 ? <Empty title="Nothing stocked" /> : null}
      <div className="list">
        {rows.map((s) => (
          <div key={s.id} className="item" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div>
              <div className="title">{s.item.name}</div>
              <div className="sub">{s.item.sku}{s.categoryName ? ` · ${s.categoryName}` : ""} · min {s.min}</div>
            </div>
            {counting ? <Input type="number" inputMode="numeric" value={counts[s.itemId] ?? ""} onChange={(e) => setCounts({ ...counts, [s.itemId]: e.target.value })} style={{ width: 72, textAlign: "right" }} /> : <div className="row gap-2"><span className="num strong">{s.onHand}</span><Pill tone={s.status === "out" ? "urgent" : s.status === "low" ? "parts" : "site"} plain>{s.status === "out" ? "Out" : s.status === "low" ? "Low" : "OK"}</Pill></div>}
          </div>
        ))}
      </div>
    </div>
  );
}
