/*
 * FILE    : apps/web/app/hub/pros/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-03_0042 UTC — link to the pro's signed contracts.
 * PURPOSE : One pro as an asset: value generated, quality, onboarding & compliance
 *           documents, work history, payout ledger and 1099 totals.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { COVERAGES, PROBATION, TRADES, getService, money, necThreshold, onboardingChecklist, proTier, specialtiesFor, type Contractor, type CoverageKey } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { Badge, Stat, StatusBadge, fmtDate } from "@/components/ui";
import { DocDecision, ProStatusControls } from "@/components/HubActions";

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
          <ul className="mt-3 space-y-2 text-sm">{steps.map((s) => <li key={s.key} className="flex justify-between gap-2"><span>{s.done ? "✅" : "⬜"} {s.label}{s.expiring ? " ⚠️ expiring" : ""}</span><span className="text-ink-soft">{s.detail}</span></li>)}</ul>
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
