/*
 * FILE    : apps/web/app/pro/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2109 UTC — Pro tier, progress to the next tier, probation, referral bonus.
 * PURPOSE : Pro home — open offers, upcoming jobs, earnings.
 */
import Link from "next/link";
import { PROBATION, PRO_REFERRAL, TIME_WINDOW_LABEL, getService, money, nextTierProgress, onboardingChecklist, proTier, type Job } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Empty, Stat, StatusBadge, fmtDate } from "@/components/ui";
import Link2 from "next/link";

export default async function ProHome() {
  const v = await getViewer();
  if (!v) return null;
  const [{ data: offers }, { data: jobs }, { data: payouts }, { data: me }] = await Promise.all([
    v.db.from("job_offers").select("id, payout, expires_at, job_id, jobs(ref, service_slug, city, zip, scheduled_date, time_window, answers, notes, status)").eq("status", "offered").order("offered_at", { ascending: false }),
    v.db.from("jobs").select("*").eq("contractor_id", v.contractorId!).order("scheduled_date"),
    v.db.from("payouts").select("amount, status, created_at"),
    v.db.from("contractors").select("*").eq("id", v.contractorId!).single(),
  ]);
  const list = (jobs ?? []) as Job[];
  const upcoming = list.filter((j) => ["assigned", "in_progress", "qa_review", "site_visit"].includes(j.status));
  const month = new Date().toISOString().slice(0, 7);
  const earned = (payouts ?? []).filter((p: { created_at: string }) => p.created_at.startsWith(month)).reduce((t: number, p: { amount: number }) => t + Number(p.amount), 0);
  type OfferRow = { id: string; payout: number; expires_at: string; jobs: { ref: string; service_slug: string; city: string; zip: string; scheduled_date: string | null; time_window: Job["time_window"]; notes: string | null } | null };
  const setup = me ? onboardingChecklist(me) : null;
  return (
    <div className="space-y-8">
      {setup && (!setup.complete || setup.steps.some((x) => x.expiring)) && (
        <Link href="/pro/onboarding" className="card block border-amber-300 bg-amber-50">
          <div className="font-semibold">{setup.complete ? "A document expires soon" : `Finish setup — ${setup.steps.filter((x) => !x.done).length} step(s) left`}</div>
          <div className="text-sm text-ink-soft">{setup.steps.filter((x) => !x.done || x.expiring).map((x) => x.label).join(" · ")}</div>
        </Link>
      )}
      <div><h1 className="text-2xl font-bold">{me?.business_name}</h1><p className="text-sm text-ink-soft">Status: {me?.status}{me?.status !== "approved" ? " — offers start once insurance & background check are verified" : ""}</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Earned this month" value={money(earned)} />
        <Stat label="Rating" value={`${me?.rating ?? "—"} ★`} />
        <Stat label="Jobs completed" value={me?.jobs_completed ?? 0} />
      </div>
      {me && (() => {
        const tier = proTier(me), prog = nextTierProgress(me);
        return (
          <div className="card border-brand/40 bg-brand-tint">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">{tier.badge} {tier.name} pro{tier.payoutBoost ? ` · +${Math.round(tier.payoutBoost * 100)}% of the job price on every payout` : ""}</div>
              {me.jobs_completed < PROBATION.jobs && <span className="text-xs text-ink-soft">Probation: {PROBATION.jobs - me.jobs_completed} job(s) left (jobs up to {money(PROBATION.maxJobPrice)})</span>}
            </div>
            <div className="text-sm text-ink-soft">{tier.perks.join(" · ")}</div>
            {prog.next && <div className="mt-2 text-sm">Next: <b>{prog.next.badge} {prog.next.name}</b> (+{Math.round(prog.next.payoutBoost * 100)}% pay, earlier offers). To get there: {prog.todo.join(", ")}.</div>}
            <div className="mt-2 text-xs text-ink-soft">Know a great pro? Earn {money(PRO_REFERRAL.bonus)} when they finish their {PRO_REFERRAL.afterJobs}th job. Send them to /pros and have them put your business name in the “Tell us about your crew” box.</div>
          </div>
        );
      })()}
      <section>
        <h2 className="mb-3 font-bold">New offers</h2>
        {!(offers ?? []).length && <Empty>No open offers right now. We’ll email you the moment one comes in.</Empty>}
        <div className="space-y-3">
          {((offers ?? []) as unknown as OfferRow[]).map((o) => {
            const s = getService(o.jobs?.service_slug ?? "");
            return (
              <div key={o.id} className="card flex flex-wrap items-center justify-between gap-4">
                <div><div className="font-semibold">{s?.icon} {s?.name} · <span className="text-brand">{o.payout ? money(o.payout) : "site visit"}</span></div>
                  <div className="text-sm text-ink-soft">{o.jobs?.city} {o.jobs?.zip} · {fmtDate(o.jobs?.scheduled_date)} · {o.jobs ? TIME_WINDOW_LABEL[o.jobs.time_window] : ""}</div>
                  {o.jobs?.notes && <div className="mt-1 text-xs text-ink-soft">“{o.jobs.notes}”</div>}
                  <div className="text-xs text-ink-soft">Expires {new Date(o.expires_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div></div>
                <Link2 href={`/pro/offers/${o.id}`} className="btn-primary px-5">View & accept →</Link2>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="mb-3 font-bold">Your schedule</h2>
        {!upcoming.length && <Empty>Nothing scheduled.</Empty>}
        <div className="space-y-3">
          {upcoming.map((j) => (
            <Link key={j.id} href={`/pro/jobs/${j.id}`} className="card flex items-center justify-between gap-3 hover:border-brand">
              <div><div className="font-semibold">{getService(j.service_slug)?.name} <span className="text-xs text-ink-soft">{j.ref}</span></div><div className="text-sm text-ink-soft">{fmtDate(j.scheduled_date)} · {j.address}, {j.city}</div></div>
              <div className="flex items-center gap-3"><span className="text-sm font-semibold">{money(j.contractor_payout)}</span><StatusBadge status={j.status} /></div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
