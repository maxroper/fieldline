import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "../app/api";
import { meQuery } from "../app/session";
import { toast } from "../app/store";
import { Avatar, Loading } from "../design/components";

interface DevUser {
  id: string;
  name: string;
  role: string;
  title: string;
  orgId: string;
  orgName: string;
}

/**
 * Development sign-in: pick a person. A real identity provider replaces this page; see docs/ARCHITECTURE.md "Auth".
 */
export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const users = useQuery({ queryKey: ["dev-users"], queryFn: () => api.get<{ users: DevUser[] }>("/auth/users") });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  if (users.isLoading) return <Loading label="Loading people" />;
  const byOrg = new Map<string, DevUser[]>();
  for (const u of users.data?.users ?? []) byOrg.set(u.orgName, [...(byOrg.get(u.orgName) ?? []), u]);
  return (
    <div className="login">
      <div>
        <div className="brand">
          <b style={{ fontSize: 28 }}>Fieldline</b>
          <span>Sign in</span>
        </div>
        <p className="muted">Development sign-in. Pick who you are; techs land on the phone app, everyone else on the dispatch board.</p>
      </div>
      {[...byOrg.entries()].map(([org, list]) => (
        <div key={org} className="stack tight">
          <span className="eyebrow">{org}</span>
          <div className="menu-list">
            {list.map((u) => (
              <button
                key={u.id}
                type="button"
                className="menu-item"
                onClick={async () => {
                  try {
                    await api.post("/auth/dev-login", { userId: u.id });
                    // The layouts read the session with ensureQueryData, which trusts cached data, so drop
                    // the cached "no session" answer and fetch the new one before moving on.
                    queryClient.removeQueries({ queryKey: ["me"] });
                    await queryClient.fetchQuery(meQuery);
                    await navigate({ to: u.role === "tech" ? "/tech" : "/dispatch" });
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Sign-in failed", "error");
                  }
                }}
              >
                <Avatar name={u.name} size="sm" tone={u.role === "tech" ? "moss" : u.role === "admin" ? "ink" : undefined} />
                <span>
                  <b>{u.name}</b>
                  <small>
                    {u.title || u.role.replace("_", " ")} · {u.role === "tech" ? "tech phone" : "office"}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
