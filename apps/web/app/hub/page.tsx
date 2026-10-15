/*
 * FILE    : apps/web/app/hub/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Mastermind Dashboard — a snapshot of every number that matters plus plain-English insights. Every tile is a
 *           button: click it for the full history behind the number (app/hub/stats/[metric]).
 * UPDATED : 2026-10-04_1934 UTC — AI-driven target follows the growth plan year (80% → 95%).
 * UPDATED : 2026-10-06_0324 UTC — Factoring partners strip (outreach status and quotes in).
 * UPDATED : 2026-10-14_2330 UTC — Stats and insights only. The AI morning brief, alerts and today's schedule moved to
 *           Daily Briefing (app/hub/briefing). Tiles compare month-to-date with the same days last month and open
 *           drill-down history pages.
 * UPDATED : 2026-10-15_0010 UTC — 🧰 Pros & recruiting is the first section: active roster, candidates in the pipeline,
 *           applications, jobs no pro could take, pro-lead outreach, insurance expiring, drop-offs and applicant → active
 *           conversion, plus the recruiting funnel by stage. Recruiting insights lead the list.
 */
import Link from "next/link";
import { PIPELINE, getService, money, type PipelineStage } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { aiDrivenRate, aiDrivenTargetNow } from "@/lib/metrics";
import { pipeline } from "@/lib/recruiting";
import { adminClient } from "@/lib/supabase/server";
import { pctChange, sum, trendLabel, type MetricKey } from "@/lib/dashboard";

type Tile = { label: string; value: string; hint: string; trend?: { text: string; good: boolean | null }; href: string; alert?: boolean };

function TileCard({ t }: { t: Tile }) {
  return (
    <Link href={t.href} className="card group flex flex-col justify-between gap-2 p-4 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.label}</div>
        <div className={`mt-1 text-2xl font-bold ${t.alert ? "text-rose-600" : ""}`}>{t.value}</div>
        <div className="mt-1 text-xs text-ink-soft">{t.hint}</div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className={t.trend?.good === true ? "font-semibold text-emerald-700" : t.trend?.good === false ? "font-semibold text-rose-600" : "text-ink-soft"}>{t.trend?.text ?? ""}</span>
        <span className="text-brand opacity-60 group-hover:opacity-100">History →</span>
      </div>
    </Link>
  );
}

const stat = (m: MetricKey) => `/hub/stats/${m}`;

const FUNNEL_LABEL: Record<PipelineStage, string> = {
  applied: "Applied", screened: "Needs decision", interview: "Interviewing", interviewed: "Interviewed", invited: "Invited",
  onboarding: "Doing setup", verifying: "Docs check", background: "Background", active: "Active", rejected: "Not a fit", dropped: "Dropped",
};

export default async function HubDashboard() {
  const v = await getViewer();
  if (!v) return null;
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString();
  // Same point in last month (e.g. the 14th at this hour) so month-to-date compares like with like.
  const lastMonthCut = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, Math.min(now.getUTCDate(), 28), now.getUTCHours())).toISOString();
  const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const d14 = new Date(now.getTime() - 14 * 86400000).toISOString();

  const [{ data: done }, { data: created }, { data: open }, { data: cancelled }, { data: pays }, { data: pouts }, { data: revs }, { data: apps }, auto, target, { data: factors }] = await Promise.all([
    v.db.from("jobs").select("service_slug, price_final, contractor_payout, completed_at").eq("status", "completed").gte("completed_at", lastMonthStart).limit(5000),
    v.db.from("jobs").select("created_at").gte("created_at", d14).limit(5000),
    v.db.from("jobs").select("status, contractor_id").not("status", "in", "(completed,cancelled)").limit(5000),
    v.db.from("jobs").select("cancelled_at, cancel_fee").eq("status", "cancelled").gte("cancelled_at", lastMonthStart).limit(5000),
    v.db.from("payments").select("amount, status, created_at").gte("created_at", lastMonthStart).limit(5000),
    v.db.from("payouts").select("amount, status, paid_at").or(`status.in.(pending,approved,held),paid_at.gte.${lastMonthStart}`).limit(5000),
    v.db.from("reviews").select("rating, created_at").gte("created_at", lastMonthStart).limit(5000),
    v.db.from("contractor_applications").select("status, created_at").or(`status.eq.new,created_at.gte.${lastMonthStart}`).limit(5000),
    aiDrivenRate(v.db, monthStart),
    aiDrivenTargetNow(v.db),
    v.db.from("factoring_partners").select("status, advance_rate, fee_pct"),
  ]);
  // Recruiting & roster — the most important part of the business, so it gets its own reads.
  const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  const adb = adminClient();
  const [funnel, { data: pros }, { data: activations }, { data: noProAlerts }, { data: proLeads }] = await Promise.all([
    pipeline(),
    v.db.from("contractors").select("status, insured_until, dropped_at").limit(10000),
    v.db.from("recruiting_events").select("created_at").eq("kind", "activated").gte("created_at", lastMonthStart).limit(5000),
    v.db.from("ops_alerts").select("job_id").eq("kind", "no_pros").gte("created_at", d30).not("job_id", "is", null).limit(5000),
    adb.from("pro_leads").select("status").limit(20000),
  ]);

  // Split rows into "this month so far" and "same days last month".
  const split = <T,>(rows: T[] | null, at: (r: T) => string | null) => {
    const r = rows ?? [];
    return {
      cur: r.filter((x) => (at(x) ?? "") >= monthStart),
      prev: r.filter((x) => { const t = at(x) ?? ""; return t >= lastMonthStart && t < lastMonthCut; }),
    };
  };
  const jobs = split(done, (j) => j.completed_at);
  const revenue = sum(jobs.cur.map((j) => j.price_final));
  const revenuePrev = sum(jobs.prev.map((j) => j.price_final));
  const take = revenue - sum(jobs.cur.map((j) => j.contractor_payout));
  const takePrev = revenuePrev - sum(jobs.prev.map((j) => j.contractor_payout));
  const takeRate = revenue ? Math.round((take / revenue) * 100) : 0;

  const paid = split((pays ?? []).filter((p) => p.status === "paid"), (p) => p.created_at);
  const collected = sum(paid.cur.map((p) => p.amount));
  const collectedPrev = sum(paid.prev.map((p) => p.amount));
  const failed = (pays ?? []).filter((p) => p.status === "failed" && p.created_at >= monthStart).length;

  const po = pouts ?? [];
  const paidOut = split(po.filter((p) => p.status === "paid"), (p) => p.paid_at);
  const owed = sum(po.filter((p) => p.status === "pending" || p.status === "approved").map((p) => p.amount));
  const held = po.filter((p) => p.status === "held").length;

  const week = (created ?? []).filter((j) => j.created_at >= d7).length;
  const weekPrev = (created ?? []).length - week;
  const unassigned = (open ?? []).filter((j) => !j.contractor_id && ["scheduled", "dispatched"].includes(j.status)).length;
  const qa = (open ?? []).filter((j) => j.status === "qa_review").length;

  const canc = split(cancelled, (j) => j.cancelled_at);
  const cancRate = canc.cur.length + jobs.cur.length ? Math.round((canc.cur.length / (canc.cur.length + jobs.cur.length)) * 100) : 0;

  const rv = split(revs, (r) => r.created_at);
  const avg = (xs: { rating: number }[]) => (xs.length ? sum(xs.map((r) => r.rating)) / xs.length : null);
  const rating = avg(rv.cur);
  const ratingPrev = avg(rv.prev);
  const lowReviews = rv.cur.filter((r) => r.rating <= 3).length;

  const newApps = (apps ?? []).filter((a) => a.status === "new").length;
  const appSplit = split(apps, (a) => a.created_at);

  const roster = pros ?? [];
  const activePros = roster.filter((c) => c.status === "approved");
  const act = split(activations, (e) => e.created_at);
  const stageCount = (s: PipelineStage) => funnel.filter((r) => r.stage === s).length;
  const inPipeline = funnel.filter((r) => !["active", "rejected", "dropped"].includes(r.stage)).length;
  const needDecision = stageCount("screened") + stageCount("interviewed");
  const noProJobs = new Set((noProAlerts ?? []).map((a) => a.job_id)).size;
  const leads = proLeads ?? [];
  const leadsOut = leads.filter((l) => ["queued", "emailing", "clicked", "replied", "call"].includes(l.status)).length;
  const leadsApplied = leads.filter((l) => l.status === "applied").length;
  const leadsReplied = leads.filter((l) => ["replied", "call"].includes(l.status)).length;
  const insExpiring = activePros.filter((c) => c.insured_until && c.insured_until <= in30).length;
  const insExpired = activePros.filter((c) => c.insured_until && c.insured_until < today).length;
  const droppedMonth = roster.filter((c) => c.dropped_at && c.dropped_at >= monthStart).length;
  const recent = funnel.filter((r) => String(r.app.created_at ?? "") >= d90 && r.stage !== "rejected");
  const conversion = recent.length ? Math.round((recent.filter((r) => r.stage === "active").length / recent.length) * 100) : null;

  const up = (pct: number | null) => (pct === null ? null : pct >= 0);
  const vsMonth = "same days last month";

  const groups: [string, Tile[]][] = [
    ["🧰 Pros & recruiting", [
      { label: "Active pros", value: String(activePros.length), hint: `+${act.cur.length} activated this month · ${roster.length} on file`, trend: { text: trendLabel(pctChange(act.cur.length, act.prev.length), `activations ${vsMonth}`), good: up(pctChange(act.cur.length, act.prev.length)) }, href: stat("roster") },
      { label: "Candidates in pipeline", value: String(inPipeline), hint: needDecision ? `${needDecision} need a decision from you` : "nobody waiting on a decision", href: "/hub/recruiting", alert: needDecision > 0 },
      { label: "New applications (month)", value: String(appSplit.cur.length), hint: `${newApps} not reviewed yet`, trend: { text: trendLabel(pctChange(appSplit.cur.length, appSplit.prev.length), vsMonth), good: up(pctChange(appSplit.cur.length, appSplit.prev.length)) }, href: stat("applications") },
      { label: "Jobs no pro could take (30 days)", value: String(noProJobs), hint: noProJobs ? "see where to recruit" : "every job found a pro", href: "/hub/gaps", alert: noProJobs > 0 },
      { label: "Pro leads in outreach", value: String(leadsOut), hint: `${leadsReplied} replied · ${leadsApplied} applied · ${leads.length} found`, href: "/hub/leads" },
      { label: "Applicant → active (90 days)", value: conversion === null ? "—" : `${conversion}%`, hint: `${recent.filter((r) => r.stage === "active").length} of ${recent.length} applicants now active`, href: "/hub/recruiting?stage=active" },
      { label: "Insurance expiring (30 days)", value: String(insExpiring), hint: insExpired ? `${insExpired} already expired` : "active pros only", href: stat("roster"), alert: insExpired > 0 },
      { label: "Dropped off (month)", value: String(droppedMonth), hint: "pros who stopped mid-setup or left", href: "/hub/recruiting?stage=dropped", alert: droppedMonth > 0 },
    ]],
    ["Money", [
      { label: "Revenue (month)", value: money(revenue), hint: `${jobs.cur.length} completed job${jobs.cur.length === 1 ? "" : "s"}`, trend: { text: trendLabel(pctChange(revenue, revenuePrev), vsMonth), good: up(pctChange(revenue, revenuePrev)) }, href: stat("revenue") },
      { label: "Our take (month)", value: money(take), hint: `${takeRate}% average take`, trend: { text: trendLabel(pctChange(take, takePrev), vsMonth), good: up(pctChange(take, takePrev)) }, href: stat("revenue") },
      { label: "Collected (month)", value: money(collected), hint: failed ? `${failed} failed payment${failed === 1 ? "" : "s"} this month` : "no failed payments this month", trend: { text: trendLabel(pctChange(collected, collectedPrev), vsMonth), good: up(pctChange(collected, collectedPrev)) }, href: stat("payments"), alert: failed > 0 },
      { label: "Paid to pros (month)", value: money(sum(paidOut.cur.map((p) => p.amount))), hint: `${money(owed)} owed${held ? ` · ${held} held` : ""}`, href: stat("payouts") },
    ]],
    ["Jobs", [
      { label: "Bookings (7 days)", value: String(week), hint: `${(open ?? []).length} jobs in progress`, trend: { text: trendLabel(pctChange(week, weekPrev), "prior 7 days"), good: up(pctChange(week, weekPrev)) }, href: stat("bookings") },
      { label: "Needs a pro", value: String(unassigned), hint: `${qa} awaiting QA`, href: stat("open"), alert: unassigned > 0 },
      { label: "Cancellations (month)", value: String(canc.cur.length), hint: `${cancRate}% of jobs · ${money(sum(canc.cur.map((j) => j.cancel_fee)))} in fees`, trend: { text: trendLabel(pctChange(canc.cur.length, canc.prev.length), vsMonth), good: pctChange(canc.cur.length, canc.prev.length) === null ? null : (pctChange(canc.cur.length, canc.prev.length) ?? 0) <= 0 }, href: stat("cancellations") },
      { label: "AI-driven rate (month)", value: auto.rate === null ? "—" : `${Math.round(auto.rate * 100)}%`, hint: `${auto.untouched} of ${auto.completed} jobs had zero human touches`, trend: { text: `target ${Math.round(target * 100)}%`, good: auto.rate === null ? null : auto.rate >= target }, href: "/hub/agents" },
    ]],
    ["Quality", [
      { label: "Avg rating (month)", value: rating === null ? "—" : `${rating.toFixed(2)} ★`, hint: `${rv.cur.length} review${rv.cur.length === 1 ? "" : "s"}${lowReviews ? ` · ${lowReviews} at 3★ or below` : ""}`, trend: rating !== null && ratingPrev !== null ? { text: `${rating >= ratingPrev ? "▲" : "▼"} ${Math.abs(rating - ratingPrev).toFixed(2)} vs ${vsMonth}`, good: rating >= ratingPrev } : undefined, href: stat("reviews"), alert: lowReviews > 0 },
    ]],
  ];

  // Plain-English insights — the few things worth knowing at a glance.
  const insights: { tone: "good" | "warn" | "info"; text: string; href: string }[] = [];
  if (noProJobs) insights.push({ tone: "warn", text: `${noProJobs} job${noProJobs === 1 ? "" : "s"} in the last 30 days couldn't find a pro — Supply gaps shows which services and ZIPs to recruit for.`, href: "/hub/gaps" });
  if (needDecision) insights.push({ tone: "warn", text: `${needDecision} pro candidate${needDecision === 1 ? " is" : "s are"} waiting on your decision (screened or interviewed).`, href: "/hub/recruiting" });
  const appPct = pctChange(appSplit.cur.length, appSplit.prev.length);
  if (appPct !== null) insights.push({ tone: appPct >= 0 ? "good" : "warn", text: `Pro applications are ${appPct >= 0 ? "up" : "down"} ${Math.abs(appPct)}% vs the same days last month (${appSplit.cur.length} vs ${appSplit.prev.length}).`, href: stat("applications") });
  if (insExpiring) insights.push({ tone: "warn", text: `${insExpiring} active pro${insExpiring === 1 ? "'s" : "s'"} insurance expires within 30 days${insExpired ? ` (${insExpired} already expired)` : ""}.`, href: stat("roster") });
  const revPct = pctChange(revenue, revenuePrev);
  if (revPct !== null) insights.push({ tone: revPct >= 0 ? "good" : "warn", text: `Revenue is ${revPct >= 0 ? "up" : "down"} ${Math.abs(revPct)}% compared with the same days last month (${money(revenue)} vs ${money(revenuePrev)}).`, href: stat("revenue") });
  const bySvc = new Map<string, number>();
  for (const j of jobs.cur) bySvc.set(j.service_slug, (bySvc.get(j.service_slug) ?? 0) + Number(j.price_final ?? 0));
  const top = [...bySvc.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && revenue) insights.push({ tone: "info", text: `${getService(top[0])?.name ?? top[0]} is your top service this month — ${money(top[1])} (${Math.round((top[1] / revenue) * 100)}% of revenue).`, href: stat("revenue") });
  if (unassigned) insights.push({ tone: "warn", text: `${unassigned} scheduled job${unassigned === 1 ? " has" : "s have"} no pro yet.`, href: stat("open") });
  if (owed) insights.push({ tone: "info", text: `${money(owed)} is owed to pros in the next payout run.`, href: stat("payouts") });
  if (cancRate >= 10) insights.push({ tone: "warn", text: `Cancellations are running at ${cancRate}% this month — check the reasons.`, href: stat("cancellations") });
  if (lowReviews) insights.push({ tone: "warn", text: `${lowReviews} review${lowReviews === 1 ? "" : "s"} this month came in at 3★ or below.`, href: stat("reviews") });
  if (failed) insights.push({ tone: "warn", text: `${failed} card payment${failed === 1 ? "" : "s"} failed this month.`, href: stat("payments") });
  if (!insights.length) insights.push({ tone: "info", text: "Not enough activity yet this month to spot trends — insights appear as jobs complete.", href: stat("bookings") });

  const F = factors ?? [];
  const factorQuotes = F.filter((f) => f.advance_rate != null && f.fee_pct != null).length;
  const factorActive = F.filter((f) => f.status === "active").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-ink-soft">Month to date · click any number for its full history</p>
        </div>
        <div className="flex gap-2"><Link href="/hub/briefing" className="btn-ghost">☀️ Daily Briefing</Link><Link href="/hub/assistant" className="btn-dark">✨ Ask the AI assistant</Link></div>
      </div>

      <section className="card space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Insights</h2>
        <ul className="space-y-1.5">
          {insights.map((i) => (
            <li key={i.text}><Link href={i.href} className="flex items-start gap-2 text-sm hover:underline">
              <span aria-hidden>{i.tone === "good" ? "📈" : i.tone === "warn" ? "⚠️" : "💡"}</span><span>{i.text}</span>
            </Link></li>
          ))}
        </ul>
      </section>

      {groups.map(([name, tiles], gi) => (
        <section key={name}>
          <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="font-bold">{name}</h2>{gi === 0 && <Link href="/hub/recruiting" className="text-sm text-brand underline">Open recruiting →</Link>}</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map((t) => <TileCard key={t.label} t={t} />)}</div>
          {gi === 0 && (
            <div className="card mt-4 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">Recruiting funnel — click a stage to see who’s in it</div>
              <div className="flex flex-wrap gap-2">
                {PIPELINE.map((s, i) => (
                  <Link key={s} href={`/hub/recruiting?stage=${s}`} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:border-brand ${s === "active" ? "border-emerald-300 bg-emerald-50" : ["screened", "interviewed"].includes(s) && stageCount(s) ? "border-rose-300 bg-rose-50" : "border-line bg-white"}`}>
                    <span className="text-ink-soft">{i + 1}.</span><span>{FUNNEL_LABEL[s]}</span><b>{stageCount(s)}</b>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      ))}

      {F.length > 0 && (
        <Link href="/hub/factoring" className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-brand">
          <span className="text-sm font-semibold">🏦 Factoring partners <span className="font-normal text-ink-soft">· covers weekly pro payouts while net-30+ clients pay</span></span>
          <span className="text-xs text-ink-soft">{F.filter((f) => f.status !== "to_contact").length} of {F.length} contacted · {factorQuotes} quotes in · {factorActive ? `${factorActive} active` : "none active yet"} →</span>
        </Link>
      )}
    </div>
  );
}
