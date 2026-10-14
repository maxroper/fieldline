import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { meQuery } from "../app/session";
import { PhoneShell } from "../app/shell/PhoneShell";

/**
 * Layout for the tech phone app at /tech/*. Office roles may open it to preview a tech's day by
 * passing `?as=<techId>`; every child reads that through `useTechWho()`.
 */
export const Route = createFileRoute("/tech")({
  validateSearch: z.object({ as: z.string().optional() }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.session) throw redirect({ to: "/login" });
    return { me };
  },
  component: PhoneShell,
});
