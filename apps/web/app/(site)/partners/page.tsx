/*
 * FILE    : apps/web/app/(site)/partners/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0130 UTC
 * PURPOSE : Public page for the Referral Partner Program: what partners earn (10% of our fee, 12 months, weekly via
 *           Stripe), who it's for, worked examples, sign-up form and the partner terms.
 * UPDATED : 2026-10-22_0400 UTC — three ways to earn: refer a person (10%, 12 months), a referral ticket for a one-time job (20%)
 *           or a recurring job (15% every visit, 12 months); open to Handled pros and clients too.
 * UPDATED : 2026-10-09_0300 UTC — Handled +5 points paid by customers (commission about 20% → 37%, take band 15–40%; pro pay unchanged).
 */
import Link from "next/link";
import { BRAND, PARTNER_KINDS, PARTNER_PROGRAM, money, partnerCommission, partnerTerms, pctLabel } from "@handled/core";
import { PartnerSignUp } from "@/components/PartnerUI";

export const metadata = { title: "Referral Partner Program — get paid for every job you send us", description: `Send ${BRAND.name} a job and earn ${pctLabel(PARTNER_PROGRAM.jobOncePct)}% of our fee, ${pctLabel(PARTNER_PROGRAM.jobRecurringPct)}% on every visit of a recurring job, or ${pctLabel(PARTNER_PROGRAM.pctOfTake)}% of every job from a person you refer — for ${PARTNER_PROGRAM.months} months, paid weekly.` };

// examples assume we keep about a quarter of the price (our take ranges about 20–40% by service)
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
          <p className="mt-4 max-w-2xl text-lg text-white/75">Realtors, property managers, contractors, business owners, neighbors, {BRAND.name} pros and clients: anyone can join. Send us a job and earn {pctLabel(P.jobOncePct)}% of our fee, {pctLabel(P.jobRecurringPct)}% on every visit if it repeats — or refer a person and earn {pctLabel(P.pctOfTake)}% of everything they book for {P.months} months. Paid to your bank every week.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#join" className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Become a partner</a><Link href="/partner" className="btn border border-white/30 px-6 py-3 text-base text-white hover:border-gold-light">Partner sign in</Link></div>
        </div>
      </section>

      <section className="wrap pt-12">
        <h2 className="text-2xl font-bold">Three ways to earn</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{[
          [`${pctLabel(P.jobOncePct)}%`, "A one-time job", "Fill out a referral ticket for one job — a move-out clean, a tree, a repaint. You earn on that job."],
          [`${pctLabel(P.jobRecurringPct)}%`, "A recurring job", `Weekly cleaning, monthly lawn care, quarterly gutters: you earn on every visit for ${P.months} months.`],
          [`${pctLabel(P.pctOfTake)}%`, "A person", `Share your link or send a customer. You earn on every job they book, anything, for ${P.months} months.`],
        ].map(([pct, t, d]) => (
          <div key={t} className="card border-t-4 border-t-gold"><div className="text-3xl font-extrabold">{pct}<span className="text-base font-semibold text-ink-soft"> of our fee</span></div><h3 className="mt-1 font-bold">{t}</h3><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}</div>
        <p className="mt-2 text-xs text-ink-soft">Our fee is what&apos;s left after the pro is paid. Your commission comes out of our share — never the pro&apos;s pay.</p>
      </section>

      <section className="wrap grid gap-4 py-12 md:grid-cols-3">
        {[
          ["1", "Send a ticket, a customer or your link", `Fill out a referral ticket with the job's details (our AI files it and sends the customer a pre-filled booking link), enter a customer, or share your link on cards, texts and listings.`],
          ["2", "We do the work", `Insured, background-checked pros, an upfront price, photo proof, and a free redo if anything's missed — so your name looks good.`],
          ["3", "You get paid weekly", `Every completed job you referred pays you through Stripe once it's past our ${P.holdDays}-day guarantee. You hear from us when it's booked, assigned and done.`],
        ].map(([n, t, d]) => (
          <div key={n} className="card"><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep font-bold text-gold-light">{n}</div><h2 className="mt-3 font-bold">{t}</h2><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}
      </section>

      <section className="wrap pb-12">
        <h2 className="text-2xl font-bold">What it adds up to</h2>
        <p className="mt-1 text-sm text-ink-soft">Examples for referring a person. Our fee is what&apos;s left after the pro is paid (about 20–40% of the price, depending on the service); you get {pctLabel(P.pctOfTake)}% of it — {pctLabel(P.jobOncePct)}% or {pctLabel(P.jobRecurringPct)}% when you send the job on a ticket.</p>
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
            <p className="mt-2 text-sm text-ink-soft">No fee, no quota. You get your link right away. Already a {BRAND.name} pro or client? <Link href="/partner" className="underline">Sign in and join in one tap</Link>.</p>
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
