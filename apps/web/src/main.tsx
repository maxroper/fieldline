import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "./app/api";
import { resetDemoData } from "./app/demo-state";
import { isDemo } from "./app/transport";
import { Button, Loading } from "./design/components";
import "./design/fieldline.css";
import { routeTree } from "./routeTree.gen";

// The static demo runs the API inside the page. The condition is fixed at build time, so the normal
// build never includes the API or the embedded database.
if (isDemo) {
  const { installDemo } = await import("./app/demo");
  installDemo();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  scrollRestoration: true,
  basepath: import.meta.env.BASE_URL.replace(/\/$/, ""),
  defaultPendingMs: 300,
  defaultPendingMinMs: 200,
  defaultPendingComponent: () => <Loading label={isDemo ? "Starting the demo database. The first visit takes a few seconds." : "Loading"} />,
  defaultErrorComponent: ({ error }) => (
    <div className="page" style={{ maxWidth: 640 }}>
      <h1>Something went wrong</h1>
      <p className="muted">{error instanceof Error ? error.message : String(error)}</p>
      <div className="row gap-2">
        <Button onClick={() => location.reload()}>Reload</Button>
        {isDemo ? <Button tone="ghost" onClick={() => void resetDemoData()}>Reset the demo data</Button> : null}
      </div>
    </div>
  ),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
