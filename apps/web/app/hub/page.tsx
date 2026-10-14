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
 */
import Link from "next/link";
import { getService, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { aiDrivenRate, aiDrivenTargetNow } from "@/lib/metrics";
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
    v.db.from("contractor_applications").select("status, created_at").or(`status.eq.new,created_at.gte.${monthStart}`).limit(5000),
    aiDrivenRate(v.db, monthStart),
    aiDrivenTargetNow(v.db),
    v.db.from("factoring_partners").select("status, advance_rate, fee_pct"),
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
  const appsMonth = (apps ?? []).filter((a) => a.created_at >= monthStart).length;

  const up = (pct: number | null) => (pct === null ? null : pct >= 0);
  const vsMonth = "same days last month";

  const groups: [string, Tile[]][] = [
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
    ["Quality & growth", [
      { label: "Avg rating (month)", value: rating === null ? "—" : `${rating.toFixed(2)} ★`, hint: `${rv.cur.length} review${rv.cur.length === 1 ? "" : "s"}${lowReviews ? ` · ${lowReviews} at 3★ or below` : ""}`, trend: rating !== null && ratingPrev !== null ? { text: `${rating >= ratingPrev ? "▲" : "▼"} ${Math.abs(rating - ratingPrev).toFixed(2)} vs ${vsMonth}`, good: rating >= ratingPrev } : undefined, href: stat("reviews"), alert: lowReviews > 0 },
      { label: "Pro applications", value: String(newApps), hint: `waiting for review · ${appsMonth} applied this month`, href: stat("applications") },
    ]],
  ];

  // Plain-English insights — the few things worth knowing at a glance.
  const insights: { tone: "good" | "warn" | "info"; text: string; href: string }[] = [];
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

      {groups.map(([name, tiles]) => (
        <section key={name}>
          <h2 className="mb-3 font-bold">{name}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map((t) => <TileCard key={t.label} t={t} />)}</div>
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
