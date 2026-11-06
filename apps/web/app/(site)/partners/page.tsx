/*
 * FILE    : apps/web/app/(site)/partners/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0130 UTC
 * PURPOSE : Public page for the Referral Partner Program: what partners earn (10% of our fee, 12 months, weekly via
 *           Stripe), who it's for, worked examples, sign-up form and the partner terms.
 * UPDATED : 2026-10-09_0300 UTC — Handled +5 points paid by customers (commission about 20% → 37%, take band 15–40%; pro pay unchanged).
 * UPDATED : 2026-10-23_1500 UTC — #join clears the sticky header (the home page's Become a Partner button links straight here).
 * UPDATED : 2026-11-06_1638 UTC — Field Sales: the 10%→45% ladder (45% at $1M profit generated), photo tickets, and
 *           ?kind=sales_rep pre-selects "Field Sales partner" (the Indeed post links to /partners?kind=sales_rep#join).
 */
import Link from "next/link";
import { BRAND, PARTNER_KINDS, PARTNER_LADDER, PARTNER_PROGRAM, SALES_TICKET, ladderTable, money, partnerCommission, partnerTerms } from "@handled/core";
import { PartnerSignUp } from "@/components/PartnerUI";

export const metadata = { title: "Referral Partner Program — get paid for every job you send us", description: `Refer customers to ${BRAND.name} and earn ${PARTNER_LADDER.baseRate * 100}%–${PARTNER_LADDER.topRate * 100}% of our profit on every job they book for ${PARTNER_PROGRAM.months} months, paid weekly. Field Sales: part-time or full-time.` };

// ladder milestones shown on the page (the full table is on the partner page and in the Indeed post)
const MILESTONES = [0, 5, 10, 15, 20, 25, 30, 35].map((n) => ladderTable()[n]);

// examples assume we keep about a quarter of the price (our take ranges about 20–40% by service)
const EX = [
  { who: "Realtor", what: "Sends 3 sellers a month a move-out clean ($350)", jobs: 3, price: 350 },
  { who: "Property manager", what: "8 unit turnovers a month ($450)", jobs: 8, price: 450 },
  { who: "Neighbor", what: "Refers a family on bi-weekly cleaning ($180)", jobs: 2, price: 180 },
].map((e) => {
  const per = partnerCommission({ price: e.price, payout: e.price * 0.75 });
  return { ...e, per, year: Math.round(per * e.jobs * 12) };
});

export default async function Partners({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const P = PARTNER_PROGRAM, L = PARTNER_LADDER;
  const { kind } = await searchParams;
  return (
    <>
      <section className="border-b border-line bg-brand-deep text-white">
        <div className="wrap py-16">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-gold/40">{BRAND.name} Partner Program</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Send us a job. <span className="text-gold-light">Get paid on it.</span></h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">Realtors, property managers, contractors, business owners, neighbors: anyone can join. Earn {L.baseRate * 100}% of our profit on every job from the customers you bring us, rising to {L.topRate * 100}% as you grow, for a full {P.months} months per customer, paid to your bank every week. Want to do it as a part-time or full-time job? <a href="#field-sales" className="underline">Field Sales</a>.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#join" className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Become a partner</a><Link href="/partner" className="btn border border-white/30 px-6 py-3 text-base text-white hover:border-gold-light">Partner sign in</Link></div>
        </div>
      </section>

      <section className="wrap py-12">
        <h2 className="text-2xl font-bold">Two ways to earn</h2>
        <p className="mt-1 text-sm text-ink-soft">Same pay for both: {L.baseRate * 100}% of our profit to start, rising to {L.topRate * 100}%. Both count toward your next raise.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="card border-t-4 border-t-brand">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 1 · Direct sales</div>
            <h3 className="mt-1 text-lg font-bold">You sell it, we do it</h3>
            <p className="mt-1 text-sm text-ink-soft">Sell any of our services: cleaning, lawn, hauling, repairs, remodels, websites and more. Write a ticket on your phone: {SALES_TICKET.minPhotos}–{SALES_TICKET.maxPhotos} photos for on-site work, the sizes, the customer and when they need it. You see the upfront price and can close right there: the customer pays on your phone, or from the text we send. You never handle money.</p>
            <a href="#field-sales" className="mt-3 inline-block text-sm font-semibold text-brand underline">How direct sales work →</a>
          </div>
          <div className="card border-t-4 border-t-gold">
            <div className="text-xs font-semibold uppercase tracking-wide text-brand">Way 2 · Referrals</div>
            <h3 className="mt-1 text-lg font-bold">You send them, we sell it</h3>
            <p className="mt-1 text-sm text-ink-soft">Share your link (cards, texts, listings, QR codes), give out your code (customers type it when they pay), or enter a customer on your partner page and we email them from you. Every completed job from that customer pays you for {P.months} months, repeat and recurring visits included.</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-ink-soft">Either way: insured, background-checked pros, an upfront price, photo proof, and a free redo if anything&apos;s missed. You&apos;re paid weekly through Stripe once each job is past our {P.holdDays}-day guarantee.</p>
      </section>

      <section className="wrap pb-12">
        <h2 className="text-2xl font-bold">What it adds up to</h2>
        <p className="mt-1 text-sm text-ink-soft">Examples. Our fee is what&apos;s left after the pro is paid (about 20–40% of the price, depending on the service); you start at {L.baseRate * 100}% of it. These examples use the starting rate; your rate rises as you grow.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{EX.map((e) => (
          <div key={e.who} className="card border-t-4 border-t-gold">
            <div className="text-sm font-semibold text-brand">{e.who}</div>
            <p className="mt-1 text-sm">{e.what}</p>
            <div className="mt-3 text-3xl font-extrabold">{money(e.year)}<span className="text-base font-semibold text-ink-soft"> /year</span></div>
            <p className="text-xs text-ink-soft">≈ {money(e.per)} per job × {e.jobs}/month</p>
          </div>
        ))}</div>
      </section>

      <section id="field-sales" className="scroll-mt-20 border-t border-line">
        <div className="wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <span className="text-sm font-semibold text-brand">Field Sales · part-time or full-time</span>
            <h2 className="mt-1 text-2xl font-bold">Find the work. Snap it. Get paid when it&apos;s done.</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              <li>Meet a homeowner, landlord or business with a job — a fence, a yard, a deep clean, a roof, a move-out.</li>
              <li>With their OK, take {SALES_TICKET.minPhotos}–{SALES_TICKET.maxPhotos} photos (none needed for remote services like websites) and fill out the ticket: the service and sizes, when they need it, the address, and that you spoke with the person who pays. Our AI suggests the service from the photos.</li>
              <li>You see the upfront price on the spot. Close it right there (they pay on your phone) or we text them the pay link. They pay {BRAND.name} directly — you never handle money.</li>
              <li>Once it&apos;s paid, the job goes to the job board and a vetted pro does it.</li>
              <li>When it&apos;s completed, your commission is locked in at your current rate and paid weekly after our {P.holdDays}-day guarantee.</li>
            </ol>
            <p className="mt-4 text-sm text-ink-soft">Set your own hours. You&apos;re an independent partner (1099), not an employee; no fee, no quota.</p>
          </div>
          <div className="card">
            <h3 className="font-bold">Your rate climbs as you grow</h3>
            <p className="mt-1 text-sm text-ink-soft">Every level is +1 point of our profit. Your level comes from the lifetime profit you&apos;ve generated for {BRAND.name} — or every {L.jobsPerStep} completed jobs, up to {L.jobsCapRate * 100}%. Levels never go down.</p>
            <table className="mt-3 w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="py-1">Your rate</th><th className="py-1 text-right">Lifetime profit generated</th></tr></thead>
              <tbody>{MILESTONES.map((m) => <tr key={m.level} className="border-t border-line"><td className="py-1.5 font-semibold">{Math.round(m.rate * 100)}%</td><td className="py-1.5 text-right tabular-nums">{m.profit ? `${money(m.profit)}+` : "Day one"}</td></tr>)}</tbody>
            </table>
            <p className="mt-2 text-xs text-ink-soft">Profit = the job price minus what the pro is paid and any refunds. Every point in between is on your partner page.</p>
          </div>
        </div>
      </section>

      <section id="join" className="scroll-mt-20 border-t border-line bg-paper">
        <div className="wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Join in two minutes</h2>
            <p className="mt-2 text-sm text-ink-soft">No fee, no quota. You get your link right away.</p>
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
