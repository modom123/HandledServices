/*
 * FILE    : apps/web/lib/lead-intake.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : One inbox for every inbound lead (Hub → Lead inbox), from any channel:
 *             intakeLead  — normalize (core normalizeIntake), drop duplicates, save with channel / campaign / consent,
 *                           then speed to lead within seconds: the AI's first reply by email, a text only when they
 *                           agreed to texts (TCPA), an alert to call within 5 minutes; a business (company given)
 *                           also goes into Business leads at the top of the Call desk
 *             setLeadStatus — new → contacted → booked / lost / spam (staff)
 *           Callers: /api/leads/web (website form), /api/leads/intake (Zapier / Make: TikTok, LinkedIn, Yelp, Google
 *           Local Services…), /api/webhooks/meta-leads (Facebook / Instagram Lead Ads), /api/webhooks/google-leads
 *           (Google Ads lead forms) and the website AI chat.
 */
import "server-only";
import { BRAND, channelLabel, normalizeIntake, type IntakeLead } from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { sendSms } from "./sms";
import { raiseAlert } from "./jobs";
import { speedToLeadReply } from "./ai/speed-to-lead";

const db = () => adminClient();
const like = (e: string) => e.replace(/[\\%_]/g, "\\$&");

export interface IntakeResult { ok: boolean; id?: string; duplicate?: boolean; error?: string }

export async function intakeLead(raw: Record<string, unknown>, o: { channel?: string | null; actor?: string } = {}): Promise<IntakeResult> {
  const l = normalizeIntake(raw, o.channel);
  if (!l.email && !l.phone) return { ok: false, error: "A lead needs an email or a phone number" };
  // the same platform lead twice (webhook retries), or the same person within a day: keep one
  if (l.external_id) {
    const { data } = await db().from("leads").select("id").eq("channel", l.channel).eq("external_id", l.external_id).maybeSingle();
    if (data) return { ok: true, id: data.id, duplicate: true };
  }
  const since = new Date(Date.now() - 86400000).toISOString();
  const [{ data: byEmail }, { data: byPhone }] = await Promise.all([
    l.email ? db().from("leads").select("id").gte("created_at", since).ilike("email", like(l.email)).limit(1).maybeSingle() : Promise.resolve({ data: null }),
    l.phone ? db().from("leads").select("id").gte("created_at", since).eq("phone", l.phone).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const recent = byEmail ?? byPhone;
  if (recent) {
    if (l.message) await db().from("leads").update({ message: l.message }).eq("id", recent.id);
    return { ok: true, id: recent.id, duplicate: true };
  }
  const base = { name: l.name, email: l.email, phone: l.phone, zip: l.zip, service_slug: l.service_slug, message: l.message, source: l.channel };
  let { data: row, error } = await db().from("leads").insert({
    ...base, city: l.city, company: l.company, channel: l.channel, campaign: l.campaign, attribution: l.attribution, external_id: l.external_id, sms_consent: l.sms_consent, status: "new",
  }).select("id").single();
  // before the omnichannel migration is run: save the lead with the original columns so nobody is lost
  if (error && /column|schema cache/i.test(error.message)) {
    ({ data: row, error } = await db().from("leads").insert({ ...base, message: [l.company && `Company: ${l.company}`, l.message].filter(Boolean).join("\n") || null }).select("id").single());
    if (row) { await raiseAlert("sales", "warn", `New lead — ${channelLabel(l.channel)}: ${l.name ?? l.email ?? l.phone}`, `Call them: ${l.phone ?? l.email}. (Run supabase/setup/RUN_ONCE_ALL_NEW_2026-10-21_0000.sql to turn on the Lead inbox and instant replies.)`); return { ok: true, id: row.id }; }
  }
  if (error || !row) return { ok: false, error: error?.message ?? "Couldn't save the lead" };
  const bizId = l.company ? await toBusinessLead(l).catch(() => null) : null;
  if (bizId) await db().from("leads").update({ biz_lead_id: bizId }).eq("id", row.id);
  await speedToLead(row.id, l).catch((e) => console.error("[speed-to-lead]", e));
  return { ok: true, id: row.id };
}

/** A business that asked: into Business leads as warm ('replied'), first on today's Call desk. */
async function toBusinessLead(l: IntakeLead): Promise<string | null> {
  if (l.email) {
    const { data } = await db().from("biz_leads").select("id, status").ilike("email", like(l.email)).limit(1).maybeSingle();
    if (data) {
      if (!["converted", "do_not_contact", "unsubscribed"].includes(data.status)) await db().from("biz_leads").update({ status: "replied", next_call_at: new Date().toISOString(), ...(l.phone ? { phone: l.phone } : {}) }).eq("id", data.id);
      await db().from("biz_lead_events").insert({ lead_id: data.id, kind: "inbound", note: `Asked us via ${channelLabel(l.channel)}${l.message ? `: ${l.message.slice(0, 500)}` : ""}`, actor: "lead inbox" });
      return data.id;
    }
  }
  const { data } = await db().from("biz_leads").insert({
    source: "inbound", external_id: l.email ?? l.phone, business_name: l.company!.slice(0, 160), contact_name: l.name, email: l.email, phone: l.phone, city: l.city, zip: l.zip,
    segment: "facilities", score: 90, status: "replied", next_call_at: new Date().toISOString(), notes: l.message?.slice(0, 1000) ?? null,
  }).select("id").single();
  if (data) await db().from("biz_lead_events").insert({ lead_id: data.id, kind: "found", note: `Inbound from ${channelLabel(l.channel)}${l.campaign ? ` (${l.campaign})` : ""}`, actor: "lead inbox" });
  return data?.id ?? null;
}

/** The instant reply (email; text only with consent) and the alert to call now. */
async function speedToLead(id: string, l: IntakeLead) {
  const reply = await speedToLeadReply(l, { siteUrl: siteUrl(), phone: BRAND.supportPhone || null });
  const opted = l.email ? (await db().from("email_optouts").select("email", { count: "exact", head: true }).eq("email", l.email)).count : 0;
  let replied = false;
  if (l.email && !opted) replied = await sendEmail(l.email, reply.subject, reply.email).catch(() => false);
  if (l.phone && l.sms_consent) replied = (await sendSms(l.phone, reply.sms).catch(() => false)) || replied;
  if (replied) await db().from("leads").update({ first_reply_at: new Date().toISOString() }).eq("id", id);
  await raiseAlert("sales", "warn", `New lead — ${channelLabel(l.channel)}: ${l.name ?? l.company ?? l.email ?? l.phone}`,
    [`${reply.call_note}`, l.phone ? `📞 Call within 5 minutes: ${l.phone}` : `No phone — answer by email: ${l.email}`, l.company ? `Business: ${l.company} (on the Call desk now)` : null,
      l.message ? `They wrote: "${l.message.slice(0, 400)}"` : null, replied ? `Instant reply sent${l.sms_consent && l.phone ? " (email + text)" : ""}.` : "No instant reply sent (no email, or they opted out).", "Hub → Lead inbox"].filter(Boolean).join("\n"));
}

export async function setLeadStatus(id: string, status: "new" | "contacted" | "booked" | "lost" | "spam", actor: string) {
  await db().from("leads").update({ status, handled_by: actor }).eq("id", id);
  // the first time anyone reaches them counts for speed to lead
  if (status !== "new") await db().from("leads").update({ contacted_at: new Date().toISOString() }).eq("id", id).is("contacted_at", null);
}
