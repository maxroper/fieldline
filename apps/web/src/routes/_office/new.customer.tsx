import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { api } from "../../app/api";
import { useAction, useSettings } from "../../app/queries";
import { BackBar, Button, Card, Field, Input, Select, Switch, Textarea } from "../../design/components";

const search = z.object({ q: z.string().optional(), then: z.enum(["work-order"]).optional() });

export const Route = createFileRoute("/_office/new/customer")({ validateSearch: search, component: NewCustomerPage });

/** Bill-to parent plus the first site, in one pass. Sites can be added later from the customer record. */
function NewCustomerPage() {
  const params = Route.useSearch();
  const navigate = useNavigate();
  const settings = useSettings();
  const looksLikePhone = /^[\d\s().+-]{7,}$/.test(params.q ?? "");
  const [customer, setCustomer] = useState({ name: looksLikePhone ? "" : (params.q ?? ""), phone: looksLikePhone ? (params.q ?? "") : "", email: "", billingAddress: "", apContactName: "", apContactPhone: "", contract: false, taxExempt: false, taxExemptNumber: "", invoiceDelivery: "" });
  const [site, setSite] = useState({ name: "", address: "", city: "", contact: "", contactPhone: "", accessNotes: "", primaryTechId: "" });
  const [sameAddress, setSameAddress] = useState(true);
  const create = useAction(
    () => api.post<{ id: string; siteId: string | null }>("/customers", { ...customer, invoiceDelivery: customer.invoiceDelivery || null, site: { ...site, address: sameAddress ? customer.billingAddress : site.address, contactPhone: site.contactPhone || customer.phone, primaryTechId: site.primaryTechId || null } }),
    {
      success: "Customer created",
      onSuccess: (r) => {
        if (params.then === "work-order") navigate({ to: "/new/work-order", search: { siteId: r.siteId ?? undefined, customerId: r.id } as never });
        else navigate({ to: "/customers/$id", params: { id: r.id } });
      },
    },
  );
  const techs = settings.data?.users.filter((u) => u.role === "tech" && u.active) ?? [];
  const ready = customer.name.trim() && (sameAddress ? customer.billingAddress.trim() : site.address.trim());
  return (
    <>
      <BackBar to="/customers" place="Customers" />
      <div className="page" style={{ maxWidth: 920 }}>
        <div className="page-head">
          <div>
            <h1 style={{ fontSize: 24 }}>New customer</h1>
            <div className="sub">Who gets the bill, and where the first site is.</div>
          </div>
        </div>
        <div className="two-col loose">
          <div className="stack loose">
            <Card title="Bill-to customer" flat>
              <div className="stack">
                <Field label="Customer name"><Input autoFocus value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Harbor Pointe Dental" /></Field>
                <div className="field-grid">
                  <Field label="Main phone"><Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /></Field>
                  <Field label="Email"><Input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} /></Field>
                </div>
                <Field label="Billing address"><Input value={customer.billingAddress} onChange={(e) => setCustomer({ ...customer, billingAddress: e.target.value })} placeholder="1400 Harbor Blvd, Suite 210, Costa Mesa" /></Field>
                <div className="field-grid">
                  <Field label="AP contact"><Input value={customer.apContactName} onChange={(e) => setCustomer({ ...customer, apContactName: e.target.value })} /></Field>
                  <Field label="AP phone"><Input value={customer.apContactPhone} onChange={(e) => setCustomer({ ...customer, apContactPhone: e.target.value })} /></Field>
                  <Field label="Invoice delivery"><Select value={customer.invoiceDelivery} onChange={(e) => setCustomer({ ...customer, invoiceDelivery: e.target.value })}><option value="">Ask each time</option><option value="email">Email</option><option value="print">Print and mail</option><option value="both">Email and print</option><option value="text">Text a link</option></Select></Field>
                  {customer.taxExempt ? <Field label="Tax exempt number"><Input value={customer.taxExemptNumber} onChange={(e) => setCustomer({ ...customer, taxExemptNumber: e.target.value })} /></Field> : null}
                </div>
                <div className="row wrap gap-3">
                  <Switch on={customer.contract} onChange={(v) => setCustomer({ ...customer, contract: v })} label="Contract customer" />
                  <Switch on={customer.taxExempt} onChange={(v) => setCustomer({ ...customer, taxExempt: v })} label="Tax exempt" />
                </div>
              </div>
            </Card>
            <Card title="First site" flat>
              <div className="stack">
                <Switch on={sameAddress} onChange={setSameAddress} label="Service address is the billing address" />
                {!sameAddress ? <Field label="Service address"><Input value={site.address} onChange={(e) => setSite({ ...site, address: e.target.value })} /></Field> : null}
                <div className="field-grid">
                  <Field label="Site name" help="Leave blank to use the address."><Input value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} /></Field>
                  <Field label="City"><Input value={site.city} onChange={(e) => setSite({ ...site, city: e.target.value })} /></Field>
                  <Field label="On-site contact"><Input value={site.contact} onChange={(e) => setSite({ ...site, contact: e.target.value })} /></Field>
                  <Field label="Contact mobile" help="Defaults to the main phone."><Input value={site.contactPhone} onChange={(e) => setSite({ ...site, contactPhone: e.target.value })} /></Field>
                  <Field label="Primary tech"><Select value={site.primaryTechId} onChange={(e) => setSite({ ...site, primaryTechId: e.target.value })}><option value="">Decide later</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
                </div>
                <Field label="Access notes"><Textarea value={site.accessNotes} onChange={(e) => setSite({ ...site, accessNotes: e.target.value })} rows={2} placeholder="Roof hatch in the back hallway. Check in at the front desk." /></Field>
              </div>
            </Card>
            <div className="row gap-2">
              <Button tone="primary" size="lg" onClick={() => create.mutate()} disabled={!ready || create.isPending}>{params.then === "work-order" ? "Create and start the work order" : "Create customer"}</Button>
            </div>
          </div>
          <div className="stack tight small muted">
            <span className="eyebrow">What happens next</span>
            <p>The customer gets a portal link and the site gets a service history. Equipment can be added on the site page or by the tech photographing nameplates on the first visit.</p>
            <p>Contract customers bill at the contract labor rates and material margins in Settings. Everyone else uses the standard tables.</p>
          </div>
        </div>
      </div>
    </>
  );
}
