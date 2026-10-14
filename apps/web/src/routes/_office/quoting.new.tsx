import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BackBar } from "../../design/components";
import { QuoteEditor } from "../../features/quoting/QuoteEditor";

const search = z.object({ siteId: z.string().optional(), customerId: z.string().optional(), workOrderId: z.string().optional(), equipmentId: z.string().optional() });

export const Route = createFileRoute("/_office/quoting/new")({ validateSearch: search, component: NewQuotePage });

function NewQuotePage() {
  const params = Route.useSearch();
  return (
    <>
      <BackBar to="/quoting" place="Quoting" />
      <div className="page">
        <div className="page-head">
          <div>
            <h1 style={{ fontSize: 24 }}>New quote</h1>
            <div className="sub">Scope it, price it at margin, and give the customer options.</div>
          </div>
        </div>
        <QuoteEditor prefill={params} />
      </div>
    </>
  );
}
