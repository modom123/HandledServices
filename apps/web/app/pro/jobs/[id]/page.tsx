/*
 * FILE    : apps/web/app/pro/jobs/[id]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2124 UTC — materials receipts, lockout report.
 * UPDATED : 2026-10-02_1329 UTC — "On my way" (texts the customer a live tracking link).
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 * UPDATED : 2026-10-03_0124 UTC — hand back an upcoming job (late cancel inside 24h).
 * UPDATED : 2026-10-03_1311 UTC — crew accounts: pick who's doing the job.
 * UPDATED : 2026-10-05_0221 UTC — the job checklist: check items off (or N/A with the reason) as the work gets done.
 * UPDATED : 2026-10-04_2204 UTC — "The customer asked for …" (crew member request) and "the customer favorited you".
 * PURPOSE : Pro job sheet — scope, address, customer photos, start/complete, messages.
 */
import { notFound } from "next/navigation";
import { TIME_WINDOW_LABEL, buildWorkOrder, getService, localDate, money, questionVisible, serviceText, t as tr, whyNot, type Contractor, type Answers, type Job } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { getPolicy } from "@/lib/pro-benefits";
import { WorkOrderView } from "@/components/WorkOrderView";
import { getViewer } from "@/lib/auth";
import { signedUrls } from "@/lib/photos";
import { StatusBadge } from "@/components/ui";
import { CompleteJob, LockoutReport, MaterialsForm, OnMyWay, ScopeChange, StartJob } from "@/components/ProActions";
import { ReleaseJob } from "@/components/Standing";
import { JobThread } from "@/components/JobThread";
import { CrewPicker } from "@/components/Crew";
import { listCrew } from "@/lib/crew";
import { crewRequest } from "@/lib/favorites";
import { checklistState, freezeChecklist } from "@/lib/checklists";
import { ChecklistPanel } from "@/components/Checklist";
import { crewCanTake, crewReady } from "@handled/core";

export default async function ProJob({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const l = await getLocale();
  const es = l === "es";
  const t = (x: string) => tr(l, x);
  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d.length === 10 ? `${d}T12:00:00` : d).toLocaleDateString(es ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric" }) : t("Date TBD");
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
  const crew = ["assigned", "in_progress"].includes(job.status) ? await listCrew(v.contractorId!) : [];
  const asked = await crewRequest(job, v.contractorId);
  if (!job.checklist) job.checklist = await freezeChecklist(job);
  const cl = await checklistState(job);
  const trade = s.trades.find((x) => (me?.trades ?? []).includes(x));
  const noMaterials = me ? whyNot(policy.materials, me as Contractor, trade) : "pro not found";
  type Q = (typeof s.questions)[number];
  const answerText = (q: Q, v: unknown) => {
    if (!es || v == null) return String(v ?? "—");
    if (q.type === "select") { const o = q.options.find((x) => x.value === v); return o ? t(o.label) : String(v); }
    if (typeof v === "boolean") return t(v ? "Yes" : "No");
    return String(v);
  };
  const maps = `https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city}, ${job.state} ${job.zip}`)}`;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <div className="card">
          <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">{s.icon} {serviceText(l, s.slug, s).name}</h1><StatusBadge status={job.status} locale={l} /></div>
          <div className="mt-2 text-sm text-ink-soft">{job.ref} · {fmtDate(job.scheduled_date)} · {t(TIME_WINDOW_LABEL[job.time_window])}</div>
          <a href={maps} target="_blank" className="mt-2 block text-sm font-semibold text-brand">📍 {job.address}, {job.city} {job.zip}</a>
          <div className="mt-2 text-sm">{t("Customer:")} {job.contact_name}{job.company_name ? ` (${job.company_name})` : ""} · {job.contact_phone}</div>
          <div className="mt-4 text-xl font-bold">{t("Your payout:")} {money(job.contractor_payout)}</div>
        </div>
        <div className="card">
          <div className="font-semibold">{t("Scope")}</div>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {s.questions.filter((q) => questionVisible(q, job.answers as Answers, s.questions)).map((q) => <li key={q.id}><span className="text-ink-soft">{t(q.label)}:</span> {answerText(q, job.answers[q.id])}</li>)}
          </ul>
          <div className="mt-3 text-sm"><span className="text-ink-soft">{t("Includes:")}</span> {s.includes.map(t).join(" · ")}</div>
          {job.notes && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">“{job.notes}”</p>}
          {photos.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{photos.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt={t("Customer photo")} className="aspect-square rounded-lg object-cover" /></a>)}</div>}
        </div>
        {job.instructions && <p className="card bg-brand-tint text-sm text-brand-dark"><b>{t("Instructions:")}</b> {job.instructions}</p>}
        <ChecklistPanel jobId={job.id} checklist={cl.checklist} checks={cl.checks} es={es} locked={!["assigned", "in_progress"].includes(job.status)} />
        <details className="card"><summary className="cursor-pointer font-semibold">{t("Full work order & job terms")}</summary><div className="mt-3"><WorkOrderView locale={l} hideChecklist w={buildWorkOrder(job, { reveal: true, locale: l })} /></div></details>
        <JobThread jobId={job.id} userId={v.userId} as="pro" initial={msgs ?? []} locale={l} />
      </div>
      <div className="space-y-4">
        {job.status === "assigned" && job.scheduled_date === localDate() && <OnMyWay locale={l} jobId={job.id} sent={Boolean(job.en_route_at)} />}
        {job.preferred_contractor_id === v.contractorId && <div className="card border-brand/40 bg-brand-tint text-sm">★ {es ? "Este cliente lo pidió a usted." : "This customer asked for you."}{asked && (es ? ` Pidieron a ${asked.name.split(" ")[0]}; usted decide quién va.` : ` They asked for ${asked.name.split(" ")[0]}; who goes is your call.`)}</div>}
        {crew.length > 0 && <CrewPicker jobId={job.id} es={es} current={job.crew_member_id ?? null} requested={asked} blocked={me ? crewReady(me as Contractor) : null}
          options={crew.map((m) => ({ id: m.id, name: m.full_name, why: crewCanTake(m, job.service_slug) }))} />}
        {job.status === "assigned" && <StartJob locale={l} jobId={job.id} />}
        {(job.status === "assigned" || job.status === "in_progress") && <CompleteJob locale={l} jobId={job.id} />}
        {job.status === "qa_review" && <div className="card text-sm">{t("Photos submitted — AI quality check in progress. Your payout is approved as soon as it passes.")}</div>}
        {(job.status === "assigned" || job.status === "in_progress") && !job.remedy && <ScopeChange locale={l} jobId={job.id} slug={job.service_slug} booked={job.answers as Record<string, string | number | boolean>} frequency={job.frequency} />}
        {(job.status === "assigned" || job.status === "in_progress") && <LockoutReport locale={l} jobId={job.id} />}
        {job.status === "assigned" && <ReleaseJob jobId={job.id} es={l === "es"} />}
        {["assigned", "in_progress", "qa_review", "completed"].includes(job.status) && <MaterialsForm locale={l} jobId={job.id} allowed={!noMaterials} reason={noMaterials} />}
        {(expenses ?? []).length > 0 && (
          <div className="card text-sm"><div className="font-semibold">{t("Materials")}</div>
            {(expenses ?? []).map((e: { id: string; amount: number; description: string; status: string }) => <div key={e.id} className="flex justify-between border-t border-line py-1"><span>{e.description}</span><span>{money(e.amount)} · {t(e.status)}</span></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
