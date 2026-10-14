import { ROLES } from "@fieldline/shared";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "../../app/api";
import { relativeLabel, statusLabel } from "../../app/format";
import { useAction, useSettings } from "../../app/queries";
import type { UserRow } from "../../app/types";
import { Avatar, Button, Check, Chip, Field, Input, Loading, Pill, Select, Sheet, SummaryLine, Switch } from "../../design/components";

export const Route = createFileRoute("/_office/users")({ component: UsersPage });

const blank = { name: "", email: "", role: "tech", title: "", phone: "", teamId: "", homeTeamId: "", canEditCustomers: false, canBill: false, active: true, shiftHours: "8" };

function UsersPage() {
  const settings = useSettings();
  const me = Route.useRouteContext().me;
  const [filter, setFilter] = useState<"all" | "office" | "tech" | "inactive">("all");
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [form, setForm] = useState(blank);
  useEffect(() => {
    if (editing === "new") setForm(blank);
    else if (editing) setForm({ name: editing.name, email: editing.email ?? "", role: editing.role, title: editing.title, phone: editing.phone, teamId: editing.teamId ?? "", homeTeamId: editing.homeTeamId ?? "", canEditCustomers: Boolean(editing.canEditCustomers), canBill: Boolean(editing.canBill), active: editing.active, shiftHours: String(editing.shiftHours ?? 8) });
  }, [editing]);
  const body = () => ({ name: form.name, email: form.email || undefined, role: form.role, title: form.title, phone: form.phone, teamId: form.teamId || null, homeTeamId: form.homeTeamId || null, canEditCustomers: form.canEditCustomers, canBill: form.canBill });
  const save = useAction(() => (editing === "new" ? api.post("/settings/users", body()) : api.patch(`/settings/users/${(editing as UserRow).id}`, { ...body(), active: form.active, shiftHours: Number(form.shiftHours || 8) })), { success: "User saved", onSuccess: () => setEditing(null) });
  const data = settings.data;
  if (!data) return <Loading label="Loading people" />;
  const users = data.users.filter((u) => (filter === "office" ? u.role !== "tech" && u.active : filter === "tech" ? u.role === "tech" && u.active : filter === "inactive" ? !u.active : u.active));
  const team = (id: string | null) => data.teams.find((t) => t.id === id)?.name ?? "";
  const isAdmin = me.session?.role === "admin" || me.session?.role === "supervisor";
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {([["all", "Active"], ["office", "Office"], ["tech", "Technicians"], ["inactive", "Inactive"]] as const).map(([v, label]) => <Chip key={v} on={filter === v} onClick={() => setFilter(v)}>{label}</Chip>)}
        </div>
        <span className="grow" />
        <SummaryLine items={[{ value: data.users.filter((u) => u.active && u.role === "tech").length, label: "techs" }, { value: data.users.filter((u) => u.active && u.role !== "tech").length, label: "office" }, { value: data.teams.length, label: "teams" }]} />
        {isAdmin ? <Button size="sm" tone="copper" icon="plus" onClick={() => setEditing("new")}>Person</Button> : null}
      </div>
      <div className="page">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Team</th><th>Phone</th><th>Permissions</th><th className="num">Shift</th><th>Last active</th></tr></thead>
            <tbody className="stagger">
              {users.map((u) => (
                <tr key={u.id} className={isAdmin ? "clickable" : ""} onClick={() => isAdmin && setEditing(u)}>
                  <td className="primary-cell"><span className="row gap-2"><Avatar name={u.name} size="sm" tone={u.role === "tech" ? "moss" : u.role === "admin" ? "ink" : undefined} /><span><div>{u.name}</div><div className="small muted">{u.title}{u.email ? ` · ${u.email}` : ""}</div></span></span></td>
                  <td><Pill tone={u.role === "tech" ? "site" : u.role === "admin" ? "copper" : "open"} plain>{statusLabel(u.role)}</Pill>{!u.active ? <Pill tone="hold" plain className="ml-1">Inactive</Pill> : null}</td>
                  <td>{team(u.teamId)}{u.homeTeamId && u.homeTeamId !== u.teamId ? <span className="small muted"> · home {team(u.homeTeamId)}</span> : null}</td>
                  <td className="num">{u.phone}</td>
                  <td className="small muted">{[u.canBill ? "bill" : null, u.canEditCustomers ? "edit customers" : null].filter(Boolean).join(" · ") || (u.role === "admin" ? "everything" : "")}</td>
                  <td className="num">{u.role === "tech" ? `${u.shiftHours} h` : ""}</td>
                  <td className="small muted">{u.lastActiveAt ? relativeLabel(u.lastActiveAt) : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a person" : `Edit ${(editing as UserRow | null)?.name ?? ""}`} footer={<><Button tone="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button tone="primary" onClick={() => save.mutate()} disabled={!form.name}>Save</Button></>}>
        <div className="field-grid">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Role"><Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{statusLabel(r)}</option>)}</Select></Field>
          <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Lead technician, EPA 608" /></Field>
          <Field label="Mobile"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="Email" help="Used for sign-in once an identity provider is connected."><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Team"><Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}><option value="">None</option>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          <Field label="Home team" help="Where they return after a loan."><Select value={form.homeTeamId} onChange={(e) => setForm({ ...form, homeTeamId: e.target.value })}><option value="">Same as team</option>{data.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
          {form.role === "tech" ? <Field label="Shift hours"><Input type="number" step="0.5" value={form.shiftHours} onChange={(e) => setForm({ ...form, shiftHours: e.target.value })} /></Field> : null}
        </div>
        <div className="row wrap gap-3">
          <Check on={form.canBill} onChange={(v) => setForm({ ...form, canBill: v })} label="Can mark jobs billed and issue credits" />
          <Check on={form.canEditCustomers} onChange={(v) => setForm({ ...form, canEditCustomers: v })} label="Can edit customers and sites" />
        </div>
        {editing !== "new" ? <Switch on={form.active} onChange={(v) => setForm({ ...form, active: v })} label="Active" /> : null}
      </Sheet>
    </>
  );
}
