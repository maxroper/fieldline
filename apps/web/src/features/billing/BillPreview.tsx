import type { WorkOrderBill } from "@fieldline/shared";
import { money } from "../../app/format";
import { Notice } from "../../design/components";

/** The live bill for a job, laid out the way the invoice will read. Pure presentation of workOrderBill(). */
export function BillPreview({ bill }: { bill: WorkOrderBill }) {
  const billed = bill.labor.filter((l) => !l.running);
  return (
    <div className="stack">
      {bill.clockRunning ? <Notice>A clock is still running on this job. The bill updates when it stops.</Notice> : null}
      {bill.rateMissing ? <Notice tone="red">A labor bill rate is missing. Set it in Settings before billing.</Notice> : null}
      {bill.overNte != null ? <Notice tone="red">Over the not-to-exceed amount by {money(bill.overNte)}. Cap the bill or ask the customer to approve.</Notice> : null}
      <div className="table-wrap">
        <table className="table dense">
          <thead>
            <tr>
              <th>Line</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bill.quotedFlat || bill.fixedPrice ? (
              <tr>
                <td>{bill.fixedPrice ? "Maintenance visit, agreement price" : "Quoted work, as approved"}</td>
                <td className="num">1</td>
                <td className="num" />
                <td className="num">{money(bill.amount ?? 0)}</td>
              </tr>
            ) : (
              <>
                {billed.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.kind} · {l.who} · {l.date} · visit {l.visit}
                    </td>
                    <td className="num">{l.hours} h</td>
                    <td className="num">{l.rate != null ? money(l.rate) : "rate missing"}</td>
                    <td className="num">{l.total != null ? money(l.total) : ""}</td>
                  </tr>
                ))}
                {bill.materials.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.description} <span className="muted small">· {m.source}</span>
                    </td>
                    <td className="num">{m.quantity}</td>
                    <td className="num">{m.sell != null && m.quantity > 0 ? money(m.sell / m.quantity) : ""}</td>
                    <td className="num">{m.sell != null ? money(m.sell) : ""}</td>
                  </tr>
                ))}
                {(bill.miscAmount ?? 0) > 0 ? (
                  <tr>
                    <td>Misc material, {bill.miscPercent}% of labor and material</td>
                    <td className="num" />
                    <td className="num" />
                    <td className="num">{money(bill.miscAmount ?? 0)}</td>
                  </tr>
                ) : null}
                {bill.vehicleAmount > 0 ? (
                  <tr>
                    <td>Vehicle charge</td>
                    <td className="num" />
                    <td className="num" />
                    <td className="num">{money(bill.vehicleAmount)}</td>
                  </tr>
                ) : null}
                {(bill.salesTax ?? 0) > 0 ? (
                  <tr>
                    <td>Sales tax {bill.taxRate}%</td>
                    <td className="num" />
                    <td className="num" />
                    <td className="num">{money(bill.salesTax ?? 0)}</td>
                  </tr>
                ) : null}
              </>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="strong">Amount to bill</td>
              <td />
              <td />
              <td className="num strong">{bill.amount != null ? money(bill.amount) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {bill.quoted ? (
        <div className="small muted">
          Job cost {money(bill.quoted.actualCost ?? 0)} ({bill.quoted.laborHours + bill.quoted.travelHours} h labor at cost, materials {money(bill.quoted.materialCost)}, use tax {money(bill.quoted.useTax)}) · margin {bill.quoted.actualMargin != null ? money(bill.quoted.actualMargin) : "—"}
        </div>
      ) : null}
      {bill.fixedPrice ? <div className="small muted">Job cost {bill.jobCost != null ? money(bill.jobCost) : "—"} against the agreement price.</div> : null}
    </div>
  );
}
