import { statusLabel, woNumber } from "../../app/format";
import type { TechRow, WorkOrderRow } from "../../app/types";

/**
 * A map without a map provider: trucks and job sites projected onto a plain canvas from their
 * coordinates. Swap the SVG for a Mapbox or Google map when a key is configured (see Settings).
 */
export function MapPanel({ techs, jobs }: { techs: TechRow[]; jobs: WorkOrderRow[] }) {
  const points = [
    ...techs.filter((t) => t.location).map((t) => ({ lat: Number(t.location!.lat), lng: Number(t.location!.lng) })),
    ...jobs.filter((j) => j.siteLat != null && j.siteLng != null).map((j) => ({ lat: Number(j.siteLat), lng: Number(j.siteLng) })),
  ];
  if (!points.length) return <div className="map"><div className="empty" style={{ margin: 24 }}><b>No positions yet</b>Techs appear here when their phones report a location.</div></div>;
  const pad = 0.015;
  const minLat = Math.min(...points.map((p) => p.lat)) - pad;
  const maxLat = Math.max(...points.map((p) => p.lat)) + pad;
  const minLng = Math.min(...points.map((p) => p.lng)) - pad;
  const maxLng = Math.max(...points.map((p) => p.lng)) + pad;
  const x = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = (lat: number) => (1 - (lat - minLat) / (maxLat - minLat)) * 100;
  return (
    <div className="map" style={{ minHeight: 420 }}>
      <svg className="streets" viewBox="0 0 340 420" preserveAspectRatio="none" aria-hidden="true">
        <rect width="340" height="420" fill="#ece5d8" />
        <g stroke="#dbd2c3" strokeWidth="2">
          <path d="M0 60H340M0 130H340M0 200H340M0 270H340M0 340H340" />
          <path d="M50 0V420M120 0V420M190 0V420M260 0V420" />
        </g>
      </svg>
      {jobs
        .filter((j) => j.siteLat != null && j.siteLng != null && j.status === "open")
        .slice(0, 40)
        .map((j) => (
          <div key={j.id} className={`pin ${j.assignedTechId ? (j.techStatus === "on_site" ? "moss" : j.techStatus === "en_route" ? "amber" : "steel") : "red"}`} style={{ left: `${x(Number(j.siteLng))}%`, top: `${y(Number(j.siteLat))}%` }} title={`${woNumber(j)} ${j.customerName ?? ""}`}>
            <i />
            <b>
              {woNumber(j)} {(j.customerName ?? j.siteName ?? "").split(" ").slice(0, 2).join(" ")}
            </b>
          </div>
        ))}
      {techs
        .filter((t) => t.location)
        .map((t) => (
          <div key={t.id} className="truck" style={{ left: `${x(Number(t.location!.lng))}%`, top: `${y(Number(t.location!.lat))}%` }} title={`${t.name} · ${t.current ? statusLabel(t.current.techStatus) : "free"}`}>
            {t.name
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </div>
        ))}
      <div className="map-legend">
        <span><span className="dot moss" /> On site</span>
        <span><span className="dot amber" /> En route</span>
        <span><span className="dot red" /> Unassigned</span>
      </div>
    </div>
  );
}
