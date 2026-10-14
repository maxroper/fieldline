import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { money } from "../../app/format";
import { useAction } from "../../app/queries";
import type { PricebookItem } from "../../app/types";
import { Button, Chip, Empty, Field, Input, Loading, Select, Sheet, SummaryLine, Switch, Textarea } from "../../design/components";

const search = z.object({ category: z.string().optional(), q: z.string().optional() });

export const Route = createFileRoute("/_office/pricebook")({ validateSearch: search, component: PricebookPage });

const blank = { code: "", name: "", category: "", description: "", partsCost: "", laborHours: "", priceGood: "", priceBetter: "", priceBest: "", marginPercent: "", active: true };

/** Flat-rate items the quote builder pulls from. Good, Better, Best prices live here so every quote is consistent. */
function PricebookPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery({ queryKey: ["pricebook", params.category ?? "", params.q ?? ""], queryFn: () => api.get<{ items: (PricebookItem & { financingMonthly: number | null })[]; categories: string[] }>(`/pricebook${qs({ category: params.category, q: params.q })}`) });
  const all = useQuery({ queryKey: ["pricebook", "", ""], queryFn: () => api.get<{ items: PricebookItem[]; categories: string[] }>("/pricebook") });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const [editing, setEditing] = useState<PricebookItem | "new" | null>(null);
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (editing === "new") setForm(blank);
    else if (editing) setForm({ code: editing.code, name: editing.name, category: editing.category, description: editing.description, partsCost: String(editing.partsCost), laborHours: String(editing.laborHours), priceGood: editing.priceGood?.toString() ?? "", priceBetter: editing.priceBetter?.toString() ?? "", priceBest: editing.priceBest?.toString() ?? "", marginPercent: editing.marginPercent?.toString() ?? "", active: editing.active });
  }, [editing]);
  const body = () => ({ ...form, partsCost: Number(form.partsCost || 0), laborHours: Number(form.laborHours || 0), priceGood: form.priceGood === "" ? null : Number(form.priceGood), priceBetter: form.priceBetter === "" ? null : Number(form.priceBetter), priceBest: form.priceBest === "" ? null : Number(form.priceBest), marginPercent: form.marginPercent === "" ? null : Number(form.marginPercent) });
  const save = useAction(() => (editing === "new" ? api.post("/pricebook", body()) : api.patch(`/pricebook/${(editing as PricebookItem).id}`, body())), { success: "Pricebook saved", onSuccess: () => setEditing(null) });
  const categories = all.data?.categories ?? [];
  const items = query.data?.items ?? [];
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          <Chip on={!params.category} onClick={() => setSearch({ category: undefined })}>All</Chip>
          {categories.map((c) => <Chip key={c} on={params.category === c} onClick={() => setSearch({ category: c })}>{c}</Chip>)}
        </div>
        <div className="search" style={{ flex: "1 1 200px", maxWidth: 320 }}>
          <input className="input" type="search" placeholder="Code, name, or description" defaultValue={params.q ?? ""} onKeyDown={(e) => e.key === "Enter" && setSearch({ q: (e.target as HTMLInputElement).value || undefined })} />
        </div>
        <span className="grow" />
        <Button tone="copper" size="sm" icon="plus" onClick={() => setEditing("new")}>Item</Button>
      </div>
      <div className="page">
        {query.isLoading ? <Loading label="Loading the pricebook" /> : (
          <div className="stack loose">
            <SummaryLine items={[{ value: items.length, label: "items" }, { value: categories.length, label: "categories" }, { value: items.filter((i) => i.priceGood && i.priceBetter && i.priceBest).length, label: "with Good, Better, Best" }]} />
            {items.length === 0 ? <Empty title="No items here yet">Add the repairs you quote most; the quote builder picks from this list.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Code</th><th>Item</th><th>Category</th><th className="num">Parts cost</th><th className="num">Labor</th><th className="num">Good</th><th className="num">Better</th><th className="num">Best</th><th className="num">Financing</th><th className="num">Used</th></tr></thead>
                  <tbody className="stagger">
                    {items.map((it) => (
                      <tr key={it.id} className="clickable" onClick={() => setEditing(it)}>
                        <td className="num primary-cell">{it.code}</td>
                        <td className="primary-cell"><div>{it.name}</div><div className="small muted truncate" style={{ maxWidth: 320 }}>{it.description}</div></td>
                        <td>{it.category}</td>
                        <td className="num">{money(it.partsCost)}</td>
                        <td className="num">{it.laborHours} h</td>
                        <td className="num">{it.priceGood != null ? money(it.priceGood) : ""}</td>
                        <td className="num strong">{it.priceBetter != null ? money(it.priceBetter) : ""}</td>
                        <td className="num">{it.priceBest != null ? money(it.priceBest) : ""}</td>
                        <td className="num small muted">{it.financingMonthly ? `${money(it.financingMonthly)}/mo` : ""}</td>
                        <td className="num">{it.timesUsed || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New pricebook item" : "Edit item"} footer={<><Button tone="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button tone="primary" onClick={() => save.mutate()} disabled={!form.code || !form.name || !form.category}>Save</Button></>}>
        <div className="field-grid">
          <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CAP-45-5" /></Field>
          <Field label="Category"><Input list="pb-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /><datalist id="pb-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></Field>
        </div>
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Customer-facing description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></Field>
        <div className="field-grid">
          <Field label="Parts cost"><Input type="number" step="0.01" value={form.partsCost} onChange={(e) => setForm({ ...form, partsCost: e.target.value })} /></Field>
          <Field label="Labor hours"><Input type="number" step="0.25" value={form.laborHours} onChange={(e) => setForm({ ...form, laborHours: e.target.value })} /></Field>
          <Field label="Margin %" help="Blank uses the company default."><Input type="number" value={form.marginPercent} onChange={(e) => setForm({ ...form, marginPercent: e.target.value })} /></Field>
        </div>
        <div className="field-grid">
          <Field label="Good"><Input type="number" step="1" value={form.priceGood} onChange={(e) => setForm({ ...form, priceGood: e.target.value })} /></Field>
          <Field label="Better" help="The recommended option."><Input type="number" step="1" value={form.priceBetter} onChange={(e) => setForm({ ...form, priceBetter: e.target.value })} /></Field>
          <Field label="Best"><Input type="number" step="1" value={form.priceBest} onChange={(e) => setForm({ ...form, priceBest: e.target.value })} /></Field>
        </div>
        <Switch on={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Active, shown in the quote builder" />
        {editing !== "new" && editing ? <Select value="" onChange={() => undefined} style={{ display: "none" }} /> : null}
      </Sheet>
    </>
  );
}
