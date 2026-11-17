/*
 * FILE    : apps/web/app/(site)/partner/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0135 UTC
 * PURPOSE : The referral partner's page: their link and short link, earnings (paid / ready / upcoming), Stripe payout
 *           setup, "send us a customer", the customers credited to them (and until when) and every commission.
 * UPDATED : 2026-10-28_0122 UTC — partner-v2 rates table (25% one-time / 10% repeat / 15% account); the standard referral
 *           ticket replaces "send us a customer"; every ticket with its number and status; the rate on every commission.
 * UPDATED : 2026-11-06_1730 UTC — two ways to earn. Way 1 Referrals (partner-v2 tiers, referral ticket, link, code) and Way 2
 *           Direct sales (close-ready sales ticket, pay link to close on the spot, sales tickets list) paid on the
 *           10% → 45% ladder; the partner's level and progress (direct sales count 1.5×, referrals 1×).
 * UPDATED : 2026-11-06_1800 UTC — partner-v4: referrals pay one rate on every job, 15% of the price rising to 30%.
 * UPDATED : 2026-11-09_0330 UTC — Professional look: line icons instead of emoji (ThemedIcon / Ico switch by look; Original unchanged).
 * UPDATED : 2026-11-10_0400 UTC — lead pay status ($10 per lead, unlock progress: 10 leads + first paid-out sale, waiting / paid).
 * UPDATED : 2026-11-10_1415 UTC — a "Step 1: set up your payouts" banner at the top until Stripe payouts are ready.
 * UPDATED : 2026-11-10_1450 UTC — "Grow your partner business" card linking the Partner Success roadmap (/partner/grow).
 * UPDATED : 2026-11-17_2100 UTC — partners who joined under earlier terms see "Sign the Referral Partner Agreement" at the top.
 * UPDATED : 2026-11-17_1930 UTC — partner-v7 one program: one rate panel — profit from referrals (1×), from direct sales (1.5×),
 *           total credit, the rate now (referral / direct = +5) and exactly what gets the next raise; one ladder table.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { BRAND, DIRECT_BONUS, roadmapFor, PARTNER_LADDER, PARTNER_PROGRAM, SALES_DRAW, PARTNER_TIERS, REFERRAL_LADDER, referralRange, SALES_TICKET, SERVICES, ladderTable, TICKET_CONTACT, TICKET_JOB_TYPES, TICKET_RELATIONSHIPS, TICKET_STATUSES, TICKET_TIMING, getService, money, moneyCents, ticketStage, tierPct, type PartnerTier } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/notify";
import { leadPayStatus, partnerFor, partnerLink, partnerStats, payoutsReady } from "@/lib/partners";
import { Badge, Empty, Stat } from "@/components/ui";
import { AgreementSign, CopyButton, PartnerPayoutButton, ReferralTicket, SalesTicketForm } from "@/components/PartnerUI";
import { ticketsFor } from "@/lib/sales-tickets";

const pct = (r: number) => `${Math.round(r * 100)}%`;
const SALE_STATUS: Record<string, [string, "green" | "amber" | "red" | "brand" | "slate"]> = {
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
    <div className="wrap py-20 pro:py-12"><div className="card mx-auto max-w-lg text-center">
      <h1 className="text-xl font-bold">You&apos;re not a partner yet</h1>
      <p className="mt-2 text-sm text-ink-soft">{v.email} isn&apos;t in the Partner Program. Join in two minutes. If you signed up with a different email, sign in with that one.</p>
      <Link href="/partners#join" className="btn-primary mt-4 inline-block">Become a partner</Link>
    </div></div>
  );
  const db = adminClient();
  const [lead, stats, ready, sales, { data: customers }, { data: comms }] = await Promise.all([
    leadPayStatus(partner.id).catch(() => null),
    partnerStats(partner.id),
    payoutsReady(partner),
    ticketsFor(partner.id).catch(() => []),
    db.from("referral_customers").select("*").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(200),
    db.from("partner_commissions").select("*, jobs(ref, service_slug, completed_at, contact_email)").eq("partner_id", partner.id).order("created_at", { ascending: false }).limit(500),
  ]);
  const link = partnerLink(partner.code), short = `${siteUrl()}/r/${partner.code}`;
  const services = SERVICES.map((s) => [s.slug, s.name] as [string, string]).sort((a, b) => a[1].localeCompare(b[1]));
  type Comm = { id: string; amount: number; status: string; eligible_at: string; paid_at: string | null; tier?: string | null; rate?: number | null; jobs: { ref: string; service_slug: string; completed_at: string | null; contact_email: string } | null };
  const C = (comms ?? []) as unknown as Comm[];
  const byCustomer = new Map<string, { completed: number; paid: number }>();
  for (const c of C) {
    const k = (c.jobs?.contact_email ?? "").toLowerCase();
    const x = byCustomer.get(k) ?? { completed: 0, paid: 0 };
    if (c.status !== "void") x.completed++; if (c.status === "paid") x.paid++; byCustomer.set(k, x);
  }
  const rateOf = (c: Comm) => c.tier === "self" ? "10% back on your own first project · Post & earn" : c.tier === "sale" ? `${pct(Number(c.rate ?? PARTNER_LADDER.baseRate))} of the job price · Direct sale` : c.tier === "direct" ? `${pct(Number(c.rate ?? 0.1))} of our profit · Direct sale` : c.tier && c.tier !== "legacy" ? `${pct(Number(c.rate ?? PARTNER_TIERS[c.tier as PartnerTier]?.rate ?? 0))} of the job price · Referral` : "10% of our fee (before Oct 28)";
  const tone = (st: string) => (st === "paid" || st === "completed" ? "green" : st === "booked" ? "brand" : st === "closed" ? "red" : "amber") as "green" | "brand" | "red" | "amber";
  const mask = (e: string) => e.replace(/^(.)(.*)(@.*)$/, (_m, a, b, c) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);
  return (
    <div className="wrap space-y-6 py-10">
      {/* the current Referral Partner Agreement: partners who joined under earlier terms sign it here */}
      {(partner as { terms_version?: string | null }).terms_version !== PARTNER_PROGRAM.termsVersion && (
        <div className="card space-y-2 border-2 border-brand/40">
          <div className="font-bold">Sign the Referral Partner Agreement</div>
          <p className="text-sm text-ink-soft">Our partner terms are now one signable agreement: the same rates, written out — business and property-manager referrals, exactly what's commissionable, how credit is checked and when you're paid. <a href="/terms/referral-partner-agreement" target="_blank" className="font-semibold text-brand underline">Read it</a>, then sign below.</p>
          <AgreementSign defaultName={partner.name} />
        </div>
      )}
      {/* payouts first: until Stripe is set up we can't pay them (pros are paid with their job payouts) */}
      {!ready && q.connect !== "done" && (
        <div id="payouts-first" className="card flex flex-wrap items-center justify-between gap-3 border-2 border-amber-300 bg-amber-50">
          <div className="min-w-0">
            <div className="font-bold text-amber-900">Step 1: set up your payouts</div>
            <p className="text-sm text-amber-900/90">We can only pay your commissions once this is done. About 2 minutes with Stripe: add a bank account or debit card. {stats.ready ? <b>{money(stats.ready)} is already waiting for you.</b> : "Do it now, before your first customer books."}</p>
          </div>
          <PartnerPayoutButton ready={ready} />
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">Hi {partner.name.split(" ")[0]}<span className="pro:hidden"> 👋</span></h1>
        <p className="text-sm text-ink-soft">One program, two ways to earn, paid weekly once each job is past our {PARTNER_PROGRAM.holdDays}-day guarantee: <b>refer</b> customers and earn {pct(stats.referral.rate)} of our profit on the job, or <b>sell</b> the job yourself and earn {pct(stats.level.rate)} (your rate + 5 points). Both rise as you grow.{partner.status !== "active" && <b className="text-rose-700"> Your partner account is paused — contact us.</b>}</p>
      </div>
      <Link href="/partner/grow" className="card flex flex-wrap items-center justify-between gap-3 border-t-4 border-t-brand hover:border-brand">
        <span><span className="block font-bold">Grow your partner business →</span><span className="text-sm text-ink-soft">Your roadmap: {roadmapFor(partner.kind).name}. Goals tracked from your real numbers, what to do next, and the services to sell.</span></span>
        <span className="btn-primary">See your roadmap</span>
      </Link>
      <div className="grid gap-3 sm:grid-cols-2">
        <a href="#referrals" className="card border-t-4 border-t-gold hover:border-brand"><div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 1</div><div className="font-bold">Referrals</div><p className="mt-1 text-sm text-ink-soft">Send us the customer on a referral ticket, your link or your code. We do the selling. {pct(stats.referral.rate)} of our profit today, up to {pct(REFERRAL_LADDER.topRate)} (paid by us — the pro's pay is never cut).</p><p className="mt-2 text-sm">Earned so far: <b>{money(stats.bySource.referral)}</b></p></a>
        <a href="#direct" className="card border-t-4 border-t-brand hover:border-brand"><div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 2</div><div className="font-bold">Direct sales</div><p className="mt-1 text-sm text-ink-soft">Sell the service yourself on a sales ticket; the customer pays on the spot or from our text. {pct(stats.level.rate)} of our profit today (your rate + 5 points), up to {pct(PARTNER_LADDER.topRate)} — and it counts 1.5× toward your next raise.</p><p className="mt-2 text-sm">Earned so far: <b>{money(stats.bySource.direct)}</b></p></a>
      </div>

      {/* partner-v7: one ladder — what built it (referrals 1×, direct sales 1.5×), the rate now and what gets the next raise */}
      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Your rate: {pct(stats.referral.rate)} on referrals · {pct(stats.level.rate)} on direct sales</h2>
          <span className="text-sm text-ink-soft">Level {stats.referral.level} of {ladderTable(REFERRAL_LADDER).length - 1}</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-paper p-3"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">From referrals (1×)</div><div className="text-xl font-bold">{money(stats.credit.referralProfit)}</div><div className="text-xs text-ink-soft">profit made for {BRAND.name}</div></div>
          <div className="rounded-xl bg-paper p-3"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">From direct sales ({PARTNER_LADDER.directCredit}×)</div><div className="text-xl font-bold">{money(stats.credit.directProfit)}</div><div className="text-xs text-ink-soft">counts as {money(Math.round(stats.credit.directProfit * PARTNER_LADDER.directCredit * 100) / 100)}</div></div>
          <div className="rounded-xl border-2 border-brand/40 p-3"><div className="text-xs font-semibold uppercase tracking-wide text-brand">Total credit</div><div className="text-xl font-extrabold">{money(stats.credit.total)}</div><div className="text-xs text-ink-soft">what sets your rate</div></div>
        </div>
        {stats.referral.next ? (() => {
          const n = stats.referral.next!, from = ladderTable(REFERRAL_LADDER)[stats.referral.level].profit;
          const done = Math.max(0, Math.min(100, ((stats.credit.total - from) / Math.max(1, n.profit - from)) * 100));
          return (<>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-paper"><div className="h-full rounded-full bg-brand" style={{ width: `${done}%` }} /></div>
            <p className="mt-2 text-sm">Next raise to <b>{pct(n.rate)}</b> on referrals and <b>{pct(n.rate + DIRECT_BONUS)}</b> on direct sales at {money(n.profit)} of credit: <b>{money(n.profitToGo)} to go</b> — about {money(n.profitToGo)} of profit from referrals, or {money(Math.ceil((n.profitToGo / PARTNER_LADDER.directCredit) * 100) / 100)} from direct sales.</p>
          </>);
        })() : <p className="mt-2 text-sm font-semibold text-brand-dark">You&apos;re at the top rate. Thank you for everything you&apos;ve built with us.</p>}
        <p className="mt-2 text-xs text-ink-soft">Credit = the profit your completed jobs make {BRAND.name}: the job price minus what the pro is paid and any refunds. Direct sales count {PARTNER_LADDER.directCredit}×, referrals {PARTNER_LADDER.referralCredit}×. Each job keeps the rate it was booked at.</p>
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-ink-soft">See the whole ladder</summary>
          <div className="mt-2 grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-8">{ladderTable(REFERRAL_LADDER).map((r) => (
            <div key={r.level} className={`flex justify-between gap-3 ${r.level === stats.referral.level ? "font-bold text-brand-dark" : ""}`}><span>{pct(r.rate)} referral · {pct(r.rate + DIRECT_BONUS)} direct</span><span className="tabular-nums">{money(r.profit)}</span></div>
          ))}</div>
        </details>
      </section>

      <h2 id="referrals" className="scroll-mt-20 pt-2 text-xl font-extrabold">Way 1 · Referrals</h2>
      <div className="card border-t-4 border-t-gold">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><div><span className="text-3xl font-extrabold">{pct(stats.referral.rate)}</span> <span className="font-semibold">of every referred job</span></div><span className="text-sm text-ink-soft">{referralRange()} · the same on every service</span></div>
        <p className="mt-1 text-sm text-ink-soft">Your rate is locked on each job when it&apos;s booked, for every job from the customer for {PARTNER_PROGRAM.months} months. It's a share of our profit on the job, paid by us.</p>
      </div>
      {q.connect === "done" && <div className="card border-brand bg-brand-tint text-sm">{ready ? "Payouts are set up. You'll be paid every Monday." : "Thanks — Stripe is still checking your details. This page shows when payouts are ready."}</div>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Your customers" value={stats.customers} hint={`${stats.jobs} paying job(s)`} />
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
          <p className="mt-1 text-sm">Your code: <b className="font-mono">{partner.code}</b> — new customers can type it in the code box when they pay, and they&apos;re yours.</p>
        </div>
        <div className="card">
          <h2 className="font-bold">Payouts</h2>
          <p className="mt-1 text-sm text-ink-soft">{ready ? "Ready — commissions go to your bank every Monday through Stripe." : "Set up payouts once through Stripe (bank account or debit card). Stripe also collects the tax details we need if you earn $600+ in a year."}</p>
          <div className="mt-3 flex items-center gap-3">{ready ? <Badge tone="green">Payouts ready</Badge> : <Badge tone="amber">Not set up</Badge>}<PartnerPayoutButton ready={ready} /></div>
        </div>
      </section>

      <section className="card">
        <h2 className="font-bold">Referral ticket</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">One form for every referral. You get a ticket number to follow here; we email them a booking link from you and reach out ourselves. They&apos;re your customer for {PARTNER_PROGRAM.months} months, even if they book later or on their phone.</p>
        <ReferralTicket services={services} jobTypes={Object.entries(TICKET_JOB_TYPES).map(([k, v]) => [k, v.label, v.earns])} timings={Object.entries(TICKET_TIMING)} contacts={Object.entries(TICKET_CONTACT)} relationships={Object.entries(TICKET_RELATIONSHIPS)} />
      </section>

      <section>
        <h2 className="mb-2 font-bold">Your tickets and customers</h2>
        {!(customers ?? []).length ? <Empty>No referrals yet. Share your link or fill out a ticket above.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Ticket</th><th className="p-3">Customer</th><th className="p-3">Needs</th><th className="p-3">How</th><th className="p-3">Status</th><th className="p-3">Earning until</th></tr></thead>
            <tbody>{((customers ?? []) as { ticket_no?: string | null; customer_name: string | null; customer_email: string; service_slug: string | null; job_type?: string | null; source: string; status?: string | null; first_job_id: string | null; expires_at: string; created_at: string }[]).map((c) => {
              const st = ticketStage(c, byCustomer.get(c.customer_email.toLowerCase()));
              return (
                <tr key={c.customer_email} className="border-t border-line"><td className="p-3 font-mono text-xs">{c.ticket_no ?? "—"}<div className="font-sans text-ink-soft">{c.created_at.slice(0, 10)}</div></td><td className="p-3">{c.customer_name ?? mask(c.customer_email)}</td><td className="p-3">{c.service_slug ? getService(c.service_slug)?.name ?? "—" : "—"}{c.job_type && <div className="text-xs text-ink-soft">{TICKET_JOB_TYPES[c.job_type as keyof typeof TICKET_JOB_TYPES]?.label}</div>}</td><td className="p-3">{c.source === "direct" ? "Your referral ticket" : c.source === "sale" ? "Your sale" : c.source === "self" ? "Your own project (10% back)" : c.source === "staff" ? "Credited by us" : "Your link or code"}</td><td className="p-3"><Badge tone={tone(st)}>{TICKET_STATUSES[st]}</Badge></td><td className="p-3">{c.expires_at.slice(0, 10)}</td></tr>
              );
            })}</tbody>
          </table></div>
        )}
      </section>

      <h2 id="direct" className="scroll-mt-20 pt-2 text-xl font-extrabold">Way 2 · Direct sales</h2>
      <section className="card">
        <h3 className="font-bold">Write a sales ticket</h3>
        <p className="mb-3 mt-1 text-sm text-ink-soft">Sell any Handled service. The ticket holds everything needed to close: the service and its sizes, {SALES_TICKET.minPhotos}–{SALES_TICKET.maxPhotos} photos for on-site work (none for remote services like websites), the customer, when they need it, and the price you showed. We text them the pay link, or they pay right now on your phone. Once paid, the job goes to the job board; you&apos;re paid {pct(stats.level.rate)} of our profit on it (rate locked when it&apos;s booked) once it&apos;s completed. Their repeat visits for {PARTNER_PROGRAM.months} months pay you the same way.</p>
        <SalesTicketForm services={services} minPhotos={SALES_TICKET.minPhotos} maxPhotos={SALES_TICKET.maxPhotos} repCode={partner.code} />
      </section>

      <section>
        {lead && (
          <div className="card mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div><b>Lead pay: {money(SALES_DRAW.perLead)} for every lead</b> <span className="text-ink-soft">— an advance on that lead&apos;s commission, taken back out when it pays; you keep it if the lead never books.</span>
              {lead.unlocked
                ? <div className="mt-1 text-brand-dark">✓ Unlocked — paid every Monday. {money(lead.paid)} paid so far{lead.waiting ? `, ${money(lead.waiting)} on the next payout` : ""}.</div>
                : <div className="mt-1 text-amber-800">Unlocks after {SALES_DRAW.unlockLeads} leads and your first paid-out sale: {Math.min(lead.leads, SALES_DRAW.unlockLeads)}/{SALES_DRAW.unlockLeads} leads · {Math.min(lead.paidSales, SALES_DRAW.unlockPaidSales)}/{SALES_DRAW.unlockPaidSales} paid sale. {money(lead.waiting)} is building up and pays out once it unlocks.</div>}
            </div>
          </div>
        )}
        <h3 className="mb-2 font-bold">Your sales tickets</h3>
        {!sales.length ? <Empty>No sales tickets yet. Write your first one above.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Sent</th><th className="p-3">Customer</th><th className="p-3">Service</th><th className="p-3">Price shown</th><th className="p-3">Ticket</th><th className="p-3">Job</th></tr></thead>
            <tbody>{sales.map((t) => { const [label, tn] = SALE_STATUS[t.status] ?? [t.status, "slate" as const]; return (
              <tr key={t.id} className="border-t border-line"><td className="p-3">{t.created_at.slice(0, 10)}</td><td className="p-3">{t.customer_name}{t.city ? <span className="text-xs text-ink-soft"> · {t.city}</span> : null}</td><td className="p-3">{t.service_slug ? getService(t.service_slug)?.name ?? "—" : "—"}</td><td className="p-3">{t.quoted_price ? money(Number(t.quoted_price)) : "—"}</td><td className="p-3"><Badge tone={tn}>{label}</Badge>{t.link && <div className="mt-1"><CopyButton text={t.link} label="Copy pay link" /></div>}</td><td className="p-3">{t.jobs ? `${t.jobs.ref} · ${t.jobs.status.replace(/_/g, " ")}${t.jobs.price_final ? ` · ${money(Number(t.jobs.price_final))}` : ""}` : "—"}</td></tr>
            ); })}</tbody>
          </table></div>
        )}
      </section>

      <section>
        <h2 className="mb-2 pt-2 text-xl font-extrabold">Commissions</h2>
        {!C.length ? <Empty>Commissions show here when a referred customer&apos;s job is completed.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Job</th><th className="p-3">Completed</th><th className="p-3">Rate</th><th className="p-3">Commission</th><th className="p-3">Status</th></tr></thead>
            <tbody>{C.map((c) => (
              <tr key={c.id} className="border-t border-line"><td className="p-3">{c.jobs ? `${getService(c.jobs.service_slug)?.name ?? ""} · ${c.jobs.ref}` : "—"}</td><td className="p-3">{c.jobs?.completed_at?.slice(0, 10) ?? "—"}</td><td className="p-3 text-xs">{rateOf(c)}</td><td className="p-3 font-semibold">{moneyCents(Number(c.amount))}</td>
                <td className="p-3">{c.status === "paid" ? <Badge tone="green">Paid {c.paid_at?.slice(0, 10)}</Badge> : c.status === "void" ? <Badge tone="red">Cancelled (refund)</Badge> : new Date(c.eligible_at) <= new Date() ? <Badge tone="brand">Ready</Badge> : <Badge tone="amber">Payable {c.eligible_at.slice(0, 10)}</Badge>}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
