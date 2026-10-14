import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, money, statusLabel } from "../../app/format";
import type { QuoteRow } from "../../app/types";
import { Chip, Empty, Kpi, LinkButton, Loading, Pill, SummaryLine } from "../../design/components";

type QuoteListRow = QuoteRow & { customerName: string | null; siteName: string | null; unitTag: string | null; createdByName: string | null; options: { id: string; tier: string; price: number; isRecommended: boolean }[]; price: number | null };

interface QuotesPayload {
  quotes: QuoteListRow[];
  kpis: { openValue: number; openCount: number; closeRate: number; averageQuote: number; followUpsDue: number; byStatus: Record<string, number> };
}

const search = z.object({ view: z.enum(["open", "draft", "follow_up", "approved", "declined", "all"]).default("open"), q: z.string().optional() });

export const Route = createFileRoute("/_office/quoting/")({ validateSearch: search, component: QuotingPage });

const quoteTone = (status: string) => (status === "approved" ? "site" : status === "declined" ? "hold" : status === "draft" ? "open" : "quote");

function QuotingPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery({ queryKey: ["quotes", params.q ?? ""], queryFn: () => api.get<QuotesPayload>(`/quotes${qs({ q: params.q })}`) });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const today = new Date().toISOString().slice(0, 10);
  const data = query.data;
  const rows = (data?.quotes ?? []).filter((q) => (params.view === "open" ? ["sent", "viewed", "follow_up"].includes(q.status) : params.view === "follow_up" ? ["sent", "viewed", "follow_up"].includes(q.status) && q.followUpDate && q.followUpDate <= today : params.view === "all" ? true : q.status === params.view));
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {([["open", "Open", data?.kpis.openCount], ["follow_up", "Follow-up due", data?.kpis.followUpsDue], ["draft", "Drafts", data?.kpis.byStatus.draft], ["approved", "Approved", data?.kpis.byStatus.approved], ["declined", "Declined", data?.kpis.byStatus.declined], ["all", "All", undefined]] as const).map(([v, label, count]) => (
            <Chip key={v} on={params.view === v} count={count || undefined} onClick={() => setSearch({ view: v })}>{label}</Chip>
          ))}
        </div>
        <div className="search" style={{ flex: "1 1 200px", maxWidth: 320 }}>
          <input className="input" type="search" placeholder="Customer, site, or scope" defaultValue={params.q ?? ""} onKeyDown={(e) => e.key === "Enter" && setSearch({ q: (e.target as HTMLInputElement).value || undefined })} />
        </div>
        <span className="grow" />
        <LinkButton to="/quoting/new" tone="copper" size="sm" icon="plus">New quote</LinkButton>
      </div>
      <div className="page">
        {query.isLoading || !data ? <Loading label="Loading quotes" /> : (
          <div className="stack loose">
            <div className="kpis">
              <Kpi label="Open quotes" value={money(data.kpis.openValue)} delta={`${data.kpis.openCount} waiting on customers`} />
              <Kpi label="Close rate" value={data.kpis.closeRate} unit="%" delta="approved of sent" />
              <Kpi label="Average quote" value={money(data.kpis.averageQuote)} />
              <Kpi label="Follow-ups due" value={data.kpis.followUpsDue} delta={data.kpis.followUpsDue ? "touch today" : "all caught up"} deltaTone={data.kpis.followUpsDue ? "down" : "up"} />
            </div>
            {rows.length === 0 ? <Empty title="No quotes in this view">Found something on a visit? Start a quote from the work order or here.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Quote</th><th>Customer · site</th><th>Scope</th><th>Options</th><th className="num">Price</th><th>Status</th><th>Sent</th><th>Follow-up</th><th>By</th></tr></thead>
                  <tbody className="stagger">
                    {rows.map((q) => (
                      <tr key={q.id} className="clickable" onClick={() => navigate({ to: "/quoting/$id", params: { id: q.id } })}>
                        <td className="num primary-cell">{q.number}</td>
                        <td className="primary-cell"><div>{q.customerName}</div><div className="small muted">{q.siteName}{q.unitTag ? ` · ${q.unitTag}` : ""}</div></td>
                        <td className="truncate" style={{ maxWidth: 260 }}>{q.scope || q.problemText}</td>
                        <td>{q.options.length > 1 ? <span className="row gap-2">{q.options.map((o) => <span key={o.id} className={`pill plain ${o.isRecommended ? "copper" : "open"}`}>{statusLabel(o.tier)} {money(o.price)}</span>)}</span> : <span className="small muted">Single</span>}</td>
                        <td className="num strong">{q.price != null ? money(q.price) : ""}</td>
                        <td><Pill tone={quoteTone(q.status)}>{statusLabel(q.status)}{q.viewCount && q.status !== "approved" ? ` · viewed ${q.viewCount}×` : ""}</Pill></td>
                        <td className="num">{q.sentAt ? dayLabel(q.sentAt.slice(0, 10)) : ""}</td>
                        <td className="num" style={{ color: q.followUpDate && q.followUpDate <= today && !["approved", "declined"].includes(q.status) ? "var(--red)" : undefined }}>{q.followUpDate && !["approved", "declined"].includes(q.status) ? dayLabel(q.followUpDate) : ""}</td>
                        <td className="small muted">{q.createdByName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <SummaryLine items={[{ value: data.kpis.byStatus.sent ?? 0, label: "sent" }, { value: data.kpis.byStatus.viewed ?? 0, label: "viewed" }, { dot: "moss", value: data.kpis.byStatus.approved ?? 0, label: "approved" }, { dot: "red", value: data.kpis.byStatus.declined ?? 0, label: "declined" }]} />
          </div>
        )}
      </div>
    </>
  );
}
