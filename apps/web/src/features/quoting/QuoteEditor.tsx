import { companySettings, financingMonthly, laborCostRate, MARGIN_PRESETS, QUOTE_LOSS_REASONS, QUOTE_REASONS, quoteTotals, type CompanySettings, type QuoteTotals } from "@fieldline/shared";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, qs } from "../../app/api";
import { dayLabel, money, siteUrl, stampLabel, statusLabel, woNumber } from "../../app/format";
import { useAction, useSettings, type WorkOrderDetail } from "../../app/queries";
import type { CustomerRow, EquipmentRow, PricebookItem, QuoteLabor, QuoteLineRow, QuoteOptionRow, QuoteRow, SiteRow } from "../../app/types";
import { Button, Card, Check, Empty, Facts, Field, Input, Notice, Pill, Select, Sheet, StatusTrack, Textarea } from "../../design/components";

export interface QuoteDetail {
  quote: QuoteRow;
  options: QuoteOptionRow[];
  lines: QuoteLineRow[];
  customer: CustomerRow | null;
  site: SiteRow | null;
  equipment: EquipmentRow | null;
  totals: QuoteTotals;
  labor: QuoteLabor;
  selectedOption: QuoteOptionRow | null;
  price: number | null;
  scopeTemplates: { id: string; name: string; scope: string; laborHours: number; labor: Partial<QuoteLabor> }[];
  files: { id: string; kind: string; caption: string }[];
}

interface Ctx {
  customer: { id: string; name: string; contract: boolean; taxExempt: boolean; portalToken?: string | null; portalEnabled?: boolean } | null;
  site: SiteRow | null;
  equipment: EquipmentRow[];
}

interface LineDraft { key: number; kind: string; description: string; quantity: string; unitCost: string; pricebookItemId: string | null }
interface OptionDraft { key: number; tier: string; name: string; description: string; price: string; cost: string; isRecommended: boolean; included: string }

interface Draft {
  equipmentId: string;
  workOrderId: string | null;
  contactName: string;
  contactPhone: string;
  reason: string;
  problemText: string;
  scope: string;
  scopeTemplateId: string;
  labor: QuoteLabor;
  marginPercent: number;
  lines: LineDraft[];
  options: OptionDraft[];
  followUpDate: string;
}

let seq = 1;
const nextKey = () => seq++;
const emptyLabor: QuoteLabor = { journeymanHours: 0, apprenticeHours: 0, driverHours: 0, journeymanRate: null, apprenticeRate: null, driverRate: null };

function fromDetail(d: QuoteDetail): Draft {
  return {
    equipmentId: d.quote.equipmentId ?? "",
    workOrderId: d.quote.workOrderId,
    contactName: d.quote.contactName,
    contactPhone: d.quote.contactPhone,
    reason: d.quote.reason,
    problemText: d.quote.problemText,
    scope: d.quote.scope,
    scopeTemplateId: d.quote.scopeTemplateId ?? "",
    labor: d.quote.labor,
    marginPercent: d.quote.marginPercent,
    lines: d.lines.map((l) => ({ key: nextKey(), kind: l.kind, description: l.description, quantity: String(l.quantity), unitCost: String(l.unitCost), pricebookItemId: l.pricebookItemId })),
    options: d.options.map((o) => ({ key: nextKey(), tier: o.tier, name: o.name, description: o.description, price: String(o.price), cost: o.cost?.toString() ?? "", isRecommended: o.isRecommended, included: o.included.join("\n") })),
    followUpDate: d.quote.followUpDate ?? "",
  };
}

/**
 * The quote builder: scope, labor at cost, material lines from the pricebook, a margin, and the
 * customer-facing options (one price, or Good, Better, Best). Totals are computed with the same shared
 * function the API uses, so the office sees the same numbers the quote will carry.
 */
export function QuoteEditor({ detail, prefill }: { detail?: QuoteDetail; prefill?: { siteId?: string; customerId?: string; workOrderId?: string; equipmentId?: string } }) {
  const navigate = useNavigate();
  const settings = useSettings();
  const cs: CompanySettings = companySettings(settings.data?.org.settings as Partial<CompanySettings> | undefined);
  const [ctx, setCtx] = useState<Ctx>(detail ? { customer: detail.customer, site: detail.site, equipment: detail.equipment ? [detail.equipment] : [] } : { customer: null, site: null, equipment: [] });
  const [draft, setDraft] = useState<Draft>(detail ? fromDetail(detail) : { equipmentId: prefill?.equipmentId ?? "", workOrderId: prefill?.workOrderId ?? null, contactName: "", contactPhone: "", reason: "service", problemText: "", scope: "", scopeTemplateId: "", labor: emptyLabor, marginPercent: cs.defaultQuoteMargin, lines: [], options: [{ key: nextKey(), tier: "single", name: "Repair as scoped", description: "", price: "", cost: "", isRecommended: true, included: "" }], followUpDate: "" });
  useEffect(() => { if (detail) { setDraft(fromDetail(detail)); setCtx({ customer: detail.customer, site: detail.site, equipment: detail.equipment ? [detail.equipment] : [] }); } }, [detail?.quote.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefills for a new quote: from a work order (found on a visit) or straight from a site.
  const woPrefill = useQuery({ queryKey: ["work-order", prefill?.workOrderId], queryFn: () => api.get<WorkOrderDetail>(`/work-orders/${prefill?.workOrderId}`), enabled: Boolean(prefill?.workOrderId) && !detail });
  const sitePrefill = useQuery({ queryKey: ["site", prefill?.siteId], queryFn: () => api.get<{ site: SiteRow; customer: CustomerRow | null; equipment: EquipmentRow[] }>(`/sites/${prefill?.siteId}`), enabled: Boolean(prefill?.siteId) && !prefill?.workOrderId && !detail });
  useEffect(() => {
    const w = woPrefill.data;
    if (w && !ctx.site) {
      setCtx({ customer: w.customer ? { id: w.customer.id, name: w.customer.name, contract: w.customer.contract, taxExempt: w.customer.taxExempt } : null, site: w.site as unknown as SiteRow, equipment: w.equipment ? [w.equipment as unknown as EquipmentRow] : [] });
      setDraft((d) => ({ ...d, equipmentId: w.equipment?.id ?? d.equipmentId, problemText: d.problemText || `${w.workOrder.title}. ${w.workOrder.description}`.trim(), contactName: w.site?.contact ?? "", contactPhone: w.site?.contactPhone ?? "" }));
    }
  }, [woPrefill.data, ctx.site]);
  useEffect(() => {
    const s = sitePrefill.data;
    if (s && !ctx.site) setCtx({ customer: s.customer ? { id: s.customer.id, name: s.customer.name, contract: s.customer.contract, taxExempt: s.customer.taxExempt } : null, site: s.site, equipment: s.equipment });
  }, [sitePrefill.data, ctx.site]);

  // Site search for a quote that starts from nothing.
  const [q, setQ] = useState("");
  const lookup = useQuery({ queryKey: ["lookup", q], queryFn: () => api.get<{ matches: { site: SiteRow; customerName: string; customerId: string; contract: boolean; equipment: EquipmentRow[] }[] }>(`/customers/lookup${qs({ q })}`), enabled: !ctx.site && q.trim().length >= 2 });

  const labor: QuoteLabor = { ...draft.labor, journeymanRate: draft.labor.journeymanRate ?? laborCostRate(cs, "Journeyman"), apprenticeRate: draft.labor.apprenticeRate ?? laborCostRate(cs, "Apprentice"), driverRate: draft.labor.driverRate ?? laborCostRate(cs, "Driver") };
  const taxRate = ctx.customer?.taxExempt ? 0 : (ctx.site?.taxRate ?? cs.salesTaxPercent);
  const totals = quoteTotals({ labor, materials: draft.lines.filter((l) => l.kind === "material").map((l) => ({ quantity: Number(l.quantity || 0), unitCost: Number(l.unitCost || 0) })), marginPercent: draft.marginPercent, taxRate });
  const recommended = draft.options.find((o) => o.isRecommended) ?? draft.options[0];

  const body = () => ({
    customerId: ctx.customer?.id ?? null,
    siteId: ctx.site?.id ?? null,
    equipmentId: draft.equipmentId || null,
    workOrderId: draft.workOrderId,
    contactName: draft.contactName,
    contactPhone: draft.contactPhone,
    reason: draft.reason,
    problemText: draft.problemText,
    scope: draft.scope,
    scopeTemplateId: draft.scopeTemplateId || null,
    labor: { journeymanHours: Number(draft.labor.journeymanHours || 0), apprenticeHours: Number(draft.labor.apprenticeHours || 0), driverHours: Number(draft.labor.driverHours || 0), journeymanRate: draft.labor.journeymanRate, apprenticeRate: draft.labor.apprenticeRate, driverRate: draft.labor.driverRate },
    marginPercent: draft.marginPercent,
    lines: draft.lines.filter((l) => l.description.trim()).map((l) => ({ kind: l.kind, description: l.description, quantity: Number(l.quantity || 0), unitCost: Number(l.unitCost || 0), pricebookItemId: l.pricebookItemId })),
    options: draft.options.filter((o) => o.name.trim()).map((o) => ({ tier: o.tier, name: o.name, description: o.description, price: Number(o.price || 0), cost: o.cost === "" ? null : Number(o.cost), isRecommended: o.isRecommended, included: o.included.split("\n").map((s) => s.trim()).filter(Boolean) })),
    followUpDate: draft.followUpDate || null,
  });
  const save = useAction(() => (detail ? api.patch(`/quotes/${detail.quote.id}`, body()) : api.post<{ id: string }>("/quotes", body())), { success: "Quote saved", onSuccess: (r) => { if (!detail && r && typeof r === "object" && "id" in r) navigate({ to: "/quoting/$id", params: { id: (r as { id: string }).id } }); } });
  const send = useAction(async () => { await api.patch(`/quotes/${detail?.quote.id}`, body()); return api.post(`/quotes/${detail?.quote.id}/send`); }, { success: "Marked sent. The customer can approve from their portal." });
  const [approveOpen, setApproveOpen] = useState(false);
  const [approve, setApprove] = useState({ optionId: "", signerName: "" });
  const doApprove = useAction(() => api.post<{ workOrderId: string; number: number }>(`/quotes/${detail?.quote.id}/approve`, { optionId: approve.optionId || undefined, signerName: approve.signerName || undefined }), { success: (r) => `Approved. Work order ${r.number} created`, onSuccess: (r) => navigate({ to: "/work-orders/$id", params: { id: r.workOrderId } }) });
  const [declineOpen, setDeclineOpen] = useState(false);
  const [decline, setDecline] = useState({ reason: "price", note: "" });
  const doDecline = useAction(() => api.post(`/quotes/${detail?.quote.id}/decline`, decline), { success: "Marked declined", onSuccess: () => setDeclineOpen(false) });
  const [pickerOpen, setPickerOpen] = useState(false);

  const setLine = (key: number, patch: Partial<LineDraft>) => setDraft({ ...draft, lines: draft.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) });
  const setOption = (key: number, patch: Partial<OptionDraft>) => setDraft({ ...draft, options: draft.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) });
  const addFromPricebook = (item: PricebookItem, mode: "line" | "options") => {
    const lines = [...draft.lines, { key: nextKey(), kind: "material", description: item.name, quantity: "1", unitCost: String(item.partsCost), pricebookItemId: item.id }];
    const laborNext = { ...draft.labor, journeymanHours: Number(draft.labor.journeymanHours || 0) + item.laborHours };
    if (mode === "options" && item.priceGood != null && item.priceBetter != null && item.priceBest != null) {
      setDraft({ ...draft, lines, labor: laborNext, options: [
        { key: nextKey(), tier: "good", name: `Good · ${item.name}`, description: item.description, price: String(item.priceGood), cost: "", isRecommended: false, included: "" },
        { key: nextKey(), tier: "better", name: `Better · ${item.name}`, description: item.description, price: String(item.priceBetter), cost: "", isRecommended: true, included: "" },
        { key: nextKey(), tier: "best", name: `Best · ${item.name}`, description: item.description, price: String(item.priceBest), cost: "", isRecommended: false, included: "" },
      ] });
    } else setDraft({ ...draft, lines, labor: laborNext, scope: draft.scope || item.description });
    setPickerOpen(false);
  };
  const locked = detail ? detail.quote.status === "approved" || detail.quote.status === "declined" : false;
  const status = detail?.quote.status ?? "draft";
  const track = [{ key: "draft", label: "Draft" }, { key: "sent", label: "Sent", at: detail?.quote.sentAt ? dayLabel(detail.quote.sentAt.slice(0, 10)) : undefined }, { key: "viewed", label: "Viewed", at: detail?.quote.viewedAt ? dayLabel(detail.quote.viewedAt.slice(0, 10)) : undefined }, { key: status === "declined" ? "declined" : "approved", label: status === "declined" ? "Declined" : "Approved", at: detail?.quote.approvedAt ? dayLabel(detail.quote.approvedAt.slice(0, 10)) : undefined }];

  return (
    <div className="two-col loose">
      <div className="stack loose">
        <Card title="Customer and site" flat actions={ctx.site && !detail ? <Button size="sm" tone="ghost" onClick={() => setCtx({ customer: null, site: null, equipment: [] })}>Change</Button> : null}>
          {ctx.site ? (
            <div className="stack tight">
              <div className="row wrap gap-2"><b>{ctx.site.name || ctx.site.address}</b><span className="muted">· {ctx.customer?.name}</span>{ctx.customer?.contract ? <Pill tone="sched" plain>Contract</Pill> : null}{ctx.customer?.taxExempt ? <Pill tone="open" plain>Tax exempt</Pill> : null}</div>
              <div className="small muted">{ctx.site.address}{ctx.site.city ? `, ${ctx.site.city}` : ""}</div>
              <div className="field-grid">
                {ctx.equipment.length ? <Field label="Equipment"><Select value={draft.equipmentId} onChange={(e) => setDraft({ ...draft, equipmentId: e.target.value })} disabled={locked}><option value="">Not tied to a unit</option>{ctx.equipment.map((u) => <option key={u.id} value={u.id}>{u.tag} · {u.make} {u.model}</option>)}</Select></Field> : null}
                <Field label="Contact"><Input value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} placeholder={ctx.site.contact} disabled={locked} /></Field>
                <Field label="Contact mobile"><Input value={draft.contactPhone} onChange={(e) => setDraft({ ...draft, contactPhone: e.target.value })} placeholder={ctx.site.contactPhone} disabled={locked} /></Field>
              </div>
            </div>
          ) : (
            <div className="stack tight">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer, site, or address" autoFocus className="lg" />
              {lookup.data?.matches.length ? <div className="list">{lookup.data.matches.map((m) => <button key={m.site.id} type="button" className="item clickable" style={{ textAlign: "left" }} onClick={() => setCtx({ customer: { id: m.customerId, name: m.customerName, contract: m.contract, taxExempt: false }, site: m.site, equipment: m.equipment })}><div><div className="title">{m.site.name || m.site.address} <span className="muted">· {m.customerName}</span></div><div className="sub">{m.site.address}</div></div></button>)}</div> : q.length >= 2 && lookup.data ? <Empty title="No match">Create the customer first from the + New menu.</Empty> : null}
            </div>
          )}
        </Card>

        <Card title="Scope" flat>
          <div className="stack">
            <div className="field-grid">
              <Field label="Why"><Select value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} disabled={locked}>{QUOTE_REASONS.map((r) => <option key={r} value={r}>{r === "pm" ? "Found on maintenance" : r === "service" ? "Found on a service call" : "Customer asked"}</option>)}</Select></Field>
              <Field label="Start from a template"><Select value={draft.scopeTemplateId} onChange={(e) => { const t = detail?.scopeTemplates.find((x) => x.id === e.target.value) ?? templates.find((x) => x.id === e.target.value); setDraft({ ...draft, scopeTemplateId: e.target.value, scope: t ? t.scope : draft.scope, labor: t ? { ...draft.labor, journeymanHours: t.labor.journeymanHours ?? t.laborHours, apprenticeHours: t.labor.apprenticeHours ?? draft.labor.apprenticeHours, driverHours: t.labor.driverHours ?? draft.labor.driverHours } : draft.labor }); }} disabled={locked}><option value="">None</option>{(detail?.scopeTemplates ?? templates).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
            </div>
            <Field label="What we found"><Textarea value={draft.problemText} onChange={(e) => setDraft({ ...draft, problemText: e.target.value })} rows={2} disabled={locked} placeholder="Compressor on RTU-2 is grounded; unit is 14 years old on R-22." /></Field>
            <Field label="Scope of work" help="This is what the customer reads and approves."><Textarea value={draft.scope} onChange={(e) => setDraft({ ...draft, scope: e.target.value })} rows={4} disabled={locked} /></Field>
          </div>
        </Card>

        <Card title="Labor at cost" flat>
          <div className="field-grid">
            {(["journeyman", "apprentice", "driver"] as const).map((cls) => (
              <Field key={cls} label={`${cls[0]!.toUpperCase()}${cls.slice(1)} hours`} help={`${money(labor[`${cls}Rate`] ?? 0)}/h cost`}>
                <Input type="number" step="0.5" value={draft.labor[`${cls}Hours`] || ""} onChange={(e) => setDraft({ ...draft, labor: { ...draft.labor, [`${cls}Hours`]: Number(e.target.value || 0) } })} disabled={locked} />
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Material" flat actions={!locked ? <div className="row gap-2"><Button size="sm" tone="ghost" icon="book" onClick={() => setPickerOpen(true)}>Pricebook</Button><Button size="sm" tone="ghost" icon="plus" onClick={() => setDraft({ ...draft, lines: [...draft.lines, { key: nextKey(), kind: "material", description: "", quantity: "1", unitCost: "", pricebookItemId: null }] })}>Line</Button></div> : null}>
          {draft.lines.length === 0 ? <p className="small muted">No material yet. Pull from the pricebook or add a line.</p> : (
            <table className="table dense lines-table">
              <thead><tr><th>Part</th><th className="num" style={{ width: 80 }}>Qty</th><th className="num" style={{ width: 120 }}>Unit cost</th><th className="num" style={{ width: 100 }}>Cost</th>{!locked ? <th style={{ width: 40 }} /> : null}</tr></thead>
              <tbody>
                {draft.lines.map((l) => (
                  <tr key={l.key}>
                    <td>{locked ? l.description : <Input value={l.description} onChange={(e) => setLine(l.key, { description: e.target.value })} />}</td>
                    <td>{locked ? l.quantity : <Input type="number" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />}</td>
                    <td>{locked ? money(Number(l.unitCost)) : <Input type="number" step="0.01" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} />}</td>
                    <td className="num">{money(Number(l.quantity || 0) * Number(l.unitCost || 0))}</td>
                    {!locked ? <td><Button size="sm" tone="ghost" icon="x" aria-label="Remove" onClick={() => setDraft({ ...draft, lines: draft.lines.filter((x) => x.key !== l.key) })} /></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Options the customer sees" flat actions={!locked ? <Button size="sm" tone="ghost" icon="plus" onClick={() => setDraft({ ...draft, options: [...draft.options, { key: nextKey(), tier: draft.options.length === 0 ? "single" : draft.options.length === 1 ? "better" : "best", name: "", description: "", price: "", cost: "", isRecommended: draft.options.length === 0, included: "" }] })}>Option</Button> : null}>
          <div className="option-grid">
            {draft.options.map((o) => (
              <div key={o.key} className={`option-card${o.isRecommended ? " on" : ""}`} style={{ cursor: "default" }}>
                <div className="row between">
                  <Select value={o.tier} onChange={(e) => setOption(o.key, { tier: e.target.value })} disabled={locked} style={{ maxWidth: 120 }}><option value="single">Single</option><option value="good">Good</option><option value="better">Better</option><option value="best">Best</option></Select>
                  <Check on={o.isRecommended} onChange={(v) => setDraft({ ...draft, options: draft.options.map((x) => ({ ...x, isRecommended: x.key === o.key ? v : v ? false : x.isRecommended })) })} label="Recommended" />
                </div>
                <Input value={o.name} onChange={(e) => setOption(o.key, { name: e.target.value })} placeholder="Replace compressor" disabled={locked} />
                <Textarea value={o.description} onChange={(e) => setOption(o.key, { description: e.target.value })} rows={2} placeholder="What this option covers" disabled={locked} />
                <Textarea value={o.included} onChange={(e) => setOption(o.key, { included: e.target.value })} rows={2} placeholder="Included, one per line" disabled={locked} />
                <div className="row gap-2">
                  <Field label="Price"><Input type="number" step="1" value={o.price} onChange={(e) => setOption(o.key, { price: e.target.value })} disabled={locked} /></Field>
                  {!locked ? <Button size="sm" tone="ghost" onClick={() => setOption(o.key, { price: totals.sell != null ? String(Math.round(totals.sell)) : o.price, cost: totals.cost != null ? String(totals.cost) : o.cost })} disabled={totals.sell == null} title="Price from the labor, material and margin below">From totals</Button> : null}
                  {!locked && draft.options.length > 1 ? <Button size="sm" tone="ghost" icon="x" aria-label="Remove option" onClick={() => setDraft({ ...draft, options: draft.options.filter((x) => x.key !== o.key) })} /> : null}
                </div>
                {o.price ? <div className="small muted">{money(financingMonthly(Number(o.price)))}/mo financing{totals.cost != null ? ` · ${Math.round(((Number(o.price) - totals.cost) / Number(o.price)) * 100)}% margin at these costs` : ""}</div> : null}
              </div>
            ))}
          </div>
        </Card>

        {!locked ? (
          <div className="row wrap gap-2">
            <Button tone="primary" size="lg" onClick={() => save.mutate()} disabled={save.isPending || (!detail && !ctx.site)}>{detail ? "Save" : "Create quote"}</Button>
            {detail && status === "draft" ? <Button tone="copper" size="lg" onClick={() => send.mutate()}>Save and mark sent</Button> : null}
            {detail && status !== "draft" ? <><Button tone="moss" size="lg" onClick={() => { setApprove({ optionId: detail.selectedOption?.id ?? "", signerName: "" }); setApproveOpen(true); }}>Customer approved</Button><Button tone="ghost" size="lg" onClick={() => setDeclineOpen(true)}>Declined</Button></> : null}
          </div>
        ) : (
          <Notice tone={status === "approved" ? "moss" : "plain"}>{status === "approved" ? <>Approved{detail?.quote.signerName ? ` by ${detail.quote.signerName}` : ""} {detail?.quote.approvedAt ? stampLabel(detail.quote.approvedAt) : ""}. {detail?.quote.createdWorkOrderId ? <Link to="/work-orders/$id" params={{ id: detail.quote.createdWorkOrderId }} className="nav-link strong">Open the work order</Link> : null}</> : <>Declined{detail?.quote.lossReason ? `: ${statusLabel(detail.quote.lossReason)}` : ""}{detail?.quote.lossNote ? ` · ${detail.quote.lossNote}` : ""}.</>}</Notice>
        )}
      </div>

      <aside className="stack loose">
        {detail ? (
          <div className="stack tight">
            <div className="row between"><span className="eyebrow">Quote {detail.quote.number}</span><Pill tone={status === "approved" ? "site" : status === "declined" ? "hold" : status === "draft" ? "open" : "quote"}>{statusLabel(status)}{detail.quote.viewCount ? ` · viewed ${detail.quote.viewCount}×` : ""}</Pill></div>
            <StatusTrack steps={track} current={status === "follow_up" ? "sent" : status} />
          </div>
        ) : null}
        <Card title="Project cost and price" flat>
          <Facts tight rows={[["Labor", totals.laborTotal != null ? `${money(totals.laborTotal)} · ${totals.hours} h` : "rates missing"], ["Material", money(totals.materialCost)], [`Use tax ${totals.taxRate}%`, money(totals.useTax)], ["Project cost", totals.cost != null ? money(totals.cost) : "—"]]} />
          <Field label="Margin">
            <div className="row gap-2 wrap">
              {MARGIN_PRESETS.map((m) => <button key={m} type="button" className={`chip${draft.marginPercent === m ? " on" : ""}`} onClick={() => !locked && setDraft({ ...draft, marginPercent: m })}>{m}%</button>)}
              <Input type="number" value={draft.marginPercent} onChange={(e) => setDraft({ ...draft, marginPercent: Number(e.target.value) })} style={{ maxWidth: 80 }} disabled={locked} />
            </div>
          </Field>
          <Facts tight rows={[["Sell at margin", <b key="s">{totals.sell != null ? money(totals.sell) : "—"}</b>], ["Profit", totals.profit != null ? money(totals.profit) : "—"], ["Recommended option", recommended?.price ? money(Number(recommended.price)) : "not priced"]]} />
          <p className="small muted">Sell = cost ÷ (1 − margin). Material on quoted jobs carries use tax as cost; the customer is not charged sales tax.</p>
        </Card>
        <Field label="Follow up on"><Input type="date" value={draft.followUpDate} onChange={(e) => setDraft({ ...draft, followUpDate: e.target.value })} disabled={locked} /></Field>
        {detail ? (
          <div className="stack tight small">
            {detail.quote.workOrderId ? <Link to="/work-orders/$id" params={{ id: detail.quote.workOrderId }} className="nav-link">Found on work order</Link> : null}
            {ctx.customer ? <Link to="/customers/$id" params={{ id: ctx.customer.id }} className="nav-link">{ctx.customer.name}</Link> : null}
            {detail.customer?.portalEnabled && detail.customer.portalToken ? <a href={siteUrl(`/portal/${detail.customer.portalToken}`)} target="_blank" rel="noreferrer">Customer portal (approve online)</a> : <span className="muted">Enable the customer portal to let them approve online.</span>}
            <span className="muted">Created {stampLabel(detail.quote.createdAt)}</span>
          </div>
        ) : null}
      </aside>

      <PricebookPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addFromPricebook} />
      <Sheet open={approveOpen} onClose={() => setApproveOpen(false)} title="Record the customer's approval" footer={<><Button tone="ghost" onClick={() => setApproveOpen(false)}>Cancel</Button><Button tone="moss" onClick={() => doApprove.mutate()}>Approve and create the work order</Button></>}>
        {detail && detail.options.length > 1 ? <Field label="Option chosen"><Select value={approve.optionId} onChange={(e) => setApprove({ ...approve, optionId: e.target.value })}>{detail.options.map((o) => <option key={o.id} value={o.id}>{o.name} · {money(o.price)}</option>)}</Select></Field> : null}
        <Field label="Approved by" help="Name of the person who said yes, for the record."><Input value={approve.signerName} onChange={(e) => setApprove({ ...approve, signerName: e.target.value })} /></Field>
        <p className="small muted">A quoted work order is created at the option's price and lands in the follow-up queue until it is scheduled.</p>
      </Sheet>
      <Sheet open={declineOpen} onClose={() => setDeclineOpen(false)} title="Mark declined" footer={<><Button tone="ghost" onClick={() => setDeclineOpen(false)}>Cancel</Button><Button tone="danger" onClick={() => doDecline.mutate()}>Mark declined</Button></>}>
        <Field label="Reason"><Select value={decline.reason} onChange={(e) => setDecline({ ...decline, reason: e.target.value })}>{QUOTE_LOSS_REASONS.map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}</Select></Field>
        <Field label="Note"><Input value={decline.note} onChange={(e) => setDecline({ ...decline, note: e.target.value })} /></Field>
      </Sheet>
    </div>
  );
}

const templates: QuoteDetail["scopeTemplates"] = [];

function PricebookPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (item: PricebookItem, mode: "line" | "options") => void }) {
  const [q, setQ] = useState("");
  const query = useQuery({ queryKey: ["pricebook", "", q], queryFn: () => api.get<{ items: PricebookItem[] }>(`/pricebook${qs({ q })}`), enabled: open });
  return (
    <Sheet open={open} onClose={onClose} title="Pricebook" wide>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code, name, or description" autoFocus />
      <div className="list">
        {(query.data?.items ?? []).map((it) => (
          <div key={it.id} className="item" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div>
              <div className="title"><span className="num">{it.code}</span> · {it.name}</div>
              <div className="sub">{it.category} · parts {money(it.partsCost)} · {it.laborHours} h{it.priceBetter != null ? ` · G/B/B ${money(it.priceGood ?? 0)} / ${money(it.priceBetter)} / ${money(it.priceBest ?? 0)}` : ""}</div>
            </div>
            <div className="row gap-2">
              <Button size="sm" onClick={() => onPick(it, "line")}>Add</Button>
              {it.priceGood != null && it.priceBetter != null && it.priceBest != null ? <Button size="sm" tone="copper" onClick={() => onPick(it, "options")}>Good, Better, Best</Button> : null}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
