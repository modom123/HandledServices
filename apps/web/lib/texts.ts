/*
 * FILE    : apps/web/lib/texts.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : Two-way texting. Inbound texts (Twilio webhook) are matched to a pro (contractors.phone) or a customer
 *           (profiles.phone / jobs.contact_phone) and to their current job; matched texts also appear in that job's
 *           message thread. Everything lands in sms_inbox (Hub → Texts), where staff reply by text and mark it handled.
 *           STOP / START mirror the opt-out on the profile (Twilio enforces it too).
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { phoneKey, smsKeyword, twilioSignatureBase } from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendSms, e164 } from "./sms";
import { raiseAlert } from "./jobs";
import { siteUrl } from "./notify";

const db = () => adminClient();
const OPEN = ["dispatched", "assigned", "in_progress", "scheduled", "quoted", "site_visit", "requested", "qa_review"];

/** True when the X-Twilio-Signature header matches (tries the public site URL and the URL the request arrived on). */
export function validTwilioSignature(signature: string | null, requestUrl: string, params: Record<string, string>): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const u = new URL(requestUrl);
  const urls = new Set([requestUrl, `${siteUrl()}${u.pathname}${u.search}`]);
  const got = Buffer.from(signature);
  for (const url of urls) {
    const want = Buffer.from(createHmac("sha1", token).update(twilioSignatureBase(url, params)).digest("base64"));
    if (want.length === got.length && timingSafeEqual(want, got)) return true;
  }
  return false;
}

type Match = { role: "customer" | "pro" | "unknown"; profileId: string | null; contractorId: string | null; jobId: string | null; name: string | null; ref: string | null };

const same = (a: string | null | undefined, key: string) => phoneKey(a) === key;

/** Who sent this number, and which job it's most likely about (today/upcoming first, else the most recent). */
export async function matchSender(from: string): Promise<Match> {
  const key = phoneKey(from);
  const none: Match = { role: "unknown", profileId: null, contractorId: null, jobId: null, name: null, ref: null };
  if (!key) return none;
  const tail = `%${key.slice(-4)}`;
  const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const pickJob = (jobs: { id: string; ref: string; status: string; scheduled_date: string | null; created_at: string }[]) => {
    const open = jobs.filter((j) => OPEN.includes(j.status));
    const soon = open.filter((j) => !j.scheduled_date || j.scheduled_date >= today).sort((a, b) => (a.scheduled_date ?? "9").localeCompare(b.scheduled_date ?? "9"));
    return soon[0] ?? open[0] ?? [...jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  };
  const jobCols = "id, ref, status, scheduled_date, created_at";

  const { data: pros } = await db().from("contractors").select("id, profile_id, contact_name, business_name, phone").ilike("phone", tail).limit(20);
  const pro = (pros ?? []).find((p) => same(p.phone, key));
  if (pro) {
    const { data: jobs } = await db().from("jobs").select(jobCols).eq("contractor_id", pro.id).order("created_at", { ascending: false }).limit(30);
    const j = pickJob(jobs ?? []);
    return { role: "pro", profileId: pro.profile_id, contractorId: pro.id, jobId: j?.id ?? null, name: pro.contact_name || pro.business_name, ref: j?.ref ?? null };
  }
  const [{ data: profs }, { data: byContact }] = await Promise.all([
    db().from("profiles").select("id, full_name, phone").ilike("phone", tail).limit(20),
    db().from("jobs").select(`${jobCols}, customer_id, contact_name, contact_phone`).ilike("contact_phone", tail).order("created_at", { ascending: false }).limit(30),
  ]);
  const prof = (profs ?? []).find((p) => same(p.phone, key));
  let jobs = (byContact ?? []).filter((j) => same(j.contact_phone, key));
  if (prof) {
    const { data: own } = await db().from("jobs").select(`${jobCols}, customer_id, contact_name, contact_phone`).eq("customer_id", prof.id).order("created_at", { ascending: false }).limit(30);
    jobs = [...(own ?? []), ...jobs.filter((j) => !(own ?? []).some((o) => o.id === j.id))];
  }
  if (!prof && !jobs.length) return none;
  const j = pickJob(jobs);
  return { role: "customer", profileId: prof?.id ?? jobs.find((x) => x.customer_id)?.customer_id ?? null, contractorId: null, jobId: j?.id ?? null, name: prof?.full_name ?? jobs[0]?.contact_name ?? null, ref: j?.ref ?? null };
}

/** Record one inbound text, thread it onto the job, mirror STOP/START, alert staff. */
export async function receiveText(p: { from: string; to: string | null; body: string; sid: string | null; media: number }): Promise<void> {
  if (p.sid) {
    const { data: dup } = await db().from("sms_inbox").select("id").eq("twilio_sid", p.sid).maybeSingle();
    if (dup) return; // Twilio retried
  }
  const m = await matchSender(p.from);
  const kw = smsKeyword(p.body);
  if (kw && kw !== "help" && m.profileId) await db().from("profiles").update({ sms_opt_out: kw === "stop" }).eq("id", m.profileId);
  await db().from("sms_inbox").insert({
    from_number: e164(p.from) ?? p.from, to_number: p.to, body: p.body.slice(0, 2000), media_count: p.media, twilio_sid: p.sid,
    matched_role: m.role, profile_id: m.profileId, contractor_id: m.contractorId, job_id: m.jobId, direction: "in",
    handled_at: kw ? new Date().toISOString() : null, handled_by: kw ? "auto (keyword)" : null,
  });
  if (kw) return;
  const text = p.body.trim() || (p.media ? "(photo)" : "");
  if (m.jobId && m.role !== "unknown") await db().from("messages").insert({ job_id: m.jobId, sender_id: m.profileId, sender_role: m.role, body: `📱 ${text}${p.media && p.body.trim() ? " (+ photo — see Hub → Texts)" : ""}`.slice(0, 2000) });
  const who = m.role === "unknown" ? `unknown number ${e164(p.from) ?? p.from}` : `${m.role} ${m.name ?? ""}`.trim();
  await raiseAlert("sms_in", "info", `Text from ${who}${m.ref ? ` · ${m.ref}` : ""}`, `${text.slice(0, 500)}\n\nReply in Hub → Texts.`, m.jobId);
}

/** Staff reply by text: sends, records it, and threads it onto the job when there is one. */
export async function replyText(p: { to: string; body: string; jobId: string | null; inboxId: string | null; staff: string }): Promise<{ ok: boolean; error?: string }> {
  const to = e164(p.to);
  if (!to) return { ok: false, error: "Not a valid US phone number" };
  const ok = await sendSms(to, p.body);
  await db().from("sms_inbox").insert({ from_number: to, body: p.body.slice(0, 2000), direction: "out", sent_by: p.staff, job_id: p.jobId, handled_at: new Date().toISOString(), handled_by: p.staff, matched_role: null });
  if (p.inboxId) await db().from("sms_inbox").update({ handled_at: new Date().toISOString(), handled_by: p.staff }).eq("id", p.inboxId).is("handled_at", null);
  if (p.jobId) await db().from("messages").insert({ job_id: p.jobId, sender_role: "ops", body: `📱 (texted to ${to}) ${p.body}`.slice(0, 2000) });
  return ok ? { ok } : { ok, error: "Text not sent — see Twilio status in Hub → Setup (it's logged on the job)" };
}
