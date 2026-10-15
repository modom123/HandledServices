/*
 * FILE    : apps/web/app/hub/briefing/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-14_2330 UTC
 * PURPOSE : Mastermind → Daily Briefing: what needs attention today — the AI morning brief, open alerts, today's
 *           schedule and the queues waiting on a person (jobs without a pro, QA, IEBC approvals, new pro applications).
 *           Moved off the Dashboard, which is now stats and insights only (app/hub/page.tsx).
 * UPDATED : 2026-10-15_0010 UTC — pro candidates waiting on a decision (screened or interviewed) lead the queues.
 */
import Link from "next/link";
import { getService, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Badge, Empty, StatusBadge } from "@/components/ui";
import { ResolveAlert } from "@/components/HubActions";
import { pipeline } from "@/lib/recruiting";

export const metadata = { title: "Daily Briefing" };

type Alert = { id: string; kind: string; severity: "info" | "warn" | "critical"; title: string; body: string | null; job_id: string | null; created_at: string };

export default async function Briefing() {
  const v = await getViewer();
  if (!v) return null;
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: todays }, { data: alerts }, { data: open }, { count: apps }, { count: iebcPending }, funnel] = await Promise.all([
    v.db.from("jobs").select("*").eq("scheduled_date", today).order("time_window"),
    v.db.from("ops_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(25),
    v.db.from("jobs").select("status, contractor_id").not("status", "in", "(completed,cancelled)"),
    v.db.from("contractor_applications").select("id", { count: "exact", head: true }).eq("status", "new"),
    v.db.from("agent_actions").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    pipeline(),
  ]);
  const decide = funnel.filter((r) => r.stage === "screened" || r.stage === "interviewed").length;
  const unassigned = (open ?? []).filter((j) => !j.contractor_id && ["scheduled", "dispatched"].includes(j.status)).length;
  const qa = (open ?? []).filter((j) => j.status === "qa_review").length;
  const brief = (alerts ?? []).find((a: Alert) => a.kind === "daily_brief") as Alert | undefined;
  const rest = ((alerts ?? []) as Alert[]).filter((a) => a !== brief);
  const jobs = (todays ?? []) as Job[];

  const queues: [string, number, string, boolean][] = [
    ["🧲 Pro candidates to decide", decide, "/hub/recruiting", decide > 0],
    ["🧰 Jobs need a pro", unassigned, "/hub/dispatch", unassigned > 0],
    ["🔍 Awaiting QA", qa, "/hub/jobs", qa > 0],
    ["🤖 IEBC actions to approve", iebcPending ?? 0, "/hub/workforce", (iebcPending ?? 0) > 0],
    ["📨 New pro applications", apps ?? 0, "/hub/recruiting?stage=applied", false],
  ];
  const waiting = decide + unassigned + qa + (iebcPending ?? 0) + rest.length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Good {new Date().getHours() < 12 ? "morning" : "afternoon"}</h1>
          <p className="text-sm text-ink-soft">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {jobs.length} visit{jobs.length === 1 ? "" : "s"} today · {waiting ? `${waiting} item${waiting === 1 ? "" : "s"} waiting on you` : "nothing waiting on you"}</p>
        </div>
        <div className="flex gap-2"><Link href="/hub" className="btn-ghost">📊 Dashboard</Link><Link href="/hub/assistant" className="btn-dark">✨ Ask the AI assistant</Link></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {queues.map(([label, n, href, hot]) => (
          <Link key={label} href={href} className="card flex items-center justify-between gap-3 p-4 hover:border-brand">
            <span className="text-sm font-semibold">{label}</span>
            <span className={`text-xl font-bold ${hot ? "text-rose-600" : ""}`}>{n}</span>
          </Link>
        ))}
      </div>

      {brief ? (
        <div className="card border-brand/40 bg-brand-tint">
          <div className="flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wide text-brand-dark">AI morning brief</div><ResolveAlert id={brief.id} /></div>
          <div className="mt-1 text-lg font-bold">{brief.title}</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-soft">{brief.body}</pre>
        </div>
      ) : (
        <Empty>No AI morning brief yet today — it posts here each morning.</Empty>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-bold">Alerts</h2>
          {!rest.length && <Empty>All clear. The AI raises alerts for unassigned jobs, failed QA, risks and payment issues.</Empty>}
          <div className="space-y-2">
            {rest.map((a) => (
              <div key={a.id} className="card flex items-start justify-between gap-3 p-4">
                <div><div className="flex items-center gap-2"><Badge tone={a.severity === "critical" ? "red" : a.severity === "warn" ? "amber" : "slate"}>{a.severity}</Badge><span className="text-sm font-semibold">{a.title}</span></div>
                  {a.body && <p className="mt-1 text-sm text-ink-soft">{a.body}</p>}
                  {a.job_id && <Link href={`/hub/jobs/${a.job_id}`} className="text-xs text-brand underline">Open job</Link>}</div>
                <ResolveAlert id={a.id} />
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 font-bold">Today’s schedule</h2>
          {!jobs.length && <Empty>No visits scheduled today.</Empty>}
          <div className="space-y-2">
            {jobs.map((j) => (
              <Link key={j.id} href={`/hub/jobs/${j.id}`} className="card flex items-center justify-between gap-3 p-4 hover:border-brand">
                <div className="text-sm"><span className="font-semibold">{j.ref}</span> {getService(j.service_slug)?.name}<div className="text-xs text-ink-soft">{j.time_window} · {j.city} {j.zip}</div></div>
                <StatusBadge status={j.status} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
