/*
 * FILE    : apps/web/lib/interviews.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0246 UTC
 * PURPOSE : Pro screening interviews (packet in packages/core/src/interview.ts; AI in lib/ai/interview.ts).
 *             startInterview    — AI: a private link by email (14 days); person: an empty scorecard in the Hub
 *             interviewByToken  — what the candidate's page shows
 *             consent / candidateMessage / requestPerson — the candidate's side of the AI interview
 *             finishInterview   — AI scores against the rubric; the result is computed; staff are alerted
 *             saveScorecard     — an interview done by a person (in person / phone), same rubric
 *             decideInterview   — a person invites, asks for a follow-up, or declines
 *           A person always makes the decision unless the owner turns on auto-invite after an "advance" result.
 */
import "server-only";
import { after } from "next/server";
import { BRAND, COMPETENCIES, QUESTIONS, interviewPlan, scoreInterview, type Competency, type InterviewQuestion, type InterviewResult, type InterviewScore } from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";
import { getRecruitingSettings, inviteApplicant, logRecruiting, rejectApplicant } from "./recruiting";
import { aiEnabled } from "./ai/client";
import { aiEvaluate, aiInterviewTurn, type TranscriptLine } from "./ai/interview";

const db = () => adminClient();
const MAX_CANDIDATE_MESSAGES = 45;
const first = (name: unknown) => String(name ?? "").trim().split(/\s+/)[0] || "";

export interface Interview {
  id: string; application_id: string; token: string; mode: "ai" | "human"; locale: "en" | "es"; status: string;
  plan: string[]; transcript: TranscriptLine[]; scores: InterviewScore[] | null; evaluation: Record<string, unknown> | null;
  result: InterviewResult | null; average: number | null; interviewer: string | null; consent_at: string | null; started_at: string | null;
  completed_at: string | null; expires_at: string; decision: string | null; decided_by: string | null; decided_at: string | null; notes: string | null; created_at: string;
}

const planOf = (ids: string[]): InterviewQuestion[] => ids.map((id) => QUESTIONS.find((x) => x.id === id)).filter((x): x is InterviewQuestion => Boolean(x));
export const interviewUrl = (token: string) => `${siteUrl()}/pros/interview/${token}`;

export async function startInterview(appId: string, mode: "ai" | "human", actor: string): Promise<{ ok: boolean; error?: string; id?: string; url?: string }> {
  const { data: app } = await db().from("contractor_applications").select("*").eq("id", appId).maybeSingle();
  if (!app) return { ok: false, error: "Application not found" };
  if (["invited", "rejected", "withdrawn"].includes(app.stage)) return { ok: false, error: `Already ${app.stage}` };
  if (mode === "ai" && !aiEnabled()) return { ok: false, error: "The AI isn't set up (ANTHROPIC_API_KEY) — interview them yourself" };
  // one open interview at a time
  await db().from("pro_interviews").update({ status: "cancelled" }).eq("application_id", appId).in("status", ["invited", "in_progress", "human_requested"]);
  const plan = interviewPlan((app.trades as string[]) ?? []).map((x) => x.id);
  const { data: row, error } = await db().from("pro_interviews").insert({ application_id: appId, mode, locale: app.locale === "es" ? "es" : "en", plan, interviewer: mode === "human" ? actor : null, status: mode === "human" ? "in_progress" : "invited", started_at: mode === "human" ? new Date().toISOString() : null }).select("*").single();
  if (error || !row) return { ok: false, error: error?.message ?? "Couldn't create the interview" };
  await db().from("contractor_applications").update({ stage: "interviewing", status: "reviewing", last_contact_at: new Date().toISOString() }).eq("id", appId);
  await logRecruiting(mode === "ai" ? "interview_sent" : "interview_started", { applicationId: appId }, mode === "ai" ? "AI interview link emailed" : `in person / phone by ${actor}`, actor);
  if (mode === "ai") {
    const url = interviewUrl(row.token);
    const es = row.locale === "es";
    await sendEmail(app.email, es ? `Siguiente paso con ${BRAND.name}: una entrevista corta en línea` : `Next step with ${BRAND.name}: a short online interview`, es
      ? `Hola ${first(app.contact_name)}:\n\nGracias por su solicitud. El siguiente paso es una entrevista corta por chat (unos 15 minutos) sobre su experiencia y cómo trabaja con los clientes. Puede hacerla cuando quiera en los próximos 14 días, desde su teléfono:\n${url}\n\nLa entrevista la conduce un asistente de inteligencia artificial; una persona de nuestro equipo revisa cada entrevista y toma la decisión. Si prefiere hablar con una persona, puede pedirlo en esa página.\n\n— ${BRAND.name}`
      : `Hi ${first(app.contact_name)},\n\nThanks for applying. The next step is a short chat interview (about 15 minutes) about your experience and how you work with customers. Do it any time in the next 14 days, from your phone:\n${url}\n\nThe interview is run by an AI assistant; a person on our team reviews every interview and makes the decision. If you'd rather talk to a person, you can ask for that on the page.\n\n— ${BRAND.name}`);
    return { ok: true, id: row.id, url };
  }
  return { ok: true, id: row.id };
}

export async function interviewByToken(token: string) {
  if (!/^[a-f0-9]{24,40}$/.test(token)) return null;
  const { data } = await db().from("pro_interviews").select("*").eq("token", token).maybeSingle();
  const iv = data as Interview | null;
  if (!iv || iv.mode !== "ai") return null;
  if (["invited", "in_progress"].includes(iv.status) && new Date(iv.expires_at) < new Date()) {
    await db().from("pro_interviews").update({ status: "expired" }).eq("id", iv.id);
    iv.status = "expired";
  }
  const { data: app } = await db().from("contractor_applications").select("contact_name, business_name, trades").eq("id", iv.application_id).single();
  return { iv, firstName: first(app?.contact_name), business: String(app?.business_name ?? ""), trades: (app?.trades ?? []) as string[] };
}

/** Consent → the first question (written by us, so the AI disclosure is always exact). */
export async function consent(token: string, locale: "en" | "es") {
  const s = await interviewByToken(token);
  if (!s) return { ok: false, error: "Link not found" };
  const { iv } = s;
  if (iv.status !== "invited") return { ok: iv.status === "in_progress", transcript: iv.transcript, status: iv.status };
  const plan = planOf(iv.plan);
  const q1 = plan[0];
  const es = locale === "es";
  const opening = es
    ? `Hola${s.firstName ? ` ${s.firstName}` : ""}, soy el asistente de IA de ${BRAND.name}. Le haré unas ${plan.length} preguntas sobre su trabajo; no hay respuestas perfectas, conteste como si hablara con un cliente. Puede pausar y volver con el mismo enlace. Primera pregunta: ${q1.es}`
    : `Hi${s.firstName ? ` ${s.firstName}` : ""}, I'm ${BRAND.name}'s AI assistant. I'll ask about ${plan.length} questions about your work — there are no perfect answers, just answer the way you'd talk to a customer. You can pause and come back with the same link. First question: ${q1.en}`;
  const transcript: TranscriptLine[] = [{ role: "ai", text: opening, at: new Date().toISOString(), q: q1.id }];
  await db().from("pro_interviews").update({ status: "in_progress", consent_at: new Date().toISOString(), started_at: new Date().toISOString(), locale, transcript }).eq("id", iv.id);
  await logRecruiting("interview_started", { applicationId: iv.application_id }, "candidate consented to the AI interview", "candidate");
  return { ok: true, transcript, status: "in_progress" };
}

export async function candidateMessage(token: string, text: string): Promise<{ ok: boolean; error?: string; transcript?: TranscriptLine[]; done?: boolean }> {
  const s = await interviewByToken(token);
  if (!s) return { ok: false, error: "Link not found" };
  const { iv } = s;
  if (iv.status !== "in_progress") return { ok: false, error: iv.status === "completed" ? "This interview is finished — thank you!" : "This interview isn't open" };
  const clean = text.replace(/\s+\n/g, "\n").trim().slice(0, 2000);
  if (!clean) return { ok: false, error: "Type your answer" };
  const transcript: TranscriptLine[] = [...iv.transcript, { role: "candidate", text: clean, at: new Date().toISOString() }];
  const plan = planOf(iv.plan);
  const answers = transcript.filter((t) => t.role === "candidate").length;
  let turn = answers >= MAX_CANDIDATE_MESSAGES ? null : await aiInterviewTurn({ plan, transcript, locale: iv.locale, firstName: s.firstName, interviewId: iv.id }).catch(() => null);
  if (!turn && answers < MAX_CANDIDATE_MESSAGES) {
    // AI hiccup: ask the next planned question ourselves so the candidate is never stuck
    const asked = new Set(transcript.map((t) => t.q).filter(Boolean));
    const next = plan.find((p) => !asked.has(p.id));
    turn = next ? { reply: iv.locale === "es" ? `Gracias. ${next.es}` : `Thanks. ${next.en}`, asking: next.id, done: false } : null;
  }
  const done = !turn || turn.done;
  const closing = iv.locale === "es" ? "¡Gracias! Eso es todo. Una persona de nuestro equipo revisa cada entrevista y le escribiremos por correo en 2 días hábiles." : "Thank you — that's everything. A person on our team reviews every interview, and we'll email you within 2 business days.";
  transcript.push({ role: "ai", text: turn?.reply || closing, at: new Date().toISOString(), q: turn?.asking && plan.some((p) => p.id === turn!.asking) ? turn.asking : null });
  await db().from("pro_interviews").update({ transcript }).eq("id", iv.id);
  if (done) after(() => finishInterview(iv.id).catch((e) => console.error("[interview finish]", e)));
  return { ok: true, transcript, done };
}

export async function requestPerson(token: string) {
  const s = await interviewByToken(token);
  if (!s || !["invited", "in_progress"].includes(s.iv.status)) return { ok: false, error: "Link not found" };
  await db().from("pro_interviews").update({ status: "human_requested" }).eq("id", s.iv.id);
  await logRecruiting("interview_person_requested", { applicationId: s.iv.application_id }, "candidate asked for a person", "candidate");
  await raiseAlert("recruiting", "info", `${s.business}: wants to interview with a person`, "Call them and score the interview in Hub → Recruiting → their candidate page (Interview → in person / phone).");
  return { ok: true };
}

async function afterResult(iv: Interview, result: InterviewResult, average: number, why: string) {
  await db().from("contractor_applications").update({ stage: "interviewed", last_contact_at: new Date().toISOString() }).eq("id", iv.application_id);
  await logRecruiting("interviewed", { applicationId: iv.application_id }, `${iv.mode === "ai" ? "AI" : "in person"}: ${result} (${average}) — ${why}`, iv.mode === "ai" ? "ai" : iv.interviewer ?? "staff");
  const { data: app } = await db().from("contractor_applications").select("business_name").eq("id", iv.application_id).single();
  const settings = await getRecruitingSettings();
  if (result === "advance" && settings.autoInviteAfterInterview) {
    await decideInterview(iv.id, "invite", "auto-invite after interview");
    return;
  }
  await raiseAlert("recruiting", result === "advance" ? "info" : "warn", `Interview done: ${app?.business_name ?? "candidate"} — ${result.replace("_", " ")} (${average})`, `${why}. Decide in Hub → Recruiting → candidate page.`);
}

/** Score an AI interview and record the result. */
export async function finishInterview(id: string) {
  const { data } = await db().from("pro_interviews").select("*").eq("id", id).single();
  const iv = data as Interview;
  if (iv.status === "completed") return;
  const { data: app } = await db().from("contractor_applications").select("trades").eq("id", iv.application_id).single();
  const ev = await aiEvaluate({ plan: planOf(iv.plan), transcript: iv.transcript, trades: (app?.trades ?? []) as string[], interviewId: id }).catch(() => null);
  const scored = ev ? scoreInterview(ev.scores, ev.knockouts) : { result: "follow_up" as const, average: 0, why: "AI scoring unavailable — score it by hand" };
  await db().from("pro_interviews").update({ status: "completed", completed_at: new Date().toISOString(), scores: ev?.scores ?? null, evaluation: ev, result: scored.result, average: scored.average }).eq("id", id);
  await afterResult(iv, scored.result, scored.average, scored.why);
}

/** An interview done by a person: scores 1–5 per competency (with notes), answers per question, knockouts. */
export async function saveScorecard(appId: string, s: { scores: { competency: Competency; score: number; evidence?: string | null }[]; answers: Record<string, string>; knockouts: string[]; notes: string | null; complete: boolean }, actor: string) {
  const { data: open } = await db().from("pro_interviews").select("*").eq("application_id", appId).eq("mode", "human").eq("status", "in_progress").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let iv = open as Interview | null;
  if (!iv) {
    const r = await startInterview(appId, "human", actor);
    if (!r.ok) return r;
    iv = (await db().from("pro_interviews").select("*").eq("id", r.id!).single()).data as Interview;
  }
  const transcript: TranscriptLine[] = Object.entries(s.answers).filter(([, v]) => v.trim()).map(([qid, v]) => ({ role: "candidate", text: v.trim().slice(0, 2000), at: new Date().toISOString(), q: qid }));
  const scores = s.scores.filter((x) => x.score >= 1 && x.score <= 5 && x.competency in COMPETENCIES);
  const scored = scoreInterview(scores, s.knockouts);
  await db().from("pro_interviews").update({ transcript, scores, notes: s.notes, interviewer: actor, evaluation: { knockouts: s.knockouts }, ...(s.complete ? { status: "completed", completed_at: new Date().toISOString(), result: scored.result, average: scored.average } : {}) }).eq("id", iv.id);
  if (s.complete) await afterResult({ ...iv, interviewer: actor }, scored.result, scored.average, scored.why);
  return { ok: true, id: iv.id, result: scored };
}

/** A person decides: invite (pro record + setup email), follow up, or decline (polite email). */
export async function decideInterview(id: string, decision: "invite" | "follow_up" | "decline", actor: string, reason?: string | null) {
  const { data } = await db().from("pro_interviews").select("*").eq("id", id).maybeSingle();
  const iv = data as Interview | null;
  if (!iv) return { ok: false, error: "Interview not found" };
  await db().from("pro_interviews").update({ decision, decided_by: actor, decided_at: new Date().toISOString(), notes: reason ? [iv.notes, reason].filter(Boolean).join("\n") : iv.notes }).eq("id", id);
  if (decision === "invite") return inviteApplicant(iv.application_id, actor, `after interview (${iv.result ?? "no result"})`);
  if (decision === "decline") { await rejectApplicant(iv.application_id, actor, reason ?? undefined); return { ok: true }; }
  await logRecruiting("interview_follow_up", { applicationId: iv.application_id }, reason ?? null, actor);
  return { ok: true };
}

export async function interviewsFor(appId: string): Promise<Interview[]> {
  const { data } = await db().from("pro_interviews").select("*").eq("application_id", appId).order("created_at", { ascending: false });
  return (data ?? []) as Interview[];
}
