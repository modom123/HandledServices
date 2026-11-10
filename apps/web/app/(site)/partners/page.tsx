/*
 * FILE    : apps/web/app/(site)/partners/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0130 UTC
 * UPDATED : 2026-11-07_1500 UTC — "Got a project of your own? Post it" (Post & earn: 10% back, up to $250).
 * PURPOSE : Public page for the Referral Partner Program: what partners earn (25% one-time / 10% repeat / 15% account,
 *           of the job price, weekly via Stripe), who it's for, worked examples, sign-up form and the partner terms.
 * UPDATED : 2026-10-09_0300 UTC — Handled +5 points paid by customers (commission about 20% → 37%, take band 15–40%; pro pay unchanged).
 * UPDATED : 2026-10-23_1500 UTC — #join clears the sticky header (the home page's Become a Partner button links straight here).
 * UPDATED : 2026-10-28_0122 UTC — partner-v2: fixed rates of the job price (same on every service), referral ticket.
 * UPDATED : 2026-11-06_1730 UTC — two ways to earn: referrals (partner-v2 rates) and direct sales / Field Sales (sell it
 *           yourself on a sales ticket: 10% → 45% of our profit, 45% at $1M; direct sales count 1.5× toward the next
 *           raise). ?kind=sales_rep pre-selects "Field Sales partner" (the Indeed post links to /partners?kind=sales_rep#join).
 * UPDATED : 2026-11-06_1800 UTC — partner-v4: referrals pay one rate on every job, 15% of the price rising to 30%.
 * UPDATED : 2026-11-09_0330 UTC — Professional look: tighter spacing (pro: utilities; other looks unchanged).
 * UPDATED : 2026-11-09_1600 UTC — Professional look: line icons instead of emoji (ThemedIcon / Ico switch by look; Original unchanged).
 * UPDATED : 2026-11-10_0430 UTC — "insured pros" → "background-checked, vetted pros" (insurance is only required for services that need it).
 */
import Link from "next/link";
import { Ico } from "@/components/Glyph";
import { firstProjectLine, BRAND, PARTNER_KINDS, PARTNER_LADDER, PARTNER_PROGRAM, REFERRAL_LADDER, referralRange, SALES_TICKET, ladderTable, money, moneyCents, partnerSplit, partnerTerms, tierPct, type PartnerTier } from "@handled/core";
import { PartnerSignUp } from "@/components/PartnerUI";

export const metadata = { title: "Partner Program — refer or sell services and get paid on every job", description: `Refer customers to ${BRAND.name} and earn ${referralRange()} of every job they book for ${PARTNER_PROGRAM.months} months — or sell the job yourself and earn ${PARTNER_LADDER.baseRate * 100}% up to ${PARTNER_LADDER.topRate * 100}% of our profit. Part-time or full-time, paid weekly.` };

// ladder milestones shown on the page (every point is on the partner page and in the Indeed post)
const MILESTONES = [0, 5, 10, 15, 20, 25, 30, 35].map((n) => ladderTable()[n]);

// the rate is a share of the job price, so the example is the same whatever the service
// examples at the starting referral rate (15% of the job price — the same on every service)
const EX = ([
  { who: "Realtor", what: "Sends 3 sellers a month a one-time move-out clean ($350)", jobs: 3, price: 350 },
  { who: "Property manager", what: "Refers their company's account: 8 unit turnovers a month ($450)", jobs: 8, price: 450 },
  { who: "Neighbor", what: "Refers a family on bi-weekly cleaning ($180)", jobs: 2, price: 180 },
] as { who: string; what: string; jobs: number; price: number }[]).map((e) => {
  const per = partnerSplit({ price: e.price, payout: e.price * 0.6, tier: "repeat", rate: REFERRAL_LADDER.baseRate }).amount;
  return { ...e, per, year: Math.round(per * e.jobs * 12) };
});
const REF_MILESTONES = [0, 3, 5, 8, 10, 12, 15].map((n) => ladderTable(REFERRAL_LADDER)[n]);

export default async function Partners({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const P = PARTNER_PROGRAM, L = PARTNER_LADDER;
  const { kind } = await searchParams;
  return (
    <>
      <section className="border-b border-line bg-brand-deep text-white">
        <div className="wrap py-16 pro:py-10">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-gold/40">{BRAND.name} Partner Program</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Send it or sell it. <span className="text-gold-light">Get paid on every job.</span></h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">Realtors, property managers, contractors, business owners, neighbors: anyone can join. Earn {referralRange()} of every job from the customers you refer, for {P.months} months. Or sell the job yourself and earn {L.baseRate * 100}% of our profit, rising to {L.topRate * 100}%. Paid to your bank every week.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#join" className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Become a partner</a><a href="#field-sales" className="btn border border-white/30 px-6 py-3 text-base text-white hover:border-gold-light">Field Sales (part-time or full-time)</a><Link href="/partner" className="btn border border-white/30 px-6 py-3 text-base text-white hover:border-gold-light">Partner sign in</Link></div>
        </div>
      </section>

      <section className="wrap pt-12">
        <h2 className="text-2xl font-bold">Two ways to earn</h2>
        <p className="mt-1 text-sm text-ink-soft">Both build your level: profit from your direct sales counts {L.directCredit}× toward your next raise, from referrals {L.referralCredit}×.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <a href="#referrals" className="card border-t-4 border-t-gold hover:border-brand">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 1 · Referrals</div>
            <h3 className="mt-1 text-lg font-bold">You send them, we sell it</h3>
            <p className="mt-1 text-sm text-ink-soft">Share your link or your code (customers type it when they pay), or fill out a referral ticket. Earn {Math.round(REFERRAL_LADDER.baseRate * 100)}% of every job to start, rising to {Math.round(REFERRAL_LADDER.topRate * 100)}%, for {P.months} months.</p>
          </a>
          <a href="#field-sales" className="card border-t-4 border-t-brand hover:border-brand">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 2 · Direct sales</div>
            <h3 className="mt-1 text-lg font-bold">You sell it, we do it</h3>
            <p className="mt-1 text-sm text-ink-soft">Sell any of our services on a sales ticket from your phone: photos, the sizes, the customer, and the upfront price on the spot. The customer pays right there or from our text — you never handle money. Earn {L.baseRate * 100}% of our profit, rising to {L.topRate * 100}%.</p>
          </a>
        </div>
      </section>

      <section id="referrals" className="wrap scroll-mt-20 grid gap-4 py-12 md:grid-cols-3">
        {[
          ["1", "Share your link or send a ticket", `Use your link (on cards, texts, listings, QR codes) or fill out a referral ticket on your partner page — one standard form, a ticket number you can follow, and we email them a booking link from you.`],
          ["2", "We do the work", `Background-checked, vetted pros, an upfront price, photo proof, and a free redo if anything's missed — so your name looks good.`],
          ["3", "You get paid weekly", `${referralRange()} of the price on every completed job — the same on every service. Paid through Stripe once each job is past our ${P.holdDays}-day guarantee.`],
        ].map(([n, t, d]) => (
          <div key={n} className="card"><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep font-bold text-gold-light">{n}</div><h2 className="mt-3 font-bold">{t}</h2><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}
      </section>

      <section className="wrap pb-12">
        <h2 className="text-2xl font-bold">What you earn</h2>
        <p className="mt-1 text-sm text-ink-soft">One rate on every referred job: a share of what the customer pays. The pro and {BRAND.name} each pay half of it, so it&apos;s the same rate whatever the service.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <div className="card"><div className="text-4xl font-extrabold text-brand-deep">{Math.round(REFERRAL_LADDER.baseRate * 100)}% → {Math.round(REFERRAL_LADDER.topRate * 100)}%</div><div className="mt-1 font-semibold">Of every job from your customers, for {P.months} months</div><p className="text-sm text-ink-soft">You start at {Math.round(REFERRAL_LADDER.baseRate * 100)}% and go up one point at a time as you grow. Each job keeps the rate you had when it was booked.</p></div>
          <div className="card"><table className="w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="py-1">Referral rate</th><th className="py-1 text-right">Level credit</th></tr></thead>
            <tbody>{REF_MILESTONES.map((m) => <tr key={m.level} className="border-t border-line"><td className="py-1.5 font-semibold">{Math.round(m.rate * 100)}%</td><td className="py-1.5 text-right tabular-nums">{m.profit ? `${money(m.profit)}+` : "Day one"}</td></tr>)}</tbody></table>
            <p className="mt-2 text-xs text-ink-soft">Level credit = the lifetime profit you&apos;ve generated for {BRAND.name} (direct sales count {PARTNER_LADDER.directCredit}×), or every {REFERRAL_LADDER.jobsPerStep} job credits up to {Math.round(REFERRAL_LADDER.jobsCapRate * 100)}%.</p></div>
        </div>
        <h3 className="mt-10 pro:mt-8 text-xl font-bold">What it adds up to</h3>
        <p className="mt-1 text-sm text-ink-soft">Examples at the starting rate. Your rate goes up as you grow.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{EX.map((e) => (
          <div key={e.who} className="card border-t-4 border-t-gold">
            <div className="text-sm font-semibold text-brand">{e.who}</div>
            <p className="mt-1 text-sm">{e.what}</p>
            <div className="mt-3 text-3xl font-extrabold">{money(e.year)}<span className="text-base font-semibold text-ink-soft"> /year</span></div>
            <p className="text-xs text-ink-soft">{Math.round(REFERRAL_LADDER.baseRate * 100)}% = {moneyCents(e.per)} per job × {e.jobs}/month, at the starting rate</p>
          </div>
        ))}</div>
      </section>

      <section id="field-sales" className="scroll-mt-20 border-t border-line">
        <div className="wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <span className="text-sm font-semibold text-brand">Way 2 · Direct sales (Field Sales) · part-time or full-time</span>
            <h2 className="mt-1 text-2xl font-bold">Find the work. Close it. Get paid when it&apos;s done.</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              <li>Meet a homeowner, landlord or business with a job: a fence, a yard, a deep clean, a roof, a website.</li>
              <li>With their OK, take {SALES_TICKET.minPhotos}–{SALES_TICKET.maxPhotos} photos (none needed for remote services) and fill out the sales ticket: the service and sizes, when they need it, the address, and that you spoke with the person who pays. Our AI suggests the service from the photos.</li>
              <li>You see the upfront price on the spot. Close it right there (they pay on your phone) or we text them the pay link. They pay {BRAND.name} directly — you never handle money.</li>
              <li>Once it&apos;s paid, the job goes to the job board and a vetted pro does it.</li>
              <li>When it&apos;s completed, your commission is locked in at your current rate and paid weekly after our {P.holdDays}-day guarantee. Their repeat visits for {P.months} months pay you the same way.</li>
            </ol>
            <p className="mt-4 text-sm text-ink-soft">Set your own hours. You&apos;re an independent partner (1099), not an employee; no fee, no quota. {BRAND.name} pays your direct-sales commission in full — the pro pays nothing toward it.</p>
          </div>
          <div className="card">
            <h3 className="font-bold">Your direct-sales rate climbs as you grow</h3>
            <p className="mt-1 text-sm text-ink-soft">Every level is +1 point of our profit. Your level comes from the lifetime profit you&apos;ve generated for {BRAND.name} (direct sales count {L.directCredit}×, referrals {L.referralCredit}×), or every {L.jobsPerStep} job credits up to {L.jobsCapRate * 100}%. Levels never go down.</p>
            <table className="mt-3 w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="py-1">Your rate</th><th className="py-1 text-right">Level credit</th></tr></thead>
              <tbody>{MILESTONES.map((m) => <tr key={m.level} className="border-t border-line"><td className="py-1.5 font-semibold">{Math.round(m.rate * 100)}%</td><td className="py-1.5 text-right tabular-nums">{m.profit ? `${money(m.profit)}+` : "Day one"}</td></tr>)}</tbody>
            </table>
            <p className="mt-2 text-xs text-ink-soft">Profit = the job price minus what the pro is paid and any refunds. Example: a $400 job where the pro is paid $300 is $100 of profit — $10 to you at 10%, $45 at 45%.</p>
          </div>
        </div>
      </section>

      <section id="join" className="scroll-mt-20 border-t border-line bg-paper">
        <div className="wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Join in two minutes</h2>
            <p className="mt-2 text-sm text-ink-soft">No fee, no quota. You get your link right away.</p>
            <p className="mt-2 text-sm"><Ico i="📝" /><b>Got a project of your own?</b> <a href="/post" className="font-semibold text-brand underline">Post it</a>, tick the partner box and get {firstProjectLine()} on your first project.</p>
            <div className="mt-4"><PartnerSignUp kinds={Object.entries(PARTNER_KINDS).filter(([k]) => k !== "pro")} defaultKind={kind && kind in PARTNER_KINDS && kind !== "pro" ? kind : undefined} /></div>
          </div>
          <div>
            <h2 className="text-lg font-bold">Partner terms <span className="text-xs font-normal text-ink-soft">({P.termsVersion})</span></h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">{partnerTerms().map((t, i) => <li key={i}>{t}</li>)}</ol>
          </div>
        </div>
      </section>
    </>
  );
}
