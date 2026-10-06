/*
 * FILE    : apps/web/app/hub/jobs/[id]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — shows how soon the customer needs it (deadline status) and their budget.
 * UPDATED : 2026-10-03_0124 UTC — record a pro no-show (re-dispatches; counts toward the deactivation policy).
 * UPDATED : 2026-10-05_0221 UTC — the job checklist (what the pro checked) and staff special instructions.
 * UPDATED : 2026-10-05_2146 UTC — link to the customer’s history & notes.
 * UPDATED : 2026-10-06_2120 UTC — Backups & cancellations panel: backup #1–#3 status, every hand-back / no-show, call the
 *           next backup or offer to everyone.
 * PURPOSE : Job control panel — customer, scope, AI quote/dispatch/QA reasoning,
 *           offers, timeline, messages and every manual override.
 */
import Link from "next/link";
import { CoverActions } from "@/components/Coverage";
import { NoShowButton } from "@/components/Standing";
import { notFound } from "next/navigation";
import { LATE_CANCEL_FEE, SERVICES, TIME_WINDOW_LABEL, URGENCY_LABEL, budgetFit, deadlineRisk, getService, money, questionVisible, moneyRange, type Answers, type Job } from "@handled/core";
import { isLate } from "@/lib/pro-benefits";
import { getViewer } from "@/lib/auth";
import { signedUrls } from "@/lib/photos";
import { Badge, StatusBadge, fmtDate } from "@/components/ui";
import { CancelPanel, ExpenseActions, JobAdmin, OpsRating, PaymentPanel, RemedyPanel } from "@/components/HubActions";
import { checklistState } from "@/lib/checklists";
import { ChecklistView, StaffInstructions } from "@/components/Checklist";

type AnyRec = Record<string, unknown>;

export default async function HubJob({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const { id } = await params;
  const { data } = await v.db.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job & { completion_photos: string[] };
  const s = getService(job.service_slug)!;
  const [{ data: offers }, { data: events }, { data: msgs }, { data: pros }, { data: opsRating }, { data: custReview }, before, after, { data: expenses }] = await Promise.all([
    v.db.from("job_offers").select("id, status, payout, ai_score, ai_reason, offered_at, contractors(business_name)").eq("job_id", id).order("ai_score", { ascending: false }),
    v.db.from("job_events").select("*").eq("job_id", id).order("created_at"),
    v.db.from("messages").select("*").eq("job_id", id).order("created_at"),
    v.db.from("contractors").select("id, business_name, trades").eq("status", "approved"),
    v.db.from("ops_ratings").select("*").eq("job_id", id).maybeSingle(),
    v.db.from("reviews").select("rating, comment").eq("job_id", id).maybeSingle(),
    signedUrls(job.photos),
    signedUrls(job.completion_photos ?? []),
    v.db.from("job_expenses").select("id, amount, description, status, created_at").eq("job_id", id).order("created_at"),
  ]);
  const { data: backupRows } = await v.db.from("job_backups").select("rank, status, asked_at, called_at, contractors(id, business_name)").eq("job_id", id).order("rank");
  const { data: cancels } = await v.db.from("pro_standing_events").select("kind, note, created_at, contractors(business_name)").eq("job_id", id).in("kind", ["free_cancel", "short_notice_cancel", "late_cancel", "excused_cancel", "no_show"]).order("created_at");
  const quote = job.ai_quote as AnyRec | null;
  const qa = job.ai_qa as AnyRec | null;
  const dispatch = job.ai_dispatch as AnyRec | null;
  const qualified = (pros ?? []).filter((p: { trades: string[] }) => s.trades.some((t) => p.trades.includes(t)));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{job.ref} · {s.icon} {s.name}</h1><div className="flex gap-2">{job.remedy && <Badge tone="brand">{job.remedy}</Badge>}{!job.paid_at && !job.remedy && job.price_final ? <Badge tone="red">unpaid</Badge> : null}{job.priority !== "normal" && <Badge tone="amber">{job.priority}</Badge>}<StatusBadge status={job.status} /></div></div>
          <a href={`/invoice/${job.id}`} target="_blank" className="text-xs font-semibold text-brand underline">Invoice & service agreement ↗</a>
          <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            <div><div className="font-semibold">{job.contact_name}{job.company_name ? ` · ${job.company_name}` : ""}</div><div className="text-ink-soft">{job.contact_email} · {job.contact_phone}</div><Link href={`/hub/customers/${encodeURIComponent(String(job.contact_email).toLowerCase())}`} className="text-xs font-semibold text-brand underline">Customer history & notes →</Link><div className="text-ink-soft">{job.address}, {job.city} {job.state} {job.zip}</div></div>
            <div><div>{fmtDate(job.scheduled_date)} · {TIME_WINDOW_LABEL[job.time_window]}</div><div className="text-ink-soft">{job.frequency} · {job.customer_type} · via {job.source}</div>
              <div className="mt-1 font-semibold">{job.price_final ? money(job.price_final) : moneyRange(job.estimate_low, job.estimate_high)} <span className="font-normal text-ink-soft">· payout {money(job.contractor_payout)} · margin {job.price_final && job.contractor_payout ? money(job.price_final - job.contractor_payout) : "—"}</span></div>
              {(job.urgency || job.needed_by) && <div className={deadlineRisk(job) === "late" ? "font-semibold text-rose-600" : deadlineRisk(job) ? "font-semibold text-amber-700" : ""}>Customer needs it: {job.urgency ? URGENCY_LABEL[job.urgency] : "—"}{job.needed_by ? ` · by ${fmtDate(job.needed_by)}` : ""}{deadlineRisk(job) === "late" ? " (past due)" : deadlineRisk(job) === "due" ? " (due now)" : ""}</div>}
              {job.customer_budget ? <div>Customer budget: {money(job.customer_budget)} · <span className="text-ink-soft">{budgetFit(job.customer_budget, Number(job.price_final ?? job.estimate_low)).message}</span></div> : null}</div>
          </div>
          <div className="mt-4 grid gap-1 border-t border-line pt-4 text-sm sm:grid-cols-2">{s.questions.filter((q) => questionVisible(q, job.answers as Answers, s.questions)).map((q) => <div key={q.id}><span className="text-ink-soft">{q.label}:</span> {String(job.answers[q.id] ?? "—")}</div>)}</div>
          {job.notes && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">“{job.notes}”</p>}
        </div>
        <HubChecklist job={job} />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="card text-sm"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">✨ AI quote</div>
            {quote ? <><div className="font-semibold">{money(quote.final_price as number)} · {String(quote.confidence)} confidence</div><p className="mt-1 text-ink-soft">{String(quote.ops_notes)}</p>{(quote.risk_flags as string[])?.map((f) => <Badge key={f} tone="red">{f}</Badge>)}</> : <p className="text-ink-soft">Rule-based price (no notes/photos to review).</p>}</div>
          <div className="card text-sm"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">✨ AI dispatch</div>
            {dispatch ? <p className="text-ink-soft">{String(dispatch.dispatcher_note ?? `${(dispatch.ranking as unknown[])?.length ?? 0} pros ranked`)}</p> : <p className="text-ink-soft">Not dispatched yet.</p>}</div>
          <div className="card text-sm"><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">✨ AI QA</div>
            {qa ? <><div className="font-semibold">{qa.passed ? "Passed" : "Flagged"} · {String(qa.score)}/100</div>{(qa.issues as string[]).map((i) => <p key={i} className="text-ink-soft">• {i}</p>)}</> : <p className="text-ink-soft">Runs when the pro submits photos.</p>}</div>
        </div>

        {(before.length > 0 || after.length > 0) && (
          <div className="card"><div className="grid gap-4 sm:grid-cols-2">
            <div><div className="text-sm font-semibold">Customer photos</div><div className="mt-2 grid grid-cols-3 gap-2">{before.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="" className="aspect-square rounded-lg object-cover" /></a>)}</div></div>
            <div><div className="text-sm font-semibold">Completion photos</div><div className="mt-2 grid grid-cols-3 gap-2">{after.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="" className="aspect-square rounded-lg object-cover" /></a>)}</div></div>
          </div></div>
        )}

        <div className="card overflow-x-auto">
          <div className="font-semibold">Offers</div>
          <table className="mt-3 w-full text-sm"><tbody>
            {(offers ?? []).map((o: AnyRec) => (
              <tr key={String(o.id)} className="border-t border-line"><td className="py-2 font-medium">{(o.contractors as AnyRec | null)?.business_name as string}</td><td>{String(o.status)}</td><td>{money(o.payout as number)}</td><td>{String(o.ai_score ?? "")}</td><td className="text-xs text-ink-soft">{String(o.ai_reason ?? "")}</td></tr>
            ))}
            {!(offers ?? []).length && <tr><td className="py-2 text-ink-soft">No offers yet.</td></tr>}
          </tbody></table>
        </div>

        <div className="card text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">🛟 Backups & cancellations{(job as Job & { handoffs?: number }).handoffs ? ` · ${(job as Job & { handoffs?: number }).handoffs} hand-off(s)` : ""}</div>
            {["dispatched", "scheduled", "assigned"].includes(job.status) && <CoverActions jobId={job.id} open={!job.contractor_id} />}
          </div>
          {(backupRows ?? []).length ? (
            <ul className="mt-2 space-y-1">{((backupRows ?? []) as unknown as { rank: number; status: string; called_at: string | null; contractors: { id: string; business_name: string } | null }[]).map((b) => (
              <li key={b.rank}>#{b.rank} <Link href={`/hub/pros/${b.contractors?.id}`} className="underline">{b.contractors?.business_name ?? "—"}</Link> — {({ asked: "asked", standby: "✓ standing by", called: "📞 called", passed: "passed", declined: "declined", promoted: "★ took the job", released: "released" } as Record<string, string>)[b.status] ?? b.status}{b.called_at ? <span className="text-xs text-ink-soft"> · called {b.called_at.slice(11, 16)}</span> : null}</li>
            ))}</ul>
          ) : <p className="mt-2 text-ink-soft">No backups yet — they're asked when a pro accepts.</p>}
          {(cancels ?? []).length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-2 text-xs">{((cancels ?? []) as unknown as { kind: string; note: string | null; created_at: string; contractors: { business_name: string } | null }[]).map((c, i) => (
              <li key={i}><b>{({ free_cancel: "Free hand-back", short_notice_cancel: "Short-notice hand-back", late_cancel: "Late cancel", excused_cancel: "Excused cancel", no_show: "No-show" } as Record<string, string>)[c.kind]}</b> · {c.contractors?.business_name ?? "—"} · {c.created_at.slice(0, 16).replace("T", " ")}{c.note ? ` — “${c.note}”` : ""}</li>
            ))}</ul>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <PaymentPanel job={{ id: job.id, ref: job.ref, price_final: job.price_final, paid_at: job.paid_at, amount_paid: job.amount_paid, amount_refunded: job.amount_refunded, remedy: job.remedy, status: job.status, payment_plan: job.payment_plan, deposit_amount: job.deposit_amount, deposit_paid_at: job.deposit_paid_at, balance_due_date: job.balance_due_date }} />
        {(expenses ?? []).length > 0 && (
          <div className="card text-sm"><div className="font-semibold">Materials (at cost, billed to the customer)</div>
            {(expenses ?? []).map((e: { id: string; amount: number; description: string; status: string }) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2"><span>{e.description} · <b>{money(e.amount)}</b> · {e.status}</span><ExpenseActions id={e.id} status={e.status} /></div>
            ))}
          </div>
        )}
        {!["completed", "cancelled", "qa_review"].includes(job.status) && <CancelPanel jobId={job.id} late={isLate(job)} fee={money(Math.min(LATE_CANCEL_FEE, Number(job.amount_paid)))} />}
        <RemedyPanel jobId={job.id} paid={Boolean(job.paid_at) && !job.remedy} services={SERVICES.filter((x) => !x.siteVisit).map((x) => ({ slug: x.slug, name: x.name }))} />
        {job.contractor_id && ["qa_review", "completed"].includes(job.status) && (
          <>
            <div className="card text-sm"><div className="font-semibold">Customer’s rating</div><p className="mt-1">{custReview ? `${"★".repeat(custReview.rating)} ${custReview.comment ?? ""}` : "Not rated yet — the customer is asked after completion."}</p></div>
            <OpsRating jobId={job.id} current={opsRating} />
          </>
        )}
        {job.contractor_id && ["assigned", "scheduled", "dispatched"].includes(job.status) && <NoShowButton jobId={job.id} />}
        <JobAdmin job={{ id: job.id, status: job.status, price_final: job.price_final, scheduled_date: job.scheduled_date, contractor_id: job.contractor_id, instructions: job.instructions }} pros={qualified} />
        <div className="card"><div className="font-semibold">Timeline</div>
          <ol className="mt-3 space-y-3 text-sm">{(events ?? []).map((e: AnyRec) => <li key={String(e.id)}><span className="text-xs text-ink-soft">{new Date(String(e.created_at)).toLocaleString()} · {String(e.actor)}</span><div>{String(e.message)}{!e.visible_to_customer && <span className="ml-1 text-xs text-ink-soft">(internal)</span>}</div></li>)}</ol></div>
        <div className="card"><div className="font-semibold">Messages</div>
          <div className="mt-3 space-y-2 text-sm">{(msgs ?? []).map((m: AnyRec) => <div key={String(m.id)}><span className="text-xs uppercase text-ink-soft">{String(m.sender_role)}</span> {String(m.body)}</div>)}{!(msgs ?? []).length && <p className="text-ink-soft">None.</p>}</div></div>
      </div>
    </div>
  );
}

/** The job's checklist with what the pro checked, and staff special instructions. */
async function HubChecklist({ job }: { job: Job }) {
  const cl = await checklistState(job);
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between"><div className="font-semibold">✅ {cl.checklist.title}</div><a href={`/hub/checklists#${job.service_slug}`} className="text-xs text-brand underline">checklist library</a></div>
      {!["completed", "cancelled"].includes(job.status) && <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">Special instructions for this job</div><StaffInstructions jobId={job.id} extra={job.checklist_extra ?? []} /></div>}
      <details open={["in_progress", "qa_review"].includes(job.status)}><summary className="cursor-pointer text-sm font-semibold">Checklist{job.contractor_id ? " — what the pro checked" : ""}</summary><div className="mt-2"><ChecklistView checklist={cl.checklist} checks={cl.checks} es={false} compact /></div></details>
    </div>
  );
}
