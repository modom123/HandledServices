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
 * UPDATED : 2026-11-17_2100 UTC — links the full Referral Partner Agreement.
 * UPDATED : 2026-11-17_2015 UTC — partner-v7 one program (the old Field Sales formula from 15%): 15% → 45% of our profit on every
 *           job, direct sales + 5 points (20% → 50%), level n at $1M × (n/30)², paid by Handled alone.
 * UPDATED : 2026-11-18_0125 UTC — merged with partner-v7 (its rates and ladder stay); a link to the Handled Sales Force for people selling for a living.
 * UPDATED : 2026-11-24_1700 UTC — two clear paths (owner): Path 1 · Refer (15% → 45%, its own chart) and Path 2 · Sell, the Sales
 *           Force (20% → 50%, titles, bonuses; its chart lives on /careers/sales). The second rate table is gone, so there's one
 *           chart per path. Pay rules unchanged.
 * UPDATED : 2026-11-27_2000 UTC — copy made concise (owner): same structure and numbers, about half the words; the short
 *           terms fold behind "Read the terms" (same wording).
 * UPDATED : 2026-11-27_2100 UTC — the two paths flow to their own pages (owner): /partners is the choice (two big buttons);
 *           Path 1 · Refer → /partners/refer (how it works, pay, sign-up), Path 2 · Sell → /careers/sales (its own sign-up).
 *           ?kind= links go to the right path's sign-up.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Ico } from "@/components/Glyph";
import { BRAND, FAST_MONEY, PARTNER_LADDER, PARTNER_PROGRAM, REFERRAL_LADDER, firstProjectLine, referralRange } from "@handled/core";

export const metadata = { title: "Partner Program — refer or sell, get paid on every job", description: `Refer customers and earn ${referralRange()} of our profit on their jobs for ${PARTNER_PROGRAM.months} months, or sell jobs yourself for ${Math.round(PARTNER_LADDER.baseRate * 100)}–${Math.round(PARTNER_LADDER.topRate * 100)}%. Paid weekly.` };

export default async function Partners({ searchParams }: { searchParams: Promise<{ kind?: string; leader?: string }> }) {
  const { kind, leader } = await searchParams;
  // old links (/partners?kind=…#join) land on the right path's sign-up
  if (kind === "sales_rep") redirect(`/careers/sales${leader ? `?leader=${encodeURIComponent(leader)}` : ""}#join`);
  if (kind) redirect(`/partners/refer?kind=${encodeURIComponent(kind)}#join`);
  const P = PARTNER_PROGRAM, L = PARTNER_LADDER;
  const paths = [
    { href: "/partners/refer", tag: "Path 1 · Refer", title: "You send them, we sell it", body: "Share your link. We book and do the job.", rate: `${Math.round(REFERRAL_LADDER.baseRate * 100)}% → ${Math.round(REFERRAL_LADDER.topRate * 100)}%`, fine: `of our profit, for ${P.months} months · no quota`, cta: "Refer →", border: "border-t-gold" },
    { href: "/careers/sales", tag: `Path 2 · Sell · the ${BRAND.name} Sales Force`, title: "You sell it, we do it", body: "Find the job and close it on your phone. Your own hours.", rate: `${Math.round(L.baseRate * 100)}% → ${Math.round(L.topRate * 100)}%`, fine: `of our profit · $${FAST_MONEY.firstSale} first-sale bonus · career path`, cta: "Sell →", border: "border-t-brand" },
  ];
  return (
    <>
      <section className="border-b border-line bg-brand-deep text-white">
        <div className="wrap py-16 pro:py-10">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-light ring-1 ring-gold/40">{BRAND.name} Partner Program</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Send it or sell it. <span className="text-gold-light">Get paid on every job.</span></h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">Two paths. Pick one to see how it works and sign up. Paid weekly.</p>
        </div>
      </section>
      <section className="wrap py-12">
        <div className="grid gap-4 md:grid-cols-2">
          {paths.map((x) => (
            <Link key={x.href} href={x.href} className={`card border-t-4 ${x.border} p-6 transition hover:border-brand hover:shadow-lg`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand">{x.tag}</div>
              <h2 className="mt-1 text-2xl font-bold">{x.title}</h2>
              <p className="mt-1 text-ink-soft">{x.body}</p>
              <div className="mt-4 text-4xl font-extrabold text-brand-deep">{x.rate}</div>
              <p className="text-xs text-ink-soft">{x.fine}</p>
              <span className="btn-primary mt-5 inline-block px-6 py-2.5">{x.cta}</span>
            </Link>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link href="/partner" className="font-semibold text-brand underline">Already a partner? Sign in</Link>
          <span><Ico i="📝" /><b>Got a project?</b> <a href="/post" className="font-semibold text-brand underline">Get it Handled</a>, tick the partner box and get {firstProjectLine()}.</span>
        </div>
      </section>
    </>
  );
}
