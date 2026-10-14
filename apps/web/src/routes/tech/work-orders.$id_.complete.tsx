import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../../app/api";
import { woNumber } from "../../app/format";
import { useAction, workOrderQuery } from "../../app/queries";
import { Button, Check, Field, Input, Loading, Notice, SignaturePad, Textarea } from "../../design/components";

export const Route = createFileRoute("/tech/work-orders/$id_/complete")({ component: CompleteJob });

/** Closeout: what was done, whether a return is needed, the customer's signature. Stops the clock and closes the job. */
function CompleteJob() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const query = useQuery(workOrderQuery(id));
  const [form, setForm] = useState({ workPerformed: "", signerName: "", needReturn: false, sendPhotoReport: true });
  const [signature, setSignature] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const closeout = useAction(() => api.post(`/work-orders/${id}/closeout`, { workPerformed: form.workPerformed, signerName: form.signerName || undefined, signatureDataUrl: signature ?? undefined, needReturn: form.needReturn, sendPhotoReport: form.sendPhotoReport }), { success: "Job completed", onSuccess: () => navigate({ to: "/tech", search: true }) });
  const d = query.data;
  if (!d) return <Loading label="Loading" />;
  const wo = d.workOrder;
  if (!seeded) { setForm((f) => ({ ...f, workPerformed: wo.workPerformed || wo.summary || "", signerName: d.site?.contact ?? "" })); setSeeded(true); }
  const required = d.checklistTemplates.filter((t) => t.requiredBeforeComplete && t.trigger.callTypes?.includes(wo.callType));
  const missing = required.filter((t) => { const r = d.checklists.find((c) => c.r.templateId === t.id); return !r || t.items.some((i) => !r.r.items.find((a) => a.key === i.key)); });
  const photos = d.files.filter((f) => f.kind === "photo").length;
  const needsSignature = wo.signatureRequired && !signature;
  return (
    <div className="ph-page">
      <Link to="/tech/work-orders/$id" params={{ id }} search={true} className="small nav-link muted">‹ Back to {woNumber(wo)}</Link>
      <h1>Complete {woNumber(wo)}</h1>
      <div className="small muted">{wo.customerName} · {d.site?.name}</div>
      {missing.length ? <Notice tone="red">Finish the {missing.map((m) => m.name).join(" and ")} checklist first. <Link to="/tech/work-orders/$id" params={{ id }} search={true} className="strong nav-link">Open the job</Link></Notice> : null}
      {photos === 0 ? <Notice>No photos on this job yet. A before and after photo makes the invoice easier to approve.</Notice> : null}
      <Field label="Work performed" help="The customer reads this on the invoice and the portal.">
        <Textarea value={form.workPerformed} onChange={(e) => setForm({ ...form, workPerformed: e.target.value })} rows={5} placeholder="Found failed run capacitor on RTU-2. Replaced 45/5 µF capacitor, checked amps and superheat, unit cooling normally." autoFocus />
      </Field>
      <Check on={form.needReturn} onChange={(v) => setForm({ ...form, needReturn: v })} label="Need to come back (parts, more time, another tech)" />
      <Check on={form.sendPhotoReport} onChange={(v) => setForm({ ...form, sendPhotoReport: v })} label="Text the customer a photo report when this closes" />
      {wo.signatureRequired ? (
        <div className="ph-section">
          <span className="eyebrow">Customer signature</span>
          <Input value={form.signerName} onChange={(e) => setForm({ ...form, signerName: e.target.value })} placeholder="Printed name" />
          <SignaturePad onChange={setSignature} />
        </div>
      ) : null}
      <div className="ph-bar">
        <Button tone="copper" size="lg" onClick={() => closeout.mutate()} disabled={!form.workPerformed.trim() || missing.length > 0 || needsSignature || closeout.isPending}>{needsSignature ? "Signature needed" : "Complete and stop the clock"}</Button>
      </div>
    </div>
  );
}
