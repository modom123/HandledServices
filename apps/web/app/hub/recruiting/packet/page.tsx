/*
 * FILE    : apps/web/app/hub/recruiting/packet/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : Hub → Recruiting → Interview packet (printable; ?lang=es for Spanish questions): how approval works,
 *           what not to ask, the questions with what a good answer has, the scoring guide, a blank scoring sheet
 *           and the approval checklist. Same source as the AI interviewer (packages/core/src/interview.ts).
 */
import Link from "next/link";
import { COMPETENCIES, DO_NOT_ASK, INTERVIEW_PASS, QUESTIONS, TRADES, type Competency, type TradeGroup } from "@handled/core";
import { PrintButton } from "@/components/PrintButton";

const GROUP_LABEL: Record<TradeGroup, string> = { cleaning: "Cleaning, windows, carpet, organizing, detailing", repair: "Handyman, remodel, low voltage", outdoor: "Lawn, trees, snow, gutters, pressure washing, pet waste", moving: "Hauling, moving, containers", painting: "Painting", licensed: "Plumbing, electrical, HVAC", pets: "Pet care", transport: "Transportation", errands: "Errands & couriers", events: "Events", security: "Security (licensed agencies)" };

export default async function Packet({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const es = (await searchParams).lang === "es";
  const core = QUESTIONS.filter((q) => !q.group);
  const groups = [...new Set(QUESTIONS.filter((q) => q.group).map((q) => q.group!))];
  const comps = Object.keys(COMPETENCIES) as Competency[];
  const Q = ({ q, n }: { q: (typeof QUESTIONS)[number]; n: number }) => (
    <li className="break-inside-avoid">
      <div className="font-semibold">{n}. {es ? q.es : q.en}</div>
      {!es && <div className="text-xs text-ink-soft">ES: {q.es}</div>}
      <div className="text-xs">✔ Look for: {q.lookFor}{q.redFlag ? <span className="text-rose-700"> · ✖ Red flag: {q.redFlag}</span> : null}{q.competency ? <span className="text-ink-soft"> · Scores: {COMPETENCIES[q.competency].en}</span> : <span className="text-ink-soft"> · Not scored</span>}</div>
      <div className="mt-1 h-10 border-b border-dashed border-line print:h-14" />
    </li>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-8 text-sm">
      <div className="flex items-center justify-between print:hidden"><Link href="/hub/recruiting" className="text-brand underline">← Recruiting</Link><div className="flex gap-3"><a className="underline" href={es ? "?" : "?lang=es"}>{es ? "English" : "Preguntas en español"}</a><PrintButton /></div></div>
      <header><h1 className="text-3xl font-extrabold">Pro interview packet</h1><p className="text-ink-soft">Screening interview for independent pros (1099 businesses). Candidate: ____________________ · Trades: ____________________ · Date: ________ · Interviewer: ____________</p></header>

      <section><h2 className="mb-2 text-xl font-bold">1. How a pro gets approved</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Applies at /pros → an AI screen of their business qualifications.</li>
          <li><b>Screening interview</b> — the AI interviewer (link by email, about 15 minutes, English or Spanish) or you, in person or by phone, with this packet. A person reviews every interview.</li>
          <li><b>A person decides:</b> invite, follow up, or decline.</li>
          <li>Setup in the pro portal: W-9 · independent contractor agreement · specialties · work area & days · insurance certificate (general liability; plus trade coverages) · workers' comp or a no-employees statement · trade license where required · photo ID check · background check (consent through the screening provider) · payout method.</li>
          <li>We verify documents; the background check clears → <b>approved to receive job offers</b>.</li>
          <li>First jobs are probation: smaller jobs, human review of each, a call to the customer.</li>
        </ol>
        <p className="mt-2 text-xs text-ink-soft">Say “approved”, not “hired”. Pros run their own businesses: they choose jobs, days, area, methods and tools. Don't promise a number of jobs or income; pay figures before approval are estimates.</p>
      </section>

      <section className="break-inside-avoid"><h2 className="mb-2 text-xl font-bold">2. Never ask about</h2>
        <ul className="grid gap-1 sm:grid-cols-2">{DO_NOT_ASK.map((d) => <li key={d.en}>✖ {es ? d.es : d.en}</li>)}</ul>
        <p className="mt-2 text-xs text-ink-soft">If a candidate brings one up, don't follow up and don't let it affect the decision. Ask everyone the same core questions. Score what they said, not accent, grammar or which language they use. If someone asks for an accommodation (more time, a phone interview, an interpreter), say yes.</p>
      </section>

      <section><h2 className="mb-2 text-xl font-bold">3. Questions — everyone</h2><ol className="space-y-3">{core.map((q, i) => <Q key={q.id} q={q} n={i + 1} />)}</ol></section>
      <section><h2 className="mb-2 text-xl font-bold">4. Questions — by trade (ask the ones for their trades)</h2>
        {groups.map((g) => <div key={g} className="mb-4 break-inside-avoid"><h3 className="font-semibold">{GROUP_LABEL[g]}</h3><ol className="mt-1 space-y-3">{QUESTIONS.filter((q) => q.group === g).map((q, i) => <Q key={q.id} q={q} n={i + 1} />)}</ol></div>)}
        <p className="text-xs text-ink-soft">Trades: {TRADES.map((t) => t.label).join(", ")}.</p>
      </section>

      <section className="break-inside-avoid"><h2 className="mb-2 text-xl font-bold">5. Scoring guide (1–5)</h2>
        <table className="w-full text-xs"><thead><tr className="text-left"><th className="p-1">Competency</th><th className="p-1">1 — concerning</th><th className="p-1">3 — meets</th><th className="p-1">5 — excellent</th></tr></thead>
          <tbody>{comps.map((c) => <tr key={c} className="border-t border-line align-top"><td className="p-1 font-semibold">{es ? COMPETENCIES[c].es : COMPETENCIES[c].en}</td><td className="p-1">{COMPETENCIES[c].anchors[1]}</td><td className="p-1">{COMPETENCIES[c].anchors[3]}</td><td className="p-1">{COMPETENCIES[c].anchors[5]}</td></tr>)}</tbody></table>
        <p className="mt-2"><b>Result:</b> average of the six ≥ {INTERVIEW_PASS.average} and none below {INTERVIEW_PASS.floor} → <b>Advance</b>. A low score or a missing competency → <b>Follow up</b> (a short call on that topic). Average under 2.6 or any knockout → <b>Not now</b>.</p>
        <p><b>Knockouts:</b> won't carry required insurance · would do licensed work without the license · would knowingly continue unsafe work · abusive or threatening in the interview.</p>
      </section>

      <section className="break-inside-avoid"><h2 className="mb-2 text-xl font-bold">6. Scoring sheet</h2>
        <table className="w-full text-xs"><tbody>{comps.map((c) => <tr key={c} className="border-t border-line"><td className="w-56 p-2 font-semibold">{COMPETENCIES[c].en}</td><td className="p-2">1 ☐ 2 ☐ 3 ☐ 4 ☐ 5 ☐</td><td className="p-2">Evidence: ______________________________</td></tr>)}
          <tr className="border-t border-line"><td className="p-2 font-semibold">Average</td><td className="p-2">______</td><td className="p-2">Knockout? ☐ no ☐ yes: ____________________</td></tr>
          <tr className="border-t border-line"><td className="p-2 font-semibold">Decision</td><td className="p-2" colSpan={2}>☐ Invite to set up ☐ Follow up first ☐ Not now — reason: ______________________</td></tr></tbody></table>
        <p className="mt-1 text-xs text-ink-soft">Enter it in Hub → Recruiting → the candidate → “Interview them myself” so it's on their record.</p>
      </section>

      <section className="break-inside-avoid"><h2 className="mb-2 text-xl font-bold">7. Approval checklist</h2>
        <ul className="space-y-1">{["Application received", "Application screened", "Screening interview done", "Decision by a person: invite", "Pro account created (signed in with the application email)", "W-9 on file", "Independent contractor agreement signed", "Specialties chosen", "Work area & days set", "Insurance certificate (COI) verified", "Trade coverages verified (where the trade needs them)", "Workers' comp, or a no-employees statement", "Trade license verified (where required)", "Photo ID verified", "Background check cleared", "Payout method set", "Approved — receiving job offers", "First job completed and reviewed"].map((x) => <li key={x}>☐ {x}</li>)}</ul>
        <p className="mt-2 text-xs text-ink-soft">The Hub tracks every step for each candidate (Recruiting → click a name), shows what's next and who it waits on, and flags anyone stuck.</p>
      </section>
    </div>
  );
}
