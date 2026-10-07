/*
 * FILE    : apps/web/app/(site)/partner/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0135 UTC
 * PURPOSE : The referral partner's page: their link and short link, earnings (paid / ready / upcoming), Stripe payout
 *           setup, "send us a customer", the customers credited to them (and until when) and every commission.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { PARTNER_PROGRAM, SERVICES, getService, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/notify";
import { partnerFor, partnerLink, partnerStats, payoutsReady } from "@/lib/partners";
import { Badge, Empty, Stat } from "@/components/ui";
import { CopyButton, PartnerPayoutButton, ReferCustomer } from "@/components/PartnerUI";

export const metadata = { title: "Partner page" };
export const dynamic = "force-dynamic";

export default async function PartnerHome({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const q = await searchParams;
  const v = await getViewer();
  if (!v) redirect("/login?next=/partner");
  const partner = await partnerFor(v);
  if (!partner) return (
    <div className="wrap py-20"><div className="card mx-auto max-w-lg text-center">
      <h1 className="text-xl font-bold">You&apos;re not a partner yet</h1>
      <p className="mt-2 text-sm text-ink-soft">{v.email} isn&apos;t in the Partner Program. Join in two minutes. If you signed up with a different email, sign in with that one.</p>
      <Link href="/partners#join" className="btn-primary mt-4 inline-block">Become a partner</Link>
    </div></div>
  );
  const db = adminClient();
  const [stats, ready, { data: customers }, { data: comms }] = await Promise.all([
    partnerStats(partner.id),
    payoutsReady(partner),
    db.from("referral_customers").select("customer_name, customer_email, service_slug, source, first_job_id, expires_at, created_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200),
    db.from("partner_commissions").select("id, amount, status, eligible_at, paid_at, created_at, jobs(ref, service_slug, completed_at)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200),
  ]);
  const link = partnerLink(partner.code), short = `${siteUrl()}/r/${partner.code}`;
  const services = SERVICES.map((s) => [s.slug, s.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a, b, c) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);
  return (
    <div className="wrap space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Hi {partner.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-ink-soft">You earn {PARTNER_PROGRAM.pctOfTake * 100}% of our fee on every completed job from your customers, for {PARTNER_PROGRAM.months} months, paid weekly once each job is past our {PARTNER_PROGRAM.holdDays}-day guarantee.{partner.status !== "active" && <b className="text-rose-700"> Your partner account is paused — contact us.</b>}</p>
      </div>
      {q.connect === "done" && <div className="card border-brand bg-brand-tint text-sm">{ready ? "Payouts are set up. You'll be paid every Monday." : "Thanks — Stripe is still checking your details. This page shows when payouts are ready."}</div>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Customers referred" value={stats.customers} hint={`${stats.jobs} paying job(s)`} />
        <Stat label="Paid to you" value={money(stats.paid)} />
        <Stat label="Ready for next payout" value={money(stats.ready)} hint={stats.ready && stats.ready < PARTNER_PROGRAM.minPayout ? `paid once it reaches ${money(PARTNER_PROGRAM.minPayout)}` : "paid Monday"} />
        <Stat label="Upcoming" value={money(stats.upcoming)} hint={`in the ${PARTNER_PROGRAM.holdDays}-day guarantee window`} />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="font-bold">Your link</h2>
          <p className="mt-1 text-sm text-ink-soft">Anyone new who books within {PARTNER_PROGRAM.cookieDays} days of clicking it becomes your customer.</p>
          <p className="mt-3 select-all break-all rounded-lg bg-paper p-2 font-mono text-sm">{link}</p>
          <CopyButton text={link} />
          <p className="mt-3 text-sm">Short link for cards and texts: <span className="select-all font-mono">{short}</span></p>
          <p className="mt-1 text-sm">Your code: <b className="font-mono">{partner.code}</b></p>
        </div>
        <div className="card">
          <h2 className="font-bold">Payouts</h2>
          <p className="mt-1 text-sm text-ink-soft">{ready ? "Ready — commissions go to your bank every Monday through Stripe." : "Set up payouts once through Stripe (bank account or debit card). Stripe also collects the tax details we need if you earn $600+ in a year."}</p>
          <div className="mt-3 flex items-center gap-3">{ready ? <Badge tone="green">Payouts ready</Badge> : <Badge tone="amber">Not set up</Badge>}<PartnerPayoutButton ready={ready} /></div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-bold">Send us a customer</h2>
        <p className="mb-3 mt-1 text-sm text-ink-soft">We email them a booking link from you. They&apos;re your customer for {PARTNER_PROGRAM.months} months, even if they book later or on their phone.</p>
        <ReferCustomer services={services} />
      </section>

      <section>
        <h2 className="mb-2 font-bold">Your customers</h2>
        {!(customers ?? []).length ? <Empty>No customers yet. Share your link or send one above.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Customer</th><th className="p-3">Interested in</th><th className="p-3">How</th><th className="p-3">Booked?</th><th className="p-3">Earning until</th></tr></thead>
            <tbody>{((customers ?? []) as { customer_name: string | null; customer_email: string; service_slug: string | null; source: string; first_job_id: string | null; expires_at: string }[]).map((c) => (
              <tr key={c.customer_email} className="border-t border-line"><td className="p-3">{c.customer_name ?? mask(c.customer_email)}</td><td className="p-3">{c.service_slug ? getService(c.service_slug)?.name ?? "—" : "—"}</td><td className="p-3">{c.source === "direct" ? "You sent them" : c.source === "staff" ? "Credited by us" : "Your link"}</td><td className="p-3">{c.first_job_id ? <Badge tone="green">Booked</Badge> : <Badge>Not yet</Badge>}</td><td className="p-3">{c.expires_at.slice(0, 10)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-bold">Commissions</h2>
        {!(comms ?? []).length ? <Empty>Commissions show here when a referred customer&apos;s job is completed.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Job</th><th className="p-3">Completed</th><th className="p-3">Commission</th><th className="p-3">Status</th></tr></thead>
            <tbody>{((comms ?? []) as unknown as { id: string; amount: number; status: string; eligible_at: string; paid_at: string | null; jobs: { ref: string; service_slug: string; completed_at: string | null } | null }[]).map((c) => (
              <tr key={c.id} className="border-t border-line"><td className="p-3">{c.jobs ? `${getService(c.jobs.service_slug)?.name ?? ""} · ${c.jobs.ref}` : "—"}</td><td className="p-3">{c.jobs?.completed_at?.slice(0, 10) ?? "—"}</td><td className="p-3 font-semibold">{money(Number(c.amount))}</td>
                <td className="p-3">{c.status === "paid" ? <Badge tone="green">Paid {c.paid_at?.slice(0, 10)}</Badge> : c.status === "void" ? <Badge tone="red">Cancelled (refund)</Badge> : new Date(c.eligible_at) <= new Date() ? <Badge tone="brand">Ready</Badge> : <Badge tone="amber">Payable {c.eligible_at.slice(0, 10)}</Badge>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
