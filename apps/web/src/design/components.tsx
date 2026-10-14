import { Link, type LinkProps } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { useUi } from "../app/store";
import { Icon, type IconName } from "./icons";

/**
 * The design system as React. Every component maps to a class in design/fieldline.css,
 * so a designer can change the look without touching components.
 */

type Tone = "primary" | "copper" | "ghost" | "subtle" | "danger" | "moss" | "steel" | "default";
type Size = "sm" | "md" | "lg" | "xl";

export function Button({ tone = "default", size = "md", icon, block, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: Size; icon?: IconName; block?: boolean }) {
  const classes = ["btn", tone === "default" ? "" : tone, size === "md" ? "" : size, block ? "block" : "", !children && icon ? "icon" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}

export function LinkButton({ tone = "default", size = "md", icon, className = "", children, ...rest }: LinkProps & { tone?: Tone; size?: Size; icon?: IconName; className?: string; children?: ReactNode }) {
  const classes = ["btn", "nav-link", tone === "default" ? "" : tone, size === "md" ? "" : size, className].filter(Boolean).join(" ");
  return (
    <Link className={classes} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </Link>
  );
}

export function Pill({ tone = "open", plain, size, children, className = "" }: { tone?: string; plain?: boolean; size?: "lg"; children: ReactNode; className?: string }) {
  return <span className={["pill", tone, plain ? "plain" : "", size ?? "", className].filter(Boolean).join(" ")}>{children}</span>;
}

export function Chip({ on, count, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean; count?: number | string }) {
  return (
    <button type="button" className={`chip${on ? " on" : ""}`} {...rest}>
      {children}
      {count != null ? <span className="count">{count}</span> : null}
    </button>
  );
}

export function Seg<T extends string>({ value, options, onChange, light, lg }: { value: T; options: { value: T; label: ReactNode; count?: number }[]; onChange: (value: T) => void; light?: boolean; lg?: boolean }) {
  return (
    <div className={["seg", light ? "light" : "", lg ? "lg" : ""].filter(Boolean).join(" ")} role="tablist">
      {options.map((opt) => (
        <button key={opt.value} type="button" role="tab" aria-selected={opt.value === value} className={opt.value === value ? "on" : ""} onClick={() => onChange(opt.value)}>
          {opt.label}
          {opt.count != null ? <span className="count">{opt.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ label, value, unit, delta, deltaTone, children }: { label: string; value: ReactNode; unit?: string; delta?: ReactNode; deltaTone?: "up" | "down"; children?: ReactNode }) {
  return (
    <div className="kpi">
      <span className="eyebrow">{label}</span>
      <div className="value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {delta ? <div className={`delta ${deltaTone ?? ""}`}>{delta}</div> : null}
      {children}
    </div>
  );
}

export function Card({ title, actions, flat, inset, pad0, className = "", children }: { title?: ReactNode; actions?: ReactNode; flat?: boolean; inset?: boolean; pad0?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={["card", flat ? "flat" : "", inset ? "inset" : "", pad0 ? "pad-0" : "", className].filter(Boolean).join(" ")}>
      {title || actions ? (
        <div className="card-head">
          {typeof title === "string" ? <h3>{title}</h3> : title}
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Field({ label, help, children, prefilled, htmlFor }: { label: string; help?: ReactNode; children: ReactNode; prefilled?: boolean; htmlFor?: string }) {
  return (
    <div className={`field${prefilled ? " prefilled" : ""}`}>
      <label htmlFor={htmlFor}>
        {label}
        {prefilled ? <span className="prefilled-tag">prefilled</span> : null}
      </label>
      {children}
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label?: ReactNode }) {
  return (
    <label className={`switch${on ? " on" : ""}`}>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <i />
      {label ? <span>{label}</span> : null}
    </label>
  );
}

export function Check({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: ReactNode }) {
  return (
    <label className={`check${on ? " on" : ""}`}>
      <input type="checkbox" className="sr-only" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <i />
      <span>{label}</span>
    </label>
  );
}

export function Avatar({ name, tone, size }: { name: string; tone?: string; size?: "sm" | "lg" }) {
  const letters = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return <span className={["avatar", tone ?? "", size ?? ""].filter(Boolean).join(" ")}>{letters}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export function Notice({ tone, children }: { tone?: "red" | "moss" | "steel" | "plain"; children: ReactNode }) {
  return <div className={`notice ${tone ?? ""}`}>{children}</div>;
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; count?: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} className={t.value === value ? "on" : ""} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count != null ? <span className="count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Facts({ rows, tight }: { rows: [ReactNode, ReactNode][]; tight?: boolean }) {
  return (
    <dl className={`facts${tight ? " tight" : ""}`}>
      {rows.map(([k, v], i) => (
        <div key={i} style={{ display: "contents" }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatusTrack({ steps, current }: { steps: { key: string; label: string; at?: string }[]; current: string | null }) {
  const index = steps.findIndex((s) => s.key === current);
  return (
    <div className="status-track">
      {steps.map((step, i) => (
        <div key={step.key} className={`st${i < index ? " done" : ""}${i === index ? " now" : ""}`} data-st={step.key}>
          {step.label}
          {step.at ? (
            <>
              <br />
              <span className="num">{step.at}</span>
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** Right-side drawer (or bottom sheet on the phone). Closes on Escape and scrim click. */
export function Sheet({ open, onClose, title, bottom, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; bottom?: boolean; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className={`scrim${open ? " on" : ""}`} onClick={onClose} />
      <div className={["sheet", bottom ? "bottom" : "", open ? "open" : ""].filter(Boolean).join(" ")} role="dialog" aria-modal="true" style={wide ? { width: "min(760px, 100%)" } : undefined}>
        <div className="sheet-head">
          <div className="row gap-2">{typeof title === "string" ? <h2>{title}</h2> : title}</div>
          <Button icon="x" size="sm" tone="ghost" aria-label="Close" onClick={onClose} />
        </div>
        <div className="sheet-body stack loose">{open ? children : null}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}

export function ToastHost() {
  const toasts = useUi((s) => s.toasts);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === "error" ? " error" : ""}`}>
          {t.tone === "ok" ? <span className="ok">✓</span> : null}
          <span>{t.text}</span>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export function BackBar({ to, place, editing, dirty, onSave, onSaveAndBack, saveDisabled, params }: { to: string; place: string; editing?: boolean; dirty?: boolean; onSave?: () => void; onSaveAndBack?: () => void; saveDisabled?: boolean; params?: Record<string, string> }) {
  return (
    <div className="back-bar">
      <Link to={to} params={params as never} className="btn ghost sm nav-link back" onClick={(e) => dirty && !window.confirm("Discard your changes?") && e.preventDefault()}>
        Back to {place}
      </Link>
      {editing ? (
        <div className="back-bar-save row">
          <Button size="sm" tone="ghost" disabled={saveDisabled} onClick={onSave}>
            Save
          </Button>
          <Button size="sm" tone="primary" disabled={saveDisabled} onClick={onSaveAndBack}>
            Save and back
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function Meter({ value, tone, lg }: { value: number; tone?: "moss" | "steel" | "amber" | "red"; lg?: boolean }) {
  return (
    <span className={["meter", tone ?? "", lg ? "lg" : ""].filter(Boolean).join(" ")}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  );
}

export function SummaryLine({ items }: { items: { dot?: string; value: ReactNode; label: string }[] }) {
  return (
    <div className="summary-line">
      {items.map((item, i) => (
        <span key={i}>
          {item.dot ? <span className={`dot ${item.dot}`} /> : null}
          <b>{item.value}</b> {item.label}
        </span>
      ))}
    </div>
  );
}

/** A canvas you can sign on with a finger or mouse; returns a PNG data URL. */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [empty, setEmpty] = useState(true);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * scale;
    canvas.height = canvas.clientHeight * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1b1712";
    }
  }, []);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  return (
    <div className="stack tight">
      <canvas
        ref={ref}
        className="signature-pad"
        onPointerDown={(e) => {
          const ctx = ref.current?.getContext("2d");
          if (!ctx) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          const p = point(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          setDrawing(true);
        }}
        onPointerMove={(e) => {
          if (!drawing) return;
          const ctx = ref.current?.getContext("2d");
          if (!ctx) return;
          const p = point(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          if (empty) setEmpty(false);
        }}
        onPointerUp={() => {
          setDrawing(false);
          onChange(empty ? null : (ref.current?.toDataURL("image/png") ?? null));
        }}
      />
      <div className="row between small muted">
        <span>{empty ? "Sign above" : "Signed"}</span>
        <Button
          size="sm"
          tone="subtle"
          onClick={() => {
            const canvas = ref.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            setEmpty(true);
            onChange(null);
          }}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="app-loading">
      <div className="stack center">
        <div className="skeleton" style={{ width: 160, height: 12 }} />
        <span className="small muted">{label}</span>
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return <Notice tone="red">{message}</Notice>;
}
