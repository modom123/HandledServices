/*
 * FILE    : apps/web/app/hub/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Ops dashboard — KPIs, AI morning brief, live alerts, today's schedule.
 * UPDATED : 2026-10-04_1934 UTC — AI-driven target follows the growth plan year (80% → 95%).
 */
import Link from "next/link";
import { getService, money, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Badge, Empty, Stat, StatusBadge } from "@/components/ui";
import { ResolveAlert } from "@/components/HubActions";
import { aiDrivenRate, aiDrivenTargetNow } from "@/lib/metrics";

type Alert = { id: string; kind: string; severity: "info" | "warn" | "critical"; title: string; body: string | null; job_id: string | null; created_at: string };

export default async function HubHome() {
  const v = await getViewer();
  if (!v) return null;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: month }, { data: week }, { data: open }, { data: todays }, { data: alerts }, { data: reviews }, { count: apps }] = await Promise.all([
    v.db.from("jobs").select("status, price_final, contractor_payout").gte("completed_at", monthStart).eq("status", "completed"),
    v.db.from("jobs").select("id").gte("created_at", weekAgo),
    v.db.from("jobs").select("status, contractor_id").not("status", "in", "(completed,cancelled)"),
    v.db.from("jobs").select("*").eq("scheduled_date", today).order("time_window"),
    v.db.from("ops_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(25),
    v.db.from("reviews").select("rating").gte("created_at", monthStart),
    v.db.from("contractor_applications").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  const [auto, { count: iebcPending }, AI_DRIVEN_TARGET] = await Promise.all([
    aiDrivenRate(v.db, monthStart),
    v.db.from("agent_actions").select("id", { count: "exact", head: true }).eq("status", "pending_approval"),
    aiDrivenTargetNow(v.db),
  ]);
  const revenue = (month ?? []).reduce((t, j) => t + Number(j.price_final ?? 0), 0);
  const margin = revenue - (month ?? []).reduce((t, j) => t + Number(j.contractor_payout ?? 0), 0);
  const unassigned = (open ?? []).filter((j) => !j.contractor_id && ["scheduled", "dispatched"].includes(j.status)).length;
  const qa = (open ?? []).filter((j) => j.status === "qa_review").length;
  const avg = reviews?.length ? (reviews.reduce((t, r) => t + r.rating, 0) / reviews.length).toFixed(2) : "—";
  const brief = (alerts ?? []).find((a: Alert) => a.kind === "daily_brief") as Alert | undefined;
  const rest = ((alerts ?? []) as Alert[]).filter((a) => a !== brief);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-2xl font-bold">Good {new Date().getHours() < 12 ? "morning" : "afternoon"}</h1><Link href="/hub/assistant" className="btn-dark">✨ Ask the AI assistant</Link></div>
      <div className="card flex flex-wrap items-center justify-between gap-4 bg-brand-deep text-white">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-white/60">AI-driven rate (month)</div>
          <div className="mt-1 text-4xl font-extrabold">{auto.rate === null ? "—" : `${Math.round(auto.rate * 100)}%`}</div>
          <div className="text-xs text-white/60">{auto.untouched} of {auto.completed} completed jobs had zero human touches · target {Math.round(AI_DRIVEN_TARGET * 100)}% this plan year</div>
        </div>
        <div className="h-3 w-full max-w-sm overflow-hidden rounded-full bg-white/15"><div className={`h-full ${auto.rate !== null && auto.rate >= AI_DRIVEN_TARGET ? "bg-emerald-400" : "bg-sun"}`} style={{ width: `${Math.round((auto.rate ?? 0) * 100)}%` }} /></div>
        <Link href="/hub/workforce" className="text-sm underline">{iebcPending ?? 0} IEBC actions awaiting approval</Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Our take (month)" value={money(margin)} hint={`${money(revenue)} bookings · ${revenue ? Math.round((margin / revenue) * 100) : 0}% avg take`} />
        <Stat label="Bookings (7 days)" value={week?.length ?? 0} hint={`${open?.length ?? 0} jobs in pipeline`} />
        <Stat label="Needs a pro" value={<span className={unassigned ? "text-rose-600" : ""}>{unassigned}</span>} hint={`${qa} awaiting QA`} />
        <Stat label="Avg rating (month)" value={`${avg} ★`} hint={`${apps ?? 0} new pro applications`} />
      </div>

      {brief && (
        <div className="card border-brand/40 bg-brand-tint">
          <div className="flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wide text-brand-dark">AI morning brief</div><ResolveAlert id={brief.id} /></div>
          <div className="mt-1 text-lg font-bold">{brief.title}</div>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-ink-soft">{brief.body}</pre>
        </div>
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
          {!(todays ?? []).length && <Empty>No visits scheduled today.</Empty>}
          <div className="space-y-2">
            {((todays ?? []) as Job[]).map((j) => (
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
