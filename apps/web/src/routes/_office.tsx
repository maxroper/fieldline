import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQuery } from "../app/session";
import { OfficeShell } from "../app/shell/OfficeShell";

/** Pathless layout for every office page: requires an office session and wraps the sidebar shell. */
export const Route = createFileRoute("/_office")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.session) throw redirect({ to: "/login" });
    if (me.session.role === "tech") throw redirect({ to: "/tech" });
    return { me };
  },
  component: OfficeShell,
});
