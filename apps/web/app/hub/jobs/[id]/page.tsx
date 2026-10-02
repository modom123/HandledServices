/*
 * FILE    : apps/web/app/hub/jobs/[id]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Job control panel — customer, scope, AI quote/dispatch/QA reasoning,
 *           offers, timeline, messages and every manual override.
 */
import { notFound } from "next/navigation";
import { LATE_CANCEL_FEE, SERVICES, TIME_WINDOW_LABEL, getService, money, questionVisible, moneyRange, type Answers, type Job } from "@handled/core";
import { isLate } from "@/lib/pro-benefits";
import { getViewer } from "@/lib/auth";
import { signedUrls } from "@/lib/photos";
import { Badge, StatusBadge, fmtDate } from "@/components/ui";
import { CancelPanel, ExpenseActions, JobAdmin, OpsRating, PaymentPanel, RemedyPanel } from "@/components/HubActions";

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
            <div><div className="font-semibold">{job.contact_name}{job.company_name ? ` · ${job.company_name}` : ""}</div><div className="text-ink-soft">{job.contact_email} · {job.contact_phone}</div><div className="text-ink-soft">{job.address}, {job.city} {job.state} {job.zip}</div></div>
            <div><div>{fmtDate(job.scheduled_date)} · {TIME_WINDOW_LABEL[job.time_window]}</div><div className="text-ink-soft">{job.frequency} · {job.customer_type} · via {job.source}</div>
              <div className="mt-1 font-semibold">{job.price_final ? money(job.price_final) : moneyRange(job.estimate_low, job.estimate_high)} <span className="font-normal text-ink-soft">· payout {money(job.contractor_payout)} · margin {job.price_final && job.contractor_payout ? money(job.price_final - job.contractor_payout) : "—"}</span></div></div>
          </div>
          <div className="mt-4 grid gap-1 border-t border-line pt-4 text-sm sm:grid-cols-2">{s.questions.filter((q) => questionVisible(q, job.answers as Answers, s.questions)).map((q) => <div key={q.id}><span className="text-ink-soft">{q.label}:</span> {String(job.answers[q.id] ?? "—")}</div>)}</div>
          {job.notes && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">“{job.notes}”</p>}
        </div>

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
        <JobAdmin job={{ id: job.id, status: job.status, price_final: job.price_final, scheduled_date: job.scheduled_date, contractor_id: job.contractor_id, instructions: job.instructions }} pros={qualified} />
        <div className="card"><div className="font-semibold">Timeline</div>
          <ol className="mt-3 space-y-3 text-sm">{(events ?? []).map((e: AnyRec) => <li key={String(e.id)}><span className="text-xs text-ink-soft">{new Date(String(e.created_at)).toLocaleString()} · {String(e.actor)}</span><div>{String(e.message)}{!e.visible_to_customer && <span className="ml-1 text-xs text-ink-soft">(internal)</span>}</div></li>)}</ol></div>
        <div className="card"><div className="font-semibold">Messages</div>
          <div className="mt-3 space-y-2 text-sm">{(msgs ?? []).map((m: AnyRec) => <div key={String(m.id)}><span className="text-xs uppercase text-ink-soft">{String(m.sender_role)}</span> {String(m.body)}</div>)}{!(msgs ?? []).length && <p className="text-ink-soft">None.</p>}</div></div>
      </div>
    </div>
  );
}
