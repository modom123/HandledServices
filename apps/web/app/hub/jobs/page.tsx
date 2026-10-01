/*
 * FILE    : apps/web/app/hub/jobs/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Jobs board — kanban by status across the whole pipeline.
 */
import Link from "next/link";
import { JOB_STATUSES, JOB_STATUS_LABEL, getService, money, moneyRange, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { fmtDate } from "@/components/ui";

const BOARD = JOB_STATUSES.filter((s) => s !== "cancelled");

export default async function JobsBoard({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const q = (await searchParams).q?.replace(/[^\w\s-]/g, "").trim();
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  let query = v.db.from("jobs").select("*").or(`status.neq.completed,completed_at.gte.${since}`).neq("status", "cancelled").order("scheduled_date", { ascending: true }).limit(500);
  if (q) query = query.or(`ref.ilike.%${q}%,contact_name.ilike.%${q}%,zip.eq.${q.replace(/\D/g, "") || "0"}`);
  const { data } = await query;
  const jobs = (data ?? []) as Job[];
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Jobs board</h1>
        <form><input name="q" defaultValue={q} className="input w-64" placeholder="Search ref, name or ZIP" /></form>
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
