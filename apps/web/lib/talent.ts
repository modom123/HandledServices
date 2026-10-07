/*
 * FILE    : apps/web/lib/talent.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2034 UTC
 * PURPOSE : Handled Talent, server side (rules in core talent.ts):
 *             clients & searches  — intake from the website, staff set-up, fair-hiring check, recruiters assigned,
 *                                   retained payment schedule, the client's private review link
 *             recruiters          — approved pros with the "recruiter" trade: their searches, candidates, submissions
 *             submissions         — candidate ownership enforced (first written submission, 12 months); the candidate
 *                                   is emailed which company their résumé went to and can withdraw; the client is emailed
 *             client review       — interview / pass / hold with feedback, from the review link (no login)
 *             hires & money       — a hire creates the placement and fee; on the start date the client is invoiced
 *                                   (Stripe checkout, net 30); paid → the recruiter's share becomes an approved payout
 *                                   in the weekly run; retained searches bill in three payments, the last trued up
 *             guarantee           — an early exit: replacement search or prorated refund, and the recruiter's share back
 */
import "server-only";
import { randomBytes } from "node:crypto";
import {
  BRAND, TALENT_CLIENT_VISIBLE, TALENT_STAGE_LABEL, TALENT_TERMS, fairHiringCheck, guaranteeOutcome, money, normalizeEmail, ownershipCheck, placementFee, retainedSchedule,
  type ExitReason, type TalentStage,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";
import { createCheckout } from "./stripe";

const db = () => adminClient();
const BUCKET = "talent";
const now = () => new Date().toISOString();
const token = () => randomBytes(18).toString("base64url");
const today = () => now().slice(0, 10);
const addDays = (iso: string, d: number) => { const x = new Date(`${iso.slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
export const TALENT_AGREEMENT_VERSION = "talent-client-v1";

async function log(o: { submission_id?: string | null; search_id?: string | null; actor: string; kind: string; note?: string | null }) {
  await db().from("talent_events").insert({ submission_id: o.submission_id ?? null, search_id: o.search_id ?? null, actor: o.actor, kind: o.kind, note: o.note ?? null });
}

// ───────────────────────────── recruiters ─────────────────────────────

/** The signed-in pro, if they're an approved recruiter. */
export async function recruiterFor(contractorId: string | null) {
  if (!contractorId) return null;
  const { data } = await db().from("contractors").select("id, business_name, contact_name, email, phone, status, trades").eq("id", contractorId).maybeSingle();
  if (!data || data.status !== "approved" || !(data.trades ?? []).includes("recruiter")) return null;
  return data as { id: string; business_name: string; contact_name: string | null; email: string; phone: string | null };
}

export async function recruiterOnSearch(searchId: string, contractorId: string) {
  const { data } = await db().from("talent_search_recruiters").select("role").eq("search_id", searchId).eq("contractor_id", contractorId).maybeSingle();
  return Boolean(data);
}

// ───────────────────────────── clients & searches ─────────────────────────────

export interface SearchInput {
  title: string; location: string | null; workplace: "onsite" | "hybrid" | "remote"; salary_min: number | null; salary_max: number | null; openings: number;
  description: string | null; must_haves: string | null; type: "contingency" | "retained"; exclusive?: boolean;
}

/** From the website: a company asks us to fill a role. Creates (or reuses) the client and a search in "New request". */
export async function requestSearch(o: { company: string; contact_name: string; email: string; phone: string | null; website: string | null; city: string | null; agree: boolean; ip: string | null } & SearchInput) {
  const email = normalizeEmail(o.email);
  const { data: existing } = await db().from("talent_clients").select("id, agreement_signed_at").ilike("email", email).maybeSingle();
  let clientId = existing?.id as string | undefined;
  const signed = o.agree ? { agreement_version: TALENT_AGREEMENT_VERSION, agreement_signed_at: now(), agreement_signed_by: `${o.contact_name} <${email}>`, agreement_ip: o.ip } : {};
  if (!clientId) {
    const { data, error } = await db().from("talent_clients").insert({ company: o.company, contact_name: o.contact_name, email, phone: o.phone, website: o.website, city: o.city, created_by: "website", ...signed }).select("id").single();
    if (error || !data) return { ok: false, error: "Couldn't save your request — please email us" };
    clientId = data.id;
  } else if (o.agree && !existing?.agreement_signed_at) await db().from("talent_clients").update(signed).eq("id", clientId);
  const r = await createSearch(clientId!, o, "website", "intake");
  if (!r.ok) return r;
  if (opsEmail()) await sendEmail(opsEmail(), `Handled Talent request: ${o.title} at ${o.company}`, `${o.contact_name} <${email}> ${o.phone ?? ""}\n${o.title} · ${o.location ?? ""} · ${o.workplace} · ${o.salary_min ?? "?"}–${o.salary_max ?? "?"} · ${o.type}\n\n${o.description ?? ""}\n\nOpen it: ${siteUrl()}/hub/talent/${r.id}`).catch(() => {});
  await sendEmail(email, `We've got your search: ${o.title}`, `Hi ${o.contact_name.split(" ")[0]},\n\nThanks for trusting ${BRAND.name} Talent with your ${o.title} search. A recruiter will call you within one business day for a short intake: what great looks like in this role, must-haves, the interview process and timing.\n\nOur terms: ${o.type === "retained" ? `retained search, ${TALENT_TERMS.retainedPct}% of the first year's base salary in three payments` : `contingency, ${TALENT_TERMS.contingencyPct}% of the first year's base salary, due only if you hire someone we introduce`}; ${TALENT_TERMS.guaranteeDays}-day guarantee. Candidates never pay a fee.\n\n— ${BRAND.name} Talent`).catch(() => {});
  return { ok: true, id: r.id };
}

export async function createSearch(clientId: string, s: SearchInput, actor: string, status: "intake" | "open" = "intake") {
  const { data: c } = await db().from("talent_clients").select("terms").eq("id", clientId).maybeSingle();
  const t = (c?.terms ?? {}) as { feePct?: number; recruiterPct?: number; retainedPct?: number; minimumFee?: number };
  const feePct = s.type === "retained" ? t.retainedPct ?? TALENT_TERMS.retainedPct : t.feePct ?? TALENT_TERMS.contingencyPct;
  const recruiterPct = s.type === "retained" ? feePct * TALENT_TERMS.retainedRecruiterShare : Math.min(t.recruiterPct ?? TALENT_TERMS.recruiterPct, feePct);
  const flags = fairHiringCheck(`${s.title}\n${s.description ?? ""}\n${s.must_haves ?? ""}`);
  const { data, error } = await db().from("talent_searches").insert({
    client_id: clientId, title: s.title, location: s.location, workplace: s.workplace, salary_min: s.salary_min, salary_max: s.salary_max, openings: s.openings,
    description: s.description, must_haves: s.must_haves, type: s.type, exclusive: Boolean(s.exclusive), fee_pct: feePct, recruiter_pct: Math.round(recruiterPct * 100) / 100,
    minimum_fee: t.minimumFee ?? TALENT_TERMS.minimumFee, estimated_salary: s.salary_max ?? s.salary_min, status, review_token: token(), fair_flags: flags, created_by: actor,
  }).select("id").single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Couldn't save the search" };
  await log({ search_id: data.id, actor, kind: "created", note: flags.length ? `Fair-hiring flags: ${flags.map((f) => f.issue).join(", ")}` : null });
  return { ok: true as const, id: data.id as string };
}

export async function saveSearch(searchId: string, patch: Partial<SearchInput> & { status?: string; fee_pct?: number; recruiter_pct?: number; minimum_fee?: number; estimated_salary?: number | null; fair_override?: string | null }, actor: string) {
  const { data: s } = await db().from("talent_searches").select("*, talent_clients(agreement_signed_at)").eq("id", searchId).maybeSingle();
  if (!s) return { ok: false, error: "Search not found" };
  const merged = { ...s, ...patch };
  const flags = fairHiringCheck(`${merged.title}\n${merged.description ?? ""}\n${merged.must_haves ?? ""}`);
  if (patch.status === "open") {
    if (!(s.talent_clients as { agreement_signed_at: string | null } | null)?.agreement_signed_at) return { ok: false, error: "The client hasn't accepted the Handled Talent agreement yet — send them the agreement link first" };
    if (flags.length && !merged.fair_override) return { ok: false, error: `Fix the job order first (${flags.map((f) => f.issue).join(", ")}) — or record why it's a lawful requirement` };
    if (Number(merged.recruiter_pct) > Number(merged.fee_pct)) return { ok: false, error: "The recruiter's share can't be more than the fee" };
  }
  const update: Record<string, unknown> = { ...patch, fair_flags: flags };
  if (patch.status === "open" && s.status !== "open" && !s.engaged_on) update.engaged_on = today();
  if (patch.status === "filled") update.filled_at = now();
  const { error } = await db().from("talent_searches").update(update).eq("id", searchId);
  if (error) return { ok: false, error: error.message };
  await log({ search_id: searchId, actor, kind: "updated", note: patch.status ? `Status → ${patch.status}` : null });
  if (patch.status === "open" && merged.type === "retained") await scheduleRetainer(searchId);
  return { ok: true };
}

/** Retained: create the three payments when the search opens (the first is invoiced right away by the sweep). */
async function scheduleRetainer(searchId: string) {
  const { data: s } = await db().from("talent_searches").select("id, estimated_salary, salary_max, salary_min, fee_pct, engaged_on").eq("id", searchId).single();
  if (!s) return;
  const { count } = await db().from("talent_retainer_payments").select("id", { count: "exact", head: true }).eq("search_id", searchId);
  if (count) return;
  const est = Number(s.estimated_salary ?? s.salary_max ?? s.salary_min ?? 0);
  if (!(est > 0)) { await raiseAlert("talent", "warn", "Retained search has no salary estimate", `Set the estimated salary on the search so the retainer can be invoiced: ${siteUrl()}/hub/talent/${searchId}`); return; }
  const sched = retainedSchedule({ estimatedSalary: est, feePct: Number(s.fee_pct), engagedOn: s.engaged_on ?? today() });
  const { data: lead } = await db().from("talent_search_recruiters").select("contractor_id").eq("search_id", searchId).eq("role", "lead").maybeSingle();
  await db().from("talent_retainer_payments").insert(sched.payments.map((p) => ({ search_id: searchId, key: p.key, amount: p.amount, recruiter_pay: p.recruiterPay, recruiter_id: lead?.contractor_id ?? null, due: p.key === "placement" ? null : p.due })));
}

export async function assignRecruiter(searchId: string, contractorId: string, role: "lead" | "support", actor: string) {
  const r = await recruiterFor(contractorId);
  if (!r) return { ok: false, error: "That pro isn't an approved recruiter (trade: Recruiter)" };
  if (role === "lead") await db().from("talent_search_recruiters").update({ role: "support" }).eq("search_id", searchId).eq("role", "lead");
  await db().from("talent_search_recruiters").upsert({ search_id: searchId, contractor_id: contractorId, role }, { onConflict: "search_id,contractor_id" });
  if (role === "lead") await db().from("talent_retainer_payments").update({ recruiter_id: contractorId }).eq("search_id", searchId).in("status", ["scheduled", "invoiced"]);
  const { data: s } = await db().from("talent_searches").select("title, talent_clients(company)").eq("id", searchId).single();
  await sendEmail(r.email, `New search: ${s?.title}`, `Hi ${r.contact_name || r.business_name},\n\nYou're on the ${s?.title} search${role === "lead" ? " as lead recruiter" : ""}. The intake notes and must-haves are in your recruiter portal: ${siteUrl()}/pro/talent\n\nRemember: written consent from every candidate before you submit them, and nothing that screens on age, sex, race, national origin, religion, disability or any other protected trait.\n\n— ${BRAND.name} Talent`).catch(() => {});
  await log({ search_id: searchId, actor, kind: "recruiter", note: `${r.business_name} (${role})` });
  return { ok: true };
}

export async function unassignRecruiter(searchId: string, contractorId: string) {
  await db().from("talent_search_recruiters").delete().eq("search_id", searchId).eq("contractor_id", contractorId);
}

// ───────────────────────────── candidates & submissions ─────────────────────────────

export async function resumeUploadUrl(name: string) {
  const path = `resumes/${Date.now()}-${randomBytes(4).toString("hex")}-${name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false as const, error: error?.message ?? "Couldn't start the upload" };
  return { ok: true as const, path: data.path, token: data.token };
}

export async function resumeLink(path: string | null, seconds = 900) {
  if (!path) return null;
  const { data } = await db().storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

export interface CandidateInput { full_name: string; email: string; phone: string | null; location: string | null; current_title: string | null; linkedin: string | null; resume_path: string | null; summary: string | null; source: string | null; expected_salary: number | null }

/** A recruiter (or staff) adds a candidate to a search. The candidate record is shared; the submission is the recruiter's. */
export async function addCandidate(searchId: string, c: CandidateInput, recruiterId: string | null, actor: string) {
  const email = normalizeEmail(c.email);
  const { data: s } = await db().from("talent_searches").select("id, client_id, status").eq("id", searchId).maybeSingle();
  if (!s || !["open", "on_hold"].includes(s.status)) return { ok: false, error: "This search isn't open" };
  let { data: cand } = await db().from("talent_candidates").select("id, do_not_contact").ilike("email", email).maybeSingle();
  if (cand?.do_not_contact) return { ok: false, error: "This person asked not to be contacted" };
  if (!cand) {
    const { data, error } = await db().from("talent_candidates").insert({ full_name: c.full_name, email, phone: c.phone, location: c.location, current_title: c.current_title, linkedin: c.linkedin, resume_path: c.resume_path, summary: c.summary, source: c.source, owner_contractor_id: recruiterId }).select("id, do_not_contact").single();
    if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save the candidate" };
    cand = data;
  } else {
    const patch = Object.fromEntries(Object.entries({ phone: c.phone, location: c.location, current_title: c.current_title, linkedin: c.linkedin, resume_path: c.resume_path, summary: c.summary }).filter(([, v]) => v));
    if (Object.keys(patch).length) await db().from("talent_candidates").update(patch).eq("id", cand.id);
  }
  const { data: dup } = await db().from("talent_submissions").select("id, recruiter_id").eq("search_id", searchId).eq("candidate_id", cand!.id).maybeSingle();
  if (dup) return { ok: false, error: dup.recruiter_id === recruiterId ? "Already in your pipeline for this search" : "Another recruiter already has this candidate on this search" };
  const { data: sub, error } = await db().from("talent_submissions").insert({ search_id: searchId, client_id: s.client_id, candidate_id: cand!.id, recruiter_id: recruiterId, stage: "sourced", expected_salary: c.expected_salary }).select("id").single();
  if (error || !sub) return { ok: false, error: error?.message ?? "Couldn't add to the search" };
  await log({ submission_id: sub.id, search_id: searchId, actor, kind: "sourced" });
  return { ok: true, id: sub.id };
}

/** Send a candidate to the client. Needs the candidate's consent and a write-up; ownership is checked first. */
export async function submitToClient(submissionId: string, o: { pitch: string; consent: boolean; consentMethod: string }, actor: string, recruiterId: string | null) {
  const { data: sub } = await db().from("talent_submissions").select("*, talent_candidates(*), talent_searches(id, title, client_id, status, review_token, talent_clients(company, contact_name, email))").eq("id", submissionId).maybeSingle();
  if (!sub) return { ok: false, error: "Not found" };
  if (recruiterId && sub.recruiter_id !== recruiterId) return { ok: false, error: "Not your candidate" };
  if (!o.consent) return { ok: false, error: "Confirm the candidate agreed, in writing, to be submitted to this company" };
  if (o.pitch.trim().length < 40) return { ok: false, error: "Write a short summary for the client (why this person fits)" };
  const cand = sub.talent_candidates as { id: string; full_name: string; email: string; resume_path: string | null };
  const search = sub.talent_searches as { id: string; title: string; client_id: string; status: string; review_token: string; talent_clients: { company: string; contact_name: string; email: string } };
  if (search.status !== "open") return { ok: false, error: "This search isn't open" };
  if (!cand.resume_path) return { ok: false, error: "Upload the candidate's résumé first" };
  const { data: prior } = await db().from("talent_submissions").select("client_id, recruiter_id, submitted_at, stage, talent_candidates(email)").eq("client_id", search.client_id).not("submitted_at", "is", null).neq("id", submissionId);
  const own = ownershipCheck((prior ?? []).map((p) => ({ client_id: p.client_id, recruiter_id: p.recruiter_id ?? "", submitted_at: p.submitted_at!, stage: p.stage as TalentStage, candidate_email: (p.talent_candidates as unknown as { email: string } | null)?.email ?? "" })), { client_id: search.client_id, candidate_email: cand.email, recruiter_id: sub.recruiter_id ?? "" });
  if (!own.ok) return { ok: false, error: own.reason };
  const confirm = token();
  await db().from("talent_submissions").update({ stage: "submitted", pitch: o.pitch.trim(), submitted_at: now(), candidate_confirm_token: confirm, updated_at: now() }).eq("id", submissionId);
  await db().from("talent_candidates").update({ consent_at: now(), consent_method: o.consentMethod.slice(0, 200) }).eq("id", cand.id);
  await log({ submission_id: submissionId, search_id: search.id, actor, kind: "submitted", note: `Consent: ${o.consentMethod}` });
  await sendEmail(cand.email, `Your résumé went to ${search.talent_clients.company}`, `Hi ${cand.full_name.split(" ")[0]},\n\nAs we discussed, ${BRAND.name} Talent sent your résumé to ${search.talent_clients.company} for the ${search.title} role. We'll keep you posted on next steps.\n\nIf you didn't agree to this, or want to withdraw, tell us here and we'll pull it right away: ${siteUrl()}/talent/candidate/${confirm}\n\nYou never pay a fee to work with us.\n\n— ${BRAND.name} Talent`).catch(() => {});
  await sendEmail(search.talent_clients.email, `New candidate for ${search.title}: ${cand.full_name}`, `Hi ${search.talent_clients.contact_name.split(" ")[0]},\n\nWe have a new candidate for your ${search.title} search. Review the summary and résumé, then choose interview, pass or hold:\n${siteUrl()}/talent/review/${search.review_token}\n\nThis introduction is covered by your Handled Talent agreement.\n\n— ${BRAND.name} Talent`).catch(() => {});
  return { ok: true };
}

const MOVES: Record<string, TalentStage[]> = { recruiter: ["sourced", "screened", "withdrawn"], staff: ["sourced", "screened", "submitted", "client_review", "interview", "offer", "rejected", "withdrawn"] };

export async function moveStage(submissionId: string, stage: TalentStage, who: "recruiter" | "staff", actor: string, recruiterId: string | null, note: string | null) {
  if (!MOVES[who].includes(stage)) return { ok: false, error: "Use the right step for that (submit, or record the hire)" };
  const { data: sub } = await db().from("talent_submissions").select("id, recruiter_id, search_id, stage").eq("id", submissionId).maybeSingle();
  if (!sub) return { ok: false, error: "Not found" };
  if (who === "recruiter" && sub.recruiter_id !== recruiterId) return { ok: false, error: "Not your candidate" };
  if (sub.stage === "placed") return { ok: false, error: "Already hired" };
  if (who === "recruiter" && sub.stage !== "sourced" && sub.stage !== "screened" && stage !== "withdrawn") return { ok: false, error: "The client is reviewing this candidate — staff move it from here" };
  await db().from("talent_submissions").update({ stage, updated_at: now() }).eq("id", submissionId);
  await log({ submission_id: submissionId, search_id: sub.search_id, actor, kind: `stage:${stage}`, note });
  return { ok: true };
}

// ───────────────────────────── client review (no login) ─────────────────────────────

export async function searchByReviewToken(t: string) {
  if (!/^[\w-]{20,40}$/.test(t)) return null;
  const { data: s } = await db().from("talent_searches").select("id, title, location, workplace, status, type, talent_clients(company, contact_name)").eq("review_token", t).maybeSingle();
  if (!s) return null;
  const { data: subs } = await db().from("talent_submissions").select("id, stage, pitch, expected_salary, submitted_at, client_feedback, client_decision, interview_at, talent_candidates(full_name, location, current_title, linkedin, resume_path)").eq("search_id", s.id).in("stage", TALENT_CLIENT_VISIBLE).order("submitted_at", { ascending: false });
  return { search: s, submissions: subs ?? [] };
}

export async function clientDecision(t: string, submissionId: string, decision: "interview" | "pass" | "hold", feedback: string | null) {
  const found = await searchByReviewToken(t);
  if (!found) return { ok: false, error: "This link isn't valid" };
  const sub = found.submissions.find((x) => x.id === submissionId);
  if (!sub) return { ok: false, error: "Candidate not found" };
  if (["placed", "withdrawn"].includes(sub.stage)) return { ok: false, error: "This candidate's process is closed" };
  const stage: TalentStage = decision === "interview" ? "interview" : decision === "pass" ? "rejected" : "client_review";
  await db().from("talent_submissions").update({ client_decision: decision, client_feedback: feedback, stage, updated_at: now() }).eq("id", submissionId);
  await log({ submission_id: submissionId, search_id: found.search.id, actor: "client", kind: `client:${decision}`, note: feedback });
  const { data: full } = await db().from("talent_submissions").select("recruiter_id, talent_candidates(full_name), contractors:recruiter_id(email, contact_name, business_name)").eq("id", submissionId).single();
  const rec = full?.contractors as unknown as { email: string; contact_name: string | null; business_name: string } | null;
  const name = (full?.talent_candidates as unknown as { full_name: string } | null)?.full_name ?? "your candidate";
  const label = decision === "interview" ? "wants to interview" : decision === "pass" ? "passed on" : "put on hold";
  if (rec?.email) await sendEmail(rec.email, `${found.search.title}: client ${label} ${name}`, `${(found.search.talent_clients as unknown as { company: string }).company} ${label} ${name}.${feedback ? `\n\nTheir feedback: ${feedback}` : ""}\n\n${siteUrl()}/pro/talent`).catch(() => {});
  if (opsEmail()) await sendEmail(opsEmail(), `Talent: client ${label} ${name} (${found.search.title})`, feedback ?? "").catch(() => {});
  return { ok: true };
}

/** The candidate's link from the "your résumé went to…" email: confirm, or withdraw. */
export async function candidateAnswer(t: string, answer: "confirm" | "withdraw") {
  if (!/^[\w-]{20,40}$/.test(t)) return { ok: false, error: "This link isn't valid" };
  const { data: sub } = await db().from("talent_submissions").select("id, search_id, stage").eq("candidate_confirm_token", t).maybeSingle();
  if (!sub) return { ok: false, error: "This link isn't valid" };
  if (answer === "confirm") await db().from("talent_submissions").update({ candidate_confirmed_at: now() }).eq("id", sub.id);
  else if (sub.stage !== "placed") {
    await db().from("talent_submissions").update({ stage: "withdrawn", updated_at: now() }).eq("id", sub.id);
    await raiseAlert("talent", "warn", "A candidate withdrew from a submission", `Check the recruiter had consent: ${siteUrl()}/hub/talent/${sub.search_id}`);
  }
  await log({ submission_id: sub.id, search_id: sub.search_id, actor: "candidate", kind: `candidate:${answer}` });
  return { ok: true };
}

// ───────────────────────────── hires, invoices, payouts ─────────────────────────────

export async function recordHire(submissionId: string, o: { base_salary: number; start_date: string }, actor: string) {
  const { data: sub } = await db().from("talent_submissions").select("*, talent_searches(*)").eq("id", submissionId).maybeSingle();
  if (!sub) return { ok: false, error: "Not found" };
  if (!sub.submitted_at) return { ok: false, error: "Only candidates submitted to the client can be hired through us" };
  const s = sub.talent_searches as { id: string; type: string; fee_pct: number; recruiter_pct: number; minimum_fee: number; openings: number; estimated_salary: number | null; engaged_on: string | null; title: string };
  const retained = s.type === "retained";
  let fee: number, recruiterPay: number;
  if (retained) {
    const { data: pays } = await db().from("talent_retainer_payments").select("key, amount, status").eq("search_id", s.id);
    const paidOrBilled = (pays ?? []).filter((p) => p.key !== "placement").reduce((t, p) => t + Number(p.amount), 0);
    const sched = retainedSchedule({ estimatedSalary: Number(s.estimated_salary ?? o.base_salary), feePct: Number(s.fee_pct), engagedOn: s.engaged_on ?? today(), actualSalary: o.base_salary, paidSoFar: paidOrBilled });
    const last = sched.payments[2];
    await db().from("talent_retainer_payments").update({ amount: last.amount, recruiter_pay: last.recruiterPay, due: o.start_date }).eq("search_id", s.id).eq("key", "placement").eq("status", "scheduled");
    fee = sched.totalFee; recruiterPay = Math.round(fee * TALENT_TERMS.retainedRecruiterShare * 100) / 100;
  } else {
    const f = placementFee(o.base_salary, { feePct: Number(s.fee_pct), recruiterPct: Number(s.recruiter_pct), minimumFee: Number(s.minimum_fee) });
    fee = f.fee; recruiterPay = f.recruiterPay;
  }
  const { data: pl, error } = await db().from("talent_placements").insert({
    submission_id: sub.id, search_id: s.id, client_id: sub.client_id, candidate_id: sub.candidate_id, recruiter_id: sub.recruiter_id, base_salary: o.base_salary, fee_pct: s.fee_pct,
    fee, recruiter_pay: recruiterPay, platform: Math.round((fee - recruiterPay) * 100) / 100, start_date: o.start_date, guarantee_ends: addDays(o.start_date, TALENT_TERMS.guaranteeDays),
    invoice_due: addDays(o.start_date, TALENT_TERMS.invoiceDueDays), status: retained ? "invoiced" : "pending_start", created_by: actor,
  }).select("id").single();
  if (error || !pl) return { ok: false, error: error?.message ?? "Couldn't record the hire" };
  await db().from("talent_submissions").update({ stage: "placed", offer_salary: o.base_salary, start_date: o.start_date, updated_at: now() }).eq("id", sub.id);
  const { count } = await db().from("talent_placements").select("id", { count: "exact", head: true }).eq("search_id", s.id).in("status", ["pending_start", "invoiced", "paid"]);
  if ((count ?? 0) >= s.openings) await db().from("talent_searches").update({ status: "filled", filled_at: now() }).eq("id", s.id);
  await log({ submission_id: sub.id, search_id: s.id, actor, kind: "hired", note: `${money(o.base_salary)} base, starts ${o.start_date}, fee ${money(fee)}` });
  return { ok: true, id: pl.id };
}

const invNo = async (prefix: string) => {
  const y = new Date().getUTCFullYear();
  const [{ count: a }, { count: b }] = await Promise.all([
    db().from("talent_placements").select("id", { count: "exact", head: true }).not("invoice_number", "is", null),
    db().from("talent_retainer_payments").select("id", { count: "exact", head: true }).not("invoice_number", "is", null),
  ]);
  return `${prefix}-${y}-${String((a ?? 0) + (b ?? 0) + 1).padStart(4, "0")}`;
};

export async function invoicePlacement(placementId: string, actor = "system") {
  const { data: p } = await db().from("talent_placements").select("*, talent_clients(company, contact_name, email), talent_searches(title, type), talent_candidates(full_name)").eq("id", placementId).maybeSingle();
  if (!p || p.status !== "pending_start") return { ok: false, error: "Nothing to invoice" };
  const c = p.talent_clients as { company: string; contact_name: string; email: string };
  const title = (p.talent_searches as { title: string }).title;
  const who = (p.talent_candidates as { full_name: string }).full_name;
  const number = await invNo("TAL");
  const pay = await createCheckout({ amount: Number(p.fee), name: `${BRAND.name} Talent invoice ${number}`, description: `Placement fee: ${who}, ${title} (${p.fee_pct}% of ${money(Number(p.base_salary))})`, kind: "invoice", customerEmail: c.email, customerName: c.company, successPath: "/pay/thanks", createdBy: actor }).catch(() => null);
  if (pay) await db().from("payments").update({ talent_placement_id: p.id }).eq("id", pay.paymentId);
  await db().from("talent_placements").update({ status: "invoiced", invoice_number: number, payment_url: pay?.url ?? null }).eq("id", p.id);
  await sendEmail(c.email, `${BRAND.name} Talent invoice ${number}: ${money(Number(p.fee))} due ${p.invoice_due}`, `Hi ${c.contact_name.split(" ")[0]},\n\nCongratulations on ${who} joining as ${title}. Here is the placement fee under our agreement:\n\nInvoice: ${number}\nFee: ${money(Number(p.fee))} (${p.fee_pct}% of the first year's base salary, ${money(Number(p.base_salary))})\nDue: ${p.invoice_due}\nGuarantee through: ${p.guarantee_ends}\n\n${pay ? `Pay by card or bank: ${pay.url}` : "Reply for wire / ACH details."}\n\nThank you for working with ${BRAND.name} Talent.`).catch(() => {});
  if (!pay) await raiseAlert("talent", "warn", `Talent invoice ${number} has no payment link`, "Stripe isn't configured — send payment details by hand.");
  return { ok: true };
}

export async function invoiceRetainer(paymentId: string, actor = "system") {
  const { data: r } = await db().from("talent_retainer_payments").select("*, talent_searches(title, talent_clients(company, contact_name, email))").eq("id", paymentId).maybeSingle();
  if (!r || r.status !== "scheduled" || !(Number(r.amount) > 0)) return { ok: false, error: "Nothing to invoice" };
  const s = r.talent_searches as { title: string; talent_clients: { company: string; contact_name: string; email: string } };
  const number = await invNo("TAR");
  const label = { engagement: "Retained search — first payment (engagement)", shortlist: "Retained search — second payment (shortlist)", placement: "Retained search — final payment (hire)" }[r.key as "engagement"];
  const pay = await createCheckout({ amount: Number(r.amount), name: `${BRAND.name} Talent invoice ${number}`, description: `${label}: ${s.title}`, kind: "invoice", customerEmail: s.talent_clients.email, customerName: s.talent_clients.company, successPath: "/pay/thanks", createdBy: actor }).catch(() => null);
  if (pay) await db().from("payments").update({ talent_retainer_id: r.id }).eq("id", pay.paymentId);
  await db().from("talent_retainer_payments").update({ status: "invoiced", invoice_number: number, payment_url: pay?.url ?? null }).eq("id", r.id);
  await sendEmail(s.talent_clients.email, `${BRAND.name} Talent invoice ${number}: ${money(Number(r.amount))}`, `Hi ${s.talent_clients.contact_name.split(" ")[0]},\n\n${label} for ${s.title}.\n\nInvoice: ${number}\nAmount: ${money(Number(r.amount))}\nDue: ${addDays(today(), TALENT_TERMS.invoiceDueDays)}\n\n${pay ? `Pay by card or bank: ${pay.url}` : "Reply for wire / ACH details."}\n\n— ${BRAND.name} Talent`).catch(() => {});
  return { ok: true };
}

/** Stripe paid a Talent invoice (webhook): mark it paid and release the recruiter's share into the weekly payout run. */
export async function settleTalentPayment(row: { talent_placement_id?: string | null; talent_retainer_id?: string | null }, amount: number) {
  if (row.talent_placement_id) {
    const { data: p } = await db().from("talent_placements").select("*, talent_searches(title), talent_clients(company)").eq("id", row.talent_placement_id).maybeSingle();
    if (!p) return;
    const paid = Math.round((Number(p.amount_paid) + amount) * 100) / 100;
    const full = paid >= Number(p.fee) - 0.005;
    await db().from("talent_placements").update({ amount_paid: paid, ...(full ? { status: "paid", paid_at: now() } : {}) }).eq("id", p.id);
    if (full && p.recruiter_id && Number(p.recruiter_pay) > 0)
      await db().from("payouts").insert({ contractor_id: p.recruiter_id, amount: p.recruiter_pay, status: "approved", kind: "placement", talent_placement_id: p.id, reason: `Placement: ${(p.talent_searches as { title: string }).title} at ${(p.talent_clients as { company: string }).company}` });
    if (opsEmail()) await sendEmail(opsEmail(), `Talent invoice ${p.invoice_number} paid: ${money(amount)}`, full ? "Paid in full — recruiter share released to the next weekly payout." : `Partial; ${money(Number(p.fee) - paid)} still open.`).catch(() => {});
    return;
  }
  if (row.talent_retainer_id) {
    const { data: r } = await db().from("talent_retainer_payments").select("*, talent_searches(title, talent_clients(company))").eq("id", row.talent_retainer_id).maybeSingle();
    if (!r || r.status === "paid") return;
    await db().from("talent_retainer_payments").update({ status: "paid", paid_at: now() }).eq("id", r.id);
    if (r.recruiter_id && Number(r.recruiter_pay) > 0) {
      const s = r.talent_searches as { title: string; talent_clients: { company: string } };
      await db().from("payouts").insert({ contractor_id: r.recruiter_id, amount: r.recruiter_pay, status: "approved", kind: "placement", talent_retainer_id: r.id, reason: `Retained search (${r.key}): ${s.title} at ${s.talent_clients.company}` });
    }
    if (r.key === "placement") {
      // retained hire: the placement is settled once the final payment lands (the fee was billed across the three payments)
      const { data: open } = await db().from("talent_placements").select("id, fee").eq("search_id", r.search_id).eq("status", "invoiced");
      for (const p of open ?? []) await db().from("talent_placements").update({ status: "paid", paid_at: now(), amount_paid: p.fee }).eq("id", p.id);
    }
  }
}

/** Daily: invoice hires that started and retainer payments that are due; nudge clients 7 days past due. */
export async function talentSweep() {
  const t = today();
  let invoiced = 0;
  const { data: starts } = await db().from("talent_placements").select("id").eq("status", "pending_start").lte("start_date", t);
  for (const p of starts ?? []) if ((await invoicePlacement(p.id)).ok) invoiced++;
  const { data: retainers } = await db().from("talent_retainer_payments").select("id, key, due").eq("status", "scheduled");
  for (const r of retainers ?? []) if (r.key === "engagement" || (r.due && r.due <= t)) { if ((await invoiceRetainer(r.id)).ok) invoiced++; }
  const { data: late } = await db().from("talent_placements").select("invoice_number, fee, invoice_due, talent_clients(company)").eq("status", "invoiced").lt("invoice_due", addDays(t, -7));
  for (const l of late ?? []) await raiseAlert("talent", "warn", `Talent invoice ${l.invoice_number} is past due`, `${(l.talent_clients as unknown as { company: string }).company}: ${money(Number(l.fee))} was due ${l.invoice_due}. Call them — the guarantee only applies when the fee is paid on time.`);
  return { invoiced, late: late?.length ?? 0 };
}

/** A hire left early. Covered → replacement search (reopen) or prorated refund with the recruiter's share clawed back. */
export async function reportExit(placementId: string, o: { exit_date: string; reason: ExitReason; remedy: "replacement" | "refund" }, actor: string) {
  const { data: p } = await db().from("talent_placements").select("*").eq("id", placementId).maybeSingle();
  if (!p) return { ok: false, error: "Not found" };
  const paidOnTime = p.status === "paid" && Boolean(p.paid_at) && p.paid_at.slice(0, 10) <= (p.invoice_due ?? p.paid_at.slice(0, 10));
  const out = guaranteeOutcome({ fee: Number(p.fee), recruiterPay: Number(p.recruiter_pay), startDate: p.start_date, endDate: o.exit_date, reason: o.reason, paidOnTime, remedy: o.remedy });
  await db().from("talent_placements").update({ exit_date: o.exit_date, exit_reason: o.reason, remedy: out.remedy, refund: out.refund, status: out.covered ? (out.remedy === "refund" ? "refunded" : "replaced") : p.status }).eq("id", p.id);
  if (out.covered && out.remedy === "replacement") await db().from("talent_searches").update({ status: "open", filled_at: null }).eq("id", p.search_id);
  if (out.covered && out.recruiterClawback > 0 && p.recruiter_id)
    await db().from("payouts").insert({ contractor_id: p.recruiter_id, amount: -out.recruiterClawback, status: "clawback", kind: "clawback", talent_placement_id: null, reason: `Guarantee refund: share of the ${money(out.refund)} refunded on a placement` });
  if (out.covered && out.refund > 0) await raiseAlert("talent", "warn", `Refund ${money(out.refund)} to the client (guarantee)`, `Placement ${p.invoice_number ?? p.id}: issue the refund in Stripe (Payments → the invoice payment → Refund). The recruiter's share was clawed back.`);
  await log({ search_id: p.search_id, submission_id: p.submission_id, actor, kind: "exit", note: out.why });
  return { ok: true, ...out };
}

export const stageLabel = (s: string) => TALENT_STAGE_LABEL[s as TalentStage] ?? s;
