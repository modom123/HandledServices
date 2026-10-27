/*
 * FILE    : apps/web/app/hub/recruiting/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Hub → Recruiting → Overview: the Recruiting division top down. One flow for every role we fill — independent
 *           pros for our network, our own team, and our clients' roles (Handled Talent):
 *             1 Openings (what we need) → 2 Indeed (posted, applicants) → 3 Pipeline → 4 Decisions → 5 Onboarding (contracts,
 *             documents, background) → 6 Hired / active,
 *           the funnel by track and stage, today's to-do list, where applicants come from (Indeed first), and the AI team:
 *           which agent works each step (runs in the last 30 days) and where a person always decides.
 *           The pro pipeline that used to live here is Hub → Recruiting → Pipeline.
 * UPDATED : 2026-10-27_1900 UTC — "Add an approved pro": your hiring routine (post on Indeed → screen the résumé → phone
 *           interview → enter them here) and what the system does on its own after that, up to their first Monday pay.
 */
import Link from "next/link";
import { AGENTS, DIVISION_AI, TRADES, DIVISION_STAGES, DIVISION_STAGE_LABEL, TRACK_ICON, TRACK_LABEL, type Track } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/ai/client";
import { getViewer } from "@/lib/auth";
import { funnel, openings } from "@/lib/recruiting-division";
import { ApproveProForm } from "@/components/RecruitingIntake";

export const dynamic = "force-dynamic";

export default async function RecruitingOverview() {
  const v = await getViewer();
  if (!v) return null;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const kinds = DIVISION_AI.flatMap((x) => x.agents);
  const [ops, f, { count: inSetup }, { count: docsWaiting }, { data: runs }] = await Promise.all([
    openings(), funnel(),
    adminClient().from("contractors").select("id", { count: "exact", head: true }).eq("status", "vetting").is("dropped_at", null),
    adminClient().from("contractor_documents").select("id", { count: "exact", head: true }).eq("status", "pending").not("storage_path", "is", null),
    adminClient().from("ai_runs").select("kind").in("kind", kinds).gte("created_at", since).limit(20000),
  ]);
  const runsOf = (k: string) => ((runs ?? []) as { kind: string }[]).filter((r) => r.kind === k).length;
  const ai = aiEnabled();
  const open = ops.filter((o) => !o.paused);
  const unposted = open.filter((o) => !o.indeedUrl);
  const tracks: Track[] = ["pro", "staff", "client"];
  const inFunnel = (t: Track) => DIVISION_STAGES.filter((s) => s !== "active").reduce((n, s) => n + f.by[t][s], 0);
  const indeed30 = f.sources.find(([k]) => k === "Indeed")?.[1] ?? 0;
  const all30 = f.sources.reduce((n, [, c]) => n + c, 0);
  const hired = tracks.reduce((n, t) => n + f.by[t].active, 0);
  const steps = [
    { n: 1, t: "Openings", v: `${open.length}`, d: `${open.reduce((n, o) => n + o.needed, 0)} people needed`, href: "/hub/recruiting/openings" },
    { n: 2, t: "Indeed", v: `${open.length - unposted.length}/${open.length}`, d: `posted · ${indeed30} applicants in 30 days`, href: "/hub/recruiting/indeed" },
    { n: 3, t: "Pipeline", v: `${tracks.reduce((n, t) => n + inFunnel(t), 0)}`, d: "candidates in progress", href: "/hub/recruiting/pipeline" },
    { n: 4, t: "Decide", v: `${f.decide}`, d: "pro candidates waiting on you", href: "/hub/recruiting/pipeline?stage=screened" },
    { n: 5, t: "Onboarding", v: `${inSetup ?? 0}`, d: `in setup · ${docsWaiting ?? 0} documents to verify`, href: "/hub/recruiting/onboarding" },
    { n: 6, t: "Hired / active", v: `${hired}`, d: "pros live + people placed", href: "/hub/pros" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recruiting division</h1>
        <p className="text-sm text-ink-soft">One flow for every role we fill: independent pros for our network, people for our own team, and our clients' roles. Indeed is our primary source — every opening has a ready-to-post Indeed job, and Indeed applicants flow straight into the right pipeline.</p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="card text-sm">
          <h2 className="font-bold">How you hire a pro</h2>
          <ol className="mt-2 space-y-1.5">
            <li><b>1 · You post the ad</b> on Indeed (<Link href="/hub/recruiting/indeed" className="text-brand underline">post kits</Link>).</li>
            <li><b>2 · You screen the résumé.</b></li>
            <li><b>3 · You do a short, informal phone interview</b> and decide yes or no.</li>
            <li><b>4 · Yes → upload their résumé here and tick “I interviewed them.”</b> Their pro file is created and that's the last thing you have to do.</li>
          </ol>
          <h3 className="mt-4 font-bold">Then the system takes over</h3>
          <ol className="mt-2 space-y-1.5 text-ink-soft">
            <li>📧 Invite email right away: one-click sign-in, their setup checklist and how jobs and pay work (English or Spanish).</li>
            <li>📝 They do setup on their phone (~15 min): W-9, sign the agreement, skills, area, photo, ID, insurance, payout account.</li>
            <li>⏰ Reminders on days 1, 3, 7 and 14 until it's done; dropped after 30 days.</li>
            <li>🤖 AI reads each document; a person verifies (<Link href="/hub/recruiting/onboarding" className="text-brand underline">Onboarding</Link> shows what's waiting on us).</li>
            <li>🔎 Background check ordered automatically when setup is in.</li>
            <li>🎉 Everything clear → they go live and get a “You're live” email and push.</li>
            <li>📲 Job offers start in their trades and ZIPs; they accept, do the job, finish the checklist and photos.</li>
            <li>💵 Paid every Monday for the week's finished jobs (instant cash-out optional).</li>
          </ol>
        </div>
        <ApproveProForm trades={TRADES.map((x) => ({ id: x.id, label: x.label }))} />
      </section>

      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((s) => (
          <li key={s.n}>
            <Link href={s.href} className="card flex h-full flex-col transition hover:border-brand">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-soft">{s.n} · {s.t}</span>
              <span className="mt-1 text-3xl font-extrabold text-brand">{s.v}</span>
              <span className="text-xs text-ink-soft">{s.d}</span>
            </Link>
          </li>
        ))}
      </ol>

      <section className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft"><th className="p-3">Track</th><th className="p-3">Openings</th>{DIVISION_STAGES.map((s) => <th key={s} className="p-3 text-right">{DIVISION_STAGE_LABEL[s]}</th>)}</tr></thead>
          <tbody>
            {tracks.map((t) => (
              <tr key={t} className="border-b border-line last:border-0">
                <td className="p-3 font-semibold">{TRACK_ICON[t]} {TRACK_LABEL[t]}</td>
                <td className="p-3">{open.filter((o) => o.track === t).length}</td>
                {DIVISION_STAGES.map((s) => <td key={s} className={`p-3 text-right ${f.by[t][s] ? "font-semibold" : "text-ink-soft"}`}>{f.by[t][s]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="card text-sm">
          <h2 className="font-bold">Today</h2>
          <ul className="mt-3 space-y-2">
            {f.decide > 0 && <li><Link href="/hub/recruiting/pipeline?stage=screened" className="flex justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-amber-900"><span>⚖️ {f.decide} pro candidate{f.decide === 1 ? "" : "s"} waiting on your decision</span><span>Decide →</span></Link></li>}
            {unposted.slice(0, 5).map((o) => (
              <li key={o.key}><Link href={`/hub/recruiting/indeed#${encodeURIComponent(o.key)}`} className="flex justify-between gap-3 rounded-lg bg-paper px-3 py-2"><span>📣 Post on Indeed: <b>{o.title}</b> <span className="text-ink-soft">({o.reason}{o.needed ? `, ${o.needed} needed` : ""})</span></span><span className="text-brand">Post →</span></Link></li>
            ))}
            {unposted.length > 5 && <li className="text-xs text-ink-soft">+ {unposted.length - 5} more openings not on Indeed yet — <Link className="underline" href="/hub/recruiting/indeed">see all</Link></li>}
            {f.decide === 0 && unposted.length === 0 && <li className="text-ink-soft">Nothing waiting. Every opening is on Indeed and no candidate needs a decision.</li>}
          </ul>
        </section>
        <section className="card text-sm">
          <h2 className="font-bold">Where applicants came from (30 days)</h2>
          {!all30 && <p className="mt-2 text-ink-soft">No applicants yet in the last 30 days.</p>}
          <ul className="mt-3 space-y-2">
            {f.sources.slice(0, 8).map(([k, n]) => (
              <li key={k}>
                <div className="flex justify-between"><span className={k === "Indeed" ? "font-semibold" : ""}>{k}</span><span className="text-ink-soft">{n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-paper"><div className={`h-1.5 rounded-full ${k === "Indeed" ? "bg-brand" : "bg-ink-soft/40"}`} style={{ width: `${Math.round((n / Math.max(1, all30)) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card text-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-bold">🤖 AI team in recruiting</h2><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ai ? "bg-brand-tint text-brand-dark" : "bg-amber-50 text-amber-900"}`}>{ai ? "AI on" : "AI off — set ANTHROPIC_API_KEY (rules still run)"}</span></div>
        <p className="mt-1 text-ink-soft">Agents do the first pass at every step; a person makes every hiring decision. Runs are the last 30 days.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft"><th className="py-2 pr-3">Step</th><th className="py-2 pr-3">AI agents</th><th className="py-2 pr-3">Automatic</th><th className="py-2">A person</th></tr></thead>
            <tbody>
              {DIVISION_AI.map((x) => (
                <tr key={x.step} className="border-b border-line align-top last:border-0">
                  <td className="py-2 pr-3 font-semibold">{x.step}</td>
                  <td className="py-2 pr-3">{x.agents.length ? x.agents.map((k) => { const a = AGENTS.find((g) => g.kind === k); return <div key={k}>{a?.name ?? k} <span className="text-xs text-ink-soft">· {runsOf(k)} runs</span></div>; }) : <span className="text-ink-soft">—</span>}</td>
                  <td className="py-2 pr-3 text-ink-soft">{x.auto.map((t) => <div key={t}>{t}</div>)}</td>
                  <td className="py-2 text-ink-soft">{x.human}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Give the AI team recruiting tasks in <Link href="/hub/agents" className="underline">AI agents &amp; IEBC</Link>.</p>
      </section>

      <section className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/hub/gaps", icon: "📍", t: "Supply gaps", d: "Where we're short of pros — this sets the pro openings." },
          { href: "/hub/leads", icon: "📨", t: "Pro leads", d: "Outbound: finds and emails independent pros where we're short." },
          { href: "/hub/talent", icon: "🤝", t: "Client searches", d: "Handled Talent: clients, searches, recruiters, hires and fees." },
          { href: "/hub/recruiting/packet", icon: "📋", t: "Interview packet", d: "Questions, scoring and what not to ask (print or AI interview)." },
        ].map((x) => (
          <Link key={x.href} href={x.href} className="card transition hover:border-brand"><div className="text-2xl">{x.icon}</div><div className="mt-2 font-bold">{x.t}</div><p className="mt-1 text-ink-soft">{x.d}</p></Link>
        ))}
      </section>
    </div>
  );
}
