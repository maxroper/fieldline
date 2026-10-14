import { Link, Outlet, useRouterState, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMe } from "../session";
import { useRealtime } from "../realtime";
import { Icon, type IconName } from "../../design/icons";

/** Which tech the phone screens show: the signed-in tech, or `?as=<id>` when the office previews a day. */
export function useTechWho(): string {
  const search = useSearch({ from: "/tech" });
  return search.as ?? "me";
}

/**
 * The technician frame: full-width on a phone, framed on a desktop so the office can preview it.
 * One task per screen; each route renders its own `.ph-page`. The bottom bar holds the four places a tech goes.
 */
export function PhoneShell() {
  const me = useMe();
  useRealtime(Boolean(me.data?.session), me.data?.session?.orgId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  const tabs: { to: string; label: string; icon: IconName; exact?: boolean }[] = [
    { to: "/tech", label: "Today", icon: "calendar", exact: true },
    { to: "/tech/timesheet", label: "Timesheet", icon: "clock" },
    { to: "/tech/lookup", label: "Lookup", icon: "search" },
    { to: "/tech/vehicle", label: "Van", icon: "truck" },
  ];
  const active = (t: { to: string; exact?: boolean }) => (t.exact ? pathname === t.to || pathname === `${t.to}/` : pathname.startsWith(t.to));
  return (
    <div className="phone-stage full">
      <div className="phone">
        <div className="ph-body">
          <header className="tech-top">
            <div className="brand">
              <b>Fieldline</b>
              <span>Tech</span>
            </div>
            <div className="row gap-2">
              <span className={`pill plain ${online ? "site" : "urgent"}`}>{online ? "Synced" : "Offline"}</span>
              <span className="small strong">{me.data?.user?.name?.split(" ")[0]}</span>
            </div>
          </header>
          <Outlet />
          <nav className="ph-nav" aria-label="Tech menu">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to} search={true} className={active(t) ? "active" : ""}>
                <Icon name={t.icon} size={20} />
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
