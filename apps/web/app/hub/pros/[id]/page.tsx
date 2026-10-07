/*
 * FILE    : apps/web/app/hub/pros/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-03_0042 UTC — link to the pro's signed contracts.
 * UPDATED : 2026-10-03_0124 UTC — standing panel: events, warn / suspend / deactivate / reinstate / appeal.
 * UPDATED : 2026-10-03_1311 UTC — crew panel (background checks per crew member) and fast-track review.
 * UPDATED : 2026-10-04_1934 UTC — mark a pro's photo ID verified after a video call.
 * UPDATED : 2026-10-06_2120 UTC — cancellation record (late, no-shows, short notice, free, excused) on the profile.
 * UPDATED : 2026-10-06_0748 UTC — Progress & rewards panel: tier, what's left for the next tier (jobs / rating / on-time
 *           bars), Pro Rewards points (available, pending, lifetime, ≈ $), tenure multiplier, milestones, orders.
 * PURPOSE : One pro as an asset: value generated, quality, onboarding & compliance
 *           documents, work history, payout ledger and 1099 totals.
 */
import Link from "next/link";
import { adminClient } from "@/lib/supabase/server";
import { StandingActions } from "@/components/Standing";
import { notFound } from "next/navigation";
import { COVERAGES, PROBATION, TRADES, getService, money, necThreshold, onboardingChecklist, proTier, specialtiesFor, type Contractor, type CoverageKey, DEACTIVATION_RULES } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Badge, Stat, StatusBadge, fmtDate } from "@/components/ui";
import { DocDecision, ProStatusControls } from "@/components/HubActions";
import { HubCrewDecision } from "@/components/Crew";
import { MarkIdVerified } from "@/components/VerifyId";
import { FastTrackReview } from "@/components/FastTrack";
import { crewReady, FAST_TRACK, type CrewMember } from "@handled/core";
import { listCrew } from "@/lib/crew";
import { rewardsFor } from "@/lib/rewards";
import { PRO_TIERS, nextTierProgress, pointsToDollars } from "@handled/core";
import { signedUrls } from "@/lib/photos";

type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function ProProfile({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v) return null;
  const { id } = await params;
  const year = new Date().getFullYear();
  const [{ data: c }, { data: card }, { data: docs }, { data: jobs }, { data: payouts }, { data: reviews }] = await Promise.all([
    v.db.from("contractors").select("*").eq("id", id).maybeSingle(),
    v.db.from("contractor_scorecard").select("*").eq("contractor_id", id).maybeSingle(),
    v.db.from("contractor_documents").select("*").eq("contractor_id", id).order("created_at", { ascending: false }),
    v.db.from("jobs").select("id, ref, service_slug, status, scheduled_date, price_final, contractor_payout, amount_refunded, remedy").eq("contractor_id", id).order("scheduled_date", { ascending: false }).limit(100),
    v.db.from("payouts").select("id, amount, status, created_at, paid_at, reason, jobs(ref)").eq("contractor_id", id).order("created_at", { ascending: false }).limit(200),
    v.db.from("reviews").select("rating, comment, created_at").eq("contractor_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const { data: ops } = await v.db.from("ops_ratings").select("rating, quality, punctuality, professionalism, source").eq("contractor_id", id).order("created_at", { ascending: false }).limit(50);
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "—");
  const custAvg = avg(((reviews ?? []) as Rec[]).map((r) => r.rating));
  const opsAvg = avg(((ops ?? []) as Rec[]).map((r) => r.rating));
  const aspect = (k: string) => avg(((ops ?? []) as Rec[]).map((r) => r[k]).filter(Boolean));
  if (!c) notFound();
  const pro = c as Contractor;
  const sc = (card ?? {}) as Rec;
  const { steps, complete } = onboardingChecklist(pro as never);
  const ytdPaid = ((payouts ?? []) as Rec[]).filter((p) => ["paid", "clawback"].includes(p.status) && (p.paid_at ?? p.created_at).startsWith(String(year))).reduce((t, p) => t + Number(p.amount), 0);
  const owed = ((payouts ?? []) as Rec[]).filter((p) => ["approved", "pending"].includes(p.status)).reduce((t, p) => t + Number(p.amount), 0)
    + ((payouts ?? []) as Rec[]).filter((p) => p.status === "clawback" && !p.paid_at).reduce((t, p) => t + Number(p.amount), 0);
  const qa = Number(sc.qa_checked) ? Math.round((Number(sc.qa_passed) / Number(sc.qa_checked)) * 100) : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/hub/pros" className="text-xs text-ink-soft">← Pros</Link>
          <h1 className="text-2xl font-bold">{pro.business_name}</h1>
          <p className="text-sm text-ink-soft">{pro.contact_name} · {pro.phone} · {pro.email} · <Link className="text-brand underline" href={`/hub/contracts?q=${encodeURIComponent(pro.email)}`}>Signed contracts</Link></p>
          <p className="text-xs text-ink-soft">{pro.trades.map((t) => TRADES.find((x) => x.id === t)?.label ?? t).join(", ")} · ZIPs {pro.service_zips.join(", ") || "—"}</p>
          <p className="text-xs text-ink-soft">
            <b>{proTier(pro).badge} {proTier(pro).name}</b>{pro.jobs_completed < PROBATION.jobs ? ` · probation (${PROBATION.jobs - pro.jobs_completed} job(s) left, max $${PROBATION.maxJobPrice})` : ""}
            {" · Specialties: "}{specialtiesFor(pro.trades).filter((x) => pro.specialties?.includes(x.id)).map((x) => x.label).join(", ") || "none chosen"}
            {" · Coverage: "}GL until {pro.insured_until ?? "—"}{Object.entries(pro.coverage ?? {}).map(([k, v]) => `, ${COVERAGES[k as CoverageKey]?.label ?? k} ${v === "exempt" ? "(no employees)" : `until ${v}`}`).join("")}
          </p>
        </div>
        <Badge tone={pro.status === "approved" ? "green" : pro.status === "suspended" ? "red" : "amber"}>{pro.status}</Badge>
      </div>
      <ProgressPanel pro={pro} />
      <StandingPanel pro={pro as unknown as StandingPro} />
      <FastTrackPanel pro={pro as unknown as FastTrackPro} />
      <CrewPanel pro={pro} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Our take from their work" value={money(Number(sc.take_generated ?? 0))} hint={`${money(Number(sc.take_90d ?? 0))} last 90 days · ~${money(Number(sc.take_90d ?? 0) * 4)}/yr pace`} />
        <Stat label="Bookings delivered" value={money(Number(sc.bookings_generated ?? 0))} hint={`${sc.jobs_completed ?? 0} jobs · ${sc.jobs_90d ?? 0} in 90 days`} />
        <Stat label="Rating (60% customer · 40% us)" value={`${pro.rating} ★`} hint={`Customers ${custAvg}★ · us ${opsAvg}★ (quality ${aspect("quality")}, punctual ${aspect("punctuality")}, pro ${aspect("professionalism")}) · QA pass ${qa ?? "—"}% · ${sc.redos ?? 0} redos · ${money(Number(sc.refunds_on_their_jobs ?? 0))} refunded`} />
        <Stat label="Reliability" value={`${Math.round(pro.on_time_rate * 100)}% on time`} hint={`${Math.round(pro.acceptance_rate * 100)}% acceptance · last job ${sc.last_job_at ? fmtDate(sc.last_job_at) : "never"}`} />
        <Stat label={`Paid ${year} (1099)`} value={money(ytdPaid)} hint={`${money(owed)} owed · 1099-NEC at ${money(necThreshold(year))}+`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="card">
          <div className="flex items-center justify-between"><div className="font-semibold">Onboarding & compliance</div><Badge tone={complete ? "green" : "amber"}>{steps.filter((s) => s.done).length}/{steps.length}</Badge></div>
          <ul className="mt-3 space-y-2 text-sm">{steps.map((s) => <li key={s.key} className="flex justify-between gap-2"><span>{s.done ? "✅" : "⬜"} {s.label}{s.expiring ? " ⚠️ expiring" : ""}</span><span className="text-ink-soft">{s.detail}{s.key === "id" && !s.done && <span className="ml-2"><MarkIdVerified contractorId={id} /></span>}</span></li>)}</ul>
          <div className="mt-4 font-semibold">Documents</div>
          <div className="mt-2 space-y-2">
            {!(docs ?? []).length && <p className="text-sm text-ink-soft">None uploaded yet — the pro uploads from Pro portal → Setup & documents.</p>}
            {((docs ?? []) as Rec[]).map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-2 text-sm">
                <div><b>{d.kind.toUpperCase()}</b> · {d.status}{d.expires_on ? ` · expires ${d.expires_on}` : ""}<div className="text-xs text-ink-soft">{d.created_at.slice(0, 10)}{d.verified_by ? ` · ${d.verified_by}` : ""}{d.notes ? ` · ${d.notes}` : ""}</div>
                  {d.ai_check && (
                    <div className={`mt-1 rounded-lg px-2 py-1 text-xs ${d.ai_check.meets_requirements ? "bg-brand-tint text-brand-dark" : "bg-amber-50 text-amber-900"}`}>
                      AI read: {d.ai_check.meets_requirements ? "✓ meets requirements" : "⚠ check"} · {d.ai_check.document_type} · insured {d.ai_check.named_insured}{d.ai_check.matches_pro ? " ✓" : " (name differs)"}
                      {d.ai_check.expires_on ? ` · expires ${d.ai_check.expires_on}${d.expires_on && d.ai_check.expires_on !== d.expires_on ? ` (pro entered ${d.expires_on})` : ""}` : ""}
                      {d.ai_check.per_occurrence_limit ? ` · $${Number(d.ai_check.per_occurrence_limit).toLocaleString("en-US")}/occurrence` : ""}{d.kind === "coi" ? (d.ai_check.additional_insured ? " · additional insured ✓" : " · not additional insured") : ""}
                      {d.ai_check.problems?.length ? <div>{d.ai_check.problems.join("; ")}</div> : null}
                    </div>
                  )}
                </div>
                {d.storage_path && d.status === "pending" ? <DocDecision contractorId={id} docId={d.id} /> : d.storage_path ? <a className="text-xs underline" href={`/api/hub/contractors/${id}/documents/${d.id}`} target="_blank">Open</a> : null}
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-ink-soft">1099 profile: {pro.legal_name ?? "—"} · {pro.entity_type ?? "—"} · TIN •••{pro.tin_last4 ?? "—"} · {[pro.address_line, pro.city, pro.state, pro.zip].filter(Boolean).join(", ") || "no address"} · payout {pro.payout_method ?? "—"}{pro.payout_account_last4 ? ` •••${pro.payout_account_last4}` : ""}</div>
        </div>
        <div className="space-y-4">
          <ProStatusControls id={id} status={pro.status} complete={complete} />
          <div className="card text-sm"><div className="font-semibold">Recent reviews</div>
            {((reviews ?? []) as Rec[]).map((r, i) => <p key={i} className="mt-2">{"★".repeat(r.rating)} <span className="text-ink-soft">{r.comment ?? ""}</span></p>)}
            {!(reviews ?? []).length && <p className="mt-2 text-ink-soft">No reviews yet.</p>}</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="card overflow-x-auto p-0"><div className="p-4 font-semibold">Work history</div><table className="w-full text-sm"><tbody>
          {((jobs ?? []) as Rec[]).map((j) => (
            <tr key={j.id} className="border-t border-line"><td className="p-3"><Link href={`/hub/jobs/${j.id}`} className="font-medium underline">{j.ref}</Link>{j.remedy ? <span className="ml-1 text-xs text-ink-soft">({j.remedy})</span> : null}</td><td className="p-3">{getService(j.service_slug)?.name}</td><td className="p-3 text-xs">{fmtDate(j.scheduled_date)}</td><td className="p-3"><StatusBadge status={j.status} /></td><td className="p-3 text-right">{money(Number(j.price_final ?? 0))} → {money(Number(j.contractor_payout ?? 0))}</td></tr>
          ))}
        </tbody></table></div>
        <div className="card overflow-x-auto p-0"><div className="p-4 font-semibold">Payout ledger</div><table className="w-full text-sm"><tbody>
          {((payouts ?? []) as Rec[]).map((p) => (
            <tr key={p.id} className="border-t border-line"><td className="p-3 text-xs">{(p.paid_at ?? p.created_at).slice(0, 10)}</td><td className="p-3">{p.jobs?.ref}</td><td className="p-3">{p.status}{p.reason ? ` · ${p.reason}` : ""}</td><td className={`p-3 text-right font-semibold ${Number(p.amount) < 0 ? "text-rose-700" : ""}`}>{money(Number(p.amount))}</td></tr>
          ))}
        </tbody></table></div>
      </div>
    </div>
  );
}

type StandingPro = { id: string; standing?: string; standing_reason?: string | null; improve_by?: string | null; appeal_by?: string | null; appeal_decide_by?: string | null };

async function StandingPanel({ pro }: { pro: StandingPro }) {
        const { data: ev } = await adminClient().from("pro_standing_events").select("kind, note, actor, created_at, jobs(ref)").eq("contractor_id", pro.id).order("created_at", { ascending: false }).limit(15);
        const st = pro as unknown as { standing?: string; standing_reason?: string | null; improve_by?: string | null; appeal_by?: string | null; appeal_decide_by?: string | null };
        return (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">Standing: {st.standing ?? "good"}</div>
              <div className="text-xs text-ink-soft">{st.improve_by ? `improve by ${st.improve_by} · ` : ""}{st.appeal_by ? `appeal by ${st.appeal_by} · ` : ""}{st.appeal_decide_by ? <b className="text-rose-700">appeal — decide by {st.appeal_decide_by}</b> : ""}</div></div>
            {st.standing_reason && <p className="mt-1 text-sm text-ink-soft">{st.standing_reason}</p>}
            <ul className="mt-2 divide-y divide-line text-xs">{((ev ?? []) as unknown as { kind: string; note: string | null; actor: string | null; created_at: string; jobs: { ref: string } | null }[]).map((e, i) => <li key={i} className="py-1.5"><b>{e.kind.replace("_", " ")}</b> · {e.created_at.slice(0, 10)}{e.jobs?.ref ? ` · ${e.jobs.ref}` : ""}{e.actor ? ` · ${e.actor}` : ""}{e.note ? ` — ${e.note}` : ""}</li>)}{!ev?.length && <li className="py-1.5 text-ink-soft">No late cancels, no-shows, warnings or appeals.</li>}</ul>
            <p className="mt-3 text-xs text-ink-soft">Policy: written warning first (with reasons, {DEACTIVATION_RULES.improveDays} days to improve) except for safety, fraud, theft, violence or discrimination. Suspend immediately only for a credible safety threat or suspected fraud. Every decision goes to the pro in writing; they can appeal within {DEACTIVATION_RULES.appealDays} days and we decide within {DEACTIVATION_RULES.decisionDays}. Earned pay is always paid.</p>
            <div className="mt-2"><StandingActions contractorId={pro.id} appealOpen={Boolean(st.appeal_decide_by)} /></div>
          </div>
        );
}

async function CrewPanel({ pro }: { pro: Contractor }) {
  const crew = await listCrew(pro.id, true);
  if (!crew.length && !pro.crew_attested_at) return null;
  const notReady = crewReady(pro);
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">Crew ({crew.filter((m) => m.active).length} active)</div>
        <div className="text-xs text-ink-soft">Crew Addendum {pro.crew_attested_at ? `signed ${pro.crew_attested_at.slice(0, 10)}` : "not signed"} · {notReady ? <b className="text-amber-800">can’t send crew: {notReady}</b> : "can send crew"}</div></div>
      <ul className="mt-2 divide-y divide-line text-sm">
        {crew.map((m: CrewMember) => (
          <li key={m.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${m.active ? "" : "opacity-50"}`}>
            <div><b>{m.full_name}</b> · {m.role}{m.license_number ? ` · license ${m.license_number}` : ""}{m.years_experience ? ` · ${m.years_experience} yrs` : ""} · {m.trades.join(", ") || "—"}
              <div className="text-xs text-ink-soft">{m.email ?? "no email"}{m.phone ? ` · ${m.phone}` : ""} · added {m.created_at.slice(0, 10)}{m.active ? "" : " · removed"}</div></div>
            <div className="flex items-center gap-2 text-xs"><span>background: <b>{m.background_status}</b>{m.background_checked_at ? ` ${m.background_checked_at.slice(0, 10)}` : ""}</span>{m.active && <HubCrewDecision id={m.id} />}</div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-soft">Crew work for the pro’s company (Crew Addendum): the company handles their right to work (I-9), pay and workers’ comp. We only list them, run the background check and check licenses for licensed work. Record a hand-run result here when Checkr isn’t connected; anything but clear follows the adverse-action process.</p>
    </div>
  );
}

type FastTrackPro = { id: string; fast_track_status?: string; fast_track?: { years?: number; summary?: string; references?: string; photos?: string[]; trades?: string[] } | null; fast_track_applied_at?: string | null; fast_track_trial_job_id?: string | null; fast_track_note?: string | null; fast_track_decided_by?: string | null; tier_floor?: string | null };

async function FastTrackPanel({ pro }: { pro: FastTrackPro }) {
  const st = pro.fast_track_status ?? "none";
  if (st === "none") return null;
  const ft = pro.fast_track ?? {};
  const db = adminClient();
  const [photos, trial] = await Promise.all([
    signedUrls(ft.photos ?? []),
    pro.fast_track_trial_job_id
      ? db.from("jobs").select("id, ref, status, completion_photos, reviews(rating, comment)").eq("id", pro.fast_track_trial_job_id).maybeSingle().then((r) => r.data as { id: string; ref: string; status: string; completion_photos: string[]; reviews: { rating: number; comment: string | null }[] | { rating: number; comment: string | null } | null } | null)
      : Promise.resolve(null),
  ]);
  const trialPhotos = trial ? await signedUrls(trial.completion_photos ?? []) : [];
  const review = trial ? (Array.isArray(trial.reviews) ? trial.reviews[0] : trial.reviews) : null;
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">Fast track to Pro+: {st}</div>
        <div className="text-xs text-ink-soft">applied {pro.fast_track_applied_at?.slice(0, 10) ?? "—"}{pro.fast_track_decided_by ? ` · decided by ${pro.fast_track_decided_by}` : ""}{pro.tier_floor ? ` · floor ${pro.tier_floor}` : ""}</div></div>
      <p className="mt-1 text-sm"><b>{ft.years ?? "?"} years</b> · {(ft.trades ?? []).join(", ")}</p>
      {ft.summary && <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{ft.summary}</p>}
      {ft.references && <p className="mt-1 text-xs text-ink-soft">References: {ft.references}</p>}
      {photos.length > 0 && <div className="mt-2 grid grid-cols-5 gap-2">{photos.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="Portfolio" className="aspect-square rounded-lg object-cover" /></a>)}</div>}
      {trial && (
        <div className="mt-3 rounded-xl border border-line p-2 text-sm">Trial job <Link href={`/hub/jobs/${trial.id}`} className="underline">{trial.ref}</Link> · {trial.status}{review ? ` · customer ${review.rating}★${review.comment ? ` “${review.comment}”` : ""}` : " · no review yet"}
          {trialPhotos.length > 0 && <div className="mt-2 grid grid-cols-6 gap-2">{trialPhotos.map((u) => <a key={u} href={u} target="_blank"><img src={u} alt="Trial job" className="aspect-square rounded-lg object-cover" /></a>)}</div>}
        </div>
      )}
      {pro.fast_track_note && <p className="mt-2 text-xs text-ink-soft">Note: {pro.fast_track_note}</p>}
      <div className="mt-3"><FastTrackReview contractorId={pro.id} status={st} trialDone={trial?.status === "completed"} /></div>
      <p className="mt-2 text-xs text-ink-soft">How it works: look at the portfolio → start the trial (their next completed job is the trial; probation still applies) → look at the trial photos, call the customer ({FAST_TRACK.trialMinRating}★+ to pass) → approve. Approved pros start at Pro+ and skip the probation job-size limit; the floor holds for {FAST_TRACK.graceJobs} jobs, then only while rating and on-time stay at Pro+ level.</p>
    </div>
  );
}

/** Where the pro stands in the Pro Program (tier) and Pro Rewards (points) — the same numbers the pro sees. */
async function ProgressPanel({ pro }: { pro: Contractor }) {
  const r = await rewardsFor(pro.id).catch(() => null);
  const cx = await (await import("@/lib/coverage")).cancelRecord(pro.id).catch(() => null);
  const tier = proTier(pro), { next, todo } = nextTierProgress(pro);
  const bar = (label: string, now: number, goal: number, show: string) => {
    const pctDone = goal > 0 ? Math.min(100, Math.round((now / goal) * 100)) : 100;
    return (
      <div key={label}>
        <div className="flex justify-between text-xs"><span>{label}</span><span className="text-ink-soft">{show}</span></div>
        <div className="mt-1 h-2 rounded-full bg-paper"><div className={`h-2 rounded-full ${pctDone >= 100 ? "bg-brand" : "bg-amber-500"}`} style={{ width: `${pctDone}%` }} /></div>
      </div>
    );
  };
  const done = r?.milestones.filter((m) => m.done) ?? [];
  const upcoming = r?.milestones.filter((m) => !m.done).slice(0, 3) ?? [];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card text-sm">
        <div className="flex items-center justify-between"><div className="font-semibold">Pro Program tier</div><Badge tone="green">{tier.badge} {tier.name}{tier.payoutBoost ? ` · +${Math.round(tier.payoutBoost * 100)}% pay` : ""}</Badge></div>
        {next ? (
          <div className="mt-3 space-y-2">
            <div className="text-xs text-ink-soft">Next: <b>{next.badge} {next.name}</b> (+{Math.round(next.payoutBoost * 100)}% pay) — {todo.length ? `needs ${todo.join(", ")}` : "qualifies on the next refresh"}</div>
            {bar("Completed jobs", pro.jobs_completed, next.min.jobs, `${pro.jobs_completed} / ${next.min.jobs}`)}
            {bar("Rating", Number(pro.rating), next.min.rating, `${Number(pro.rating).toFixed(2)} / ${next.min.rating}★`)}
            {bar("On time", Number(pro.on_time_rate), next.min.onTime, `${Math.round(Number(pro.on_time_rate) * 100)}% / ${Math.round(next.min.onTime * 100)}%`)}
          </div>
        ) : <p className="mt-2 text-xs text-ink-soft">Top tier ({PRO_TIERS[PRO_TIERS.length - 1].name}) — keeps it while rating and on-time hold.</p>}
      </div>
      {cx && <div className="card text-sm lg:col-span-2">
        <div className="font-semibold">🛟 Cancellations (last {cx.days} days)</div>
        <p className="mt-1 text-xs"><b className={cx.late >= 3 ? "text-rose-700" : ""}>{cx.late} late</b> · <b className={cx.noShows >= 2 ? "text-rose-700" : ""}>{cx.noShows} no-show(s)</b> · {cx.shortNotice} short notice · {cx.free} free · {cx.excused} excused <span className="text-ink-soft">— only late cancels (3) and no-shows (2) count toward a written warning. <Link href="/hub/coverage" className="underline">All cancellations →</Link></span></p>
      </div>}
      <div className="card text-sm">
        <div className="flex items-center justify-between"><div className="font-semibold">🎁 Pro Rewards</div><Link href="/hub/rewards" className="text-xs underline">Rewards hub →</Link></div>
        {r ? (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><div className="text-lg font-bold">{r.balance.available.toLocaleString("en-US")}</div><div className="text-xs text-ink-soft">available (≈ {money(pointsToDollars(r.balance.available, r.settings))})</div></div>
              <div><div className="text-lg font-bold">{r.balance.pending.toLocaleString("en-US")}</div><div className="text-xs text-ink-soft">pending ({r.settings.pendingDays} days)</div></div>
              <div><div className="text-lg font-bold">{r.balance.lifetime.toLocaleString("en-US")}</div><div className="text-xs text-ink-soft">lifetime</div></div>
            </div>
            <p className="mt-3 text-xs text-ink-soft">Tenure: {r.monthsActive} months active · ×{r.tier.multiplier} points{r.orders.length ? ` · ${r.orders.length} reward order(s), latest ${r.orders[0].item_name} (${r.orders[0].status})` : " · no reward orders yet"}</p>
            <p className="mt-1 text-xs text-ink-soft">Milestones: {done.length ? done.map((m) => `✓ ${m.en}`).join(" · ") : "none yet"}{upcoming.length ? ` — next: ${upcoming.map((m) => `${m.en} (+${m.points.toLocaleString("en-US")})`).join(" · ")}` : ""}</p>
          </>
        ) : <p className="mt-2 text-xs text-ink-soft">Rewards data isn’t available (run the rewards migration in Hub → Setup).</p>}
      </div>
    </div>
  );
}
