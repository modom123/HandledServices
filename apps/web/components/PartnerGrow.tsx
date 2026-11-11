/*
 * FILE    : apps/web/components/PartnerGrow.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_1445 UTC
 * PURPOSE : Partner Success: the "Grow your business" view (app/(site)/partner/grow). The three roadmaps (core
 *           partner-success.ts) as tabs, the chosen one's stages with each goal's live progress from the partner's
 *           real numbers, "do this next", the services to sell at each stage, the bundles that turn one job into three
 *           and the seasonal calendar. Pure render: the page passes the stats.
 */
import Link from "next/link";
import { PARTNER_ROADMAPS, SEASONAL_CALENDAR, SERVICE_PLAYS, roadmapProgress, serviceName, type PartnerGrowthStats, type Roadmap } from "@handled/core";

const pct = (r: number) => `${+(r * 100).toFixed(2)}%`;
const fmt = (metric: string, v: number) => (metric === "earned" ? `$${Math.round(v).toLocaleString("en-US")}` : metric === "referralRate" || metric === "salesRate" ? pct(v) : metric === "payoutsReady" ? (v ? "done" : "not yet") : String(v));
const chip = (slug: string) => <Link key={slug} href={`/services/${slug}`} className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs hover:border-brand">{serviceName(slug)}</Link>;

export function PartnerGrow({ roadmap, stats, suggested }: { roadmap: Roadmap; stats: PartnerGrowthStats; suggested: Roadmap["id"] }) {
  const prog = roadmapProgress(roadmap, stats);
  const here = prog.stages[prog.current];
  return (
    <div className="wrap space-y-6 py-10">
      <div>
        <Link href="/partner" className="text-sm text-brand">← Partner page</Link>
        <h1 className="mt-1 text-2xl font-bold">Grow your partner business</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Your success is our success. Pick the road that fits how you work. Every stage has goals we track from your real numbers, what to do next, and the services to sell. Selling more <i>kinds</i> of services to the same customers is the fastest way to grow.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PARTNER_ROADMAPS.map((r) => (
          <Link key={r.id} href={`/partner/grow?path=${r.id}`} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${r.id === roadmap.id ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}>
            {r.name}{r.id === suggested ? " · for you" : ""}
          </Link>
        ))}
      </div>

      <section className="card border-t-4 border-t-brand">
        <div className="text-xs font-bold uppercase tracking-wide text-brand">{roadmap.name}</div>
        <p className="mt-1 font-semibold">{roadmap.promise}</p>
        <p className="mt-1 text-sm text-ink-soft">{roadmap.forWho}</p>
        <div className="mt-4 rounded-xl bg-brand-tint p-4">
          {prog.complete ? (
            <p className="font-semibold text-brand-dark">You&apos;ve finished every stage of this road. Keep the plays going, and try another road to grow a second way.</p>
          ) : (
            <>
              <div className="text-xs font-bold uppercase tracking-wide text-brand-dark">You&apos;re at stage {prog.current + 1} of {prog.stages.length}: {here.name}</div>
              {prog.nextGoal && <p className="mt-1 text-sm"><b>Next goal:</b> {prog.nextGoal.label} ({fmt(prog.nextGoal.metric, prog.nextGoal.value)} so far)</p>}
              {prog.nextAction && <p className="mt-1 text-sm"><b>Do this next:</b> {prog.nextAction}</p>}
              {!stats.payoutsReady && <p className="mt-2 text-sm"><Link href="/partner#payouts-first" className="font-semibold text-brand underline">Set up payouts first →</Link></p>}
            </>
          )}
        </div>
      </section>

      <ol className="space-y-4">
        {prog.stages.map((st, i) => (
          <li key={st.id} className={`card ${i === prog.current && !prog.complete ? "ring-2 ring-brand" : ""} ${st.done ? "opacity-90" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Stage {i + 1}</div>
                <h2 className="text-lg font-bold">{st.name} {st.done && <span className="ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">✓ done</span>}</h2>
                <p className="mt-0.5 text-sm text-ink-soft">{st.why}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-[1fr_1.2fr]">
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">Goals</div>
                <ul className="mt-2 space-y-2 text-sm">
                  {st.goals.map((g) => (
                    <li key={g.label}>
                      <div className="flex justify-between gap-2"><span className={g.done ? "text-emerald-800" : ""}>{g.done ? "✓ " : ""}{g.label}</span><span className="text-ink-soft">{fmt(g.metric, g.value)}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper"><div className={`h-full rounded-full ${g.done ? "bg-emerald-600" : "bg-brand"}`} style={{ width: `${Math.round(g.share * 100)}%` }} /></div>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-soft"><b>Unlocks:</b> {st.unlocks}</p>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">How</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{st.actions.map((a) => <li key={a}>{a}</li>)}</ul>
                <div className="mt-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Sell at this stage</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{st.sell.map(chip)}</div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="card">
        <h2 className="text-lg font-bold">Bundles: turn one job into three</h2>
        <p className="mt-1 text-sm text-ink-soft">Every customer you send has more on their list. When you hear one of these, suggest the rest.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_PLAYS.map((p) => (
            <div key={p.name} className="rounded-xl border border-line p-3">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-ink-soft">{p.when}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">{p.services.map(chip)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-bold">What to sell when</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEASONAL_CALENDAR.map((c) => (
            <div key={c.season} className="rounded-xl border border-line p-3">
              <div className="font-semibold">{c.season} <span className="font-normal text-ink-soft">· {c.months}</span></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{c.services.map(chip)}</div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-ink-soft">The whole program, printable: <a href="/docs/handled-partner-success-playbook.pdf" className="font-semibold text-brand underline">Partner Success Playbook (PDF)</a></p>
    </div>
  );
}
