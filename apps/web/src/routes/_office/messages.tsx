import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { api } from "../../app/api";
import { relativeLabel, stampLabel, statusLabel, woNumber } from "../../app/format";
import { useAction } from "../../app/queries";
import type { CustomerRow, MessageRow } from "../../app/types";
import { Avatar, Button, Empty, Loading, Notice, Pill, Textarea } from "../../design/components";

interface ThreadsPayload {
  threads: { customerId: string | null; customerName: string | null; lastAt: string; unread: number; total: number; last: MessageRow | undefined }[];
}
interface ThreadPayload {
  customer: CustomerRow;
  messages: { m: MessageRow; senderName: string | null }[];
  openWorkOrders: { id: string; number: number; trip: number; title: string; status: string; scheduledFor: string | null }[];
}

const search = z.object({ customer: z.string().optional() });

export const Route = createFileRoute("/_office/messages")({ validateSearch: search, component: MessagesPage });

const TEMPLATES = [
  { label: "Running late", body: "Hi, this is Harbor Coast Mechanical. Our technician is running about 20 minutes behind. We will text when they are on the way." },
  { label: "Need access", body: "Hi, this is Harbor Coast Mechanical. Our technician is at your site and needs roof access. Could someone meet them at the front desk?" },
  { label: "Parts arrived", body: "Hi, this is Harbor Coast Mechanical. The parts for your repair arrived. Reply with a good day this week and we will schedule the return visit." },
  { label: "Invoice ready", body: "Hi, this is Harbor Coast Mechanical. Your invoice is ready in your customer portal. Thank you for your business." },
];

function MessagesPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const threads = useQuery({ queryKey: ["threads"], queryFn: () => api.get<ThreadsPayload>("/messages"), refetchInterval: 20_000 });
  const automations = useQuery({ queryKey: ["automations"], queryFn: () => api.get<{ provider: string }>("/messages/automations") });
  const selected = params.customer ?? threads.data?.threads.find((t) => t.customerId)?.customerId;
  const thread = useQuery({ queryKey: ["thread", selected], queryFn: () => api.get<ThreadPayload>(`/messages/thread/${selected}`), enabled: Boolean(selected), refetchInterval: 15_000 });
  const [body, setBody] = useState("");
  const send = useAction(() => api.post("/messages", { customerId: selected, to: thread.data?.customer.phone, body }), { success: "Text sent", onSuccess: () => setBody("") });
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [thread.data?.messages.length]);
  if (threads.isLoading) return <Loading label="Loading conversations" />;
  return (
    <div className="chat">
      <div className="chat-threads">
        {automations.data?.provider === "demo" ? <div className="small muted" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line)" }}>Demo texting: messages are recorded as delivered. Add Twilio keys in Settings to send for real.</div> : null}
        {threads.data?.threads.length === 0 ? <div style={{ padding: 16 }}><Empty title="No conversations yet">Texts sent from work orders and automations show up here.</Empty></div> : null}
        {threads.data?.threads.map((t) => (
          <button key={t.customerId ?? "none"} type="button" className={`item clickable${t.customerId === selected ? " on" : ""}`} style={{ gridTemplateColumns: "auto minmax(0,1fr) auto", width: "100%", textAlign: "left", border: 0, borderBottom: "1px solid var(--line)", borderRadius: 0 }} onClick={() => t.customerId && navigate({ search: { customer: t.customerId } })}>
            <Avatar name={t.customerName ?? "?"} size="sm" tone={t.unread ? "amber" : undefined} />
            <div>
              <div className="title">{t.customerName ?? "Unknown number"}</div>
              <div className="sub truncate">{t.last ? `${t.last.direction === "out" ? "You: " : ""}${t.last.body}` : ""}</div>
            </div>
            <div className="stack tight" style={{ alignItems: "flex-end" }}>
              <span className="small muted">{relativeLabel(t.lastAt)}</span>
              {t.unread ? <span className="badge">{t.unread}</span> : null}
            </div>
          </button>
        ))}
      </div>
      <div className="chat-pane">
        {!selected ? <div style={{ padding: 24 }}><Empty title="Pick a conversation" /></div> : !thread.data ? <Loading /> : (
          <>
            <div className="row between wrap" style={{ padding: "12px 20px", borderBottom: "1px solid var(--line)" }}>
              <div>
                <Link to="/customers/$id" params={{ id: thread.data.customer.id }} className="strong nav-link">{thread.data.customer.name}</Link>
                <div className="small muted num">{thread.data.customer.phone || "No mobile number on file"}</div>
              </div>
              <div className="row wrap gap-2">{thread.data.openWorkOrders.map((w) => <Link key={w.id} to="/work-orders/$id" params={{ id: w.id }} className="pill plain open nav-link">{woNumber(w)} · {w.title}</Link>)}</div>
            </div>
            <div className="bubbles">
              {thread.data.messages.map(({ m, senderName }) => (
                <div key={m.id} className={`bubble ${m.direction}`}>
                  {m.body}
                  <span className="meta">{stampLabel(m.createdAt)}{m.automated ? " · automatic" : senderName ? ` · ${senderName}` : ""}{m.direction === "out" ? ` · ${statusLabel(m.status)}` : ""}{m.error ? ` · ${m.error}` : ""}</span>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            {!thread.data.customer.phone ? <Notice tone="red">No mobile number for this customer. Add one on the customer record to text them.</Notice> : null}
            <div style={{ padding: "8px 20px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>{TEMPLATES.map((t) => <button key={t.label} type="button" className="chip" onClick={() => setBody(t.body)}>{t.label}</button>)}</div>
            <div className="composer">
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Text ${thread.data.customer.name}`} rows={2} onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) send.mutate(); }} />
              <Button tone="primary" onClick={() => send.mutate()} disabled={!body.trim() || !thread.data.customer.phone || send.isPending}>Send</Button>
            </div>
            <div className="small muted" style={{ padding: "4px 20px 10px" }}>Replies come back here when the texting provider is connected. <Pill tone="open" plain>{thread.data.messages.length} messages</Pill></div>
          </>
        )}
      </div>
    </div>
  );
}
