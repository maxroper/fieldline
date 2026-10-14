import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQuery } from "../app/session";

/** The front door: send each person to their face of the app. */
export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me.session) throw redirect({ to: "/login" });
    if (me.session.role === "tech") throw redirect({ to: "/tech" });
    throw redirect({ to: "/dispatch" });
  },
});
