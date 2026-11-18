/*
 * FILE    : apps/web/lib/walkthroughs.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Free walkthroughs businesses book themselves (rules in core walkthrough.ts):
 *             openSlots           — the times they can pick (Hub → Walkthroughs sets hours and days)
 *             bookWalkthrough     — re-checks the slot, saves it, credits the sales lead (stops its email sequence,
 *                                   marks it warm), confirms by email with a manage link and "Add to Google Calendar",
 *                                   alerts the team
 *             rescheduleByToken / cancelByToken — the business's own manage link (/walkthrough/<token>)
 *             setWalkthroughStatus — staff: done / no-show / cancelled, notes, who's going; "done" can send the
 *                                    follow-up email with the order link
 *             walkthroughReminders — every 10 minutes (dispatch cron): one reminder about a day before
 *           Confirmations go from the company address (handledsvc.com): they asked for this, it isn't outreach.
 */
import "server-only";
import { BRAND, WALKTHROUGH_DEFAULTS, WALKTHROUGH_KINDS, bizLanding, googleCalendarUrl, slotIsOpen, walkthroughSlots, walkthroughWhen, type WalkthroughKind, type WalkthroughSettings } from "@handled/core";
import { adminClient } from "./supabase/server";
import { opsEmail, sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";

const db = () => adminClient();

export async function getWalkthroughSettings(): Promise<WalkthroughSettings & { notify_emails: string | null }> {
  const { data } = await db().from("walkthrough_settings").select("*").eq("id", 1).maybeSingle();
  return { ...WALKTHROUGH_DEFAULTS, notify_emails: null, ...(data ?? {}) } as WalkthroughSettings & { notify_emails: string | null };
}

async function bookedStarts(excludeId?: string) {
  let q = db().from("walkthroughs").select("id, starts_at").eq("status", "booked").gte("starts_at", new Date(Date.now() - 86400000).toISOString()).limit(2000);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q;
  return (data ?? []).map((r) => r.starts_at as string);
}

export async function openSlots() {
  const s = await getWalkthroughSettings();
  return { timeZone: s.time_zone, enabled: s.enabled, days: walkthroughSlots(s, await bookedStarts()) };
}

/** What we know about a sales-email lead, to pre-fill the form (only what they gave us or is on their website). */
export async function leadPrefill(token: string | null | undefined) {
  if (!token || !/^[a-z0-9]{8,40}$/.test(token)) return null;
  const { data } = await db().from("biz_leads").select("business_name, contact_name, email, phone, city, state, segment, job_title").eq("token", token).maybeSingle();
  return data ? { company: data.business_name as string, name: (data.contact_name as string | null) ?? "", email: (data.email as string | null) ?? "", phone: (data.phone as string | null) ?? "", city: (data.city as string | null) ?? "", state: (data.state as string | null) ?? "", segment: data.segment as string, jobTitle: data.job_title as string | null } : null;
}

export interface WalkthroughInput {
  kind: WalkthroughKind; start: string; name: string; company: string; email: string; phone?: string | null;
  address?: string | null; city?: string | null; state?: string | null; zip?: string | null; needs?: string | null; properties?: number | null;
  landing?: string | null; lead?: string | null; attribution?: Record<string, string> | null;
}

const manageUrl = (token: string) => `${siteUrl()}/walkthrough/${token}`;
const where = (w: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null }) => [w.address, w.city, [w.state, w.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");

export async function bookWalkthrough(w: WalkthroughInput): Promise<{ ok: boolean; token?: string; error?: string }> {
  const s = await getWalkthroughSettings();
  if (!s.enabled) return { ok: false, error: "Online booking is paused. Call or email us and we'll set a time." };
  if (!slotIsOpen(s, w.start, await bookedStarts())) return { ok: false, error: "That time was just taken. Pick another one." };
  if (w.kind === "onsite" && !w.address?.trim()) return { ok: false, error: "Add the property address so we know where to come." };
  const leadToken = w.lead && /^[a-z0-9]{8,40}$/.test(w.lead) ? w.lead : w.attribution?.biz_lead && /^[a-z0-9]{8,40}$/.test(w.attribution.biz_lead) ? w.attribution.biz_lead : null;
  const { data: lead } = leadToken ? await db().from("biz_leads").select("id, status, segment, business_name").eq("token", leadToken).maybeSingle() : { data: null };
  const landing = w.landing ? bizLanding(w.landing) : null;
  const { data: row, error } = await db().from("walkthroughs").insert({
    kind: w.kind, starts_at: new Date(w.start).toISOString(), minutes: WALKTHROUGH_KINDS[w.kind].minutes, name: w.name.trim(), company: w.company.trim(), email: w.email.trim().toLowerCase(),
    phone: w.phone?.trim() || null, address: w.address?.trim() || null, city: w.city?.trim() || null, state: w.state?.trim().toUpperCase() || null, zip: w.zip?.trim() || null,
    needs: w.needs?.trim() || null, properties: w.properties ?? null, landing: landing?.slug ?? null, segment: lead?.segment ?? (landing && landing.segment !== "hiring" ? landing.segment : null),
    biz_lead_id: lead?.id ?? null, attribution: w.attribution ?? null,
  }).select("id, token, starts_at").single();
  if (error || !row) return { ok: false, error: "Couldn't save your booking. Try again, or call us." };
  // two people picked the same time at once: the later one gets another time
  const same = (await bookedStarts()).filter((x) => new Date(x).getTime() === new Date(row.starts_at).getTime()).length;
  if (same > Math.max(1, s.per_slot)) {
    await db().from("walkthroughs").delete().eq("id", row.id);
    return { ok: false, error: "That time was just taken. Pick another one." };
  }
  if (lead) {
    const warm = !["converted", "unsubscribed", "do_not_contact"].includes(lead.status);
    await db().from("biz_leads").update({ ...(warm ? { status: "replied" } : {}), next_send_at: null, last_contact_at: new Date().toISOString() }).eq("id", lead.id);
    await db().from("biz_lead_events").insert({ lead_id: lead.id, kind: "walkthrough:booked", note: `${WALKTHROUGH_KINDS[w.kind].label}: ${walkthroughWhen(row.starts_at, s.time_zone)}`, actor: "website" });
  }
  await sendConfirmation(row.token, "booked").catch((e) => console.error("[walkthrough confirm]", e));
  const when = walkthroughWhen(row.starts_at, s.time_zone);
  const body = `${w.company} (${w.name}, ${w.email}${w.phone ? `, ${w.phone}` : ""})\n${when}${w.kind === "onsite" ? `\nAt: ${where(w)}` : `\nWe call: ${w.phone || "(no phone, email them)"}`}${w.needs ? `\n\nWhat they need: ${w.needs}` : ""}${w.properties ? `\nProperties: ${w.properties}` : ""}${lead ? `\n\nFrom the sales emails (lead: ${lead.business_name}).` : landing ? `\n\nFrom the ${landing.name} page.` : ""}\n\nHub → Walkthroughs to assign who goes.`;
  await raiseAlert("sales", "warn", `Walkthrough booked: ${w.company}, ${when}`, body);
  const to = (s.notify_emails ?? "").split(/[,\s]+/).filter((x) => x.includes("@"));
  await sendEmail(to.length ? to : opsEmail(), `[${BRAND.name}] ${WALKTHROUGH_KINDS[w.kind].label} booked: ${w.company}`, body).catch(() => false);
  return { ok: true, token: row.token };
}

async function sendConfirmation(token: string, why: "booked" | "moved" | "reminder" | "cancelled") {
  const { data: w } = await db().from("walkthroughs").select("*").eq("token", token).maybeSingle();
  if (!w) return;
  const s = await getWalkthroughSettings();
  const k = WALKTHROUGH_KINDS[w.kind as WalkthroughKind];
  const when = walkthroughWhen(w.starts_at, s.time_zone);
  const first = String(w.name).split(" ")[0];
  const place = w.kind === "onsite" ? `\nWhere: ${where(w)}` : `\nWe'll call you at ${w.phone || "the number you gave us"}.`;
  if (why === "cancelled") {
    await sendEmail(w.email, `Your ${BRAND.name} walkthrough is cancelled`, `Hi ${first},\n\nYour ${k.label.toLowerCase()} on ${when} is cancelled. Pick a new time whenever you're ready: ${siteUrl()}/walkthrough\n\nThe ${BRAND.name} team`);
    return;
  }
  const cal = googleCalendarUrl({ title: `${BRAND.name}: ${k.label}`, start: w.starts_at, minutes: w.minutes, details: `${k.blurb}\nChange or cancel: ${manageUrl(token)}`, location: w.kind === "onsite" ? where(w) : null });
  const subject = why === "reminder" ? `Reminder: your ${BRAND.name} walkthrough ${new Date(w.starts_at).getTime() - Date.now() < 36 * 3600000 ? "tomorrow" : "soon"}` : why === "moved" ? `New time for your ${BRAND.name} walkthrough` : `You're booked: ${k.label.toLowerCase()} with ${BRAND.name}`;
  const text = `Hi ${first},\n\n${why === "reminder" ? "A quick reminder:" : why === "moved" ? "Your walkthrough has a new time:" : "Thanks for booking. Here are the details:"}\n\n${k.label}\nWhen: ${when}${place}\n\n${k.blurb}${w.kind === "onsite" ? " Plan on about 30–45 minutes; someone who knows the space should be there." : ""}\n\nAdd it to your calendar: ${cal}\nNeed another time, or to cancel? ${manageUrl(token)}\nQuestions: reply to this email or call ${BRAND.supportPhone}.\n\nThe ${BRAND.name} team`;
  await sendEmail(w.email, subject, text);
}

export async function walkthroughByToken(token: string) {
  if (!/^[a-f0-9]{24,40}$/.test(token)) return null;
  const { data } = await db().from("walkthroughs").select("token, kind, starts_at, minutes, status, name, company, address, city, state, zip, landing").eq("token", token).maybeSingle();
  return data;
}

export async function rescheduleByToken(token: string, start: string): Promise<{ ok: boolean; error?: string }> {
  const { data: w } = await db().from("walkthroughs").select("id, status, company, starts_at").eq("token", token).maybeSingle();
  if (!w || w.status !== "booked") return { ok: false, error: "This walkthrough can't be changed any more." };
  const s = await getWalkthroughSettings();
  if (!slotIsOpen(s, start, await bookedStarts(w.id))) return { ok: false, error: "That time was just taken. Pick another one." };
  await db().from("walkthroughs").update({ starts_at: new Date(start).toISOString(), reminded_at: null, updated_at: new Date().toISOString() }).eq("id", w.id);
  await sendConfirmation(token, "moved").catch(() => {});
  await raiseAlert("sales", "info", `Walkthrough moved: ${w.company}`, `From ${walkthroughWhen(w.starts_at, s.time_zone)} to ${walkthroughWhen(start, s.time_zone)} (they changed it from their link).`);
  return { ok: true };
}

export async function cancelByToken(token: string, reason: string | null): Promise<{ ok: boolean; error?: string }> {
  const { data: w } = await db().from("walkthroughs").select("id, status, company, starts_at").eq("token", token).maybeSingle();
  if (!w || w.status !== "booked") return { ok: false, error: "This walkthrough is already closed." };
  await db().from("walkthroughs").update({ status: "cancelled", cancelled_reason: reason?.slice(0, 500) || "cancelled by the business", updated_at: new Date().toISOString() }).eq("id", w.id);
  await sendConfirmation(token, "cancelled").catch(() => {});
  const s = await getWalkthroughSettings();
  await raiseAlert("sales", "info", `Walkthrough cancelled: ${w.company}`, `${walkthroughWhen(w.starts_at, s.time_zone)}${reason ? `\nReason: ${reason}` : ""}\nWorth a call to rebook.`);
  return { ok: true };
}

/** Staff: close it out. "done" with followUp emails them the order link for their kind of business. */
export async function setWalkthroughStatus(id: string, p: { status?: "booked" | "done" | "no_show" | "cancelled"; staff_notes?: string | null; assigned_to?: string | null; followUp?: boolean }, actor: string): Promise<{ ok: boolean; error?: string }> {
  const { data: w } = await db().from("walkthroughs").select("*").eq("id", id).maybeSingle();
  if (!w) return { ok: false, error: "Not found" };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.status) patch.status = p.status;
  if (p.staff_notes !== undefined) patch.staff_notes = p.staff_notes;
  if (p.assigned_to !== undefined) patch.assigned_to = p.assigned_to;
  if (p.status === "done" && p.followUp && !w.followed_up_at) {
    const { data: lead } = w.biz_lead_id ? await db().from("biz_leads").select("token").eq("id", w.biz_lead_id).maybeSingle() : { data: null };
    const order = `${siteUrl()}/book?for=business${lead?.token ? `&lead=${lead.token}` : ""}`;
    const ok = await sendEmail(w.email, `Thanks for your time — next step with ${BRAND.name}`, `Hi ${String(w.name).split(" ")[0]},\n\nThanks for walking us through ${w.company}. When you're ready, order the first job here and you'll see the exact price before you pay: ${order}\n\nPay 25% to book, the rest when it's done. Reply with any questions or changes and we'll sort them out.\n\nThe ${BRAND.name} team`);
    if (ok) patch.followed_up_at = new Date().toISOString();
  }
  if (p.status === "cancelled" && w.status === "booked") await sendConfirmation(w.token, "cancelled").catch(() => {});
  await db().from("walkthroughs").update(patch).eq("id", id);
  if (w.biz_lead_id && p.status && p.status !== w.status) await db().from("biz_lead_events").insert({ lead_id: w.biz_lead_id, kind: `walkthrough:${p.status}`, note: p.staff_notes ?? null, actor });
  return { ok: true };
}

/** Every 10 minutes: one reminder for walkthroughs starting in the next 26 hours (not within the hour). */
export async function walkthroughReminders(): Promise<number> {
  const now = Date.now();
  const { data } = await db().from("walkthroughs").select("token").eq("status", "booked").is("reminded_at", null)
    .gte("starts_at", new Date(now + 3600000).toISOString()).lte("starts_at", new Date(now + 26 * 3600000).toISOString())
    .lte("created_at", new Date(now - 12 * 3600000).toISOString()).limit(50); // booked in the last 12 hours: the confirmation is reminder enough
  let n = 0;
  for (const w of data ?? []) {
    await db().from("walkthroughs").update({ reminded_at: new Date().toISOString() }).eq("token", w.token); // mark first: never twice
    await sendConfirmation(w.token, "reminder").then(() => n++).catch(() => {});
  }
  return n;
}
