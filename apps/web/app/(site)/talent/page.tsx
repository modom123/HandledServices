/*
 * FILE    : apps/web/app/(site)/talent/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Handled Talent — recruiting for companies (contingency and retained search). How it works, the fees
 *           (from core TALENT_TERMS), the guarantee, fair-hiring promise, the founder's background, and the intake form.
 *           Recruiters are pointed to apply as pros (trade: Recruiter).
 */
import Link from "next/link";
import { BRAND, FAIR_HIRING_RULES, TALENT_TERMS as T } from "@handled/core";
import { TalentRequestForm } from "@/components/TalentUI";

export const metadata = { title: "Handled Talent — recruiting for your company", description: `Contingency and retained search in Metro Detroit and beyond: ${T.contingencyPct}% only if you hire, ${T.guaranteeDays}-day guarantee, candidates never pay.` };

const STEPS = [
  ["Intake call (30 minutes)", "What great looks like, must-haves, the salary range, your interview process and timing. We tell you honestly how the market looks for the role."],
  ["We find and screen", "Recruiters with real experience in your field source beyond the job boards, screen every candidate against your must-haves, and confirm interest and salary before you see anyone."],
  ["You review on one private page", "Each candidate comes with a short write-up and résumé. Choose interview, pass or hold — we handle scheduling, follow-up and feedback."],
  ["Offer and start", "We help close the offer and keep the candidate warm to the start date. Contingency: you pay only when they start."],
];

export default function Talent() {
  return (
    <>
      <section className="border-b border-line bg-brand-deep text-white">
        <div className="wrap py-16">
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">🤝 {BRAND.name} Talent</span>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">The right hire, <span className="text-mint">handled.</span></h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">Recruiting for operations, skilled trades, office, technical and leadership roles. Led by a recruiter with experience at Korn Ferry International and Hall Kinion, with a network of vetted independent recruiters.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#start" className="btn-primary">Start a search</a><Link href="/terms/talent-client-agreement" className="btn-ghost border-white/30 text-white">Read our client agreement</Link></div>
        </div>
      </section>
      <section className="wrap grid gap-4 py-12 md:grid-cols-2">
        <div className="card">
          <div className="text-sm font-semibold text-brand">Contingency search</div>
          <div className="mt-1 text-3xl font-extrabold">{T.contingencyPct}%</div>
          <p className="text-sm text-ink-soft">of the first year&apos;s base salary — only if you hire someone we introduce. Invoiced on the start date, due in {T.invoiceDueDays} days.</p>
          <p className="mt-2 text-sm">Best for most roles: you see candidates fast and pay nothing until someone starts.</p>
        </div>
        <div className="card">
          <div className="text-sm font-semibold text-brand">Retained search</div>
          <div className="mt-1 text-3xl font-extrabold">{T.retainedPct}%</div>
          <p className="text-sm text-ink-soft">of the first year&apos;s base salary, in three payments: at the start, at the shortlist, and at the hire (adjusted to the actual salary).</p>
          <p className="mt-2 text-sm">Best for leadership, hard-to-fill or confidential roles: a dedicated recruiter, a defined timeline and a weekly report.</p>
        </div>
      </section>
      <section className="wrap pb-12">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-4">{STEPS.map(([t, d], i) => <li key={t} className="card"><div className="text-xs font-semibold text-brand">Step {i + 1}</div><div className="mt-1 font-bold">{t}</div><p className="mt-1 text-sm text-ink-soft">{d}</p></li>)}</ol>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="card"><div className="font-bold">{T.guaranteeDays}-day guarantee</div><p className="mt-1 text-sm text-ink-soft">If a hire resigns or is let go for performance or cause in the first {T.guaranteeDays} days, we run a free replacement search or refund part of the fee.</p></div>
          <div className="card"><div className="font-bold">Candidates never pay</div><p className="mt-1 text-sm text-ink-soft">Every candidate agrees before their résumé reaches you, and knows exactly which company it&apos;s going to.</p></div>
          <div className="card"><div className="font-bold">Fair, lawful hiring</div><p className="mt-1 text-sm text-ink-soft">We recruit on skills and real requirements, and flag wording in a job order that could screen people out unlawfully.</p></div>
        </div>
      </section>
      <section id="start" className="wrap max-w-4xl pb-16">
        <h2 className="text-2xl font-bold">Start a search</h2>
        <p className="mb-4 text-sm text-ink-soft">Tell us about the role. A recruiter will call you within one business day.</p>
        <TalentRequestForm />
      </section>
      <section className="border-t border-line bg-paper">
        <div className="wrap grid gap-8 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold">Our promise to candidates</h2>
            <ul className="mt-3 space-y-2 text-sm">{FAIR_HIRING_RULES.map((r) => <li key={r}>✓ {r}</li>)}</ul>
          </div>
          <div>
            <h2 className="text-xl font-bold">Are you a recruiter?</h2>
            <p className="mt-2 text-sm text-ink-soft">Work searches with {BRAND.name} Talent as an independent recruiter: we bring the clients, contracts, invoicing and collections — you recruit. You earn {T.recruiterPct}% of the hire&apos;s first-year base salary on contingency hires ({Math.round((T.recruiterPct / T.contingencyPct) * 100)}% of the fee) and {Math.round(T.retainedRecruiterShare * 100)}% of retained payments, paid weekly once the client pays.</p>
            <Link href="/pros#apply" className="btn-primary mt-4 inline-block">Apply as a recruiter</Link>
            <p className="mt-2 text-xs text-ink-soft">Choose the trade “Recruiter (Handled Talent)” on the application.</p>
          </div>
        </div>
      </section>
    </>
  );
}
