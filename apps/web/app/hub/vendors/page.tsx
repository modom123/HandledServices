/*
 * FILE    : apps/web/app/hub/vendors/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : Handled Hub → Approved vendors: where pros may buy job materials. The Handled materials card only works at these
 *           stores (matched on the card statement name) for the trades each one serves; receipts from any other store go to
 *           staff. Built-in national chains can be turned off; local suppliers can be added. Also: materials card status
 *           and the latest swipes, approved and declined, with the reason.
 */
import { GROUP_CATEGORIES, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { vendorList } from "@/lib/materials";
import { issuingReady } from "@/lib/issuing";
import { VendorEditor } from "@/components/VendorEditor";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const v = await getViewer();
  if (!v) return null;
  const [vendors, { data: events }, { count: cards }] = await Promise.all([
    vendorList(),
    v.db.from("materials_card_events").select("amount, merchant_name, approved, reason, created_at, contractor_id, job_id").order("created_at", { ascending: false }).limit(30),
    v.db.from("contractors").select("id", { count: "exact", head: true }).not("materials_card_id", "is", null),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approved vendors</h1>
        <p className="text-sm text-ink-soft">Where pros buy job materials. The Handled materials card is declined anywhere else, and only works at a vendor for the trades it serves; a receipt from another store always goes to staff for approval.</p>
      </div>
      <div className="card text-sm">
        <b>Materials cards:</b> {issuingReady() ? `on — ${cards ?? 0} pros have a card.` : "off. Turn on when Stripe Issuing is approved: set MATERIALS_CARDS=on in Vercel and add the issuing_authorization.request, issuing_authorization.updated and issuing_transaction.created events to the Stripe webhook."}
      </div>
      <VendorEditor canEdit={v.role === "admin"} groups={Object.keys(GROUP_CATEGORIES)} vendors={vendors.map((x) => ({ id: x.id, name: x.name, match: x.match, groups: x.groups, online: Boolean(x.online), active: x.active !== false }))} />
      <div className="card overflow-x-auto p-0">
        <div className="p-3 font-semibold">Latest card swipes</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-ink-soft"><th className="p-3">When</th><th className="p-3">Store</th><th className="p-3">Amount</th><th className="p-3">Result</th></tr></thead>
          <tbody>
            {(events ?? []).map((e, i) => (
              <tr key={i} className="border-t border-line"><td className="p-3">{new Date(e.created_at).toLocaleString("en-US")}</td><td className="p-3">{e.merchant_name ?? "—"}</td><td className="p-3">{money(e.amount)}</td><td className="p-3">{e.approved ? "✓ approved" : `✗ ${e.reason ?? "declined"}`}{e.job_id ? <> · <a className="text-brand underline" href={`/hub/jobs/${e.job_id}`}>job</a></> : null}</td></tr>
            ))}
            {!(events ?? []).length && <tr><td className="p-3 text-ink-soft" colSpan={4}>No card swipes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
