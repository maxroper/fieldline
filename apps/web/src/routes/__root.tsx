import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { ToastHost } from "../design/components";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      <ToastHost />
    </>
  ),
  notFoundComponent: () => (
    <div className="page">
      <h1>Not found</h1>
      <p className="muted">That page does not exist.</p>
    </div>
  ),
});
