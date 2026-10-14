import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { api, qs } from "../../app/api";
import { dayLabel, money } from "../../app/format";
import type { CustomerRow } from "../../app/types";
import { Chip, Empty, LinkButton, Loading, Pill, SummaryLine } from "../../design/components";

type CustomerListRow = CustomerRow & { siteCount: number; agreements: number; lastVisit: string | null; balance: { billed: number; paid: number; credited: number; open: number; oldestDue: string | null } };

const search = z.object({ q: z.string().optional(), view: z.enum(["all", "contract", "balance", "agreements"]).default("all") });

export const Route = createFileRoute("/_office/customers/")({ validateSearch: search, component: CustomersPage });

function CustomersPage() {
  const params = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const query = useQuery({ queryKey: ["customers", params.q ?? ""], queryFn: () => api.get<{ customers: CustomerListRow[] }>(`/customers${qs({ q: params.q })}`) });
  const setSearch = (patch: Partial<z.infer<typeof search>>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });
  const today = new Date().toISOString().slice(0, 10);
  const all = query.data?.customers ?? [];
  const rows = all.filter((c) => (params.view === "contract" ? c.contract : params.view === "balance" ? c.balance.open > 0 : params.view === "agreements" ? c.agreements > 0 : true));
  return (
    <>
      <div className="toolbar">
        <div className="chips">
          {([["all", "All"], ["contract", "Contract"], ["balance", "With a balance"], ["agreements", "With agreements"]] as const).map(([v, label]) => (
            <Chip key={v} on={params.view === v} onClick={() => setSearch({ view: v })}>{label}</Chip>
          ))}
        </div>
        <div className="search" style={{ flex: "1 1 220px", maxWidth: 360 }}>
          <input className="input" type="search" placeholder="Name, phone, or address" defaultValue={params.q ?? ""} onKeyDown={(e) => e.key === "Enter" && setSearch({ q: (e.target as HTMLInputElement).value || undefined })} />
        </div>
        <span className="grow" />
        <LinkButton to="/new/customer" tone="copper" size="sm" icon="plus">New customer</LinkButton>
      </div>
      <div className="page">
        {query.isLoading ? <Loading label="Loading customers" /> : null}
        {query.data ? (
          <div className="stack loose">
            <SummaryLine items={[{ value: rows.length, label: "customers" }, { dot: "steel", value: rows.filter((c) => c.contract).length, label: "contract" }, { dot: "red", value: rows.filter((c) => c.balance.open > 0 && c.balance.oldestDue && c.balance.oldestDue < today).length, label: "past due" }, { value: money(rows.reduce((sum, c) => sum + c.balance.open, 0)), label: "open balance" }]} />
            {rows.length === 0 ? <Empty title="No customers match">Change the view or clear the search.</Empty> : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr><th>Customer</th><th>Phone</th><th className="num">Sites</th><th className="num">Agreements</th><th>Last visit</th><th className="num">Open balance</th><th>Pricing</th></tr>
                  </thead>
                  <tbody className="stagger">
                    {rows.map((c) => (
                      <tr key={c.id} className="clickable" onClick={() => navigate({ to: "/customers/$id", params: { id: c.id } })}>
                        <td className="primary-cell">
                          <div>{c.name}</div>
                          <div className="small muted">{c.billingAddress}</div>
                        </td>
                        <td className="num">{c.phone}</td>
                        <td className="num">{c.siteCount}</td>
                        <td className="num">{c.agreements || ""}</td>
                        <td className="num">{c.lastVisit ? dayLabel(c.lastVisit) : <span className="muted">—</span>}</td>
                        <td className="num" style={{ color: c.balance.open > 0 && c.balance.oldestDue && c.balance.oldestDue < today ? "var(--red)" : undefined }}>{c.balance.open > 0 ? money(c.balance.open) : ""}</td>
                        <td>{c.contract ? <Pill tone="sched" plain>Contract</Pill> : <span className="small muted">Standard</span>}{c.taxExempt ? <Pill tone="open" plain className="ml-1">Tax exempt</Pill> : null}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
