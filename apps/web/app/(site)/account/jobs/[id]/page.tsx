/*
 * FILE    : apps/web/app/(site)/account/jobs/[id]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1329 UTC — live pro tracker, reschedule, tip your pro.
 * UPDATED : 2026-10-02_1412 UTC — English / Spanish, including the timeline (message_es).
 * UPDATED : 2026-10-02_2238 UTC — Google review ask for customers who rated but haven't reviewed on Google.
 * UPDATED : 2026-10-03_0151 UTC — while no pro has taken it: pros' counters (accept one) and raise your offer.
 * UPDATED : 2026-10-04_2204 UTC — Your pro: ★ favorite the pro (and the crew member who came), "Book again with …".
 * PURPOSE : Customer job detail — live timeline, pro, photos, messages, review.
 */
import { notFound, redirect } from "next/navigation";
import { BRAND, LATE_CANCEL_FEE, TIME_WINDOW_LABEL, getService, money, moneyRange, serviceText, t as tr, type Job } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { isLate } from "@/lib/pro-benefits";
import { getViewer, type Viewer } from "@/lib/auth";
import { signedUrls } from "@/lib/photos";
import { StatusBadge, fmtDate } from "@/components/ui";
import { AddJobPhotos, CancelBooking, GoogleReviewAsk, JobThread, PayNow, ReviewForm } from "@/components/JobThread";
import { MarketBox, type Counter } from "@/components/MarketBox";
import { adminClient } from "@/lib/supabase/server";
import type { Locale } from "@handled/core";
import { Reschedule, TipBox, TrackPro } from "@/components/AccountExtras";
import { FavoriteButton } from "@/components/Favorites";

export default async function CustomerJob({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) redirect("/login?next=/account");
  const { id } = await params;
  const { data } = await v.db.from("jobs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const job = data as Job & { completion_photos: string[] };
  const [{ data: events }, { data: msgs }, { data: review }] = await Promise.all([
    v.db.from("job_events").select("id, message, message_es, created_at").eq("job_id", id).order("created_at"),
    v.db.from("messages").select("id, sender_role, body, created_at").eq("job_id", id).order("created_at"),
    v.db.from("reviews").select("rating, google_clicked_at").eq("job_id", id).maybeSingle(),
  ]);
  const [photos, mine] = await Promise.all([signedUrls(job.completion_photos ?? []), signedUrls(job.photos ?? [])]);
  const s = getService(job.service_slug);
  const l = await getLocale();
  const t = (x: string) => tr(l, x);
  const es = l === "es";
  return (
    <div className="wrap grid gap-6 py-12 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-bold">{s?.icon} {s ? serviceText(l, s.slug, s).name : job.service_slug}</h1><StatusBadge status={job.status} /></div>
          <div className="mt-2 text-sm text-ink-soft">{job.ref} · {fmtDate(job.scheduled_date)} · {t(TIME_WINDOW_LABEL[job.time_window])}</div>
          <div className="mt-1 text-sm text-ink-soft">{job.address}, {job.city} {job.zip}</div>
          <a href={`/invoice/${job.id}`} className="mt-2 inline-block text-sm font-semibold text-brand underline">{t("Invoice & service agreement")}</a>
          <div className="mt-4 text-2xl font-bold">{job.price_final ? money(job.price_final) : moneyRange(job.estimate_low, job.estimate_high)}</div>
        </div>
        {!job.paid_at && !job.remedy && job.price_final && job.status !== "cancelled" && (
          <PayNow jobId={job.id} amount={money(job.payment_plan === "deposit" && !job.deposit_paid_at ? Number(job.deposit_amount) : Number(job.price_final) - Number(job.amount_paid))}
            label={job.payment_plan === "deposit" && !job.deposit_paid_at ? (es ? "de depósito" : "deposit") : job.deposit_paid_at ? (es ? `saldo${job.balance_due_date ? ` (se cobra automáticamente el ${job.balance_due_date})` : ""}` : `balance${job.balance_due_date ? ` (auto-charged ${job.balance_due_date})` : ""}`) : ""} locale={l} />
        )}
        {(job.paid_at || job.deposit_paid_at) && !job.contractor_id && !job.remedy && ["dispatched", "scheduled"].includes(job.status) && <MarketPanel jobId={job.id} price={Number(job.price_final)} suggested={job.suggested_price ?? null} locale={l} />}
        <TrackPro jobId={job.id} locale={l} />
        {job.paid_at && <p className="text-sm text-brand-dark">{t("Paid")} {money(job.amount_paid)}{Number(job.amount_refunded) > 0 ? ` · ${es ? "reembolsado" : "refunded"} ${money(job.amount_refunded)}` : ""}</p>}
        {mine.length > 0 && (
          <div className="card"><div className="font-semibold">{t("Your photos")}</div><div className="mt-3 grid grid-cols-4 gap-2">{mine.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt={t("Your photo")} className="aspect-square w-full rounded-lg object-cover" /></a>)}</div></div>
        )}
        {!["completed", "cancelled"].includes(job.status) && <AddJobPhotos jobId={job.id} count={job.photos?.length ?? 0} locale={l} />}
        {photos.length > 0 && (
          <div className="card"><div className="font-semibold">{t("Completion photos")}</div><div className="mt-3 grid grid-cols-3 gap-2">{photos.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt={t("Completed work")} className="aspect-square w-full rounded-lg object-cover" /></a>)}</div></div>
        )}
        {["requested", "quoted", "scheduled", "dispatched", "assigned"].includes(job.status) && !job.remedy && job.scheduled_date && (
          <Reschedule jobId={job.id} service={job.service_slug} zip={job.zip} date={job.scheduled_date} window={job.time_window} locale={l} />
        )}
        {["requested", "quoted", "site_visit", "scheduled", "dispatched", "assigned"].includes(job.status) && !job.remedy && (
          <CancelBooking jobId={job.id} late={isLate(job)} fee={money(Math.min(LATE_CANCEL_FEE, Number(job.amount_paid)))} paid={Number(job.amount_paid) > 0} locale={l} />
        )}
        {job.status === "completed" && !review && <ReviewForm jobId={job.id} contractorId={job.contractor_id} locale={l} />}
        {review && !review.google_clicked_at && BRAND.googleReviewUrl && <div className="card text-sm"><GoogleReviewAsk jobId={job.id} locale={l} /></div>}
        {job.status === "completed" && job.contractor_id && !job.remedy && <TipBox jobId={job.id} tipped={Number(job.tip_total ?? 0)} locale={l} />}
        {job.contractor_id && <YourPro job={job} es={es} db={v.db} />}
        {job.contractor_id && <JobThread jobId={job.id} userId={v.userId} as="customer" initial={msgs ?? []} locale={l} />}
      </div>
      <div className="card h-fit">
        <div className="font-semibold">{t("Timeline")}</div>
        <ol className="mt-4 space-y-4 border-l-2 border-line pl-4">
          {(events ?? []).map((e: { id: number; message: string; message_es: string | null; created_at: string }) => (
            <li key={e.id} className="relative text-sm"><span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-brand" />{es ? e.message_es ?? e.message : e.message}<div className="text-xs text-ink-soft">{new Date(e.created_at).toLocaleString(es ? "es-US" : "en-US")}</div></li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-ink-soft">{es ? `¿Preguntas? ${BRAND.supportPhone} · garantía de satisfacción de ${BRAND.guaranteeDays} días.` : `Questions? ${BRAND.supportPhone} · ${BRAND.guaranteeDays}-day make-it-right guarantee.`}</p>
      </div>
    </div>
  );
}

/** Pros' counters on this job (first name, rating, jobs, price) + raise-your-offer. */
async function MarketPanel({ jobId, price, suggested, locale }: { jobId: string; price: number; suggested: number | null; locale: Locale }) {
  const { data } = await adminClient().from("job_offers").select("id, counter_price, counter_note, contractors(contact_name, rating, jobs_completed)").eq("job_id", jobId).eq("status", "countered").order("counter_price");
  const counters: Counter[] = ((data ?? []) as unknown as { id: string; counter_price: number; counter_note: string | null; contractors: { contact_name: string; rating: number; jobs_completed: number } | null }[])
    .map((o) => ({ id: o.id, who: String(o.contractors?.contact_name ?? "Pro").split(" ")[0], rating: Number(o.contractors?.rating ?? 5), jobs: Number(o.contractors?.jobs_completed ?? 0), price: Number(o.counter_price), note: o.counter_note }));
  return <MarketBox jobId={jobId} price={price} suggested={suggested} counters={counters} locale={locale} />;
}

/** Who covered the job (safe view), ★ favorite them or their crew member, and book them again. */
async function YourPro({ job, es, db }: { job: Job; es: boolean; db: Viewer["db"] }) {
  const [{ data: pro }, { data: crew }, { data: favs }] = await Promise.all([
    db.rpc("job_pro", { p_job: job.id }).maybeSingle(),
    db.rpc("job_crew", { p_job: job.id }).maybeSingle(),
    db.from("customer_favorites").select("crew_member_id").eq("contractor_id", job.contractor_id!),
  ]);
  const p = pro as { business_name: string; contact_first_name: string; rating: number | null; jobs_completed: number } | null;
  if (!p) return null;
  const c = crew as { crew_member_id: string; first_name: string; role: string } | null;
  const saved = (favs ?? []) as { crew_member_id: string | null }[];
  const name = p.contact_first_name || p.business_name;
  const again = `/book?service=${job.service_slug}&pro=${job.contractor_id}${c ? `&crew=${c.crew_member_id}` : ""}`;
  return (
    <div className="card space-y-3">
      <div className="font-semibold">{es ? "Su profesional" : "Your pro"}</div>
      <div className="text-sm">{name}{p.business_name && p.business_name !== name ? ` · ${p.business_name}` : ""}{p.rating ? ` · ${Number(p.rating).toFixed(1)}★` : ""}{c ? (es ? ` · vino ${c.first_name}` : ` · ${c.first_name} came out`) : ""}</div>
      <div className="flex flex-wrap items-center gap-3">
        <FavoriteButton jobId={job.id} name={name} saved={saved.some((f) => !f.crew_member_id)} es={es} />
        {c && <FavoriteButton jobId={job.id} name={c.first_name} crew saved={saved.some((f) => f.crew_member_id === c.crew_member_id)} es={es} />}
        {job.status === "completed" && <a href={again} className="btn-primary px-4 text-sm">{es ? `Reservar de nuevo con ${c ? c.first_name : name}` : `Book again with ${c ? c.first_name : name}`}</a>}
      </div>
      <p className="text-xs text-ink-soft">{es
        ? "Sus favoritos ven primero sus próximas reservas de ese tipo de trabajo por unas horas; si no pueden, otro profesional verificado lo toma. No está garantizado. Si pide a alguien del equipo, el dueño de la empresa decide quién va."
        : "Your favorites see your next booking for that kind of work first for a few hours; if they can't, another vetted pro takes it. Not guaranteed. Asking for someone on a crew is a request — the company owner decides who goes."}</p>
    </div>
  );
}
