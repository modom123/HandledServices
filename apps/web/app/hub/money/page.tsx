/*
 * FILE    : apps/web/app/hub/money/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2100 UTC
 * PURPOSE : Hub → Money → Jobs & payouts: every job's money connected in one place (internal — customers never see pro pay):
 *             1 Totals for the period — customers paid, paid to pros, what Handled keeps (take %), tips passed through
 *             2 Next Monday's payout run — who gets paid, how much, and who can't be paid yet (Stripe not set up)
 *             3 The job ledger — each job: customer paid → pro pay → Handled keeps → where the pro's money stands
 *               (not created / held / pending / owed Monday / paid), with anything that doesn't add up flagged
 *           One calculation for all of it (core jobMoney); the job page's Money card uses the same one.
 *           Admins only, like Finance. Refunds and payout actions stay on the job page and in Finance.
 */
import Link from "next/link";
import { PAYOUT_STAGE_LABEL, getService, jobMoney, money, nextMonday, type MoneyLine, type PayoutStage } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";
import { adminOnly } from "@/components/AdminOnly";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs & payouts" };

type Line = MoneyLine & { id: string; job_id: string | null; contractor_id: string; reason: string | null; created_at: string };
const STAGE_TONE: Record<PayoutStage, string> = { none: "bg-paper text-ink-soft", not_created: "bg-amber-50 text-amber-900", held: "bg-rose-50 text-rose-700", pending: "bg-amber-50 text-amber-900", approved: "bg-sky-50 text-sky-800", partly_paid: "bg-sky-50 text-sky-800", paid: "bg-brand-tint text-brand-dark" };
const FILTERS = [["all", "All"], ["attention", "Needs attention"], ["owed", "Pro owed"], ["paid", "Paid out"]] as const;

export default async function JobsAndPayouts({ searchParams }: { searchParams: Promise<{ days?: string; show?: string }> }) {
  const gate = await adminOnly(); if (gate) return gate;
  const q = await searchParams;
  const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
  const show = FILTERS.some(([k]) => k === q.show) ? q.show! : "all";
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const db = adminClient();
  const [{ data: jobs }, { data: open }] = await Promise.all([
    db.from("jobs").select("id, ref, service_slug, status, scheduled_date, completed_at, created_at, contractor_id, price_final, contractor_payout, amount_paid, amount_refunded, tip_total, paid_at, remedy, billed_on_terms, contact_name")
      .not("status", "in", "(cancelled,site_visit)").gt("price_final", 0).or(`completed_at.gte.${since},and(completed_at.is.null,created_at.gte.${since})`).order("created_at", { ascending: false }).limit(1000),
    db.from("payouts").select("id, job_id, contractor_id, amount, status, kind, reason, paid_at, week_of, created_at").in("status", ["approved", "held", "pending", "clawback"]).limit(5000),
  ]);
  const jobIds = (jobs ?? []).map((j) => j.id as string);
  const { data: jobLines } = jobIds.length ? await db.from("payouts").select("id, job_id, contractor_id, amount, status, kind, reason, paid_at, week_of, created_at").in("job_id", jobIds).limit(10000) : { data: [] };
  const proIds = [...new Set([...(jobs ?? []).map((j) => j.contractor_id as string | null), ...((open ?? []) as Line[]).map((l) => l.contractor_id)].filter(Boolean))] as string[];
  const { data: pros } = proIds.length ? await db.from("contractors").select("id, business_name, stripe_account_id").in("id", proIds) : { data: [] };
  const pro = new Map(((pros ?? []) as { id: string; business_name: string; stripe_account_id: string | null }[]).map((p) => [p.id, p]));
  const linesOf = new Map<string, Line[]>();
  for (const l of (jobLines ?? []) as Line[]) if (l.job_id) linesOf.set(l.job_id, [...(linesOf.get(l.job_id) ?? []), l]);

  const rows = (jobs ?? []).map((j) => ({ j, m: jobMoney(j as never, linesOf.get(j.id as string) ?? []) }));
  const sum = (f: (x: (typeof rows)[number]) => number) => rows.reduce((t, x) => t + f(x), 0);
  const collected = sum((x) => x.m.customerNet), toPros = sum((x) => x.m.proPay), keep = sum((x) => x.m.keep), tips = sum((x) => x.m.tips), fees = sum((x) => x.m.cardFee);
  const attention = rows.filter((x) => x.m.issues.length);
  const shown = show === "attention" ? attention : show === "owed" ? rows.filter((x) => ["approved", "partly_paid", "held", "pending", "not_created"].includes(x.m.stage)) : show === "paid" ? rows.filter((x) => x.m.stage === "paid") : rows;

  // next Monday's run: every approved line (minus clawbacks) per pro, whatever job it's from
  const run = new Map<string, { owed: number; lines: number; held: number }>();
  for (const l of (open ?? []) as Line[]) {
    const r = run.get(l.contractor_id) ?? { owed: 0, lines: 0, held: 0 };
    if (l.status === "approved" || l.status === "clawback") { r.owed += Number(l.amount); r.lines++; }
    if (l.status === "held" || l.status === "pending") r.held += Number(l.amount);
    run.set(l.contractor_id, r);
  }
  const runRows = [...run.entries()].filter(([, r]) => r.owed > 0 || r.held > 0).sort((a, b) => b[1].owed - a[1].owed);
  const runTotal = runRows.reduce((t, [, r]) => t + Math.max(0, r.owed), 0);
  const notReady = runRows.filter(([id, r]) => r.owed > 0 && !pro.get(id)?.stripe_account_id).length;
  const href = (o: { days?: number; show?: string }) => `/hub/money?days=${o.days ?? days}&show=${o.show ?? show}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Jobs & payouts</h1>
          <p className="text-sm text-ink-soft">Every job's money, connected: what the customer paid → the split → the pro's payout → the Monday run. Internal only — customers see their price, never the pro's pay.</p>
        </div>
        <div className="flex gap-1 text-sm">{[7, 30, 90].map((d) => <Link key={d} href={href({ days: d })} className={`rounded-full border px-3 py-1 ${d === days ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{d} days</Link>)}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Customers paid" value={money(collected)} hint={`${rows.length} jobs · net of refunds`} />
        <Stat label="Pro pay" value={money(toPros)} hint={collected ? `${Math.round((toPros / collected) * 100)}% of what customers paid` : "—"} />
        <Stat label="Handled keeps" value={money(keep)} hint={collected ? `${Math.round((keep / collected) * 100)}% take · ${money(keep - fees)} after est. card fees` : "—"} />
        <Stat label="Tips (100% to pros)" value={money(tips)} hint="charged separately, passed through" />
        <Stat label={`Monday ${nextMonday().slice(5)} run`} value={money(runTotal)} hint={`${runRows.filter(([, r]) => r.owed > 0).length} pros${notReady ? ` · ${notReady} not set up in Stripe` : ""}`} />
      </div>

      <section className="card overflow-x-auto p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 p-4 pb-2">
          <h2 className="font-bold">Next payout run — Monday {nextMonday()}</h2>
          <span className="text-xs text-ink-soft">Sent automatically through Stripe. Pay early or hold a line in <Link href="/hub/finance" className="underline">Finance</Link>.</span>
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-y border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><th className="p-3">Pro</th><th className="p-3 text-right">Lines</th><th className="p-3 text-right">Owed Monday</th><th className="p-3 text-right">Held / pending</th><th className="p-3">Can be paid?</th></tr></thead>
          <tbody>
            {!runRows.length && <tr><td colSpan={5} className="p-3 text-ink-soft">Nothing owed right now.</td></tr>}
            {runRows.map(([id, r]) => (
              <tr key={id} className="border-b border-line last:border-0">
                <td className="p-3"><Link href={`/hub/pros/${id}`} className="font-semibold underline decoration-dotted">{pro.get(id)?.business_name ?? "Pro"}</Link></td>
                <td className="p-3 text-right">{r.lines}</td>
                <td className="p-3 text-right font-semibold">{money(Math.max(0, r.owed))}</td>
                <td className={`p-3 text-right ${r.held ? "text-amber-800" : "text-ink-soft"}`}>{money(r.held)}</td>
                <td className="p-3">{r.owed <= 0 ? <span className="text-ink-soft">—</span> : pro.get(id)?.stripe_account_id ? <span className="text-brand-dark">✓ Stripe set up</span> : <span className="font-semibold text-rose-700">✗ Payout setup missing — they've been asked</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Job ledger</h2>
          <div className="flex flex-wrap gap-1 text-sm">{FILTERS.map(([k, label]) => <Link key={k} href={href({ show: k })} className={`rounded-full border px-3 py-1 ${k === show ? "border-brand bg-brand-tint font-semibold" : "border-line"}`}>{label}{k === "attention" ? ` (${attention.length})` : ""}</Link>)}</div>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><th className="p-3">Job</th><th className="p-3">Pro</th><th className="p-3 text-right">Customer paid</th><th className="p-3 text-right">Pro pay</th><th className="p-3 text-right">Handled keeps</th><th className="p-3 text-right">Tips</th><th className="p-3">Pro's money</th></tr></thead>
            <tbody>
              {!shown.length && <tr><td colSpan={7} className="p-3 text-ink-soft">No jobs here for the last {days} days.</td></tr>}
              {shown.map(({ j, m }) => (
                <tr key={j.id as string} className="border-b border-line align-top last:border-0">
                  <td className="p-3"><Link href={`/hub/jobs/${j.id}#money`} className="font-semibold underline decoration-dotted">{j.ref as string}</Link><div className="text-xs text-ink-soft">{getService(j.service_slug as string)?.name ?? j.service_slug} · {String(j.status).replace(/_/g, " ")} · {String(j.completed_at ?? j.scheduled_date ?? j.created_at ?? "").slice(0, 10)}</div>
                    {m.issues.map((i) => <div key={i} className="text-xs font-semibold text-rose-700">⚠ {i}</div>)}</td>
                  <td className="p-3">{j.contractor_id ? <Link href={`/hub/pros/${j.contractor_id}`} className="underline decoration-dotted">{pro.get(j.contractor_id as string)?.business_name ?? "Pro"}</Link> : <span className="text-ink-soft">not assigned</span>}</td>
                  <td className="p-3 text-right">{money(m.customerNet)}{m.refunded ? <div className="text-xs text-ink-soft">refunded {money(m.refunded)}</div> : null}{!m.paid ? <div className="text-xs text-amber-800">not paid yet · price {money(m.price)}</div> : null}</td>
                  <td className="p-3 text-right">{money(m.proPay)}</td>
                  <td className="p-3 text-right font-semibold">{money(m.keep)}{m.takePct != null && <div className="text-xs font-normal text-ink-soft">{Math.round(m.takePct * 100)}%</div>}</td>
                  <td className="p-3 text-right text-ink-soft">{m.tips ? money(m.tips) : "—"}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_TONE[m.stage]}`}>{PAYOUT_STAGE_LABEL[m.stage]}</span>
                    <div className="mt-0.5 text-xs text-ink-soft">{m.stage === "paid" && m.lastPaid ? `paid ${m.lastPaid.slice(0, 10)}` : m.payday ? `${money(m.owed)} on Mon ${m.payday}` : m.stage === "not_created" ? (j.status === "completed" ? "should exist now" : "created when the job is done") : ""}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
