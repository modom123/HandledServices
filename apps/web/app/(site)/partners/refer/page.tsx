/*
 * FILE    : apps/web/app/(site)/partners/refer/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-27_2100 UTC
 * PURPOSE : Partner Program · Path 1 · Refer, on its own page (owner, 2026-11-27: the 2 path buttons on /partners should go to
 *           that path's page). How referring works, what it pays (one chart), examples, and the sign-up form for referring
 *           only, with the short terms. Path 2 · Sell lives on /careers/sales. ?kind= preselects who you are.
 */
import Link from "next/link";
import { Ico } from "@/components/Glyph";
import { FAST_MONEY, programCommission, firstProjectLine, BRAND, PARTNER_KINDS, PARTNER_LADDER, PARTNER_PROGRAM, REFERRAL_LADDER, referralRange, SALES_TICKET, ladderTable, money, moneyCents, partnerSplit, partnerTerms, tierPct, type PartnerTier } from "@handled/core";
import { PartnerSignUp } from "@/components/PartnerUI";


export const metadata = { alternates: { canonical: "/partners/refer" }, title: "Refer customers, get paid on every job", description: `Refer customers to ${BRAND.name} and earn ${referralRange()} of our profit on their jobs for ${PARTNER_PROGRAM.months} months. Paid weekly.` };

// examples at the starting rate: 15% of our profit (about 32% of a typical job's price)
const EX = ([
  { who: "Realtor", what: "Sends 3 sellers a month a one-time move-out clean ($350)", jobs: 3, price: 350 },
  { who: "Property manager", what: "Refers their company's account: 8 unit turnovers a month ($450)", jobs: 8, price: 450 },
  { who: "Neighbor", what: "Refers a family on bi-weekly cleaning ($180)", jobs: 2, price: 180 },
] as { who: string; what: string; jobs: number; price: number }[]).map((e) => {
  const per = programCommission({ price: e.price, payout: Math.round(e.price * 0.68 * 100) / 100 }, REFERRAL_LADDER.baseRate); // our profit ≈ 32% of a typical job
  return { ...e, per, year: Math.round(per * e.jobs * 12) };
});
const REF_MILESTONES = [0, 1, 3, 5, 10, 15, 20, 25, 30].map((n) => ladderTable(REFERRAL_LADDER)[n]);

export default async function ReferPath({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const P = PARTNER_PROGRAM;
  const { kind } = await searchParams;
  return (
    <>
      <section className="border-b border-line bg-brand-deep text-white">
        <div className="wrap py-12 pro:py-8">
          <Link href="/partners" className="text-sm text-white/70 hover:text-white">← Partner Program</Link>
          <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-gold-light">Path 1 · Refer</div>
          <h1 className="mt-1 max-w-3xl text-4xl font-extrabold leading-tight">You send them. We sell it and do it. <span className="text-gold-light">You get paid.</span></h1>
          <p className="mt-3 max-w-2xl text-lg text-white/75">{referralRange()} of our profit on every job from your customers, for {P.months} months. No quota.</p>
          <a href="#join" className="btn mt-6 bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Sign up to refer</a>
        </div>
      </section>

      <section id="referrals" className="wrap scroll-mt-20 grid gap-4 py-12 md:grid-cols-3">
        {[
          ["1", "Share your link", "On cards, texts, listings or a QR code. Or send a referral ticket from your partner page."],
          ["2", "We do the work", "Vetted pros, an upfront price, photo proof and a free redo if anything's missed."],
          ["3", "You get paid weekly", `${referralRange()} of our profit on each completed job, after our ${P.holdDays}-day guarantee.`],
        ].map(([n, t, d]) => (
          <div key={n} className="card"><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-deep font-bold text-gold-light">{n}</div><h2 className="mt-3 font-bold">{t}</h2><p className="mt-1 text-sm text-ink-soft">{d}</p></div>
        ))}
      </section>

      <section className="wrap pb-12">
        <h2 className="text-2xl font-bold">Path 1 · What referring earns</h2>
        <p className="mt-1 text-sm text-ink-soft">A share of our profit on each job (price minus pro pay and refunds). The pro&apos;s pay is never cut.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1.4fr]">
          <div className="card"><div className="text-4xl font-extrabold text-brand-deep">{Math.round(REFERRAL_LADDER.baseRate * 100)}% → {Math.round(REFERRAL_LADDER.topRate * 100)}%</div><div className="mt-1 font-semibold">Of our profit on every job from your customers, for {P.months} months</div><p className="text-sm text-ink-soft">Start at {Math.round(REFERRAL_LADDER.baseRate * 100)}% and go up as you grow. Each job keeps the rate it was booked at.</p></div>
          <div className="card"><table className="w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="py-1">Referral rate</th><th className="py-1 text-right">Level credit</th></tr></thead>
            <tbody>{REF_MILESTONES.map((m) => <tr key={m.level} className="border-t border-line"><td className="py-1.5 font-semibold">{Math.round(m.rate * 100)}%</td><td className="py-1.5 text-right tabular-nums">{m.profit ? `${money(m.profit)}+` : "Day one"}</td></tr>)}</tbody></table>
            <p className="mt-2 text-xs text-ink-soft">Level credit = lifetime profit from your completed jobs.</p></div>
        </div>
        <h3 className="mt-10 pro:mt-8 text-xl font-bold">What it adds up to</h3>
        <p className="mt-1 text-sm text-ink-soft">At the starting rate.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">{EX.map((e) => (
          <div key={e.who} className="card border-t-4 border-t-gold">
            <div className="text-sm font-semibold text-brand">{e.who}</div>
            <p className="mt-1 text-sm">{e.what}</p>
            <div className="mt-3 text-3xl font-extrabold">{money(e.year)}<span className="text-base font-semibold text-ink-soft"> /year</span></div>
            <p className="text-xs text-ink-soft">{Math.round(REFERRAL_LADDER.baseRate * 100)}% = {moneyCents(e.per)} per job × {e.jobs}/month, at the starting rate</p>
          </div>
        ))}</div>
      </section>

      <section id="join" className="scroll-mt-20 border-t border-line bg-paper">
        <div className="wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Sign up to refer</h2>
            <p className="mt-2 text-sm text-ink-soft">No fee, no quota. You get your link right away.</p>
            <p className="mt-2 text-sm"><Ico i="📝" /><b>Got a project?</b> <a href="/post" className="font-semibold text-brand underline">Get it Handled</a>, tick the partner box and get {firstProjectLine()}.</p>
            <div className="mt-4"><PartnerSignUp path="refer" kinds={Object.entries(PARTNER_KINDS).filter(([k]) => k !== "pro" && k !== "sales_rep")} defaultKind={kind && kind in PARTNER_KINDS && kind !== "pro" && kind !== "sales_rep" ? kind : undefined} /></div>
          </div>
          <div>
            <h2 className="text-lg font-bold">Partner terms <span className="text-xs font-normal text-ink-soft">({P.termsVersion})</span></h2>
            <p className="mt-1 text-sm">The short terms are below; the full terms are in the <a href="/terms/referral-partner-agreement" className="font-semibold text-brand underline">Referral Partner Agreement</a>. You agree to them when you sign up.</p>
            <details className="mt-3 rounded-xl border border-line bg-white p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-brand">Read the terms ({partnerTerms().length} points)</summary>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">{partnerTerms().map((t, i) => <li key={i}>{t}</li>)}</ol>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
