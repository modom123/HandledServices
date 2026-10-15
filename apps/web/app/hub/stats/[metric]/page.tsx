/*
 * FILE    : apps/web/app/hub/stats/[metric]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-14_2330 UTC
 * PURPOSE : Mastermind → Dashboard drill-down. Each Dashboard tile opens here: totals for the chosen period
 *           (7 / 30 / 90 days, year to date, all time) and every past record behind the number, newest first,
 *           each linking to its job.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getService, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Badge, Empty, fmtDate } from "@/components/ui";
import { LIVE_METRICS, METRICS, RANGES, isMetric, isRange, rangeStart, sum, type MetricKey, type RangeKey } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

const LIMIT = 500;
type Cell = React.ReactNode;
type Result = { totals: [string, string][]; head: string[]; rows: { key: string; cells: Cell[] }[] };
type Tone = "slate" | "green" | "amber" | "red" | "brand";

const jobLink = (j: { id: string; ref: string } | null | undefined) => (j ? <Link className="font-semibold text-brand underline" href={`/hub/jobs/${j.id}`}>{j.ref}</Link> : "—");
const svc = (slug: string) => getService(slug)?.name ?? slug;
const tone = (s: string): Tone => (["paid", "completed", "approved"].includes(s) ? "green" : ["failed", "rejected", "cancelled"].includes(s) ? "red" : ["pending", "held", "new", "refunded"].includes(s) ? "amber" : "slate");
const badge = (s: string | null | undefined) => (s ? <Badge tone={tone(s)}>{s.replace(/_/g, " ")}</Badge> : "—");

type Db = NonNullable<Awaited<ReturnType<typeof getViewer>>>["db"];

async function load(db: Db, m: MetricKey, since: string | null): Promise<Result> {
  const gte = <Q extends { gte: (c: string, v: string) => Q }>(q: Q, col: string) => (since ? q.gte(col, since) : q);
  switch (m) {
    case "revenue": {
      const { data } = await gte(db.from("jobs").select("id, ref, service_slug, contact_name, price_final, contractor_payout, completed_at").eq("status", "completed"), "completed_at").order("completed_at", { ascending: false }).limit(LIMIT);
      const r = data ?? [];
      const rev = sum(r.map((j) => j.price_final)), pay = sum(r.map((j) => j.contractor_payout));
      return {
        totals: [["Revenue", money(rev)], ["Paid to pros", money(pay)], ["Our take", money(rev - pay)], ["Avg take", rev ? `${Math.round(((rev - pay) / rev) * 100)}%` : "—"], ["Jobs", String(r.length)], ["Avg job", r.length ? money(rev / r.length) : "—"]],
        head: ["Completed", "Job", "Service", "Customer", "Price", "Pro payout", "Our take"],
        rows: r.map((j) => ({ key: j.id, cells: [fmtDate(j.completed_at), jobLink(j), svc(j.service_slug), j.contact_name, money(Number(j.price_final ?? 0)), money(Number(j.contractor_payout ?? 0)), money(Number(j.price_final ?? 0) - Number(j.contractor_payout ?? 0))] })),
      };
    }
    case "payments": {
      const { data } = await gte(db.from("payments").select("id, amount, kind, status, created_at, jobs(id, ref, contact_name)"), "created_at").order("created_at", { ascending: false }).limit(LIMIT);
      const r = (data ?? []) as unknown as { id: string; amount: number; kind: string; status: string; created_at: string; jobs: { id: string; ref: string; contact_name: string } | null }[];
      const by = (s: string) => r.filter((p) => p.status === s);
      return {
        totals: [["Collected", money(sum(by("paid").map((p) => p.amount)))], ["Refunded", money(sum(by("refunded").map((p) => p.amount)))], ["Pending", money(sum(by("pending").map((p) => p.amount)))], ["Failed", String(by("failed").length)], ["Payments", String(r.length)]],
        head: ["Date", "Job", "Customer", "Kind", "Amount", "Status"],
        rows: r.map((p) => ({ key: p.id, cells: [fmtDate(p.created_at), jobLink(p.jobs), p.jobs?.contact_name ?? "—", p.kind.replace(/_/g, " "), money(Number(p.amount)), badge(p.status)] })),
      };
    }
    case "payouts": {
      const { data } = await gte(db.from("payouts").select("id, amount, status, created_at, paid_at, contractors(business_name), jobs(id, ref)"), "created_at").order("created_at", { ascending: false }).limit(LIMIT);
      const r = (data ?? []) as unknown as { id: string; amount: number; status: string; created_at: string; paid_at: string | null; contractors: { business_name: string } | null; jobs: { id: string; ref: string } | null }[];
      const by = (...s: string[]) => r.filter((p) => s.includes(p.status));
      return {
        totals: [["Paid out", money(sum(by("paid").map((p) => p.amount)))], ["Owed", money(sum(by("pending", "approved").map((p) => p.amount)))], ["Held", money(sum(by("held").map((p) => p.amount)))], ["Payouts", String(r.length)]],
        head: ["Created", "Pro", "Job", "Amount", "Status", "Paid on"],
        rows: r.map((p) => ({ key: p.id, cells: [fmtDate(p.created_at), p.contractors?.business_name ?? "—", jobLink(p.jobs), money(Number(p.amount)), badge(p.status), p.paid_at ? fmtDate(p.paid_at) : "—"] })),
      };
    }
    case "bookings": {
      const { data } = await gte(db.from("jobs").select("id, ref, service_slug, contact_name, city, status, estimate_low, estimate_high, price_final, source, created_at"), "created_at").order("created_at", { ascending: false }).limit(LIMIT);
      const r = data ?? [];
      const doneN = r.filter((j) => j.status === "completed").length, cancN = r.filter((j) => j.status === "cancelled").length;
      return {
        totals: [["Bookings", String(r.length)], ["Completed", String(doneN)], ["Cancelled", String(cancN)], ["Still open", String(r.length - doneN - cancN)], ["Booked value", money(sum(r.map((j) => j.price_final ?? j.estimate_high)))]],
        head: ["Booked", "Job", "Service", "Customer", "City", "Source", "Price / estimate", "Status"],
        rows: r.map((j) => ({ key: j.id, cells: [fmtDate(j.created_at), jobLink(j), svc(j.service_slug), j.contact_name, j.city, j.source, j.price_final != null ? money(Number(j.price_final)) : `${money(Number(j.estimate_low))}–${money(Number(j.estimate_high))}`, badge(j.status)] })),
      };
    }
    case "open": {
      // Current state, not a period: every job still in flight.
      const { data } = await db.from("jobs").select("id, ref, service_slug, contact_name, city, status, scheduled_date, contractor_id, price_final, estimate_high").not("status", "in", "(completed,cancelled)").order("scheduled_date", { ascending: true, nullsFirst: false }).limit(LIMIT);
      const r = (data ?? []).sort((a, b) => Number(!!a.contractor_id) - Number(!!b.contractor_id));
      const noPro = r.filter((j) => !j.contractor_id && ["scheduled", "dispatched"].includes(j.status)).length;
      return {
        totals: [["Open jobs", String(r.length)], ["Need a pro", String(noPro)], ["In QA", String(r.filter((j) => j.status === "qa_review").length)], ["Pipeline value", money(sum(r.map((j) => j.price_final ?? j.estimate_high)))]],
        head: ["Scheduled", "Job", "Service", "Customer", "City", "Pro", "Status"],
        rows: r.map((j) => ({ key: j.id, cells: [j.scheduled_date ? fmtDate(j.scheduled_date) : "—", jobLink(j), svc(j.service_slug), j.contact_name, j.city, j.contractor_id ? "Assigned" : <span className="font-semibold text-rose-600">None</span>, badge(j.status)] })),
      };
    }
    case "cancellations": {
      const { data } = await gte(db.from("jobs").select("id, ref, service_slug, contact_name, cancelled_at, cancel_reason, cancel_fee").eq("status", "cancelled"), "cancelled_at").order("cancelled_at", { ascending: false }).limit(LIMIT);
      const r = data ?? [];
      const reasons = new Map<string, number>();
      for (const j of r) reasons.set(j.cancel_reason ?? "unknown", (reasons.get(j.cancel_reason ?? "unknown") ?? 0) + 1);
      const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        totals: [["Cancelled", String(r.length)], ["Fees charged", money(sum(r.map((j) => j.cancel_fee)))], ["Top reason", topReason ? `${topReason[0]} (${topReason[1]})` : "—"]],
        head: ["Cancelled", "Job", "Service", "Customer", "Reason", "Fee"],
        rows: r.map((j) => ({ key: j.id, cells: [j.cancelled_at ? fmtDate(j.cancelled_at) : "—", jobLink(j), svc(j.service_slug), j.contact_name, j.cancel_reason ?? "—", money(Number(j.cancel_fee ?? 0))] })),
      };
    }
    case "reviews": {
      const { data } = await gte(db.from("reviews").select("id, rating, comment, created_at, jobs(id, ref, service_slug), contractors(business_name)"), "created_at").order("created_at", { ascending: false }).limit(LIMIT);
      const r = (data ?? []) as unknown as { id: string; rating: number; comment: string | null; created_at: string; jobs: { id: string; ref: string; service_slug: string } | null; contractors: { business_name: string } | null }[];
      return {
        totals: [["Avg rating", r.length ? `${(sum(r.map((x) => x.rating)) / r.length).toFixed(2)} ★` : "—"], ["Reviews", String(r.length)], ["5 ★", String(r.filter((x) => x.rating === 5).length)], ["3 ★ or below", String(r.filter((x) => x.rating <= 3).length)]],
        head: ["Date", "Job", "Service", "Pro", "Rating", "Comment"],
        rows: r.map((x) => ({ key: x.id, cells: [fmtDate(x.created_at), jobLink(x.jobs), x.jobs ? svc(x.jobs.service_slug) : "—", x.contractors?.business_name ?? "—", <span key="r" className={x.rating <= 3 ? "font-semibold text-rose-600" : ""}>{"★".repeat(x.rating)}</span>, <span key="c" className="text-xs">{x.comment ?? ""}</span>] })),
      };
    }
    case "applications": {
      const { data } = await gte(db.from("contractor_applications").select("id, business_name, contact_name, trades, zips, years_experience, insured, status, created_at"), "created_at").order("created_at", { ascending: false }).limit(LIMIT);
      const r = data ?? [];
      const by = (s: string) => String(r.filter((a) => a.status === s).length);
      return {
        totals: [["Applications", String(r.length)], ["New", by("new")], ["Reviewing", by("reviewing")], ["Approved", by("approved")], ["Rejected", by("rejected")]],
        head: ["Applied", "Business", "Contact", "Trades", "Experience", "Insured", "Status"],
        rows: r.map((a) => ({ key: a.id, cells: [fmtDate(a.created_at), a.business_name, a.contact_name, (a.trades ?? []).join(", ") || "—", a.years_experience != null ? `${a.years_experience} yrs` : "—", a.insured ? "Yes" : "No", badge(a.status)] })),
      };
    }
  }
}

export async function generateMetadata({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  return { title: isMetric(metric) ? `${METRICS[metric].title} history` : "History" };
}

export default async function StatHistory({ params, searchParams }: { params: Promise<{ metric: string }>; searchParams: Promise<{ range?: string }> }) {
  const [{ metric }, sp, v] = await Promise.all([params, searchParams, getViewer()]);
  if (!v) return null;
  if (!isMetric(metric)) notFound();
  const range: RangeKey = isRange(sp.range) ? sp.range : "30d";
  const meta = METRICS[metric];
  const live = LIVE_METRICS.includes(metric);
  const { totals, head, rows } = await load(v.db, metric, live ? null : rangeStart(range));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/hub" className="text-sm text-brand underline">← Dashboard</Link>
        <h1 className="mt-2 text-2xl font-bold">{meta.icon} {meta.title}</h1>
        <p className="text-sm text-ink-soft">{meta.blurb}</p>
      </div>

      {!live && (
        <nav className="flex flex-wrap gap-2" aria-label="Period">
          {(Object.keys(RANGES) as RangeKey[]).map((k) => (
            <Link key={k} href={`/hub/stats/${metric}?range=${k}`} aria-current={k === range ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm ${k === range ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-ink"}`}>{RANGES[k]}</Link>
          ))}
        </nav>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {totals.map(([l, val]) => (
          <div key={l} className="card p-4"><div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{l}</div><div className="mt-1 text-xl font-bold">{val}</div></div>
        ))}
      </div>

      {!rows.length ? <Empty>Nothing recorded {live ? "right now" : `in ${RANGES[range].toLowerCase()}`}.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">{head.map((h) => <th key={h} className="px-4 py-2">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{rows.map((r) => (
              <tr key={r.key} className="align-top hover:bg-paper">{r.cells.map((c, i) => <td key={i} className="px-4 py-2">{c}</td>)}</tr>
            ))}</tbody>
          </table>
          {rows.length >= LIMIT && <p className="p-4 text-xs text-ink-soft">Showing the latest {LIMIT}. Pick a shorter period to see everything in it.</p>}
        </div>
      )}
    </div>
  );
}
