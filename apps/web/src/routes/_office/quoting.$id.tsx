import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "../../app/api";
import { money } from "../../app/format";
import { BackBar, ErrorBox, Loading } from "../../design/components";
import { QuoteEditor, type QuoteDetail } from "../../features/quoting/QuoteEditor";

export const Route = createFileRoute("/_office/quoting/$id")({ component: QuotePage });

function QuotePage() {
  const { id } = Route.useParams();
  const query = useQuery({ queryKey: ["quote", id], queryFn: () => api.get<QuoteDetail>(`/quotes/${id}`) });
  if (query.isLoading) return <Loading label="Loading the quote" />;
  if (query.error || !query.data) return <div className="page"><ErrorBox error={query.error ?? "Not found"} /></div>;
  const d = query.data;
  return (
    <>
      <BackBar to="/quoting" place="Quoting" />
      <div className="page">
        <div className="page-head">
          <div>
            <h1 style={{ fontSize: 24 }}>Quote {d.quote.number}{d.quote.scope ? ` · ${d.quote.scope.split("\n")[0]?.slice(0, 60)}` : ""}</h1>
            <div className="sub">{d.customer?.name}{d.site ? ` · ${d.site.name || d.site.address}` : ""}{d.equipment ? ` · ${d.equipment.tag}` : ""}{d.price != null ? ` · ${money(d.price)}` : ""}</div>
          </div>
        </div>
        <QuoteEditor detail={d} />
      </div>
    </>
  );
}
