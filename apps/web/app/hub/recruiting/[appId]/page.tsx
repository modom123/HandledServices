/*
 * FILE    : apps/web/app/hub/recruiting/[appId]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : Hub → Recruiting → one candidate: where they are (approval checklist from application to first job,
 *           with the next step and who it waits on), the application and AI screen, interviews (AI transcript,
 *           scores with evidence, result, decision; or the scorecard for interviewing them yourself), and history.
 * UPDATED : 2026-10-05_0432 UTC — approval checklist shows whether the pro has signed in (account created).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPETENCIES, QUESTIONS, RESULT_LABEL, TRADES, approvalChecklist, interviewPlan, onboardingChecklist, type Competency } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { interviewsFor, interviewUrl } from "@/lib/interviews";
import { aiEnabled } from "@/lib/ai/client";
import { InterviewDecision, Scorecard, StartInterview } from "@/components/Interviews";
import { RecruitingRowActions } from "@/components/HubActions";

export const dynamic = "force-dynamic";
const days = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);

export default async function Candidate({ params, searchParams }: { params: Promise<{ appId: string }>; searchParams: Promise<{ scorecard?: string }> }) {
  const { appId } = await params;
  const { scorecard } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(appId)) notFound();
  const db = adminClient();
  const { data: app } = await db.from("contractor_applications").select("*").eq("id", appId).maybeSingle();
  if (!app) notFound();
  const [ivs, { data: pro }, { data: events }] = await Promise.all([
    interviewsFor(appId),
    app.contractor_id ? db.from("contractors").select("*").eq("id", app.contractor_id).maybeSingle() : db.from("contractors").select("*").eq("email", String(app.email).toLowerCase()).maybeSingle(),
    db.from("recruiting_events").select("kind, note, actor, created_at").eq("application_id", appId).order("created_at", { ascending: false }).limit(100),
  ]);
  const { data: firstJob } = pro ? await db.from("jobs").select("id").eq("contractor_id", pro.id).eq("status", "completed").limit(1) : { data: [] };
  const latest = ivs[0];
  const done = ivs.find((i) => i.status === "completed");
  const check = approvalChecklist({
    applied_at: app.created_at, ai_screen: app.ai_screen, interview: latest ? { status: latest.status, result: latest.result, mode: latest.mode } : null,
    invited_at: app.invited_at, account_linked: Boolean(pro?.profile_id), onboarding: pro ? onboardingChecklist(pro as never).steps : [], approved: pro?.status === "approved", first_job_done: Boolean(firstJob?.length),
  });
  const plan = interviewPlan((app.trades as string[]) ?? []);
  const human = ivs.find((i) => i.mode === "human" && i.status === "in_progress");
  const trade = (t: string) => TRADES.find((x) => x.id === t)?.label ?? t;
  const lastEvent = (events ?? [])[0] as { created_at: string } | undefined;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/hub/recruiting" className="text-sm text-brand underline">← Recruiting</Link>
        <h1 className="text-2xl font-bold">{app.business_name}</h1>
        <p className="text-sm text-ink-soft">{app.contact_name} · {app.phone} · {app.email} · {((app.trades as string[]) ?? []).map(trade).join(", ")} · applied {days(app.created_at)}d ago{lastEvent ? ` · last activity ${days(lastEvent.created_at)}d ago` : ""}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="card space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-bold">Approval checklist</h2><span className="text-sm text-ink-soft">{check.pct}%</span></div>
          <div className="h-2 rounded-full bg-paper"><div className="h-2 rounded-full bg-brand" style={{ width: `${check.pct}%` }} /></div>
          {check.next && <div className="rounded-lg bg-amber-50 p-2 text-sm">Next: <b>{check.next.en}</b> <span className="text-ink-soft">(waits on {check.next.who === "candidate" ? "the candidate" : check.next.who === "staff" ? "us" : "the system"})</span></div>}
          <ul className="space-y-1 text-sm">{check.steps.map((s) => <li key={s.key} className="flex gap-2"><span>{s.done ? "✅" : "☐"}</span><span className={s.done ? "" : "text-ink-soft"}>{s.en}{s.detail ? <span className="text-xs text-ink-soft"> — {s.detail}</span> : null}</span></li>)}</ul>
          <RecruitingRowActions appId={appId} contractorId={pro?.id ?? null} stage={String(app.stage)} />
          {pro && <Link className="text-sm underline" href={`/hub/pros/${pro.id}`}>Pro record & documents →</Link>}
        </section>
        <section className="space-y-4">
          <div className="card space-y-3">
            <h2 className="font-bold">Interview</h2>
            {!latest && <><p className="text-sm text-ink-soft">No interview yet. The AI interviewer emails them a private link (about 15 minutes, English or Spanish); or interview them yourself in person or by phone with the packet.</p><StartInterview appId={appId} aiReady={aiEnabled()} /></>}
            {latest && (
              <div className="space-y-2 text-sm">
                <div><b>{latest.mode === "ai" ? "🤖 AI interview" : `📝 Interviewed by ${latest.interviewer ?? "staff"}`}</b> · {latest.status.replace("_", " ")}{latest.result ? <> · <b>{RESULT_LABEL[latest.result]}</b> ({latest.average})</> : null}</div>
                {latest.mode === "ai" && ["invited", "in_progress"].includes(latest.status) && <div className="text-xs text-ink-soft">Link: <span className="select-all">{interviewUrl(latest.token)}</span> · expires {latest.expires_at.slice(0, 10)}</div>}
                {latest.status === "human_requested" && <div className="rounded-lg bg-amber-50 p-2">They asked to talk to a person — call them and use the scorecard below.</div>}
                {latest.scores && (
                  <table className="w-full text-xs"><tbody>{(latest.scores as { competency: Competency; score: number; evidence?: string | null }[]).map((s) => (
                    <tr key={s.competency} className="border-t border-line"><td className="py-1 pr-2 font-medium">{COMPETENCIES[s.competency]?.en}</td><td className="py-1 pr-2 font-bold">{s.score}</td><td className="py-1 text-ink-soft">{s.evidence}</td></tr>
                  ))}</tbody></table>
                )}
                {latest.evaluation && (() => {
                  const e = latest.evaluation as { summary?: string; strengths?: string[]; concerns?: string[]; follow_up_questions?: string[]; knockouts?: string[] };
                  return <div className="space-y-1 text-xs">
                    {e.summary && <p>{e.summary}</p>}
                    {e.knockouts?.length ? <p className="text-rose-700">Knockouts: {e.knockouts.join("; ")}</p> : null}
                    {e.strengths?.length ? <p>Strengths: {e.strengths.join("; ")}</p> : null}
                    {e.concerns?.length ? <p className="text-amber-800">Concerns: {e.concerns.join("; ")}</p> : null}
                    {e.follow_up_questions?.length ? <p>Ask before deciding: {e.follow_up_questions.join(" · ")}</p> : null}
                  </div>;
                })()}
                {(latest.status === "completed" || latest.status === "in_progress") && <InterviewDecision id={latest.id} decided={latest.decision} canFinish={latest.mode === "ai" && latest.status === "in_progress" && latest.transcript.length > 2} />}
                {latest.transcript.length > 0 && latest.mode === "ai" && (
                  <details><summary className="cursor-pointer font-semibold">Transcript ({latest.transcript.filter((t) => t.role === "candidate").length} answers)</summary>
                    <div className="mt-2 space-y-1 text-xs">{latest.transcript.map((t, i) => <p key={i} className={t.role === "candidate" ? "pl-4" : "text-ink-soft"}><b>{t.role === "candidate" ? "Candidate" : "AI"}:</b> {t.text}</p>)}</div>
                  </details>
                )}
                {!["invited", "in_progress"].includes(latest.status) && <StartInterview appId={appId} aiReady={aiEnabled()} />}
              </div>
            )}
          </div>
          {(scorecard || human || latest?.status === "human_requested") && (
            <div id="scorecard" className="card">
              <h2 className="mb-1 font-bold">Scorecard — interviewing them yourself</h2>
              <p className="mb-3 text-xs text-ink-soft">Ask the questions in your own words. Don't ask about anything on the do-not-ask list (see the <Link className="underline" href="/hub/recruiting/packet">packet</Link>). Score what they said, not how they said it.</p>
              <Scorecard appId={appId} plan={plan} initial={human ? { scores: (human.scores ?? []) as never, answers: Object.fromEntries(human.transcript.map((t) => [t.q ?? "", t.text])), notes: human.notes, knockouts: ((human.evaluation as { knockouts?: string[] } | null)?.knockouts) ?? [] } : undefined} />
            </div>
          )}
          {ivs.length > 1 && <div className="card text-xs"><b>Earlier interviews:</b> {ivs.slice(1).map((i) => `${i.mode} ${i.status}${i.result ? ` (${i.result})` : ""} ${i.created_at.slice(0, 10)}`).join(" · ")}</div>}
          <div className="card text-sm">
            <h2 className="mb-1 font-bold">Application</h2>
            <div className="text-xs text-ink-soft">{app.years_experience ?? "?"} yrs · crew {app.crew_size ?? "?"} · {app.insured ? "insured" : "not insured yet"} · {app.has_vehicle ? "has a vehicle" : "no vehicle"}{app.license_number ? ` · license ${app.license_number}` : ""} · source: {app.source ?? "not given"}</div>
            {app.message && <p className="mt-1">“{app.message}”</p>}
            {app.ai_screen && <p className="mt-1 text-xs">AI screen {app.ai_screen.score} · {String(app.ai_screen.recommendation).replace(/_/g, " ")} · concerns: {(app.ai_screen.concerns ?? []).join("; ") || "none"}</p>}
          </div>
          <details className="card text-xs"><summary className="cursor-pointer font-semibold">History ({(events ?? []).length})</summary>
            <ul className="mt-2 space-y-0.5">{((events ?? []) as { kind: string; note: string | null; actor: string; created_at: string }[]).map((e, i) => <li key={i}><span className="text-ink-soft">{e.created_at.slice(0, 16).replace("T", " ")}</span> · {e.kind.replace(/_/g, " ")}{e.note ? ` — ${e.note}` : ""} <span className="text-ink-soft">({e.actor})</span></li>)}</ul>
          </details>
        </section>
      </div>
      <p className="text-xs text-ink-soft">Questions come from the packet ({QUESTIONS.length} in the bank; {plan.length} for this candidate's trades).</p>
    </div>
  );
}
