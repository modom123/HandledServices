/*
 * FILE    : apps/web/lib/reminders.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0030 UTC
 * PURPOSE : Bringing customers back, in each person's language:
 *             saveQuote              — "Email me this price": sends the price now with a link that
 *                                      reopens the booking with their answers filled in
 *             sendQuoteFollowups     — saved prices not booked: follow-ups on day 1 and day 4
 *             sendBookingFollowups   — booked but unpaid: payment link on day 1, 3 and 7
 *             sendSeasonalReminders  — past customers, when a service they had comes around again
 *                                      (gutters in fall, carpets in spring…), at most one email a month
 *           Reminder emails carry a one-click unsubscribe (email_optouts); booking messages
 *           (payment links, schedule changes) still go. Seasonal reminders are email + app push
 *           only — no marketing texts without separate SMS consent.
 */
import "server-only";
import {
  BOOKING_FOLLOWUPS, BRAND, QUOTE_FOLLOWUPS, estimate, followupDue, getService, money, seasonKey, seasonalDue, seasonalPitch, serviceText,
  type Answers, type Frequency, type Job,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { unsubscribeToken } from "./invoice";
import { notify } from "./push";
import { sendPaymentLink } from "./jobs";

const db = () => adminClient();
const lower = (e: string) => e.trim().toLowerCase();
type Lang = "en" | "es";

export const unsubscribeUrl = (email: string) => `${siteUrl()}/api/unsubscribe?e=${encodeURIComponent(lower(email))}&t=${unsubscribeToken(email)}`;

/** Booking page with their answers filled in; utm_source tags where the booking came from. */
export function resumeUrl(slug: string, answers: Answers, frequency: string, source: string) {
  const q = new URLSearchParams({ service: slug, utm_source: source });
  if (frequency && frequency !== "once") q.set("frequency", frequency);
  for (const [k, v] of Object.entries(answers ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  return `${siteUrl()}/book?${q}`;
}

const svcName = (slug: string, l: Lang) => { const s = getService(slug); return s ? (l === "es" ? serviceText("es", slug, s).name : s.name) : slug; };

async function optedOut(email: string) {
  const { data } = await db().from("email_optouts").select("email").eq("email", lower(email)).maybeSingle();
  return Boolean(data);
}

/** Email with the unsubscribe footer and one-click List-Unsubscribe headers. */
async function reminderEmail(to: string, l: Lang, subject: string, body: string) {
  const unsub = unsubscribeUrl(to);
  const foot = l === "es" ? `\n\n—\n¿No quiere estos recordatorios? Cancele la suscripción: ${unsub}` : `\n\n—\nDon't want these reminders? Unsubscribe: ${unsub}`;
  await sendEmail(to, subject, body + foot, { headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
}

async function recordSend(email: string, kind: "seasonal" | "quote_followup" | "booking_followup", key: string, jobId?: string | null) {
  const { error } = await db().from("marketing_sends").insert({ email: lower(email), kind, key, job_id: jobId ?? null });
  return !error; // unique (email, kind, key): false = already sent
}

// ─── "Email me this price" ──────────────────────────────────────────────────

export async function saveQuote(q: { email: string; slug: string; answers: Answers; frequency: Frequency; locale: Lang; profileId?: string | null }) {
  const svc = getService(q.slug);
  if (!svc) throw new Error("Unknown service");
  const est = estimate({ slug: q.slug, answers: q.answers, frequency: q.frequency }); // priced on the server, never trusted from the browser
  const range = svc.siteVisit ? `${money(est.low)}–${money(est.high)}` : null;
  const { data, error } = await db().from("saved_quotes").insert({
    email: lower(q.email), service_slug: q.slug, answers: q.answers, frequency: q.frequency, price: est.point, locale: q.locale, profile_id: q.profileId ?? null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  const link = resumeUrl(q.slug, q.answers, q.frequency, "saved_quote");
  const name = svcName(q.slug, q.locale);
  const price = range ?? money(est.point);
  if (q.locale === "es")
    await reminderEmail(q.email, "es", `Su precio de ${BRAND.name}: ${name} — ${price}`,
      `Aquí está su precio para ${name}: ${price}${q.frequency !== "once" ? " por visita" : ""}.\n\nReserve cuando esté listo — sus respuestas ya están guardadas:\n${link}\n\nProfesionales verificados y asegurados. Pague por adelantado para asegurar a su profesional. ¿No quedó bien? Lo repetimos gratis o le devolvemos su dinero dentro de ${BRAND.guaranteeDays} días.`);
  else
    await reminderEmail(q.email, "en", `Your ${BRAND.name} price: ${name} — ${price}`,
      `Here's your price for ${name}: ${price}${q.frequency !== "once" ? " per visit" : ""}.\n\nBook whenever you're ready — your answers are saved:\n${link}\n\nVetted, insured pros. ${BRAND.promise}`);
  return data.id as string;
}

/** Saved prices that haven't turned into a booking: a nudge on day 1 and day 4, then we stop. */
export async function sendQuoteFollowups(limit = 300): Promise<number> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data } = await db().from("saved_quotes").select("*").is("booked_job_id", null).lt("followups_sent", QUOTE_FOLLOWUPS.length).gte("created_at", since).order("created_at").limit(limit);
  let sent = 0;
  for (const q of (data ?? []) as { id: string; email: string; service_slug: string; answers: Answers; frequency: string; price: number; locale: Lang; profile_id: string | null; created_at: string; followups_sent: number }[]) {
    // booked since? stop following up
    const { data: job } = await db().from("jobs").select("id").ilike("contact_email", q.email).eq("service_slug", q.service_slug).gte("created_at", q.created_at).limit(1).maybeSingle();
    if (job) { await db().from("saved_quotes").update({ booked_job_id: job.id }).eq("id", q.id); continue; }
    const i = followupDue(q.created_at, q.followups_sent, QUOTE_FOLLOWUPS);
    if (i === null) continue;
    await db().from("saved_quotes").update({ followups_sent: q.followups_sent + 1, last_followup_at: new Date().toISOString() }).eq("id", q.id);
    if (await optedOut(q.email) || !(await recordSend(q.email, "quote_followup", `${q.id}:${i}`))) continue;
    const name = svcName(q.service_slug, q.locale);
    const link = resumeUrl(q.service_slug, q.answers, q.frequency, "quote_followup");
    const last = i === QUOTE_FOLLOWUPS.length - 1;
    if (q.locale === "es")
      await reminderEmail(q.email, "es", last ? `¿Todavía necesita ${name.toLowerCase()}?` : `Su precio para ${name} sigue aquí`,
        `${last ? `Solo un último recordatorio: su precio de ${money(q.price)} para ${name.toLowerCase()} sigue guardado.` : `Guardamos su precio de ${money(q.price)} para ${name.toLowerCase()}.`} Elija una fecha en un minuto:\n${link}\n\n${last ? "¿Tiene preguntas o el precio no le funciona? Responda a este correo: lo lee una persona." : "Profesionales verificados y asegurados, con garantía de satisfacción."}`);
    else
      await reminderEmail(q.email, "en", last ? `Still need ${name.toLowerCase()}?` : `Your ${name} price is still here`,
        `${last ? `One last nudge: your ${money(q.price)} price for ${name.toLowerCase()} is still saved.` : `We saved your ${money(q.price)} price for ${name.toLowerCase()}.`} Pick a date in a minute:\n${link}\n\n${last ? "Questions, or the price doesn't work for you? Just reply — a person reads it." : "Vetted, insured pros, backed by our guarantee."}`);
    sent++;
  }
  return sent;
}

// ─── Booked but not paid ────────────────────────────────────────────────────

/** Payment link on day 1, 3 and 7 after booking (the job isn't dispatched until it's paid). */
export async function sendBookingFollowups(limit = 200): Promise<number> {
  const since = new Date(Date.now() - 10 * 86400000).toISOString();
  const { data } = await db().from("jobs").select("*").is("paid_at", null).is("deposit_paid_at", null).is("remedy", null)
    .not("price_final", "is", null).in("status", ["requested", "quoted"]).gte("created_at", since).limit(limit);
  let sent = 0;
  for (const j of (data ?? []) as Job[]) {
    const { count } = await db().from("job_events").select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("kind", "payment_reminder");
    const i = followupDue(j.created_at, count ?? 0, BOOKING_FOLLOWUPS);
    if (i === null) continue;
    await sendPaymentLink(j);
    await db().from("job_events").insert({ job_id: j.id, kind: "payment_reminder", message: `Payment reminder ${i + 1} of ${BOOKING_FOLLOWUPS.length} sent`, visible_to_customer: false });
    await recordSend(j.contact_email, "booking_followup", `${j.id}:${i}`, j.id);
    sent++;
  }
  return sent;
}

// ─── Seasonal reminders ─────────────────────────────────────────────────────

/** Past customers whose service comes around again this season. Daily; at most one email a person a month. */
export async function sendSeasonalReminders(limit = 500): Promise<number> {
  const twoYears = new Date(Date.now() - 730 * 86400000).toISOString();
  const { data: done } = await db().from("jobs").select("contact_email, contact_name, customer_id, locale, service_slug, completed_at, answers, frequency")
    .eq("status", "completed").gte("completed_at", twoYears).limit(20000);
  if (!done?.length) return 0;
  type Row = { contact_email: string; contact_name: string; customer_id: string | null; locale: string | null; service_slug: string; completed_at: string; answers: Answers; frequency: string };
  const people = new Map<string, Row[]>();
  for (const r of done as Row[]) { const k = lower(r.contact_email); people.set(k, [...(people.get(k) ?? []), r]); }

  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: recent }, { data: plans }, { data: upcoming }, { data: optouts }, { data: gone }] = await Promise.all([
    db().from("marketing_sends").select("email").eq("kind", "seasonal").gte("sent_at", monthAgo),
    db().from("recurring_plans").select("customer_id, service_slug").eq("active", true),
    db().from("jobs").select("contact_email, service_slug").not("status", "in", "(completed,cancelled)"),
    db().from("email_optouts").select("email"),
    db().from("profiles").select("email").not("deleted_at", "is", null),
  ]);
  const skipPeople = new Set([...(recent ?? []), ...(optouts ?? []), ...(gone ?? [])].map((r: { email: string | null }) => lower(r.email ?? "")));

  let sent = 0;
  for (const [email, rows] of people) {
    if (sent >= limit) break;
    if (skipPeople.has(email)) continue;
    const ids = new Set(rows.map((r) => r.customer_id).filter(Boolean));
    const skip = [
      ...(plans ?? []).filter((p: { customer_id: string | null }) => p.customer_id && ids.has(p.customer_id)).map((p: { service_slug: string }) => p.service_slug),
      ...(upcoming ?? []).filter((u: { contact_email: string }) => lower(u.contact_email) === email).map((u: { service_slug: string }) => u.service_slug),
    ];
    const due = seasonalDue(rows, { skip }).slice(0, 2);
    // only services we haven't reminded them about this season
    const fresh: typeof due = [];
    for (const d of due) if (await recordSend(email, "seasonal", seasonKey(d.rule.slug))) fresh.push(d);
    if (!fresh.length) continue;

    const latest = rows.sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
    const l: Lang = latest.locale === "es" ? "es" : "en";
    const first = latest.contact_name?.split(" ")[0];
    const lines = fresh.map((d) => {
      const last = rows.filter((r) => r.service_slug === d.rule.slug).sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
      return `• ${svcName(d.rule.slug, l)} — ${seasonalPitch(d.rule, l)}\n  ${l === "es" ? "Reserve con sus respuestas de la última vez" : "Book with last time's answers"}: ${resumeUrl(d.rule.slug, last.answers ?? {}, "once", "seasonal")}`;
    }).join("\n\n");
    const top = svcName(fresh[0].rule.slug, l);
    if (l === "es")
      await reminderEmail(email, "es", `Es temporada de ${top.toLowerCase()}`, `${first ? `Hola ${first}:\n\n` : ""}Ya es hora otra vez:\n\n${lines}\n\nLos mismos profesionales verificados, precio por adelantado y nuestra garantía de ${BRAND.guaranteeDays} días.`);
    else
      await reminderEmail(email, "en", `It's ${top.toLowerCase()} season`, `${first ? `Hi ${first},\n\n` : ""}It's that time again:\n\n${lines}\n\nSame vetted pros, upfront price, and our ${BRAND.guaranteeDays}-day guarantee.`);
    if (latest.customer_id)
      await notify(latest.customer_id, { title: `It's ${top.toLowerCase()} season`, body: seasonalPitch(fresh[0].rule, "en"), data: { type: "book", slug: fresh[0].rule.slug }, locale: l,
        es: { title: `Es temporada de ${top.toLowerCase()}`, body: seasonalPitch(fresh[0].rule, "es") } });
    sent++;
  }
  return sent;
}
