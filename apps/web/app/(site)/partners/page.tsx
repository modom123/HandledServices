/*
 * FILE    : apps/web/app/(site)/partners/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0130 UTC
 * PURPOSE : Public page for the Referral Partner Program: what partners earn (10% of our fee, 12 months, weekly via
 *           Stripe), who it's for, worked examples, sign-up form and the partner terms.
 */
import Link from "next/link";
import { BRAND, PARTNER_KINDS, PARTNER_PROGRAM, money, partnerCommission, partnerTerms } from "@handled/core";
import { PartnerSignUp } from "@/components/PartnerUI";

export const metadata = { title: "Referral Partner Program — get paid for every job you send us", description: `Refer customers to ${BRAND.name} and earn ${PARTNER_PROGRAM.pctOfTake * 100}% of our fee on every job they book for ${PARTNER_PROGRAM.months} months, paid weekly.` };

// examples assume we keep about a quarter of the price (our take ranges 15–35% by service)
const EX = [
  { who: "Realtor", what: "Sends 3 sellers a month a move-out clean ($350)", jobs: 3, price: 350 },
  { who: "Property manager", what: "8 unit turnovers a month ($450)", jobs: 8, price: 450 },
  { who: "Neighbor", what: "Refers a family on bi-weekly cleaning ($180)", jobs: 2, price: 180 },
].map((e) => {
  const per = partnerCommission({ price: e.price, payout: e.price * 0.75 });
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
          <p className="mt-4 max-w-2xl text-lg text-white/75">Realtors, property managers, contractors, business owners, neighbors: anyone can join. Earn {P.pctOfTake * 100}% of our fee on every job from the customers you refer, for a full {P.months} months, paid to your bank every week.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#join" className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Become a partner</a><Link href="/partner" className="btn border border-white/30 px-6 py-3 text-base text-white hover:border-gold-light">Partner sign in</Link></div>
        </div>
      </section>

      <section className="wrap grid gap-4 py-12 md:grid-cols-3">
        {[
          ["1", "Share your link or send a customer", `Use your link (on cards, texts, listings, QR codes) or enter a customer on your partner page and we email them a booking link from you.`],
          ["2", "We do the work", `Insured, background-checked pros, an upfront price, photo proof, and a free redo if anything's missed — so your name looks good.`],
          ["3", "You get paid weekly", `${P.pctOfTake * 100}% of our fee on every completed job for ${P.months} months — including repeat and recurring visits. Paid through Stripe once each job is past our ${P.holdDays}-day guarantee.`],
        ].map(([n, t, d]) => (
          <div key={n} className="card"><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep font-bold text-gold-light">{n}</div><h2 className="mt-3 font-bold">{t}</h2><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}
      </section>

      <section className="wrap pb-12">
        <h2 className="text-2xl font-bold">What it adds up to</h2>
        <p className="mt-1 text-sm text-ink-soft">Examples. Our fee is what&apos;s left after the pro is paid (about 15–35% of the price, depending on the service); you get {P.pctOfTake * 100}% of it.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{EX.map((e) => (
          <div key={e.who} className="card border-t-4 border-t-gold">
            <div className="text-sm font-semibold text-brand">{e.who}</div>
            <p className="mt-1 text-sm">{e.what}</p>
            <div className="mt-3 text-3xl font-extrabold">{money(e.year)}<span className="text-base font-semibold text-ink-soft"> /year</span></div>
            <p className="text-xs text-ink-soft">≈ {money(e.per)} per job × {e.jobs}/month</p>
          </div>
        ))}</div>
      </section>

      <section id="join" className="border-t border-line bg-paper">
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
