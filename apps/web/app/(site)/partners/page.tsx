/*
 * FILE    : apps/web/app/(site)/partners/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0130 UTC
 * PURPOSE : Public page for the Referral Partner Program: what partners earn (25% one-time / 10% repeat / 15% account,
 *           of the job price, weekly via Stripe), who it's for, worked examples, sign-up form and the partner terms.
 * UPDATED : 2026-10-09_0300 UTC — Handled +5 points paid by customers (commission about 20% → 37%, take band 15–40%; pro pay unchanged).
 * UPDATED : 2026-10-23_1500 UTC — #join clears the sticky header (the home page's Become a Partner button links straight here).
 * UPDATED : 2026-10-28_0122 UTC — partner-v2: fixed rates of the job price (same on every service), referral ticket.
 */
import Link from "next/link";
import { BRAND, PARTNER_KINDS, PARTNER_PROGRAM, PARTNER_TIERS, money, moneyCents, partnerSplit, partnerTerms, tierPct, type PartnerTier } from "@handled/core";
import { PartnerSignUp } from "@/components/PartnerUI";

export const metadata = { title: "Referral Partner Program — get paid for every job you send us", description: `Refer customers to ${BRAND.name} and earn ${tierPct("one_time")} of a one-time job, ${tierPct("repeat")} of repeat jobs or ${tierPct("account")} of a business account's jobs for ${PARTNER_PROGRAM.months} months, paid weekly.` };

// the rate is a share of the job price, so the example is the same whatever the service
const EX = ([
  { who: "Realtor", what: "Sends 3 sellers a month a one-time move-out clean ($350)", jobs: 3, price: 350, tier: "one_time" },
  { who: "Property manager", what: "Refers their company's account: 8 unit turnovers a month ($450)", jobs: 8, price: 450, tier: "account" },
  { who: "Neighbor", what: "Refers a family on bi-weekly cleaning ($180)", jobs: 2, price: 180, tier: "repeat" },
] as { who: string; what: string; jobs: number; price: number; tier: PartnerTier }[]).map((e) => {
  const per = partnerSplit({ price: e.price, payout: e.price * 0.6, tier: e.tier }).amount;
  return { ...e, per, year: Math.round(per * e.jobs * 12) };
});

export default function Partners() {
  const P = PARTNER_PROGRAM;
  return (
    <>
      <section className="border-b border-line bg-brand-deep text-white">
        <div className="wrap py-16">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-gold/40">{BRAND.name} Partner Program</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Send us a job. <span className="text-gold-light">Get paid on it.</span></h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">Realtors, property managers, contractors, business owners, neighbors: anyone can join. Earn {tierPct("one_time")} of a one-time job, {tierPct("repeat")} of every repeat job for {P.months} months, or {tierPct("account")} of every job on a business account you bring us — paid to your bank every week.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#join" className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Become a partner</a><Link href="/partner" className="btn border border-white/30 px-6 py-3 text-base text-white hover:border-gold-light">Partner sign in</Link></div>
        </div>
      </section>

      <section className="wrap grid gap-4 py-12 md:grid-cols-3">
        {[
          ["1", "Share your link or send a ticket", `Use your link (on cards, texts, listings, QR codes) or fill out a referral ticket on your partner page — one standard form, a ticket number you can follow, and we email them a booking link from you.`],
          ["2", "We do the work", `Insured, background-checked pros, an upfront price, photo proof, and a free redo if anything's missed — so your name looks good.`],
          ["3", "You get paid weekly", `A fixed share of the price on every completed job — the same on every service. Paid through Stripe once each job is past our ${P.holdDays}-day guarantee.`],
        ].map(([n, t, d]) => (
          <div key={n} className="card"><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep font-bold text-gold-light">{n}</div><h2 className="mt-3 font-bold">{t}</h2><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}
      </section>

      <section className="wrap pb-12">
        <h2 className="text-2xl font-bold">What you earn</h2>
        <p className="mt-1 text-sm text-ink-soft">A share of what the customer pays for the job. The pro and {BRAND.name} each pay half of it, so it&apos;s the same rate whatever the service.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{(Object.keys(PARTNER_TIERS) as PartnerTier[]).map((t) => (
          <div key={t} className="card"><div className="text-4xl font-extrabold text-brand-deep">{tierPct(t)}</div><div className="mt-1 font-semibold">{PARTNER_TIERS[t].label}</div><p className="text-sm text-ink-soft">Of {PARTNER_TIERS[t].detail}.</p></div>
        ))}</div>
        <h3 className="mt-10 text-xl font-bold">What it adds up to</h3>
        <p className="mt-1 text-sm text-ink-soft">Examples.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{EX.map((e) => (
          <div key={e.who} className="card border-t-4 border-t-gold">
            <div className="text-sm font-semibold text-brand">{e.who}</div>
            <p className="mt-1 text-sm">{e.what}</p>
            <div className="mt-3 text-3xl font-extrabold">{money(e.year)}<span className="text-base font-semibold text-ink-soft"> /year</span></div>
            <p className="text-xs text-ink-soft">{tierPct(e.tier)} = {moneyCents(e.per)} per job × {e.jobs}/month</p>
          </div>
        ))}</div>
      </section>

      <section id="join" className="scroll-mt-20 border-t border-line bg-paper">
        <div className="wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Join in two minutes</h2>
            <p className="mt-2 text-sm text-ink-soft">No fee, no quota. You get your link right away.</p>
            <div className="mt-4"><PartnerSignUp kinds={Object.entries(PARTNER_KINDS).filter(([k]) => k !== "pro")} /></div>
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
