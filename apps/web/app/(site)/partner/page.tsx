/*
 * FILE    : apps/web/app/(site)/partner/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0135 UTC
 * PURPOSE : The referral partner's page: their link and short link, earnings (paid / ready / upcoming), Stripe payout
 *           setup, "send us a customer", the customers credited to them (and until when) and every commission.
 * UPDATED : 2026-11-06_1638 UTC — Field Sales: the partner's level and rate on the 10%→45% ladder (progress to the next
 *           raise), and the two ways to earn: Way 1 Direct sales (close-ready tickets, pay link to close on the spot, their
 *           tickets) and Way 2 Referrals (link, code, send a customer); each commission shows which way it was earned.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { PARTNER_LADDER, PARTNER_PROGRAM, SALES_TICKET, SERVICES, getService, ladderTable, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/notify";
import { partnerFor, partnerLink, partnerStats, payoutsReady } from "@/lib/partners";
import { Badge, Empty, Stat } from "@/components/ui";
import { CopyButton, PartnerPayoutButton, ReferCustomer, SalesTicketForm } from "@/components/PartnerUI";
import { ticketsFor } from "@/lib/sales-tickets";

const pct = (r: number) => `${Math.round(r * 100)}%`;
const TICKET_STATUS: Record<string, [string, "green" | "amber" | "red" | "brand" | "slate"]> = {
  sent: ["Waiting for the customer", "amber"], booked: ["Booked", "green"], expired: ["Expired", "slate"], cancelled: ["Cancelled", "red"],
};

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
  const [stats, ready, tickets, { data: customers }, { data: comms }] = await Promise.all([
    partnerStats(partner.id),
    payoutsReady(partner),
    ticketsFor(partner.id).catch(() => []),
    db.from("referral_customers").select("customer_name, customer_email, service_slug, source, first_job_id, expires_at, created_at").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200),
    db.from("partner_commissions").select("id, amount, rate, source, status, eligible_at, paid_at, created_at, jobs(ref, service_slug, completed_at)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200),
  ]);
  const link = partnerLink(partner.code), short = `${siteUrl()}/r/${partner.code}`;
  const services = SERVICES.map((s) => [s.slug, s.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a, b, c) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);
  return (
    <div className="wrap space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-bold">Hi {partner.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-ink-soft">You earn <b>{pct(stats.level.rate)}</b> of our profit on every completed job from your customers, for {PARTNER_PROGRAM.months} months, paid weekly once each job is past our {PARTNER_PROGRAM.holdDays}-day guarantee. Your rate climbs to {pct(PARTNER_LADDER.topRate)} as you grow.{partner.status !== "active" && <b className="text-rose-700"> Your partner account is paused — contact us.</b>}</p>
      </div>
      {q.connect === "done" && <div className="card border-brand bg-brand-tint text-sm">{ready ? "Payouts are set up. You'll be paid every Monday." : "Thanks — Stripe is still checking your details. This page shows when payouts are ready."}</div>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Your customers" value={stats.customers} hint={`${stats.jobs} paying job(s)`} />
        <Stat label="Paid to you" value={money(stats.paid)} />
        <Stat label="Ready for next payout" value={money(stats.ready)} hint={stats.ready && stats.ready < PARTNER_PROGRAM.minPayout ? `paid once it reaches ${money(PARTNER_PROGRAM.minPayout)}` : "paid Monday"} />
        <Stat label="Upcoming" value={money(stats.upcoming)} hint={`in the ${PARTNER_PROGRAM.holdDays}-day guarantee window`} />
      </div>

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Your level: {stats.level.level} · {pct(stats.level.rate)} of profit</h2>
          <span className="text-sm text-ink-soft">Profit you&apos;ve generated for us: <b>{money(stats.level.profit)}</b> · {stats.level.jobs} completed job{stats.level.jobs === 1 ? "" : "s"}</span>
        </div>
        {stats.level.next ? (() => {
          const n = stats.level.next!, from = ladderTable()[stats.level.level].profit;
          const done = Math.max(0, Math.min(100, ((stats.level.profit - from) / Math.max(1, n.profit - from)) * 100));
          return (<>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-brand" style={{ width: `${done}%` }} /></div>
            <p className="mt-2 text-sm">Next raise to <b>{pct(n.rate)}</b>: {money(n.profitToGo)} more profit{n.jobsToGo !== null && n.jobsToGo > 0 ? <> — or {n.jobsToGo} more completed job{n.jobsToGo === 1 ? "" : "s"}</> : null}.</p>
          </>);
        })() : <p className="mt-2 text-sm font-semibold text-brand-dark">You&apos;re at the top rate. Thank you for everything you&apos;ve built with us.</p>}
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink-soft">See the whole ladder</summary>
          <p className="mt-2 text-xs text-ink-soft">Every level is +1 point. Profit = the job price minus what the pro is paid and any refunds. Every {PARTNER_LADDER.jobsPerStep} completed jobs also moves you up one level, up to {pct(PARTNER_LADDER.jobsCapRate)}. Levels never go down.</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">{ladderTable().map((r) => (
            <div key={r.level} className={`flex justify-between ${r.level === stats.level.level ? "font-bold text-brand-dark" : ""}`}><span>{pct(r.rate)}</span><span className="tabular-nums">{money(r.profit)}</span></div>
          ))}</div>
        </details>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <a href="#direct" className="card border-t-4 border-t-brand hover:border-brand"><div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 1</div><div className="font-bold">Direct sales</div><p className="mt-1 text-sm text-ink-soft">You sell the service and write the ticket. The customer pays on the spot or from our text.</p><p className="mt-2 text-sm">Earned so far: <b>{money(stats.bySource.direct)}</b></p></a>
        <a href="#referrals" className="card border-t-4 border-t-gold hover:border-brand"><div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 2</div><div className="font-bold">Referrals</div><p className="mt-1 text-sm text-ink-soft">Share your link or code, or send us a customer. We do the selling.</p><p className="mt-2 text-sm">Earned so far: <b>{money(stats.bySource.referral)}</b></p></a>
      </div>
      <p className="-mt-2 text-xs text-ink-soft">Both pay the same rate ({pct(stats.level.rate)} today) and both count toward your next raise.</p>

      <h2 id="direct" className="scroll-mt-20 pt-2 text-xl font-extrabold">Way 1 · Direct sales</h2>
      <section className="card">
        <h3 className="font-bold">Write a ticket</h3>
        <p className="mb-3 mt-1 text-sm text-ink-soft">Sell any {"Handled"} service. The ticket holds everything needed to close: the service and its sizes, {SALES_TICKET.minPhotos}–{SALES_TICKET.maxPhotos} photos for on-site work (none for remote services like websites), the customer, when they need it, and the price you showed. We text them the pay link, or they pay right now on your phone. Once paid, the job goes to the job board; you&apos;re paid when it&apos;s completed.</p>
        <SalesTicketForm services={services} minPhotos={SALES_TICKET.minPhotos} maxPhotos={SALES_TICKET.maxPhotos} repCode={partner.code} />
      </section>

      <section>
        <h3 className="mb-2 font-bold">Your tickets</h3>
        {!tickets.length ? <Empty>No tickets yet. Write your first one above.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Sent</th><th className="p-3">Customer</th><th className="p-3">Service</th><th className="p-3">Price shown</th><th className="p-3">Ticket</th><th className="p-3">Job</th></tr></thead>
            <tbody>{tickets.map((t) => { const [label, tone] = TICKET_STATUS[t.status] ?? [t.status, "slate" as const]; return (
              <tr key={t.id} className="border-t border-line"><td className="p-3">{t.created_at.slice(0, 10)}</td><td className="p-3">{t.customer_name}{t.city ? <span className="text-xs text-ink-soft"> · {t.city}</span> : null}</td><td className="p-3">{t.service_slug ? getService(t.service_slug)?.name ?? "—" : "Customer picks"}</td><td className="p-3">{t.quoted_price ? money(Number(t.quoted_price)) : "—"}</td><td className="p-3"><Badge tone={tone}>{label}</Badge>{t.link && <div className="mt-1"><CopyButton text={t.link} label="Copy pay link" /></div>}</td><td className="p-3">{t.jobs ? `${t.jobs.ref} · ${t.jobs.status.replace(/_/g, " ")}${t.jobs.price_final ? ` · ${money(Number(t.jobs.price_final))}` : ""}` : "—"}</td></tr>
            ); })}</tbody>
          </table></div>
        )}
      </section>

      <h2 id="referrals" className="scroll-mt-20 pt-2 text-xl font-extrabold">Way 2 · Referrals</h2>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="font-bold">Your link and code</h3>
          <p className="mt-1 text-sm text-ink-soft">Anyone new who books within {PARTNER_PROGRAM.cookieDays} days of clicking it becomes your customer.</p>
          <p className="mt-3 select-all break-all rounded-lg bg-paper p-2 font-mono text-sm">{link}</p>
          <CopyButton text={link} />
          <p className="mt-3 text-sm">Short link for cards and texts: <span className="select-all font-mono">{short}</span></p>
          <p className="mt-1 text-sm">Your code: <b className="font-mono">{partner.code}</b> — new customers can type it in the code box when they pay, and the job is yours.</p>
        </div>
        <div className="card">
          <h3 className="font-bold">Send us a customer</h3>
        <p className="mb-3 mt-1 text-sm text-ink-soft">We email them a booking link from you. They&apos;re your customer for {PARTNER_PROGRAM.months} months, even if they book later or on their phone.</p>
          <ReferCustomer services={services} />
        </div>
      </section>

      <section>
        <h3 className="mb-2 font-bold">Your customers</h3>
        {!(customers ?? []).length ? <Empty>No customers yet. Share your link or send one above.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Customer</th><th className="p-3">Interested in</th><th className="p-3">How</th><th className="p-3">Booked?</th><th className="p-3">Earning until</th></tr></thead>
            <tbody>{((customers ?? []) as { customer_name: string | null; customer_email: string; service_slug: string | null; source: string; first_job_id: string | null; expires_at: string }[]).map((c) => (
              <tr key={c.customer_email} className="border-t border-line"><td className="p-3">{c.customer_name ?? mask(c.customer_email)}</td><td className="p-3">{c.service_slug ? getService(c.service_slug)?.name ?? "—" : "—"}</td><td className="p-3">{c.source === "direct" ? "You sent them" : c.source === "staff" ? "Credited by us" : c.source === "ticket" ? "Your ticket" : "Your link"}</td><td className="p-3">{c.first_job_id ? <Badge tone="green">Booked</Badge> : <Badge>Not yet</Badge>}</td><td className="p-3">{c.expires_at.slice(0, 10)}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <section>
        <h2 className="pt-2 text-xl font-extrabold">Getting paid</h2>
        <div className="card my-3">
          <h3 className="font-bold">Payouts</h3>
          <p className="mt-1 text-sm text-ink-soft">{ready ? "Ready — commissions go to your bank every Monday through Stripe." : "Set up payouts once through Stripe (bank account or debit card). Stripe also collects the tax details we need if you earn $600+ in a year."}</p>
          <div className="mt-3 flex items-center gap-3">{ready ? <Badge tone="green">Payouts ready</Badge> : <Badge tone="amber">Not set up</Badge>}<PartnerPayoutButton ready={ready} /></div>
        </div>
        <h3 className="mb-2 font-bold">Commissions</h3>
        {!(comms ?? []).length ? <Empty>Commissions show here when a referred customer&apos;s job is completed.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Job</th><th className="p-3">How</th><th className="p-3">Completed</th><th className="p-3">Rate</th><th className="p-3">Commission</th><th className="p-3">Status</th></tr></thead>
            <tbody>{((comms ?? []) as unknown as { id: string; amount: number; rate: number | null; source: string | null; status: string; eligible_at: string; paid_at: string | null; jobs: { ref: string; service_slug: string; completed_at: string | null } | null }[]).map((c) => (
              <tr key={c.id} className="border-t border-line"><td className="p-3">{c.jobs ? `${getService(c.jobs.service_slug)?.name ?? ""} · ${c.jobs.ref}` : "—"}</td><td className="p-3">{c.source === "direct" ? <Badge tone="brand">Direct sale</Badge> : <Badge>Referral</Badge>}</td><td className="p-3">{c.jobs?.completed_at?.slice(0, 10) ?? "—"}</td><td className="p-3">{pct(Number(c.rate ?? PARTNER_PROGRAM.pctOfTake))}</td><td className="p-3 font-semibold">{money(Number(c.amount))}</td>
                <td className="p-3">{c.status === "paid" ? <Badge tone="green">Paid {c.paid_at?.slice(0, 10)}</Badge> : c.status === "void" ? <Badge tone="red">Cancelled (refund)</Badge> : new Date(c.eligible_at) <= new Date() ? <Badge tone="brand">Ready</Badge> : <Badge tone="amber">Payable {c.eligible_at.slice(0, 10)}</Badge>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
