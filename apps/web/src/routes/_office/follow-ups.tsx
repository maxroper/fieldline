import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../app/api";
import { addDays, dayLabel, money, statusLabel, woNumber } from "../../app/format";
import { useAction } from "../../app/queries";
import type { WorkOrderRow } from "../../app/types";
import { Button, Card, Empty, Input, Loading, Pill, Seg, Switch, SummaryLine } from "../../design/components";

interface FollowUpsPayload {
  today: string;
  workOrders: (WorkOrderRow & { overdue: boolean })[];
  quotes: { id: string; number: number; scope: string; status: string; followUpDate: string | null; sentAt: string | null; customerName: string | null; siteName: string | null; overdue: boolean }[];
  purchaseOrders: { id: string; number: number; vendorName: string; remindAt: string | null; workOrderNumber: number | null; overdue: boolean }[];
  items: { id: string; kind: string; title: string; detail: string; dueOn: string | null; status: string; customerName: string | null; workOrderId: string | null; overdue: boolean }[];
  automations: { id: string; key: string; enabled: boolean; sentCount: number }[];
  counts: { overdue: number; dueToday: number; total: number };
}

export const Route = createFileRoute("/_office/follow-ups")({ component: FollowUpsPage });

const AUTOMATION_LABELS: Record<string, [string, string]> = {
  confirmation: ["Appointment confirmation", "Text the day before with the window; reply C confirms."],
  on_my_way: ["On my way ETA text", "When the tech taps En route, with a live tracking link."],
  review_request: ["Review request", "Two hours after completion, unless skipped in the queue."],
  quote_followup: ["Unsold-quote cadence", "Day 2 text, day 6 options email, day 10 call task."],
  permit_warranty: ["Permit and warranty reminders", "Deadlines land here as follow-ups."],
  pm_due: ["PM visit due reminders", "Three weeks before the season, with a self-book link."],
  missed_call: ["Missed-call text-back", "Instant text with a booking link after an unanswered call."],
};

function FollowUpsPage() {
  const query = useQuery({ queryKey: ["follow-ups"], queryFn: () => api.get<FollowUpsPayload>("/follow-ups") });
  const [tab, setTab] = useState<"all" | "waiting" | "automations">("all");
  const [snoozeFor, setSnoozeFor] = useState<string | null>(null);
  const [snoozeDate, setSnoozeDate] = useState("");
  const followUp = useAction((vars: { id: string; body: Record<string, unknown> }) => api.post(`/work-orders/${vars.id}/follow-up`, vars.body), { success: "Follow-up updated" });
  const partsReceived = useAction((id: string) => api.post(`/follow-ups/work-orders/${id}/parts-received`), { success: "Back in the open queue" });
  const itemAction = useAction((vars: { id: string; action: string; until?: string }) => api.post(`/follow-ups/items/${vars.id}`, { action: vars.action, until: vars.until }), { success: "Done" });
  const toggle = useAction((vars: { key: string; enabled: boolean }) => api.patch(`/messages/automations/${vars.key}`, { enabled: vars.enabled }), { success: "Automation updated" });
  const data = query.data;
  if (query.isLoading || !data) return <Loading label="Loading follow-ups" />;

  const groups: { label: string; rows: FollowUpsPayload["workOrders"] }[] = [
    { label: "Waiting on parts", rows: data.workOrders.filter((w) => w.waitingOnParts || w.followUp?.reason === "parts") },
    { label: "Waiting on customer", rows: data.workOrders.filter((w) => w.followUp && ["quote_sent", "approved", "no_access"].includes(w.followUp.reason)) },
    { label: "Need to return", rows: data.workOrders.filter((w) => (w.needReturn || w.followUp?.reason === "return") && !w.waitingOnParts) },
    { label: "Warranty pending", rows: data.workOrders.filter((w) => w.followUp?.reason === "warranty") },
  ];

  return (
    <>
      <div className="toolbar">
        <Seg value={tab} options={[{ value: "all", label: "All", count: data.counts.total }, { value: "waiting", label: "Work orders", count: data.workOrders.length }, { value: "automations", label: "Automations", count: data.automations.filter((a) => a.enabled).length }]} onChange={setTab} />
        <span className="grow" />
        <SummaryLine items={[{ dot: "red", value: data.counts.overdue, label: "overdue" }, { dot: "amber", value: data.counts.dueToday, label: "due today" }, { value: data.counts.total, label: "in the queue" }]} />
      </div>
      <div className="page">
        {tab === "automations" ? (
          <div className="stack" style={{ maxWidth: 640 }}>
            {data.automations.map((a) => (
              <div key={a.id} className="item" style={{ gridTemplateColumns: "auto minmax(0,1fr)", border: "1px solid var(--line)", borderRadius: "var(--r-2)", background: "var(--card)" }}>
                <Switch on={a.enabled} onChange={(enabled) => toggle.mutate({ key: a.key, enabled })} />
                <div>
                  <div className="title">{AUTOMATION_LABELS[a.key]?.[0] ?? a.key}</div>
                  <div className="sub">
                    {AUTOMATION_LABELS[a.key]?.[1]} · <span className="num">{a.sentCount}</span> sent
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="stack loose">
            {groups
              .filter((g) => g.rows.length)
              .map((g) => (
                <section key={g.label} className="section">
                  <div className="section-head">
                    <h3>{g.label}</h3>
                    <span className="muted small">{g.rows.length}</span>
                  </div>
                  <div className="list">
                    {g.rows.map((w) => (
                      <div key={w.id} className="item tall" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
                        <div className="stack tight">
                          <div className="row wrap gap-2">
                            <Link to="/work-orders/$id" params={{ id: w.id }} className="strong num nav-link">{woNumber(w)}</Link>
                            <span className="strong">{w.customerName ?? w.siteName}</span>
                            {w.followUp ? <Pill tone={w.overdue ? "urgent" : w.followUp.reason === "parts" ? "parts" : "sched"}>{statusLabel(w.followUp.reason)}</Pill> : <Pill tone="sched">Need to return</Pill>}
                            {w.overdue ? <span className="small" style={{ color: "var(--red)" }}>overdue</span> : w.followUp?.date ? <span className="small muted">due {dayLabel(w.followUp.date)}</span> : null}
                          </div>
                          <div className="small muted">
                            {w.siteAddress} · {w.title} · {w.techName ?? "unassigned"}
                          </div>
                          {w.followUp?.note ? <div className="small">{w.followUp.note}</div> : null}
                          {w.followUp?.part ? <div className="small muted">Part: {w.followUp.part}{w.followUp.expectedDate ? ` · expected ${dayLabel(w.followUp.expectedDate)}` : ""}</div> : null}
                          <div className="row wrap gap-2 mt-1">
                            {snoozeFor === w.id ? (
                              <>
                                <Input type="date" value={snoozeDate} onChange={(e) => setSnoozeDate(e.target.value)} style={{ maxWidth: 180 }} />
                                <Button size="sm" tone="primary" onClick={() => { followUp.mutate({ id: w.id, body: { ...w.followUp, reason: w.followUp?.reason ?? "return", date: snoozeDate } }); setSnoozeFor(null); }}>Snooze</Button>
                                <Button size="sm" tone="subtle" onClick={() => setSnoozeFor(null)}>Cancel</Button>
                              </>
                            ) : (
                              <>
                                <Button size="sm" onClick={() => { setSnoozeFor(w.id); setSnoozeDate(addDays(data.today, 2)); }}>Snooze</Button>
                                {w.waitingOnParts || w.followUp?.reason === "parts" ? <Button size="sm" tone="moss" onClick={() => partsReceived.mutate(w.id)}>Parts received</Button> : null}
                                <Link to="/dispatch" search={{ wo: w.id } as never} className="btn sm nav-link">Place on the board</Link>
                                <Button size="sm" tone="subtle" onClick={() => followUp.mutate({ id: w.id, body: { reason: null } })}>Back to open queue</Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

            {tab === "all" && data.quotes.length ? (
              <section className="section">
                <div className="section-head"><h3>Quotes waiting on the customer</h3><span className="muted small">{data.quotes.length}</span></div>
                <div className="list">
                  {data.quotes.map((q) => (
                    <Link key={q.id} to="/quoting/$id" params={{ id: q.id }} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                      <div>
                        <div className="title">Quote {q.number} · {q.customerName}</div>
                        <div className="sub">{q.scope} · {statusLabel(q.status)}{q.sentAt ? ` · sent ${dayLabel(q.sentAt.slice(0, 10))}` : ""}</div>
                      </div>
                      <Pill tone={q.overdue ? "urgent" : "quote"}>{q.followUpDate ? `Touch ${dayLabel(q.followUpDate)}` : statusLabel(q.status)}</Pill>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "all" && data.purchaseOrders.length ? (
              <section className="section">
                <div className="section-head"><h3>Purchase orders</h3><span className="muted small">{data.purchaseOrders.length}</span></div>
                <div className="list">
                  {data.purchaseOrders.map((po) => (
                    <Link key={po.id} to="/purchasing" search={{ po: po.id } as never} className="item clickable nav-link" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                      <div>
                        <div className="title">PO {po.number} · {po.vendorName}{po.workOrderNumber ? ` · WO ${po.workOrderNumber}` : ""}</div>
                        <div className="sub">Lump sum. Upload the pack list or invoice so the lines land on the bill.</div>
                      </div>
                      <Pill tone={po.overdue ? "urgent" : "parts"}>{po.overdue ? "Overdue" : "Lump sum"}</Pill>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {tab === "all" && data.items.length ? (
              <section className="section">
                <div className="section-head"><h3>Reminders</h3><span className="muted small">{data.items.length}</span></div>
                <div className="list">
                  {data.items.map((it) => (
                    <div key={it.id} className="item tall" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                      <div>
                        <div className="row wrap gap-2"><span className="title">{it.title}</span><Pill tone={it.overdue ? "urgent" : it.kind === "review_request" ? "site" : it.kind === "eta_text_failed" ? "parts" : "sched"}>{statusLabel(it.kind)}</Pill>{it.dueOn ? <span className="small muted">{dayLabel(it.dueOn)}</span> : null}</div>
                        <div className="sub">{it.detail}</div>
                      </div>
                      <div className="row gap-2">
                        <Button size="sm" tone="moss" onClick={() => itemAction.mutate({ id: it.id, action: "done" })}>{it.kind === "review_request" ? "Send" : "Done"}</Button>
                        <Button size="sm" tone="subtle" onClick={() => itemAction.mutate({ id: it.id, action: "snooze", until: addDays(data.today, 3) })}>Snooze</Button>
                        <Button size="sm" tone="subtle" onClick={() => itemAction.mutate({ id: it.id, action: "skip" })}>Skip</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {data.counts.total === 0 ? <Empty title="No follow-ups">Nothing is waiting on parts, customers, or paperwork.</Empty> : null}
            {tab === "all" ? (
              <Card title="Automations" actions={<Button size="sm" tone="subtle" onClick={() => setTab("automations")}>Edit</Button>}>
                <div className="small muted">
                  {data.automations.filter((a) => a.enabled).map((a) => AUTOMATION_LABELS[a.key]?.[0] ?? a.key).join(" · ")}
                </div>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

export { money };
