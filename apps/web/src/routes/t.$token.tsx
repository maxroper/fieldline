import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../app/api";
import { dayLabel, relativeLabel, statusLabel } from "../app/format";
import { Loading, Notice, StatusTrack } from "../design/components";
import { FilePhoto } from "../features/files/FilePhoto";

interface Tracking {
  company: { name: string; phone: string; timezone: string } | undefined;
  workOrder: { number: number; title: string; status: string; techStatus: string | null; techStatusAt: string | null; scheduledFor: string | null; window: string | null; workPerformed: string };
  site: { name: string; address: string; lat: number | null; lng: number | null } | undefined;
  tech: { firstName: string | undefined; title: string } | null;
  location: { lat: number; lng: number; at: string } | null;
  photos: { id: string; caption: string; kind: string }[];
}

export const Route = createFileRoute("/t/$token")({ component: TrackPage });

/** The customer's "where is my tech" page, reached from the on-my-way text. No sign-in; the token is the key. */
function TrackPage() {
  const { token } = Route.useParams();
  const query = useQuery({ queryKey: ["track", token], queryFn: () => api.get<Tracking>(`/public/track/${token}`), refetchInterval: 20_000, retry: false });
  if (query.isLoading) return <Loading label="Finding your visit" />;
  if (query.error || !query.data) return <div className="public"><Notice tone="red">That link is not valid any more. Call the office and we will send a new one.</Notice></div>;
  const d = query.data;
  const wo = d.workOrder;
  const done = wo.status !== "open" || wo.techStatus === "done";
  const current = done ? "done" : wo.techStatus === "on_site" || wo.techStatus === "paused" ? "on_site" : wo.techStatus === "en_route" ? "en_route" : "sched";
  return (
    <div className="public">
      <div className="brand"><b>{d.company?.name ?? "Fieldline"}</b><span>Service visit {wo.number}</span></div>
      <div className="public-card">
        <h1 style={{ fontSize: 22 }}>{done ? "Your visit is complete" : wo.techStatus === "en_route" ? `${d.tech?.firstName ?? "Your technician"} is on the way` : wo.techStatus === "on_site" ? `${d.tech?.firstName ?? "Your technician"} is on site` : "Your visit is scheduled"}</h1>
        <div className="muted">{wo.title}{d.site ? ` · ${d.site.name}` : ""}</div>
        <StatusTrack steps={[{ key: "sched", label: "Scheduled", at: wo.scheduledFor ? dayLabel(wo.scheduledFor) : undefined }, { key: "en_route", label: "On the way" }, { key: "on_site", label: "On site" }, { key: "done", label: "Done" }]} current={current} />
        {!done && wo.window ? <div><span className="eyebrow">Arrival window</span><div className="strong">{wo.window}</div></div> : null}
        {d.tech ? <div><span className="eyebrow">Your technician</span><div className="strong">{d.tech.firstName}</div><div className="small muted">{d.tech.title}</div></div> : null}
        {d.location ? <div className="small muted">Location updated {relativeLabel(d.location.at)}. {d.site?.lat != null && d.site.lng != null ? `About ${Math.round(Math.hypot(d.location.lat - d.site.lat, d.location.lng - d.site.lng) * 69)} miles away.` : ""}</div> : null}
        {wo.techStatusAt && !done ? <div className="small muted">{statusLabel(wo.techStatus)} since {relativeLabel(wo.techStatusAt)}</div> : null}
      </div>
      {done && wo.workPerformed ? <div className="public-card"><span className="eyebrow">Work performed</span><p style={{ margin: 0 }}>{wo.workPerformed}</p></div> : null}
      {done && d.photos.length ? <div className="public-card"><span className="eyebrow">Photos</span><div className="photo-grid">{d.photos.map((p) => <FilePhoto key={p.id} id={p.id} caption={p.caption} />)}</div></div> : null}
      <div className="small muted">Questions? Call {d.company?.phone ? <a href={`tel:${d.company.phone.replace(/[^\d+]/g, "")}`}>{d.company.phone}</a> : "the office"}.</div>
    </div>
  );
}
