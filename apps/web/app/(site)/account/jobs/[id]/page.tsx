/*
 * FILE    : apps/web/app/(site)/account/jobs/[id]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Customer job detail — live timeline, pro, photos, messages, review.
 */
import { notFound, redirect } from "next/navigation";
import { BRAND, TIME_WINDOW_LABEL, getService, money, moneyRange, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { signedUrls } from "@/lib/photos";
import { StatusBadge, fmtDate } from "@/components/ui";
import { JobThread, ReviewForm } from "@/components/JobThread";

export default async function CustomerJob({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/login?next=/account");
  const { id } = await params;
  const { data } = await v.db.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job & { completion_photos: string[] };
  const [{ data: events }, { data: msgs }, { data: review }] = await Promise.all([
    v.db.from("job_events").select("id, message, created_at").eq("job_id", id).order("created_at"),
    v.db.from("messages").select("id, sender_role, body, created_at").eq("job_id", id).order("created_at"),
    v.db.from("reviews").select("rating").eq("job_id", id).maybeSingle(),
  ]);
  const photos = await signedUrls(job.completion_photos ?? []);
  const s = getService(job.service_slug);
  return (
    <div className="wrap grid gap-6 py-12 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{s?.icon} {s?.name}</h1><StatusBadge status={job.status} /></div>
          <div className="mt-2 text-sm text-ink-soft">{job.ref} · {fmtDate(job.scheduled_date)} · {TIME_WINDOW_LABEL[job.time_window]}</div>
          <div className="mt-1 text-sm text-ink-soft">{job.address}, {job.city} {job.zip}</div>
          <div className="mt-4 text-2xl font-bold">{job.price_final ? money(job.price_final) : moneyRange(job.estimate_low, job.estimate_high)}</div>
        </div>
        {photos.length > 0 && (
          <div className="card"><div className="font-semibold">Completion photos</div><div className="mt-3 grid grid-cols-3 gap-2">{photos.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="Completed work" className="aspect-square w-full rounded-lg object-cover" /></a>)}</div></div>
        )}
        {job.status === "completed" && !review && <ReviewForm jobId={job.id} contractorId={job.contractor_id} />}
        {job.contractor_id && <JobThread jobId={job.id} userId={v.userId} as="customer" initial={msgs ?? []} />}
      </div>
      <div className="card h-fit">
        <div className="font-semibold">Timeline</div>
        <ol className="mt-4 space-y-4 border-l-2 border-line pl-4">
          {(events ?? []).map((e: { id: number; message: string; created_at: string }) => (
            <li key={e.id} className="relative text-sm"><span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand" />{e.message}<div className="text-xs text-ink-soft">{new Date(e.created_at).toLocaleString()}</div></li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-ink-soft">Questions? {BRAND.supportPhone} · {BRAND.guaranteeDays}-day make-it-right guarantee.</p>
      </div>
    </div>
  );
}
