/*
 * FILE    : apps/web/app/pro/jobs/[id]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2124 UTC — materials receipts, lockout report.
 * PURPOSE : Pro job sheet — scope, address, customer photos, start/complete, messages.
 */
import { notFound } from "next/navigation";
import { TIME_WINDOW_LABEL, buildWorkOrder, getService, money, whyNot, type Contractor, type Job } from "@handled/core";
import { getPolicy } from "@/lib/pro-benefits";
import { WorkOrderView } from "@/components/WorkOrderView";
import { getViewer } from "@/lib/auth";
import { signedUrls } from "@/lib/photos";
import { StatusBadge, fmtDate } from "@/components/ui";
import { CompleteJob, LockoutReport, MaterialsForm, StartJob } from "@/components/ProActions";
import { JobThread } from "@/components/JobThread";

export default async function ProJob({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const { id } = await params;
  const { data } = await v.db.from("jobs").select("*").eq("id", id).eq("contractor_id", v.contractorId!).maybeSingle();
  if (!data) notFound();
  const job = data as Job;
  const s = getService(job.service_slug)!;
  const [photos, { data: msgs }, { data: me }, { data: expenses }, policy] = await Promise.all([
    signedUrls(job.photos),
    v.db.from("messages").select("id, sender_role, body, created_at").eq("job_id", id).order("created_at"),
    v.db.from("contractors").select("*").eq("id", v.contractorId!).single(),
    v.db.from("job_expenses").select("id, amount, description, status, created_at").eq("job_id", id).order("created_at"),
    getPolicy(),
  ]);
  const trade = s.trades.find((t) => (me?.trades ?? []).includes(t));
  const noMaterials = me ? whyNot(policy.materials, me as Contractor, trade) : "pro not found";
  const maps = `https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}, ${job.state} ${job.zip}`)}`;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <div className="card">
          <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">{s.icon} {s.name}</h1><StatusBadge status={job.status} /></div>
          <div className="mt-2 text-sm text-ink-soft">{job.ref} · {fmtDate(job.scheduled_date)} · {TIME_WINDOW_LABEL[job.time_window]}</div>
          <a href={maps} target="_blank" className="mt-2 block text-sm font-semibold text-brand">📍 {job.address}, {job.city} {job.zip}</a>
          <div className="mt-2 text-sm">Customer: {job.contact_name}{job.company_name ? ` (${job.company_name})` : ""} · {job.contact_phone}</div>
          <div className="mt-4 text-xl font-bold">Your payout: {money(job.contractor_payout)}</div>
        </div>
        <div className="card">
          <div className="font-semibold">Scope</div>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {s.questions.map((q) => <li key={q.id}><span className="text-ink-soft">{q.label}:</span> {String(job.answers[q.id] ?? "—")}</li>)}
          </ul>
          <div className="mt-3 text-sm"><span className="text-ink-soft">Includes:</span> {s.includes.join(" · ")}</div>
          {job.notes && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">“{job.notes}”</p>}
          {photos.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{photos.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="Customer photo" className="aspect-square rounded-lg object-cover" /></a>)}</div>}
        </div>
        {job.instructions && <p className="card bg-brand-tint text-sm text-brand-dark"><b>Instructions:</b> {job.instructions}</p>}
        <details className="card"><summary className="cursor-pointer font-semibold">Full work order & job terms</summary><div className="mt-3"><WorkOrderView w={buildWorkOrder(job, { reveal: true })} /></div></details>
        <JobThread jobId={job.id} userId={v.userId} as="pro" initial={msgs ?? []} />
      </div>
      <div className="space-y-4">
        {job.status === "assigned" && <StartJob jobId={job.id} />}
        {(job.status === "assigned" || job.status === "in_progress") && <CompleteJob jobId={job.id} />}
        {job.status === "qa_review" && <div className="card text-sm">Photos submitted — AI quality check in progress. Your payout is approved as soon as it passes.</div>}
        {(job.status === "assigned" || job.status === "in_progress") && <LockoutReport jobId={job.id} />}
        {["assigned", "in_progress", "qa_review", "completed"].includes(job.status) && <MaterialsForm jobId={job.id} allowed={!noMaterials} reason={noMaterials} />}
        {(expenses ?? []).length > 0 && (
          <div className="card text-sm"><div className="font-semibold">Materials</div>
            {(expenses ?? []).map((e: { id: string; amount: number; description: string; status: string }) => <div key={e.id} className="flex justify-between border-t border-line py-1"><span>{e.description}</span><span>{money(e.amount)} · {e.status}</span></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
