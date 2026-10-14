import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { api } from "../api";
import { siteUrl } from "../format";
import { useUi } from "../store";
import { useMe } from "../session";
import { useRealtime } from "../realtime";
import { Button, Sheet } from "../../design/components";
import { Icon, type IconName } from "../../design/icons";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: number;
  isNew?: boolean;
}

/**
 * The office frame: grouped sidebar menu (Work, Customers, Sales, Money, Insights), slim top bar with
 * the page title, the follow-up bell and the one "+ New" button. Pages render in <Outlet />.
 */
export function OfficeShell({ title, children }: { title?: string; children?: ReactNode }) {
  const me = useMe();
  const ui = useUi();
  const [createOpen, setCreateOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  useRealtime(Boolean(me.data?.session), me.data?.session?.orgId);
  const followUps = useQuery({ queryKey: ["follow-ups"], queryFn: () => api.get<{ counts: { overdue: number } }>("/follow-ups"), staleTime: 30_000 });
  const overdue = followUps.data?.counts.overdue ?? 0;
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const groups: { label: string; items: NavItem[] }[] = [
    { label: "Work", items: [{ to: "/dispatch", label: "Dispatch board", icon: "board" }, { to: "/follow-ups", label: "Follow-ups", icon: "bell", badge: overdue }, { to: "/work-orders", label: "Work orders", icon: "list" }, { to: "/tech-status", label: "Tech status", icon: "techs" }, { to: "/timesheets", label: "Timesheets", icon: "clock" }] },
    { label: "Customers", items: [{ to: "/customers", label: "Customers", icon: "building" }, { to: "/agreements", label: "Agreements", icon: "agreement", isNew: true }, { to: "/messages", label: "Messages", icon: "chat", isNew: true }] },
    { label: "Sales", items: [{ to: "/quoting", label: "Quoting", icon: "tag" }, { to: "/pricebook", label: "Pricebook", icon: "book", isNew: true }] },
    { label: "Money", items: [{ to: "/billing", label: "Billing", icon: "dollar" }, { to: "/purchasing", label: "Purchasing", icon: "cart" }, { to: "/inventory", label: "Inventory", icon: "box" }] },
    { label: "Insights", items: [{ to: "/reports", label: "Reports", icon: "chart", isNew: true }] },
  ];
  const active = (to: string) => pathname === to || pathname.startsWith(to + "/") || (to === "/work-orders" && pathname.startsWith("/new/work-order")) || (to === "/customers" && (pathname.startsWith("/sites/") || pathname.startsWith("/new/customer")));
  const pageTitle = title ?? [...groups.flatMap((g) => g.items), { to: "/users", label: "Users" }, { to: "/settings", label: "Settings" }].find((i) => active(i.to))?.label ?? "Fieldline";

  const item = (nav: NavItem) => (
    <Link key={nav.to} to={nav.to} className={`side-item${active(nav.to) ? " active" : ""}`} data-tip={nav.label} onClick={() => ui.setSidebarOpen(false)}>
      <Icon name={nav.icon} size={18} />
      <span>{nav.label}</span>
      {nav.badge ? <span className="badge">{nav.badge}</span> : null}
      {nav.isNew ? <span className="new-dot">new</span> : null}
    </Link>
  );

  return (
    <div className="app">
      <aside className={["side", ui.sidebarCollapsed ? "collapsed" : "", ui.sidebarOpen ? "open" : ""].filter(Boolean).join(" ")} id="side" aria-label="Main menu">
        <div className="side-top">
          <div className="brand">
            <b>Fieldline</b>
          </div>
          <button className="side-collapse" type="button" aria-label="Collapse menu" onClick={ui.toggleSidebar}>
            <Icon name="chevron" size={14} />
          </button>
        </div>
        <div className="side-company">
          <span className="avatar sm ink">{(me.data?.org?.name ?? "F").slice(0, 2).toUpperCase()}</span>
          <span className="side-company-name">{me.data?.org?.name ?? "Fieldline"}</span>
        </div>
        <Link to="/work-orders" search={{ q: "" } as never} className="side-search nav-link">
          <Icon name="search" size={16} />
          <span>Search</span>
        </Link>
        <nav className="side-nav">
          {groups.map((g) => (
            <div key={g.label} style={{ display: "contents" }}>
              <span className="side-label">{g.label}</span>
              {g.items.map(item)}
            </div>
          ))}
        </nav>
        <div className="side-bottom">
          {item({ to: "/users", label: "Users", icon: "user" })}
          {item({ to: "/settings", label: "Settings", icon: "gear" })}
          <button className="side-user" type="button" onClick={() => setUserOpen(true)}>
            <span className="avatar sm">{(me.data?.user?.name ?? "?").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</span>
            <span className="side-user-text">
              <b>{me.data?.user?.name ?? ""}</b>
              <small>{me.data?.user?.title || me.data?.user?.role}</small>
            </span>
          </button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <Button icon="menu" size="sm" tone="ghost" className="menu-btn" aria-label="Open menu" onClick={() => ui.setSidebarOpen(!ui.sidebarOpen)} />
          <h1 className="top-title">{pageTitle}</h1>
          <span className="grow" />
          <Link to="/follow-ups" className="btn icon sm ghost nav-link top-bell" aria-label={`Follow-ups, ${overdue} overdue`}>
            <Icon name="bell" />
            {overdue ? <span className="badge-dot" /> : null}
          </Link>
          <Button tone="copper" size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
            New
          </Button>
        </header>
        <main className="main">{children ?? <Outlet />}</main>
      </div>

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="Create">
        <div className="menu-list">
          {[
            { to: "/new/work-order", icon: "list" as IconName, label: "Work order", sub: "From a call, an email, or a found repair" },
            { to: "/new/customer", icon: "building" as IconName, label: "Customer", sub: "Bill-to parent and first site" },
            { to: "/quoting/new", icon: "tag" as IconName, label: "Quote", sub: "Good, Better, Best from the pricebook" },
            { to: "/purchasing", icon: "cart" as IconName, label: "Purchase order", sub: "For a job or for truck stock" },
            { to: "/agreements", icon: "agreement" as IconName, label: "Agreement", sub: "Maintenance plan on a site's equipment" },
          ].map((entry) => (
            <Link key={entry.to} to={entry.to} className="menu-item nav-link" onClick={() => setCreateOpen(false)}>
              <Icon name={entry.icon} size={18} />
              <span>
                <b>{entry.label}</b>
                <small>{entry.sub}</small>
              </span>
            </Link>
          ))}
        </div>
      </Sheet>
      <Sheet open={userOpen} onClose={() => setUserOpen(false)} title="Signed in">
        <div className="stack">
          <div>
            <b>{me.data?.user?.name}</b>
            <div className="muted small">
              {me.data?.user?.title || me.data?.user?.role} · {me.data?.org?.name}
            </div>
          </div>
          <Button
            tone="ghost"
            onClick={async () => {
              await api.post("/auth/logout");
              window.location.href = siteUrl("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
