/*
 * FILE    : apps/web/app/hub/recruiting/files/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1800 UTC
 * PURPOSE : Hub → Recruiting → Pro files: every subcontractor's digital file at a glance, so the network can grow without
 *           anyone chasing paperwork by hand. One row per pro, one column per file item (photo, résumé, ID, W-9,
 *           agreement, skills, insurance, license, background, payout — core PRO_FILE_ITEMS, from the same onboarding
 *           checklist the pro sees): ✓ on file, ✗ missing, ⏳ expiring within 30 days, — not needed for their trades.
 *           Filters: missing something / expiring soon / all, and by trade. "Remind everyone in setup" emails each pro in
 *           setup the exact items they're missing. Live pros are chased automatically (upload and renewal sweeps).
 *           Click a name for the full digital file.
 */
import Link from "next/link";
import { PRO_FILE_ITEMS, TRADES, onboardingChecklist, proFileStatus, type Contractor, type FileCell } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { RemindAllMissing } from "@/components/RecruitingDivision";

export const dynamic = "force-dynamic";

const CELL: Record<FileCell, { t: string; c: string }> = {
  done: { t: "✓", c: "text-brand" }, missing: { t: "✗", c: "font-bold text-rose-700" }, expiring: { t: "⏳", c: "text-amber-700" }, "n/a": { t: "—", c: "text-ink-soft/50" },
};

export default async function ProFiles({ searchParams }: { searchParams: Promise<{ show?: string; trade?: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const { show = "missing", trade } = await searchParams;
  const { data } = await adminClient().from("contractors").select("*").in("status", ["vetting", "approved"]).is("dropped_at", null).order("business_name").limit(2000);
  const rows = ((data ?? []) as (Contractor & Record<string, unknown>)[]).map((c) => ({ c, f: proFileStatus(onboardingChecklist(c as never).steps) }));
  const byTrade = trade ? rows.filter((r) => (r.c.trades ?? []).includes(trade)) : rows;
  const shown = show === "all" ? byTrade : show === "expiring" ? byTrade.filter((r) => r.f.expiring.length) : byTrade.filter((r) => r.f.missing.length);
  const complete = rows.filter((r) => !r.f.missing.length).length;
  const expiring = rows.filter((r) => r.f.expiring.length).length;
  const inSetupMissing = rows.filter((r) => r.c.status === "vetting" && r.f.missing.length).length;
  const q = (o: Record<string, string | undefined>) => `/hub/recruiting/files?${new URLSearchParams(Object.entries({ show, trade, ...o }).filter(([, x]) => x) as [string, string][]).toString()}`;
  const trades = [...new Set(rows.flatMap((r) => r.c.trades ?? []))].sort();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pro files</h1>
        <p className="text-sm text-ink-soft">Every subcontractor's digital file: photo, résumé, ID, W-9, agreement, skills, insurance, license, background check and payout. Pros upload everything themselves during setup; the AI reads each document and a person verifies it. Missing and expiring items are chased automatically.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Pros</div><div className="mt-1 text-3xl font-extrabold">{rows.length}</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Complete files</div><div className="mt-1 text-3xl font-extrabold text-brand">{complete}</div><div className="text-xs text-ink-soft">{rows.length ? Math.round((complete / rows.length) * 100) : 0}% of the network</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Missing something</div><div className={`mt-1 text-3xl font-extrabold ${rows.length - complete ? "text-rose-700" : ""}`}>{rows.length - complete}</div></div>
        <div className="card"><div className="text-xs font-semibold uppercase text-ink-soft">Expiring in 30 days</div><div className={`mt-1 text-3xl font-extrabold ${expiring ? "text-amber-700" : ""}`}>{expiring}</div></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 text-sm">
          {[["missing", "Missing something"], ["expiring", "Expiring soon"], ["all", "All"]].map(([k, l]) => <Link key={k} href={q({ show: k })} className={`rounded-lg px-3 py-1.5 ${show === k ? "bg-brand text-white" : "bg-white"}`}>{l}</Link>)}
          <span className="mx-1 self-center text-ink-soft">·</span>
          <Link href={q({ trade: undefined })} className={`rounded-lg px-3 py-1.5 ${!trade ? "bg-ink text-white" : "bg-white"}`}>All trades</Link>
          {trades.map((t) => <Link key={t} href={q({ trade: t })} className={`rounded-lg px-3 py-1.5 ${trade === t ? "bg-ink text-white" : "bg-white"}`}>{TRADES.find((x) => x.id === t)?.label.replace(/\s*\(.*\)$/, "") ?? t}</Link>)}
        </div>
        <RemindAllMissing count={inSetupMissing} />
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft"><th className="p-3">Pro</th><th className="p-3">Status</th><th className="p-3 text-right">File</th>{PRO_FILE_ITEMS.map((it) => <th key={it.id} className="p-3 text-center">{it.label}</th>)}</tr></thead>
          <tbody>
            {!shown.length && <tr><td colSpan={PRO_FILE_ITEMS.length + 3} className="p-4 text-ink-soft">Nobody here. {show !== "all" && <Link className="underline" href={q({ show: "all" })}>Show all</Link>}</td></tr>}
            {shown.map(({ c, f }) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="p-3"><Link href={`/hub/recruiting/files/${c.id}`} className="font-semibold underline decoration-dotted">{String(c.business_name)}</Link><div className="text-xs text-ink-soft">{(c.trades ?? []).join(", ")}</div></td>
                <td className="p-3 text-xs">{c.status === "approved" ? "Live" : "In setup"}</td>
                <td className={`p-3 text-right font-semibold ${f.pct === 100 ? "text-brand" : f.pct < 60 ? "text-rose-700" : ""}`}>{f.pct}%</td>
                {PRO_FILE_ITEMS.map((it) => <td key={it.id} className={`p-3 text-center ${CELL[f.cells[it.id]].c}`} title={`${it.label}: ${f.cells[it.id]}`}>{CELL[f.cells[it.id]].t}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-soft">✓ on file and verified · ✗ missing · ⏳ expires within 30 days · — not needed for their trades. Pros in setup get daily reminders for what's missing; live pros get reminders for a missing résumé or photo and 30 / 7 days before insurance or a license expires (offers pause the day it lapses).</p>
    </div>
  );
}
