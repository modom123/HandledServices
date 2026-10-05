/*
 * FILE    : apps/web/lib/email-center.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Email Center campaigns (rules in packages/core/src/email-center.ts; mailbox in mailbox.ts).
 *             audienceRecipients — who a campaign reaches (deduped, lowercase, unsubscribes removed)
 *             launchCampaign     — freezes the recipient list and schedules it (now or later)
 *             sendTestEmail      — one copy to a staff member, exactly as recipients will see it
 *             runEmailCenter     — every 10 minutes (dispatch cron): a small batch from campaigns that are
 *                                  sending, within the daily cap; one marketing email a week per person;
 *                                  Spanish copy for Spanish-speaking customers when the campaign has one
 *             clickUrl / recordClick — signed click-tracking links (no open pixels)
 *           Every email: why they get it, the business postal address, one-click unsubscribe (CAN-SPAM).
 * UPDATED : 2026-10-05_2134 UTC — business-lead audience never includes teaming partners.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { EMAIL_AUDIENCES, EMAIL_LIMITS, lintCampaign, marketingFooter, mergeTags, parseEmailList, renderEmailHtml, type EmailAudience } from "@handled/core";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";
import { unsubscribeUrl } from "./reminders";
import { mailboxReady, sendMail } from "./mailbox";

const db = () => adminClient();
const lower = (e: string) => e.trim().toLowerCase();
const PAGE = 1000;

export interface EmailSettings { from_name: string; reply_to: string | null; daily_cap: number; per_run: number }
export async function getEmailSettings(): Promise<EmailSettings> {
  const { data } = await db().from("email_center_settings").select("*").eq("id", 1).maybeSingle();
  return { from_name: "Handled", reply_to: null, daily_cap: EMAIL_LIMITS.dailyCap, per_run: EMAIL_LIMITS.perRun, ...(data ?? {}) } as EmailSettings;
}

export interface Campaign {
  id: string; name: string; subject: string; preheader: string | null; body: string; subject_es: string | null; body_es: string | null;
  audience: EmailAudience; custom_list: string | null; custom_consent: boolean; status: string; scheduled_at: string | null;
  started_at: string | null; finished_at: string | null; recipients: number; sent: number; failed: number; skipped: number; clicks: number; unsubscribes: number; created_at: string;
}

export interface Recipient { email: string; name: string | null; locale: "en" | "es"; vars: Record<string, string> }

/** Read every row of a query in pages (PostgREST returns at most 1000 at a time). */
async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += PAGE) {
    const { data } = await q(i, i + PAGE - 1);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return out;
  }
}

const first = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "";

/** Everyone a campaign for this audience would reach (before unsubscribes are removed). */
async function rawAudience(audience: EmailAudience, customList?: string | null): Promise<Recipient[]> {
  const map = new Map<string, Recipient>();
  const add = (email: string | null | undefined, name: string | null | undefined, extra: Partial<Recipient["vars"]> = {}, locale?: string | null) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return;
    const e = lower(email);
    const cur = map.get(e);
    if (cur) { if (!cur.vars.first_name && first(name)) cur.vars.first_name = first(name); if (locale === "es") cur.locale = "es"; return; }
    map.set(e, { email: e, name: name?.trim() || null, locale: locale === "es" ? "es" : "en", vars: { first_name: first(name), ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) as Record<string, string> } });
  };
  if (audience === "customers" || audience === "repeat_customers" || audience === "lapsed_customers") {
    type J = { contact_email: string; contact_name: string | null; city: string | null; status: string; created_at: string; locale: string | null; company_name: string | null };
    const jobs = await all<J>((a, b) => db().from("jobs").select("contact_email, contact_name, city, status, created_at, locale, company_name").not("status", "eq", "cancelled").order("created_at", { ascending: false }).range(a, b));
    const done: Record<string, number> = {}, last: Record<string, string> = {};
    for (const j of jobs) { const e = lower(j.contact_email); if (j.status === "completed") done[e] = (done[e] ?? 0) + 1; if (!last[e] || j.created_at > last[e]) last[e] = j.created_at; }
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
    for (const j of jobs) {
      const e = lower(j.contact_email);
      if (audience === "repeat_customers" && (done[e] ?? 0) < 2) continue;
      if (audience === "lapsed_customers" && !(last[e] < cutoff)) continue;
      add(e, j.contact_name, { city: j.city ?? "", company: j.company_name ?? "" }, j.locale);
    }
    if (audience === "customers") {
      const profs = await all<{ email: string | null; full_name: string | null; locale: string | null; company: string | null }>((a, b) => db().from("profiles").select("email, full_name, locale, company").eq("role", "customer").range(a, b));
      for (const p of profs) add(p.email, p.full_name, { company: p.company ?? "" }, p.locale);
    } else {
      // language from the account when they have one
      const profs = await all<{ email: string | null; locale: string | null }>((a, b) => db().from("profiles").select("email, locale").eq("locale", "es").range(a, b));
      for (const p of profs) { const r = p.email ? map.get(lower(p.email)) : undefined; if (r) r.locale = "es"; }
    }
  } else if (audience === "business_accounts") {
    const rows = await all<{ email: string; business_accounts: { company: string | null; contact_name: string | null } | null }>((a, b) => db().from("business_members").select("email, business_accounts(company, contact_name)").range(a, b));
    for (const r of rows) add(r.email, null, { company: r.business_accounts?.company ?? "" });
  } else if (audience === "biz_leads") {
    const rows = await all<{ email: string | null; contact_name: string | null; business_name: string; city: string | null }>((a, b) => db().from("biz_leads").select("email, contact_name, business_name, city").in("status", ["new", "clicked"]).neq("segment", "partner").not("email", "is", null).range(a, b));
    for (const r of rows) add(r.email, r.contact_name, { company: r.business_name, city: r.city ?? "" });
  } else if (audience === "pros") {
    const rows = await all<{ email: string | null; contact_name: string | null; business_name: string; profiles: { locale: string | null } | null }>((a, b) => db().from("contractors").select("email, contact_name, business_name, profiles(locale)").eq("status", "approved").range(a, b));
    for (const r of rows) add(r.email, r.contact_name, { company: r.business_name }, r.profiles?.locale);
  } else if (audience === "custom") {
    for (const r of parseEmailList(customList ?? "")) add(r.email, r.name);
  }
  return [...map.values()];
}

async function optedOut(): Promise<Set<string>> {
  const rows = await all<{ email: string }>((a, b) => db().from("email_optouts").select("email").range(a, b));
  return new Set(rows.map((r) => r.email));
}

/** Who this audience reaches today, unsubscribes removed. */
export async function audienceRecipients(audience: EmailAudience, customList?: string | null) {
  const [list, out] = await Promise.all([rawAudience(audience, customList), optedOut()]);
  return { recipients: list.filter((r) => !out.has(r.email)), unsubscribed: list.filter((r) => out.has(r.email)).length };
}

const sig = (s: string) => createHmac("sha256", process.env.INVOICE_SIGNING_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-only-secret").update(`click:${s}`).digest("base64url").slice(0, 16);

/** A signed redirect that counts the click, then goes to the real link. */
export const clickUrl = (recipientId: string, url: string) => `${siteUrl()}/api/email/c?r=${recipientId}&u=${encodeURIComponent(url)}&s=${sig(`${recipientId}|${url}`)}`;

export async function recordClick(recipientId: string, url: string, s: string | null): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(recipientId) || !/^https?:\/\//.test(url) || !s) return null;
  const want = Buffer.from(sig(`${recipientId}|${url}`)), got = Buffer.from(s);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const { data: r } = await db().from("email_campaign_recipients").select("id, campaign_id, clicks").eq("id", recipientId).maybeSingle();
  if (r) {
    await db().from("email_campaign_recipients").update({ clicks: r.clicks + 1, clicked_at: new Date().toISOString() }).eq("id", r.id);
    if (r.clicks === 0) { const { data: c } = await db().from("email_campaigns").select("clicks").eq("id", r.campaign_id).single(); if (c) await db().from("email_campaigns").update({ clicks: c.clicks + 1 }).eq("id", r.campaign_id); }
  }
  return url;
}

/** Render one recipient's copy (Spanish when they speak Spanish and the campaign has it). */
export function renderFor(c: Pick<Campaign, "id" | "subject" | "body" | "preheader" | "subject_es" | "body_es" | "audience">, r: Pick<Recipient, "email" | "locale" | "vars">, recipientId: string | null) {
  const es = r.locale === "es" && Boolean(c.subject_es?.trim() && c.body_es?.trim());
  const unsub = `${unsubscribeUrl(r.email)}${recipientId ? `&c=${c.id}` : ""}`;
  const vars = { ...r.vars, email: r.email, site_url: siteUrl(), book_url: `${siteUrl()}/book?utm_source=email&utm_campaign=${c.id.slice(0, 8)}` };
  const subject = mergeTags(es ? c.subject_es! : c.subject, vars);
  const body = mergeTags(es ? c.body_es! : c.body, vars);
  const footer = marketingFooter(c.audience, process.env.BUSINESS_POSTAL_ADDRESS ?? "[set BUSINESS_POSTAL_ADDRESS]", unsub, es ? "es" : "en");
  const { html, text } = renderEmailHtml(body, { preheader: c.preheader ? mergeTags(c.preheader, vars) : null, footer, link: recipientId ? (u) => clickUrl(recipientId, u) : undefined });
  return { subject, html, text, unsub };
}

export function sendingProblems(): string[] {
  const p: string[] = [];
  if (!mailboxReady()) p.push("Mailbox isn't connected: set SMTP_USER and SMTP_PASSWORD in Vercel.");
  if (!process.env.BUSINESS_POSTAL_ADDRESS) p.push("BUSINESS_POSTAL_ADDRESS isn't set — the law requires it on marketing email.");
  return p;
}

/** One copy to a staff member, with the first recipient's details (or sample ones). */
export async function sendTestEmail(c: Campaign, to: string) {
  const problems = sendingProblems();
  if (problems.length) return { ok: false, error: problems.join(" ") };
  const s = await getEmailSettings();
  const r = { email: lower(to), locale: "en" as const, vars: { first_name: "Alex", company: "Sample Property Co.", city: "Detroit" } };
  const out = [renderFor(c, r, null)];
  if (c.subject_es && c.body_es) out.push(renderFor(c, { ...r, locale: "es" }, null));
  for (const m of out) await sendMail({ to, subject: `[TEST] ${m.subject}`, text: m.text, html: m.html, fromName: s.from_name, replyTo: s.reply_to });
  return { ok: true, sent: out.length };
}

/** Freeze the list and schedule it. `at` null = start with the next run (within 10 minutes). */
export async function launchCampaign(id: string, at: string | null): Promise<{ ok: boolean; error?: string; recipients?: number }> {
  const { data } = await db().from("email_campaigns").select("*").eq("id", id).maybeSingle();
  const c = data as Campaign | null;
  if (!c) return { ok: false, error: "Campaign not found" };
  if (!["draft", "paused"].includes(c.status)) return { ok: false, error: `It's ${c.status}` };
  const lint = lintCampaign(c);
  if (lint.blockers.length) return { ok: false, error: lint.blockers.join(" ") };
  if (c.audience === "custom" && !c.custom_consent) return { ok: false, error: "Confirm everyone on the pasted list agreed to hear from us." };
  const problems = sendingProblems();
  if (problems.length) return { ok: false, error: problems.join(" ") };
  if (c.status === "draft") {
    const { recipients } = await audienceRecipients(c.audience, c.custom_list);
    if (!recipients.length) return { ok: false, error: "Nobody in this audience can be emailed." };
    for (let i = 0; i < recipients.length; i += 500) {
      const { error } = await db().from("email_campaign_recipients").upsert(recipients.slice(i, i + 500).map((r) => ({ campaign_id: id, email: r.email, name: r.name, locale: r.locale, vars: r.vars })), { onConflict: "campaign_id,email", ignoreDuplicates: true });
      if (error) return { ok: false, error: error.message };
    }
    await db().from("email_campaigns").update({ recipients: recipients.length }).eq("id", id);
  }
  await db().from("email_campaigns").update({ status: "scheduled", scheduled_at: at ?? new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  const { count } = await db().from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", "queued");
  return { ok: true, recipients: count ?? 0 };
}

async function refreshCounts(id: string) {
  const count = async (status: string) => (await db().from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("status", status)).count ?? 0;
  const [sent, failed, skipped, queued] = await Promise.all([count("sent"), count("failed"), count("skipped"), count("queued")]);
  await db().from("email_campaigns").update({ sent, failed, skipped, ...(queued === 0 ? { status: "sent", finished_at: new Date().toISOString() } : {}) }).eq("id", id).eq("status", "sending");
}

/** Every 10 minutes: send the next small batch, within today's cap. */
export async function runEmailCenter(): Promise<{ sent: number; failed: number; skipped: number; capLeft: number }> {
  const res = { sent: 0, failed: 0, skipped: 0, capLeft: 0 };
  if (sendingProblems().length) return res;
  const now = new Date();
  await db().from("email_campaigns").update({ status: "sending", started_at: now.toISOString() }).eq("status", "scheduled").lte("scheduled_at", now.toISOString()).is("started_at", null);
  await db().from("email_campaigns").update({ status: "sending" }).eq("status", "scheduled").lte("scheduled_at", now.toISOString());
  const { data: live } = await db().from("email_campaigns").select("*").eq("status", "sending").order("started_at");
  const campaigns = (live ?? []) as Campaign[];
  if (!campaigns.length) return res;
  const s = await getEmailSettings();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { count: today } = await db().from("email_campaign_recipients").select("id", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", dayStart);
  let budget = Math.min(s.per_run, Math.max(0, s.daily_cap - (today ?? 0)));
  res.capLeft = Math.max(0, s.daily_cap - (today ?? 0));
  const out = await optedOut();
  const recent = new Date(now.getTime() - EMAIL_LIMITS.minDaysBetween * 86400000).toISOString();
  for (const c of campaigns) {
    if (budget <= 0) break;
    const { data: rows } = await db().from("email_campaign_recipients").select("*").eq("campaign_id", c.id).eq("status", "queued").limit(budget);
    for (const r of (rows ?? []) as (Recipient & { id: string })[]) {
      const skip = async (why: string) => { await db().from("email_campaign_recipients").update({ status: "skipped", error: why }).eq("id", r.id); res.skipped++; };
      if (out.has(r.email)) { await skip("unsubscribed"); continue; }
      const { count: lately } = await db().from("marketing_sends").select("id", { count: "exact", head: true }).eq("email", r.email).eq("kind", "campaign").gte("sent_at", recent);
      if (lately) { await skip(`got another campaign in the last ${EMAIL_LIMITS.minDaysBetween} days`); continue; }
      const m = renderFor(c, r, r.id);
      try {
        await sendMail({ to: r.email, subject: m.subject, text: m.text, html: m.html, fromName: s.from_name, replyTo: s.reply_to,
          headers: { "List-Unsubscribe": `<${m.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
        await db().from("email_campaign_recipients").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", r.id);
        await db().from("marketing_sends").insert({ email: r.email, kind: "campaign", key: c.id });
        res.sent++; budget--;
      } catch (e) {
        await db().from("email_campaign_recipients").update({ status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 300) }).eq("id", r.id);
        res.failed++; budget--;
      }
    }
    await refreshCounts(c.id);
  }
  return res;
}

/** The unsubscribe link carries the campaign (&c=) so we can count it. */
export async function countUnsubscribe(campaignId: string | null) {
  if (!campaignId || !/^[0-9a-f-]{36}$/.test(campaignId)) return;
  const { data } = await db().from("email_campaigns").select("unsubscribes").eq("id", campaignId).maybeSingle();
  if (data) await db().from("email_campaigns").update({ unsubscribes: data.unsubscribes + 1 }).eq("id", campaignId);
}

export const audienceLabel = (a: EmailAudience) => EMAIL_AUDIENCES[a]?.label ?? a;
