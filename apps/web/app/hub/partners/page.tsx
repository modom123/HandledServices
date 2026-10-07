/*
 * FILE    : apps/web/app/hub/partners/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0145 UTC
 * PURPOSE : Handled Hub → Partners (Referral Partner Program): every partner with their customers and earnings,
 *           pause / reactivate, credit a customer by hand, and the commission queue (void before payout).
 *           Payouts run on Mondays with the pro payouts (cron sweep).
 */
import { PARTNER_KINDS, PARTNER_PROGRAM, getService, money, type PartnerKind } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Badge, Empty, Stat } from "@/components/ui";
import { PartnerAssign, PartnerStatusButton, VoidCommission } from "@/components/PartnerUI";

export const dynamic = "force-dynamic";

type P = { id: string; code: string; name: string; email: string; phone: string | null; company: string | null; kind: PartnerKind; status: "active" | "suspended"; stripe_account_id: string | null; created_at: string };
type C = { id: string; partner_id: string; amount: number; take: number; status: string; eligible_at: string; paid_at: string | null; note: string | null; jobs: { ref: string; service_slug: string } | null };

export default async function PartnersHub() {
  const db = adminClient();
  const { data: partners, error } = await db.from("referral_partners").select("*").order("created_at", { ascending: false });
  if (error) return (
    <div className="card max-w-2xl"><h1 className="text-xl font-bold">The Partner Program isn&apos;t switched on yet</h1>
      <p className="mt-2 text-sm text-ink-soft">Run <code>supabase/setup/ADD_REFERRAL_PARTNERS_2026-10-07_0100.sql</code> once in Supabase → SQL Editor, then reload.</p></div>
  );
  const [{ data: custs }, { data: comms }] = await Promise.all([
    db.from("referral_customers").select("partner_id, first_job_id"),
    db.from("partner_commissions").select("id, partner_id, amount, take, status, eligible_at, paid_at, note, jobs(ref, service_slug)").order("created_at", { ascending: false }).limit(1000),
  ]);
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
        <h1 className="text-2xl font-bold">Referral partners</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Anyone can sign up at <a className="underline" href="/partners" target="_blank">/partners</a>. Partners earn {PARTNER_PROGRAM.pctOfTake * 100}% of our take on every completed job from customers they refer, for {PARTNER_PROGRAM.months} months, paid Mondays via Stripe once the job is {PARTNER_PROGRAM.holdDays} days past completion (refunds reduce or void it first). Balances under {money(PARTNER_PROGRAM.minPayout)} roll over.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Partners" value={PS.length} hint={`${PS.filter((p) => p.status === "active").length} active`} />
        <Stat label="Referred customers" value={tot.customers} />
        <Stat label="Commissions owed" value={money(tot.owed)} hint={`${pending.length} job(s)`} />
        <Stat label="Paid to partners" value={money(tot.paid)} />
      </div>

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
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Partner</th><th className="p-3">Job</th><th className="p-3">Our take</th><th className="p-3">Commission</th><th className="p-3">Payable</th><th className="p-3"></th></tr></thead>
            <tbody>{pending.map((c) => (
              <tr key={c.id} className="border-t border-line"><td className="p-3">{name.get(c.partner_id) ?? "—"}</td><td className="p-3">{c.jobs ? `${getService(c.jobs.service_slug)?.name ?? ""} · ${c.jobs.ref}` : "—"}</td><td className="p-3">{money(Number(c.take))}</td><td className="p-3 font-semibold">{money(Number(c.amount))}</td><td className="p-3">{c.eligible_at.slice(0, 10)}</td><td className="p-3"><VoidCommission id={c.id} /></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
