import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, money, moneyK, stampLabel, statusLabel } from "../../app/format";
import { Card, Kpi, Loading, Seg } from "../../design/components";

interface Overview {
  range: string;
  start: string;
  today: string;
  kpis: { billed: number; billedChange: number | null; waitingToBill: number; workOrdersCreated: number; urgentShare: number; averageTicket: number; closeRate: number; quotesSent: number; quotesViewed: number; quotesApproved: number; approvedValue: number; sentValue: number; unsoldValue: number; unsoldCount: number; arOver30: number; arTotal: number; oldestDays: number; renewalsDue: number; renewalsValue: number };
  revenueByWeek: { start: string; amount: number }[];
  capacityByWeek: { start: string; percent: number }[];
  aging: Record<string, { amount: number; count: number }>;
  byJobType: Record<string, { revenue: number; count: number }>;
  scorecard: { techId: string; name: string; jobs: number; worked: number; billable: number; billableShare: number; avgTicket: number; callbacks: number; revenue: number }[];
}

const search = z.object({ range: z.enum(["week", "month", "quarter", "year"]).default("month") });

export const Route = createFileRoute("/_office/reports")({ validateSearch: search, component: ReportsPage });

function Bars({ data, tone, format }: { data: { label: string; value: number }[]; tone?: string; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
      {data.map((d, i) => (
        <div key={i} className={`bar ${tone ?? ""}`} title={`${d.label}: ${format(d.value)}`}>
          <i style={{ height: `${Math.max(d.value > 0 ? 3 : 0, (d.value / max) * 100)}%` }} />
          <small>{d.label}</small>
        </div>
      ))}
    </div>
  );
}

function ReportsPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery({ queryKey: ["reports", params.range], queryFn: () => api.get<Overview>(`/reports/overview${qs({ range: params.range })}`) });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api.get<{ activity: { f: { id: string; entity: string; entityId: string; field: string; toValue: string | null; createdAt: string }; userName: string | null }[] }>("/reports/activity") });
  const d = query.data;
  const label = { week: "Last 7 days", month: "This month", quarter: "This quarter", year: "This year" }[params.range];
  return (
    <>
      <div className="toolbar">
        <Seg value={params.range} options={[{ value: "week", label: "Week" }, { value: "month", label: "Month" }, { value: "quarter", label: "Quarter" }, { value: "year", label: "Year" }]} onChange={(v) => navigate({ search: { range: v } })} />
        <span className="small muted">{label}{d ? ` · from ${dayLabel(d.start)}` : ""}</span>
      </div>
      <div className="page">
        {!d ? <Loading label="Adding up the numbers" /> : (
          <div className="stack loose">
            <div className="kpis">
              <Kpi label="Billed" value={money(d.kpis.billed)} delta={d.kpis.billedChange != null ? `${d.kpis.billedChange >= 0 ? "+" : ""}${d.kpis.billedChange}% vs the period before` : `${d.kpis.waitingToBill} jobs waiting to bill`} deltaTone={d.kpis.billedChange != null ? (d.kpis.billedChange >= 0 ? "up" : "down") : undefined} />
              <Kpi label="Average ticket" value={money(d.kpis.averageTicket)} delta={`${d.kpis.workOrdersCreated} work orders created · ${d.kpis.urgentShare}% urgent`} />
              <Kpi label="Quote close rate" value={d.kpis.closeRate} unit="%" delta={`${money(d.kpis.unsoldValue)} unsold in ${d.kpis.unsoldCount} quotes`} deltaTone={d.kpis.unsoldCount ? "down" : undefined} />
              <Kpi label="A/R over 30 days" value={money(d.kpis.arOver30)} delta={`${money(d.kpis.arTotal)} outstanding · oldest ${d.kpis.oldestDays} days`} deltaTone={d.kpis.arOver30 > 0 ? "down" : "up"} />
            </div>
            <div className="two-col">
              <Card title="Revenue by week" actions={<span className="small muted">Last 12 weeks, billed</span>}>
                <Bars data={d.revenueByWeek.map((w) => ({ label: dayLabel(w.start).slice(5), value: w.amount }))} format={money} />
              </Card>
              <Card title="Booked capacity" actions={<span className="small muted">Scheduled hours against tech hours</span>}>
                <Bars data={d.capacityByWeek.map((w) => ({ label: dayLabel(w.start).slice(5), value: w.percent }))} tone="steel" format={(v) => `${v}%`} />
              </Card>
            </div>
            <div className="two-col">
              <Card title="Quote funnel" actions={<span className="small muted">{label}</span>}>
                <div className="funnel">
                  <div><span className="eyebrow">Sent</span><div className="n">{d.kpis.quotesSent}</div><div className="small muted">{money(d.kpis.sentValue)}</div></div>
                  <div><span className="eyebrow">Viewed</span><div className="n">{d.kpis.quotesViewed}</div><div className="small muted">{d.kpis.quotesSent ? Math.round((d.kpis.quotesViewed / d.kpis.quotesSent) * 100) : 0}% of sent</div></div>
                  <div><span className="eyebrow">Approved</span><div className="n">{d.kpis.quotesApproved}</div><div className="small muted">{money(d.kpis.approvedValue)}</div></div>
                </div>
              </Card>
              <Card title="Receivables aging">
                <Bars data={Object.entries(d.aging).map(([k, v]) => ({ label: k === "current" ? "Current" : k, value: v.amount }))} tone="red" format={money} />
                <div className="small muted mt-1">{Object.values(d.aging).reduce((s, b) => s + b.count, 0)} open invoices · {d.kpis.renewalsDue} agreement renewals due worth {money(d.kpis.renewalsValue)}</div>
              </Card>
            </div>
            <div className="two-col">
              <Card title="Revenue by job type">
                <table className="table dense">
                  <thead><tr><th>Type</th><th className="num">Invoices</th><th className="num">Revenue</th><th className="num">Average</th></tr></thead>
                  <tbody>{Object.entries(d.byJobType).map(([k, v]) => <tr key={k}><td>{statusLabel(k)}</td><td className="num">{v.count}</td><td className="num">{money(v.revenue)}</td><td className="num">{money(v.count ? v.revenue / v.count : 0)}</td></tr>)}{Object.keys(d.byJobType).length === 0 ? <tr><td colSpan={4} className="muted small">Nothing billed in this period.</td></tr> : null}</tbody>
                </table>
              </Card>
              <Card title="Recent activity">
                <div className="timeline">{(activity.data?.activity ?? []).slice(0, 10).map((a) => <div key={a.f.id} className="tl steel"><div className="when">{stampLabel(a.f.createdAt)}</div><div className="what">{statusLabel(a.f.entity)} · {a.f.field}{a.f.toValue ? ` → ${a.f.toValue.slice(0, 60)}` : ""}</div><div className="who">{a.userName ?? "System"}</div></div>)}</div>
              </Card>
            </div>
            <Card title="Technician scorecard" actions={<span className="small muted">{label}</span>}>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Technician</th><th className="num">Jobs done</th><th className="num">Hours</th><th className="num">Billable</th><th className="num">Revenue</th><th className="num">Avg ticket</th><th className="num">Callbacks</th></tr></thead>
                  <tbody>
                    {d.scorecard.map((t) => (
                      <tr key={t.techId}>
                        <td className="primary-cell">{t.name}</td>
                        <td className="num">{t.jobs}</td>
                        <td className="num">{t.worked} h</td>
                        <td className="num">{t.billableShare}%</td>
                        <td className="num">{moneyK(t.revenue)}</td>
                        <td className="num">{money(t.avgTicket)}</td>
                        <td className="num" style={{ color: t.callbacks ? "var(--red)" : undefined }}>{t.callbacks || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
