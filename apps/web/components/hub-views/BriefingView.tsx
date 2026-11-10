/*
 * FILE    : apps/web/components/hub-views/BriefingView.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-11-10_0330 UTC
 * PURPOSE : The Daily Briefing layout (Hub → Daily Briefing, app/hub/briefing/page.tsx loads the data). Short and
 *           scannable: only the queues that need someone (chips); the AI brief as today's top actions + three
 *           one-liners with every other section folded; today's schedule as a compact list by arrival window with
 *           "needs a pro" flagged; urgent alerts first (two lines each), the rest folded.
 */
import Link from "next/link";
import { getService, type Job } from "@handled/core";
import { Badge, StatusBadge } from "@/components/ui";
import { ResolveAlert } from "@/components/HubActions";

export type Alert = { id: string; kind: string; severity: "info" | "warn" | "critical"; title: string; body: string | null; job_id: string | null; created_at: string };

/** The brief's text ("Heading: line" or "Heading:\n- item…" blocks) as sections. */
function briefSections(body: string | null): { head: string; text: string; items: string[] }[] {
  return (body ?? "").split(/\n\s*\n/).map((block) => {
    const m = block.match(/^([^:\n]{2,40}):\s*([\s\S]*)$/);
    const head = m ? m[1].trim() : "";
    const rest = (m ? m[2] : block).trim();
    const lines = rest.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = lines.filter((l) => /^(-|•|\d+[.)])\s+/.test(l)).map((l) => l.replace(/^(-|•|\d+[.)])\s+/, ""));
    return { head, text: items.length ? "" : lines.join(" "), items };
  }).filter((s) => s.text || s.items.length);
}

const WINDOWS: [string, string][] = [["morning", "Morning"], ["midday", "Midday"], ["afternoon", "Afternoon"], ["flexible", "Any time"]];
const SHOW_ALERTS = 5, SHOW_JOBS = 8;

/** The briefing's layout (kept apart from the data loading so it can be laid out and checked on its own). */
export default function BriefingView({ funnel, open, alerts, todays, apps, iebcPending }: { funnel: { stage: string }[]; open: { status: string; contractor_id: string | null }[]; alerts: Alert[]; todays: Job[]; apps: number; iebcPending: number }) {
  const decide = funnel.filter((r) => r.stage === "screened" || r.stage === "interviewed").length;
  const unassigned = open.filter((j) => !j.contractor_id && ["scheduled", "dispatched"].includes(j.status)).length;
  const qa = open.filter((j) => j.status === "qa_review").length;
  const all = alerts;
  const brief = all.find((a) => a.kind === "daily_brief");
  const rank = { critical: 0, warn: 1, info: 2 } as const;
  const rest = all.filter((a) => a !== brief).sort((a, b) => rank[a.severity] - rank[b.severity] || b.created_at.localeCompare(a.created_at));
  const urgent = rest.filter((a) => a.severity !== "info");
  const shownAlerts = (urgent.length ? urgent : rest).slice(0, SHOW_ALERTS);
  const moreAlerts = rest.filter((a) => !shownAlerts.includes(a));
  const jobs = todays;
  const noPro = jobs.filter((j) => !j.contractor_id && !["completed", "cancelled"].includes(j.status)).length;

  const queues: [string, number, string][] = [
    ["🧲 Candidates to decide", decide, "/hub/recruiting/pipeline"],
    ["🧰 Jobs need a pro", unassigned, "/hub/jobs"],
    ["🔍 Awaiting QA", qa, "/hub/jobs"],
    ["🤖 IEBC approvals", iebcPending, "/hub/agents?view=workforce"],
    ["📨 New applications", apps, "/hub/recruiting?stage=applied"],
  ];
  const hot = queues.filter(([, n]) => n > 0), quiet = queues.filter(([, n]) => n === 0);
  const waiting = decide + unassigned + qa + (iebcPending) + urgent.length;

  const sections = briefSections(brief?.body ?? null);
  const actions = sections.find((s) => /^actions?$/i.test(s.head));
  const oneLiners = ["Onboarding pros", "New jobs", "Goal pace"].map((h) => sections.find((s) => s.head.toLowerCase() === h.toLowerCase())).filter(Boolean) as typeof sections;
  const folded = sections.filter((s) => s !== actions && !oneLiners.includes(s));

  const byWindow = WINDOWS.map(([w, label]) => [label, jobs.filter((j) => (j.time_window ?? "flexible") === w)] as const).filter(([, js]) => js.length);
  let shown = 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Good {new Date().getHours() < 12 ? "morning" : "afternoon"}</h1>
          <p className="text-sm text-ink-soft">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {jobs.length} visit{jobs.length === 1 ? "" : "s"} today{noPro ? ` (${noPro} without a pro)` : ""} · {waiting ? `${waiting} thing${waiting === 1 ? "" : "s"} waiting on you` : "nothing waiting on you"}</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/hub" className="btn-ghost">📊 Dashboard</Link><Link href="/hub/assistant" className="btn-dark">✨ Ask the AI</Link></div>
      </div>

      {/* waiting on a person: only what needs someone */}
      <div className="flex flex-wrap items-center gap-2">
        {hot.map(([label, n, href]) => (
          <Link key={label} href={href} className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-800 hover:border-rose-400">
            {label} <span className="rounded-full bg-rose-600 px-2 text-xs text-white">{n}</span>
          </Link>
        ))}
        {!hot.length && <span className="rounded-full bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand-dark">✓ No queues waiting</span>}
        {quiet.length > 0 && hot.length > 0 && <span className="text-xs text-ink-soft">All clear: {quiet.map(([l]) => l.replace(/^\S+\s/, "")).join(" · ")}</span>}
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[1.35fr_1fr]">
        {/* AI brief: the actions first, three one-liners, everything else folded */}
        <section className="card min-w-0 border-brand/40 bg-brand-tint">
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-xs font-semibold uppercase tracking-wide text-brand-dark">AI morning brief</div>
              <div className="mt-0.5 font-bold">{brief ? brief.title : "Not posted yet today"}</div></div>
            {brief && <ResolveAlert id={brief.id} />}
          </div>
          {!brief && <p className="mt-2 text-sm text-ink-soft">It posts here each morning with today&apos;s top actions.</p>}
          {actions && (
            <ol className="mt-3 space-y-1.5 text-sm">
              {actions.items.slice(0, 5).map((a, i) => (
                <li key={i} className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">{i + 1}</span><span>{a}</span></li>
              ))}
            </ol>
          )}
          {oneLiners.length > 0 && (
            <dl className="mt-3 grid gap-1 border-t border-brand/20 pt-3 text-sm">
              {oneLiners.map((s) => <div key={s.head} className="flex gap-2"><dt className="w-36 shrink-0 font-semibold text-brand-dark">{s.head}</dt><dd className="text-ink-soft">{s.text || s.items.join("; ")}</dd></div>)}
            </dl>
          )}
          {folded.length > 0 && (
            <details className="mt-3 border-t border-brand/20 pt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-brand-dark">More from the brief <span className="font-normal text-ink-soft">· {folded.map((f) => f.head || "Notes").join(" · ")}</span></summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {folded.map((f) => (
                  <div key={f.head || f.text.slice(0, 20)} className="rounded-lg bg-white/70 px-3 py-2">
                    <div className="font-semibold">{f.head || "Notes"}</div>
                    {f.items.length ? <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-soft">{f.items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="mt-1 text-ink-soft">{f.text}</p>}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>

        {/* today's schedule, compact, by arrival window */}
        <section className="card min-w-0 p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-3"><h2 className="font-bold">Today&apos;s schedule</h2><Link href="/hub/jobs?view=schedule" className="text-xs font-semibold text-brand underline">Full schedule →</Link></div>
          {!jobs.length && <p className="px-4 py-6 text-center text-sm text-ink-soft">No visits scheduled today.</p>}
          {byWindow.map(([label, js]) => {
            const visible = js.filter(() => shown++ < SHOW_JOBS);
            return visible.length ? (
              <div key={label}>
                <div className="bg-paper px-4 py-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label} · {js.length}</div>
                {visible.map((j) => (
                  <Link key={j.id} href={`/hub/jobs/${j.id}`} className="flex items-center justify-between gap-3 border-t border-line px-4 py-2 text-sm hover:bg-paper">
                    <span className="min-w-0 truncate"><b>{j.ref}</b> {getService(j.service_slug)?.name} <span className="text-xs text-ink-soft">· {j.city}</span></span>
                    <span className="shrink-0 whitespace-nowrap">{!j.contractor_id && !["completed", "cancelled"].includes(j.status) ? <Badge tone="red">needs a pro</Badge> : <StatusBadge status={j.status} />}</span>
                  </Link>
                ))}
              </div>
            ) : null;
          })}
          {jobs.length > SHOW_JOBS && <Link href="/hub/jobs?view=schedule" className="block border-t border-line px-4 py-2 text-center text-sm font-semibold text-brand">+ {jobs.length - SHOW_JOBS} more today →</Link>}
        </section>
      </div>

      {/* alerts: urgent first, two lines each; the rest folded */}
      <section>
        <h2 className="mb-2 font-bold">Alerts <span className="text-sm font-normal text-ink-soft">{rest.length ? `${urgent.length} urgent · ${rest.length} open` : "all clear"}</span></h2>
        {!rest.length && <p className="text-sm text-ink-soft">Nothing open. The AI raises alerts for unassigned jobs, failed QA, risks and payment issues.</p>}
        <div className="grid min-w-0 gap-2 md:grid-cols-2">
          {shownAlerts.map((a) => <AlertRow key={a.id} a={a} />)}
        </div>
        {moreAlerts.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-semibold text-brand">Show {moreAlerts.length} more alert{moreAlerts.length === 1 ? "" : "s"}</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">{moreAlerts.map((a) => <AlertRow key={a.id} a={a} />)}</div>
          </details>
        )}
      </section>
    </div>
  );
}

function AlertRow({ a }: { a: Alert }) {
  return (
    <div className="card flex min-w-0 items-start justify-between gap-3 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2"><Badge tone={a.severity === "critical" ? "red" : a.severity === "warn" ? "amber" : "slate"}>{a.severity}</Badge><span className="truncate text-sm font-semibold">{a.title}</span></div>
        {a.body && <p className="mt-1 line-clamp-2 text-xs text-ink-soft" title={a.body}>{a.body}</p>}
        {a.job_id && <Link href={`/hub/jobs/${a.job_id}`} className="text-xs text-brand underline">Open job</Link>}
      </div>
      <ResolveAlert id={a.id} />
    </div>
  );
}
