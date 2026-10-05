/*
 * FILE    : apps/web/lib/biz-leads.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Business sales engine (demand side; rules in core biz-lead-engine.ts). Runs weekdays with
 *           the pro lead engine (Hub → Business leads to change it):
 *             1. discover — Google Places search for each segment across the metro (property managers,
 *                           brokerages, stagers, self-storage, furniture & appliance stores)
 *             2. enrich   — the contact email from the business's own website (robots.txt respected)
 *             3. send     — a 3-email sequence with a pilot offer, written here and handed to Instantly's
 *                           business campaign (INSTANTLY_BIZ_CAMPAIGN_ID). Replies, unsubscribes and bounces
 *                           come back through /api/webhooks/instantly.
 *             4. convert  — the link opens /business?lead=…; when they set up an account, the lead is marked
 *                           converted and the promised pilot offer is put on the account automatically.
 *           LinkedIn and phone stay manual (call list in the Hub). Google content is purged after 30 days.
 * UPDATED : 2026-10-05_0130 UTC — job-posting track: addJobPostLead (staff add a business that posted a job for a cleaner,
 *           handyman, maintenance tech…; emailed right away even with discovery off) and the job-posting letter.
 * UPDATED : 2026-10-05_2134 UTC — teaming partners (segment 'partner') are never enriched, queued or sent the sequence.
 */
import "server-only";
import { BIZ_LEAD_SEQUENCE, BIZ_SEGMENTS, BRAND, BUSINESS_TERMS, bizLeadEmail, bizLeadScore, extractEmails, type BizSegment } from "@handled/core";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";
import { unsubscribeUrl } from "./reminders";
import { raiseAlert } from "./jobs";
import { addLeadToCampaign, blockInInstantly, instantlyBizReady } from "./instantly";

const db = () => adminClient();
const METRO = ["Detroit", "Dearborn", "Southfield", "Royal Oak", "Troy", "Warren", "Livonia", "Novi", "Farmington Hills", "Ann Arbor"];

export interface BizLeadSettings { enabled: boolean; discover_per_day: number; emails_per_day: number; segments: BizSegment[]; pilot_pct: number; pilot_jobs: number }
export async function getBizLeadSettings(): Promise<BizLeadSettings> {
  const { data } = await db().from("biz_lead_settings").select("*").eq("id", 1).maybeSingle();
  return { enabled: false, discover_per_day: 5, emails_per_day: 20, segments: ["property_manager", "real_estate", "stager", "storage"], pilot_pct: 20, pilot_jobs: 2, ...(data ?? {}) } as BizLeadSettings;
}

async function event(leadId: string, kind: string, note?: string | null, actor = "engine") {
  await db().from("biz_lead_events").insert({ lead_id: leadId, kind, note: note ?? null, actor });
}

export async function discoverBizLeads(s: BizLeadSettings) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !s.segments.length) return { searches: 0, added: 0 };
  const day = Math.floor(Date.now() / 86400000);
  const list = Array.from({ length: s.discover_per_day }, (_, i) => ({ segment: s.segments[(day + i) % s.segments.length], city: METRO[(day * 3 + i) % METRO.length] }));
  let added = 0;
  for (const t of list) {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.addressComponents" },
      body: JSON.stringify({ textQuery: `${BIZ_SEGMENTS[t.segment].search} in ${t.city}, MI`, maxResultCount: 20 }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!r?.ok) continue;
    const j = (await r.json()) as { places?: { id: string; displayName?: { text: string }; nationalPhoneNumber?: string; websiteUri?: string; rating?: number; userRatingCount?: number; businessStatus?: string; addressComponents?: { longText: string; types: string[] }[] }[] };
    for (const p of j.places ?? []) {
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      const comp = (type: string) => p.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null;
      const row = {
        source: "google_places", external_id: p.id, business_name: p.displayName?.text ?? "Business", segment: t.segment,
        city: comp("locality") ?? t.city, zip: comp("postal_code"), phone: p.nationalPhoneNumber ?? null, website: p.websiteUri ?? null,
        rating: p.rating ?? null, review_count: p.userRatingCount ?? null, details_expire_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        score: bizLeadScore({ rating: p.rating, reviewCount: p.userRatingCount, website: p.websiteUri, phone: p.nationalPhoneNumber }),
      };
      const { data: ins } = await db().from("biz_leads").upsert(row, { onConflict: "source,external_id", ignoreDuplicates: true }).select("id");
      if (ins?.length) { added++; await event(ins[0].id, "found", `${BIZ_SEGMENTS[t.segment].search} in ${t.city}`); }
    }
  }
  return { searches: list.length, added };
}

const UA = `${BRAND.name}Bot/1.0 (+${siteUrl()}/business)`;
async function page(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!r?.ok || !(r.headers.get("content-type") ?? "").includes("html")) return "";
  return (await r.text()).slice(0, 400000);
}
async function robotsOk(origin: string) {
  const r = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4000) }).catch(() => null);
  if (!r?.ok) return true;
  let applies = false;
  for (const line of (await r.text()).split(/\r?\n/)) {
    const [k, ...rest] = line.split(":"); const v = rest.join(":").trim();
    if (/^user-agent$/i.test(k.trim())) applies = v === "*" || v.toLowerCase().includes(BRAND.name.toLowerCase());
    else if (applies && /^disallow$/i.test(k.trim()) && v === "/") return false;
  }
  return true;
}

export async function enrichBizLeads(limit = 30) {
  const { data } = await db().from("biz_leads").select("id, website, phone, rating, review_count").eq("status", "new").is("email", null).not("website", "is", null).neq("segment", "partner").limit(limit);
  let found = 0;
  for (const l of (data ?? []) as { id: string; website: string; phone: string | null; rating: number | null; review_count: number | null }[]) {
    let email: string | null = null;
    try {
      const u = new URL(l.website);
      if (await robotsOk(u.origin)) {
        email = extractEmails(await page(u.href), u.hostname)[0] ?? null;
        for (const p of ["/contact", "/contact-us", "/about"]) { if (email) break; email = extractEmails(await page(`${u.origin}${p}`), u.hostname)[0] ?? null; }
      }
    } catch { /* bad URL */ }
    const { count: out } = email ? await db().from("email_optouts").select("email", { count: "exact", head: true }).eq("email", email) : { count: 0 };
    const next = email && !out ? "queued" : l.phone ? "call" : "do_not_contact";
    await db().from("biz_leads").update({ email, status: out ? "unsubscribed" : next, score: bizLeadScore({ rating: l.rating, reviewCount: l.review_count, email, website: l.website, phone: l.phone }) }).eq("id", l.id);
    if (email) { found++; await event(l.id, "email_found", email); }
  }
  await db().from("biz_leads").update({ status: "call" }).eq("status", "new").is("website", null).not("phone", "is", null);
  return found;
}

const toHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, "<br>");

export async function sendBizLeadEmails(s: BizLeadSettings) {
  if (!instantlyBizReady()) return { sent: 0, skipped: 0 };
  const { data } = await db().from("biz_leads").select("*").eq("status", "queued").not("email", "is", null).neq("segment", "partner").order("score", { ascending: false }).limit(s.emails_per_day);
  return sendTo((data ?? []) as LeadRow[]);
}

type LeadRow = { id: string; token: string; email: string; business_name: string; contact_name: string | null; segment: BizSegment; city: string | null; phone: string | null; website: string | null; job_title?: string | null; posting_source?: string | null };

async function sendTo(rows: LeadRow[]) {
  const s = await getBizLeadSettings();
  let sent = 0, skipped = 0;
  for (const l of rows) {
    const [{ data: acct }, { count: out }] = await Promise.all([
      db().from("business_members").select("account_id").eq("email", l.email.toLowerCase()).limit(1).maybeSingle(),
      db().from("email_optouts").select("email", { count: "exact", head: true }).eq("email", l.email.toLowerCase()),
    ]);
    if (acct) { await db().from("biz_leads").update({ status: "converted", account_id: acct.account_id }).eq("id", l.id); skipped++; continue; }
    if (out) { await db().from("biz_leads").update({ status: "unsubscribed" }).eq("id", l.id); skipped++; continue; }
    const ctx = { businessName: l.business_name, firstName: l.contact_name?.split(" ")[0] ?? null, segment: l.segment, city: l.city, pilotPct: s.pilot_pct, pilotJobs: s.pilot_jobs,
      signupUrl: `${siteUrl()}/b/${l.token}`, unsubscribeUrl: unsubscribeUrl(l.email), postalAddress: process.env.BUSINESS_POSTAL_ADDRESS!,
      jobTitle: l.job_title ?? null, postingSource: l.posting_source ?? null };
    const variables: Record<string, string> = { handled_biz_lead_id: l.id, signup_url: ctx.signupUrl };
    BIZ_LEAD_SEQUENCE.forEach((_, i) => { const m = bizLeadEmail({ ...ctx, step: i }); variables[`subject_${i + 1}`] = m.subject; variables[`body_${i + 1}`] = toHtml(m.text); });
    try {
      await addLeadToCampaign({ email: l.email, firstName: ctx.firstName, companyName: l.business_name, phone: l.phone, website: l.website, variables, campaign: process.env.INSTANTLY_BIZ_CAMPAIGN_ID });
    } catch (e) { await event(l.id, "send_failed", e instanceof Error ? e.message : String(e)); skipped++; continue; }
    await db().from("biz_leads").update({ status: "emailing", last_contact_at: new Date().toISOString() }).eq("id", l.id);
    await event(l.id, "handed_to_instantly", l.job_title ? `job-posting sequence (${l.job_title})` : "3-email sequence with pilot offer");
    sent++;
  }
  return { sent, skipped };
}

export interface JobPostLead { business_name: string; contact_name?: string | null; email?: string | null; phone?: string | null; website?: string | null; city?: string | null; segment: BizSegment; job_title: string; posting_source?: string | null; posting_url?: string | null; send_now?: boolean }

/** Staff add a business that posted a job for work we do. With an email it's queued (and sent now if asked); without, it's on the call list. */
export async function addJobPostLead(l: JobPostLead, actor: string): Promise<{ ok: boolean; id?: string; sent?: boolean; error?: string }> {
  const email = l.email?.trim().toLowerCase() || null;
  if (email) {
    const [{ data: dup }, { count: out }] = await Promise.all([
      db().from("biz_leads").select("id, status").ilike("email", email.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle(),
      db().from("email_optouts").select("email", { count: "exact", head: true }).eq("email", email),
    ]);
    if (out) return { ok: false, error: "That email unsubscribed from us — don't contact them." };
    if (dup) return { ok: false, id: dup.id, error: `Already a lead (${dup.status}).` };
  }
  const { data, error } = await db().from("biz_leads").insert({
    source: "manual", external_id: null, business_name: l.business_name.trim(), contact_name: l.contact_name?.trim() || null, email, phone: l.phone?.trim() || null,
    website: l.website?.trim() || null, city: l.city?.trim() || null, segment: l.segment, job_title: l.job_title.trim(), posting_source: l.posting_source?.trim() || null,
    posting_url: l.posting_url?.trim() || null, score: Math.min(100, bizLeadScore({ email, phone: l.phone, website: l.website }) + 30), status: email ? "queued" : "call",
  }).select("*").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save" };
  await event(data.id, "found", `job posting${l.posting_source ? ` on ${l.posting_source}` : ""}: ${l.job_title}`, actor);
  let sent = false;
  if (email && l.send_now && instantlyBizReady()) sent = (await sendTo([data as LeadRow])).sent > 0;
  return { ok: true, id: data.id, sent };
}

/** Instantly events for business leads (the webhook routes here when handled_biz_lead_id is present). */
export async function onBizInstantlyEvent(e: { type: string; email: string; leadId?: string | null; text?: string | null }) {
  const email = e.email.trim().toLowerCase();
  const { data: lead } = e.leadId && /^[0-9a-f-]{36}$/.test(e.leadId)
    ? await db().from("biz_leads").select("id, status, business_name").eq("id", e.leadId).maybeSingle()
    : await db().from("biz_leads").select("id, status, business_name").ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!lead) return false;
  const t = e.type.toLowerCase();
  const done = ["converted", "unsubscribed", "do_not_contact"].includes(lead.status);
  if (t.includes("unsub")) { await db().from("email_optouts").upsert({ email }); await db().from("biz_leads").update({ status: "unsubscribed" }).eq("id", lead.id); }
  else if (t.includes("bounce")) { if (!done) await db().from("biz_leads").update({ status: "bounced" }).eq("id", lead.id); }
  else if (t.includes("repl")) {
    if (!done) await db().from("biz_leads").update({ status: "replied" }).eq("id", lead.id);
    await raiseAlert("sales", "warn", `A business replied: ${lead.business_name}`, `${e.text ? `"${e.text.slice(0, 500)}"\n\n` : ""}Answer from Instantly's Unibox today (a warm business lead), then mark them in Hub → Business leads.`);
  } else if (t.includes("click")) { if (["queued", "emailing"].includes(lead.status)) await db().from("biz_leads").update({ status: "clicked" }).eq("id", lead.id); }
  else if (t.includes("sent")) await db().from("biz_leads").update({ last_contact_at: new Date().toISOString() }).eq("id", lead.id);
  await event(lead.id, `instantly:${t}`, e.text?.slice(0, 300) ?? null, "instantly");
  return true;
}

export async function recordBizLeadClick(token: string) {
  if (!/^[a-z0-9]{8,40}$/.test(token)) return false;
  const { data } = await db().from("biz_leads").select("id, status").eq("token", token).maybeSingle();
  if (!data) return false;
  if (["new", "queued", "emailing", "call"].includes(data.status)) await db().from("biz_leads").update({ status: "clicked" }).eq("id", data.id);
  await event(data.id, "clicked");
  return true;
}

/** They set up an account from the email: credit the lead, put the promised pilot on the account, stop emailing. */
export async function leadConverted(token: string, accountId: string) {
  if (!/^[a-z0-9]{8,40}$/.test(token)) return null;
  const { data: lead } = await db().from("biz_leads").select("id, email, segment").eq("token", token).maybeSingle();
  if (!lead) return null;
  const s = await getBizLeadSettings();
  await db().from("biz_leads").update({ status: "converted", account_id: accountId }).eq("id", lead.id);
  await db().from("business_accounts").update({
    source_lead_id: lead.id, industry: BIZ_SEGMENTS[lead.segment as BizSegment]?.label ?? null,
    pilot_discount_pct: Math.min(BUSINESS_TERMS.maxPilotPct, s.pilot_pct), pilot_jobs_left: Math.min(BUSINESS_TERMS.maxPilotJobs, s.pilot_jobs),
  }).eq("id", accountId);
  if (lead.email) await blockInInstantly(lead.email);
  await event(lead.id, "converted", accountId);
  await raiseAlert("sales", "info", "A business lead set up an account", `From the sales engine (${lead.segment}). Pilot offer applied. Call them to book the first job.`);
  return lead.id;
}

export async function setBizLeadStatus(id: string, status: "call" | "not_interested" | "do_not_contact" | "replied" | "queued", note: string | null, actor: string) {
  // teaming partners are contacted by hand, never queued for the sales sequence
  if (status === "queued") { const { data: l } = await db().from("biz_leads").select("segment").eq("id", id).single(); if (l?.segment === "partner") status = "call"; }
  // status only — notes are never overwritten; a note written with a status change is kept in the history (event below)
  await db().from("biz_leads").update({ status }).eq("id", id);
  if (status === "not_interested" || status === "do_not_contact") {
    const { data } = await db().from("biz_leads").select("email").eq("id", id).single();
    if (data?.email) await blockInInstantly(data.email);
  }
  await event(id, `status:${status}`, note, actor);
}

export async function purgeBizLeadDetails() {
  const { data } = await db().from("biz_leads").update({ phone: null, rating: null, review_count: null, details_expire_at: null })
    .eq("source", "google_places").lt("details_expire_at", new Date().toISOString()).in("status", ["new", "call", "do_not_contact", "not_interested", "unsubscribed", "bounced"]).select("id");
  return data?.length ?? 0;
}

export async function bizLeadEngine() {
  const s = await getBizLeadSettings();
  if (!s.enabled) return { enabled: false };
  const discovered = await discoverBizLeads(s).catch((e) => { console.error("[biz leads discover]", e); return { searches: 0, added: 0 }; });
  const emailsFound = await enrichBizLeads().catch(() => 0);
  const sent = await sendBizLeadEmails(s).catch((e) => { console.error("[biz leads send]", e); return { sent: 0, skipped: 0 }; });
  const purged = await purgeBizLeadDetails().catch(() => 0);
  if (!process.env.GOOGLE_PLACES_API_KEY || !instantlyBizReady())
    await raiseAlert("sales", "info", "Business sales engine is on but not fully set up", `${!process.env.GOOGLE_PLACES_API_KEY ? "GOOGLE_PLACES_API_KEY missing. " : ""}${!instantlyBizReady() ? "INSTANTLY_BIZ_CAMPAIGN_ID (a second Instantly campaign) / INSTANTLY_API_KEY / BUSINESS_POSTAL_ADDRESS missing." : ""}`);
  return { enabled: true, discovered, emailsFound, sent, purged };
}
