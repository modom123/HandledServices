/*
 * FILE    : apps/web/app/hub/partners/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0145 UTC
 * PURPOSE : Handled Hub → Partners (Referral Partner Program): every partner with their customers and earnings,
 *           pause / reactivate, credit a customer by hand, and the commission queue (void before payout).
 *           Payouts run on Mondays with the pro payouts (cron sweep).
 * UPDATED : 2026-10-22_0400 UTC — Referral tickets: every ticket with the AI's filing (service, summary, what's missing), its
 *           referrer, customer and job; approve & send the customer's link, re-send, cancel. Commission rate per row.
 * UPDATED : 2026-10-22_0500 UTC — ticket photos (thumbnails, signed links valid an hour).
 */
import { COMMISSION_BASIS, PARTNER_KINDS, PARTNER_PROGRAM, SERVICES, getService, money, pctLabel, type CommissionBasis, type PartnerKind } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/photos";
import { Badge, Empty, Stat } from "@/components/ui";
import { PartnerAssign, PartnerStatusButton, TicketActions, VoidCommission } from "@/components/PartnerUI";

export const dynamic = "force-dynamic";

type P = { id: string; code: string; name: string; email: string; phone: string | null; company: string | null; kind: PartnerKind; status: "active" | "suspended"; stripe_account_id: string | null; created_at: string };
type T = { photos?: string[]; id: string; partner_id: string; customer_name: string; customer_email: string; customer_id: string | null; zip: string | null; service_slug: string | null; frequency: string; status: string; ai_summary: string | null; missing_info: string[]; ai_confidence: string | null; description: string; preferred_contractor_id: string | null; created_at: string; jobs: { ref: string; status: string } | null };
type C = { basis?: CommissionBasis; pct?: number | null; id: string; partner_id: string; amount: number; take: number; status: string; eligible_at: string; paid_at: string | null; note: string | null; jobs: { ref: string; service_slug: string } | null };

export default async function PartnersHub() {
  const db = adminClient();
  const { data: partners, error } = await db.from("referral_partners").select("*").order("created_at", { ascending: false });
  if (error) return (
    <div className="card max-w-2xl"><h1 className="text-xl font-bold">The Partner Program isn&apos;t switched on yet</h1>
      <p className="mt-2 text-sm text-ink-soft">Run <code>supabase/setup/ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql</code> once in Supabase → SQL Editor, then reload.</p></div>
  );
  const [{ data: custs }, { data: comms }, { data: tix, error: tixErr }] = await Promise.all([
    db.from("referral_customers").select("partner_id, first_job_id"),
    db.from("partner_commissions").select("*, jobs(ref, service_slug)").order("created_at", { ascending: false }).limit(1000),
    db.from("referral_tickets").select("id, photos, partner_id, customer_name, customer_email, customer_id, zip, service_slug, frequency, status, ai_summary, missing_info, ai_confidence, description, preferred_contractor_id, created_at, jobs!referral_tickets_job_id_fkey(ref, status)").order("created_at", { ascending: false }).limit(300),
  ]);
  const TX = (tix ?? []) as unknown as T[];
  // thumbnails for the open queue only (signing hundreds of booked tickets' photos would slow the page)
  const thumbs = new Map<string, string[]>(await Promise.all(TX.filter((t) => t.photos?.length && ["open", "needs_review"].includes(t.status)).map(async (t) => [t.id, await signedUrls(t.photos!)] as [string, string[]])));
  const services = SERVICES.map((s) => [s.slug, s.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  const C = (comms ?? []) as unknown as C[];
  const per = new Map<string, { customers: number; booked: number; paid: number; owed: number }>();
  for (const c of (custs ?? []) as { partner_id: string; first_job_id: string | null }[]) {
    const x = per.get(c.partner_id) ?? { customers: 0, booked: 0, paid: 0, owed: 0 };
    x.customers++; if (c.first_job_id) x.booked++; per.set(c.partner_id, x);
  }
  for (const c of C) {
    const x = per.get(c.partner_id) ?? { customers: 0, booked: 0, paid: 0, owed: 0 };
    if (c.status === "paid") x.paid += Number(c.amount); if (c.status === "pending") x.owed += Number(c.amount); per.set(c.partner_id, x);
  }
  const PS = (partners ?? []) as P[];
  const name = new Map(PS.map((p) => [p.id, p.name]));
  const tot = [...per.values()].reduce((t, x) => ({ customers: t.customers + x.customers, paid: t.paid + x.paid, owed: t.owed + x.owed }), { customers: 0, paid: 0, owed: 0 });
  const pending = C.filter((c) => c.status === "pending");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals &amp; tickets</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Anyone can sign up at <a className="underline" href="/partners" target="_blank">/partners</a>. Pros, clients and anyone can be a partner. Refer a person: {pctLabel(PARTNER_PROGRAM.pctOfTake)}% of our take on every completed job from that customer for {PARTNER_PROGRAM.months} months. Referral ticket (one job): {pctLabel(PARTNER_PROGRAM.jobOncePct)}% on a one-time job, {pctLabel(PARTNER_PROGRAM.jobRecurringPct)}% on every visit of a recurring plan for {PARTNER_PROGRAM.months} months. All paid Mondays via Stripe once the job is {PARTNER_PROGRAM.holdDays} days past completion (refunds reduce or void it first). Balances under {money(PARTNER_PROGRAM.minPayout)} roll over.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Partners" value={PS.length} hint={`${PS.filter((p) => p.status === "active").length} active`} />
        <Stat label="Referred customers" value={tot.customers} />
        <Stat label="Commissions owed" value={money(tot.owed)} hint={`${pending.length} job(s)`} />
        <Stat label="Paid to partners" value={money(tot.paid)} />
      </div>

      <section>
        <h2 className="mb-1 font-bold">Referral tickets</h2>
        <p className="mb-2 max-w-3xl text-sm text-ink-soft">A referrer sent us a job. The AI filed it; clear tickets already went to the customer as a pre-filled booking link. &ldquo;Needs review&rdquo; means the AI wasn&apos;t sure or the ZIP is missing — pick the service and send the link. Once the customer pays, the job is broadcast and assigned like any other.</p>
        {tixErr ? <div className="card text-sm">Run <code>supabase/setup/ADD_REFERRAL_TICKETS_2026-10-22_0400.sql</code> once in Supabase → SQL Editor to switch on referral tickets.</div> : !TX.length ? <Empty>No referral tickets yet.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Referrer → customer</th><th className="p-3">Job (AI filing)</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead>
            <tbody>{TX.map((t) => (
              <tr key={t.id} className="border-t border-line align-top">
                <td className="p-3"><div className="font-semibold">{name.get(t.partner_id) ?? "—"}</div><div className="text-xs text-ink-soft">→ {t.customer_name} · {t.customer_email}{t.customer_id ? " · has an account" : " · new"}{t.zip ? ` · ${t.zip}` : ""}</div>{t.preferred_contractor_id && <div className="text-xs text-brand">Referring pro asked for first look</div>}</td>
                <td className="p-3 max-w-md"><div className="font-semibold">{t.service_slug ? getService(t.service_slug)?.name : "Service unclear"}{t.frequency !== "once" ? ` · ${t.frequency}` : ""} {t.ai_confidence && <span className="text-xs font-normal text-ink-soft">({t.ai_confidence} confidence)</span>}</div><p className="text-xs text-ink-soft">{t.ai_summary ?? t.description.slice(0, 300)}</p>{t.missing_info?.length > 0 && <p className="mt-1 text-xs">Missing: {t.missing_info.join(" · ")}</p>}
                  {(thumbs.get(t.id) ?? []).length > 0 ? <div className="mt-2 flex flex-wrap gap-1">{thumbs.get(t.id)!.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer"><img src={u} alt={`Ticket photo ${i + 1}`} className="h-12 w-12 rounded object-cover" /></a>)}</div> : t.photos?.length ? <p className="mt-1 text-xs text-ink-soft">📷 {t.photos.length} photo(s)</p> : null}</td>
                <td className="p-3">{t.status === "booked" ? <Badge tone="green">Booked{t.jobs ? ` · ${t.jobs.ref}` : ""}</Badge> : t.status === "needs_review" ? <Badge tone="amber">Needs review</Badge> : t.status === "open" ? <Badge tone="brand">Link sent</Badge> : <Badge>{t.status}</Badge>}<div className="mt-1 text-xs text-ink-soft">{t.created_at.slice(0, 10)}</div></td>
                <td className="p-3"><TicketActions id={t.id} status={t.status} service={t.service_slug} services={services} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">Credit a customer by hand</h2>
        <p className="text-sm text-ink-soft">A partner says they sent someone who booked without the link. Their future jobs (12 months from today) pay the partner. Already-completed jobs aren&apos;t back-paid.</p>
        {PS.length ? <PartnerAssign partners={PS.filter((p) => p.status === "active").map((p) => [p.id, `${p.name} (${p.code})`])} /> : <Empty>No partners yet.</Empty>}
      </section>

      <section>
        <h2 className="mb-2 font-bold">Partners</h2>
        {!PS.length ? <Empty>No partners yet. Share /partners with realtors and property managers.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Partner</th><th className="p-3">Type</th><th className="p-3">Code</th><th className="p-3">Customers</th><th className="p-3">Owed</th><th className="p-3">Paid</th><th className="p-3">Payouts</th><th className="p-3"></th></tr></thead>
            <tbody>{PS.map((p) => { const x = per.get(p.id); return (
              <tr key={p.id} className="border-t border-line align-top">
                <td className="p-3"><div className="font-semibold">{p.name}</div><div className="text-xs text-ink-soft">{[p.company, p.email, p.phone].filter(Boolean).join(" · ")}</div></td>
                <td className="p-3">{PARTNER_KINDS[p.kind] ?? p.kind}</td>
                <td className="p-3 font-mono">{p.code}</td>
                <td className="p-3">{x?.customers ?? 0}<span className="text-xs text-ink-soft"> ({x?.booked ?? 0} booked)</span></td>
                <td className="p-3">{money(x?.owed ?? 0)}</td>
                <td className="p-3">{money(x?.paid ?? 0)}</td>
                <td className="p-3">{p.stripe_account_id ? <Badge tone="green">Stripe</Badge> : <Badge tone="amber">Not set up</Badge>}</td>
                <td className="p-3">{p.status === "suspended" && <Badge tone="red">Paused</Badge>} <PartnerStatusButton id={p.id} status={p.status} /></td>
              </tr>); })}</tbody>
          </table></div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold">Commission queue</h2>
        {!pending.length ? <Empty>Nothing owed.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Partner</th><th className="p-3">Job</th><th className="p-3">Our take</th><th className="p-3">Rate</th><th className="p-3">Commission</th><th className="p-3">Payable</th><th className="p-3"></th></tr></thead>
            <tbody>{pending.map((c) => (
              <tr key={c.id} className="border-t border-line"><td className="p-3">{name.get(c.partner_id) ?? "—"}</td><td className="p-3">{c.jobs ? `${getService(c.jobs.service_slug)?.name ?? ""} · ${c.jobs.ref}` : "—"}</td><td className="p-3">{money(Number(c.take))}</td><td className="p-3 text-xs">{COMMISSION_BASIS[c.basis ?? "person"].label} · {pctLabel(c.pct != null ? Number(c.pct) : COMMISSION_BASIS[c.basis ?? "person"].pct)}%</td><td className="p-3 font-semibold">{money(Number(c.amount))}</td><td className="p-3">{c.eligible_at.slice(0, 10)}</td><td className="p-3"><VoidCommission id={c.id} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
