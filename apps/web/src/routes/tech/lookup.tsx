import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, qs } from "../../app/api";
import { dayLabel, statusLabel, woNumber } from "../../app/format";
import type { AgreementRow, EquipmentRow, SiteRow, WorkOrderRow } from "../../app/types";
import { Empty, Input, Pill } from "../../design/components";

interface Match {
  site: SiteRow;
  customerName: string;
  contract: boolean;
  primaryTechName: string | null;
  openWorkOrders: WorkOrderRow[];
  lastVisit: WorkOrderRow | null;
  equipment: EquipmentRow[];
  agreement: AgreementRow | null;
}

export const Route = createFileRoute("/tech/lookup")({ component: TechLookup });

/** Find a site or unit from the truck: history, equipment, access notes. A QR scan on a unit lands here too. */
function TechLookup() {
  const [q, setQ] = useState("");
  const [needle, setNeedle] = useState("");
  useEffect(() => { const t = setTimeout(() => setNeedle(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const digits = needle.replace(/\D/g, "");
  const lookup = useQuery({ queryKey: ["lookup", needle], queryFn: () => api.get<{ matches: Match[] }>(`/customers/lookup${qs(digits.length >= 7 ? { phone: digits } : { q: needle })}`), enabled: needle.length >= 2 });
  return (
    <div className="ph-page">
      <h1>Lookup</h1>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Customer, address, or phone" className="lg" autoFocus inputMode="search" />
      {needle.length < 2 ? <div className="small muted">Type a few letters, or scan the Fieldline QR tag on a unit.</div> : null}
      {lookup.data?.matches.length === 0 ? <Empty title="No match">Ask dispatch to create the customer.</Empty> : null}
      {(lookup.data?.matches ?? []).map((m) => (
        <div key={m.site.id} className="card">
          <div className="strong">{m.site.name || m.site.address}</div>
          <div className="small muted">{m.customerName} · {m.site.address}{m.site.city ? `, ${m.site.city}` : ""}</div>
          <div className="row wrap gap-2 mt-1">
            {m.agreement ? <Pill tone="copper" plain>{m.agreement.name}</Pill> : null}
            {m.contract ? <Pill tone="sched" plain>Contract</Pill> : null}
            {m.primaryTechName ? <Pill tone="open" plain>{m.primaryTechName} primary</Pill> : null}
          </div>
          {m.site.accessNotes ? <div className="small mt-1"><b>Access:</b> {m.site.accessNotes}</div> : null}
          {m.site.contact ? <div className="small">{m.site.contact} · <a href={`tel:${m.site.contactPhone.replace(/[^\d+]/g, "")}`}>{m.site.contactPhone}</a></div> : null}
          {m.openWorkOrders.length ? <div className="stack tight mt-1"><span className="eyebrow">Open</span>{m.openWorkOrders.map((w) => <Link key={w.id} to="/tech/work-orders/$id" params={{ id: w.id }} search={true} className="small nav-link"><span className="num">{woNumber(w)}</span> · {w.title} · {w.techName ?? "unassigned"}</Link>)}</div> : null}
          {m.lastVisit ? <div className="small muted mt-1">Last visit {dayLabel(m.lastVisit.scheduledFor)} · {m.lastVisit.title} · {m.lastVisit.techName}</div> : null}
          {m.equipment.length ? <div className="stack tight mt-1"><span className="eyebrow">Equipment</span>{m.equipment.map((u) => <div key={u.id} className="small"><b>{u.tag}</b> {u.make} {u.model}{u.refrigerant ? ` · ${u.refrigerant}` : ""}{u.installYear ? ` · ${u.installYear}` : ""}{u.locationNote ? ` · ${u.locationNote}` : ""}{u.stage !== "active" ? ` · ${statusLabel(u.stage)}` : ""}</div>)}</div> : null}
        </div>
      ))}
    </div>
  );
}
