/*
 * FILE    : apps/web/app/hub/jobs/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — each card shows how soon the customer needs it (ASAP flag, needed-by,
 *           late/due), their budget vs our price; filters for ASAP and over-budget.
 * PURPOSE : Jobs board — kanban by status across the whole pipeline.
 */
import Link from "next/link";
import { JOB_STATUSES, JOB_STATUS_LABEL, URGENCY_LABEL, budgetFit, deadlineRisk, getService, money, moneyRange, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/components/ui";

const BOARD = JOB_STATUSES.filter((s) => s !== "cancelled");

export default async function JobsBoard({ searchParams }: { searchParams: Promise<{ q?: string; only?: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const sp = await searchParams;
  const q = sp.q?.replace(/[^\w\s-]/g, "").trim();
  const only = sp.only;
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  let query = v.db.from("jobs").select("*").or(`status.neq.completed,completed_at.gte.${since}`).neq("status", "cancelled").order("scheduled_date", { ascending: true }).limit(500);
  if (q) query = query.or(`ref.ilike.%${q}%,contact_name.ilike.%${q}%,zip.eq.${q.replace(/\D/g, "") || "0"}`);
  const { data } = await query;
  const all = (data ?? []) as Job[];
  const price = (j: Job) => Number(j.price_final ?? j.estimate_low ?? 0);
  const jobs = all.filter((j) => only === "asap" ? j.urgency === "asap" : only === "deadline" ? Boolean(deadlineRisk(j)) : only === "over_budget" ? ["close", "over"].includes(budgetFit(j.customer_budget, price(j)).status) : true);
  const FILTERS = [["", "All"], ["asap", `⚡ ASAP (${all.filter((j) => j.urgency === "asap").length})`], ["deadline", `⏰ Due / late (${all.filter((j) => deadlineRisk(j)).length})`], ["over_budget", `💲 Over budget (${all.filter((j) => ["close", "over"].includes(budgetFit(j.customer_budget, price(j)).status)).length})`]] as const;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs board</h1>
        <form><input name="q" defaultValue={q} className="input w-64" placeholder="Search ref, name or ZIP" /></form>
      </div>
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {FILTERS.map(([k, l]) => <Link key={k} href={k ? `/hub/jobs?only=${k}` : "/hub/jobs"} className={`rounded-full border px-3 py-1 ${(only ?? "") === k ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{l}</Link>)}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {BOARD.map((s) => {
          const col = jobs.filter((j) => j.status === s);
          return (
            <div key={s} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-soft"><span>{JOB_STATUS_LABEL[s]}</span><span>{col.length}</span></div>
              <div className="space-y-2">
                {col.map((j) => (
                  <Link key={j.id} href={`/hub/jobs/${j.id}`} className={`card block p-3 text-sm hover:border-brand ${j.priority !== "normal" ? "border-l-4 border-l-amber-400" : ""}`}>
                    <div className="flex justify-between"><span className="font-semibold">{j.ref}</span><span>{getService(j.service_slug)?.icon}</span></div>
                    <div className="truncate">{j.company_name ?? j.contact_name}</div>
                    <div className="text-xs text-ink-soft">{fmtDate(j.scheduled_date)} · {j.zip}</div>
                    {(j.urgency || j.needed_by) && (() => {
                      const risk = deadlineRisk(j);
                      return <div className={`text-xs ${risk === "late" ? "font-semibold text-rose-600" : risk === "due" || j.urgency === "asap" ? "font-semibold text-amber-700" : "text-ink-soft"}`}>{j.urgency === "asap" ? "⚡ " : ""}{j.urgency ? URGENCY_LABEL[j.urgency] : "Needed"}{j.needed_by ? ` · by ${fmtDate(j.needed_by)}` : ""}{risk === "late" ? " · LATE" : risk === "due" ? " · due" : ""}</div>;
                    })()}
                    {j.customer_budget ? (() => {
                      const fit = budgetFit(j.customer_budget, price(j));
                      return <div className={`text-xs ${fit.status === "fits" ? "text-brand-dark" : fit.status === "close" ? "text-amber-700" : "text-rose-600"}`}>Budget {money(j.customer_budget)}{fit.status === "fits" ? " ✓" : ` · ${money(fit.gap)} over`}</div>;
                    })() : null}
                    <div className="mt-1 text-xs font-semibold">{j.price_final ? money(j.price_final) : moneyRange(j.estimate_low, j.estimate_high)}{!j.contractor_id && ["scheduled", "dispatched"].includes(j.status) ? <span className="ml-2 text-rose-600">no pro</span> : null}</div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
