/*
 * FILE    : apps/web/lib/leads.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0207 UTC
 * PURPOSE : Pro lead engine — runs daily (Hub → Pro leads to change it):
 *             1. discover  — Google Places text search for the trades and areas we're short on
 *                            (Hub → Supply gaps), rated, operating local businesses only
 *             2. enrich    — the contact email from the business's OWN website (robots.txt respected)
 *             3. send      — each lead's 3-email invitation (day 0, 3, 8) is written here (real pay,
 *                            real demand, postal address, unsubscribe) and handed to an Instantly
 *                            campaign, which does the sending (warm-up, rotation, limits, replies).
 *                            Instantly's events come back via /api/webhooks/instantly. Stops when they
 *                            apply, reply, unsubscribe or bounce. Phone-only leads go to a human call
 *                            list — never automated texts (TCPA).
 *             4. clean up  — Google content older than 30 days is cleared on leads that never engaged
 *           Plus: CSV import (e.g. Michigan LARA license lists), click tracking (/l/<token>) and
 *           conversion when they apply.
 * UPDATED : 2026-10-03_0324 UTC — sending moved from a Resend outreach account to Instantly.ai.
 */
import "server-only";
import {
  BRAND, LEAD_SEQUENCE, SERVICES, TRADES, TRADE_SEARCH, defaultAnswers, estimate, extractEmails, getService, leadEmail, leadScore, money, serviceGaps, splitJob, type Contractor,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";
import { unsubscribeUrl } from "./reminders";
import { raiseAlert } from "./jobs";
import { addLeadToCampaign, blockInInstantly, instantlyReady } from "./instantly";

const db = () => adminClient();
const METRO = ["Detroit", "Dearborn", "Southfield", "Royal Oak", "Warren", "Livonia", "Troy", "Sterling Heights", "Farmington Hills", "Westland"];
const LICENSED = new Set(["plumbing", "electrical", "hvac", "remodel"]);

export interface LeadSettings { enabled: boolean; discover_per_day: number; emails_per_day: number; min_rating: number; min_reviews: number; trades: string[] }
export async function getLeadSettings(): Promise<LeadSettings> {
  const { data } = await db().from("lead_engine_settings").select("*").eq("id", 1).maybeSingle();
  return { enabled: false, discover_per_day: 10, emails_per_day: 40, min_rating: 4.3, min_reviews: 5, trades: [], ...(data ?? {}) } as LeadSettings;
}

export const outreachReady = instantlyReady;

async function event(leadId: string, kind: string, note?: string | null, actor = "engine") {
  await db().from("pro_lead_events").insert({ lead_id: leadId, kind, note: note ?? null, actor });
}

// ─── 1. Discover ────────────────────────────────────────────────────────────

/** Which (trade, city) to search today: real supply gaps first, then the trades staff picked across the metro. */
async function targets(s: LeadSettings): Promise<{ trade: string; city: string; inGap: boolean }[]> {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const [{ data: jobs }, { data: wait }, { data: pros }] = await Promise.all([
    db().from("jobs").select("service_slug, zip").gte("created_at", since).neq("status", "cancelled").limit(20000),
    db().from("waitlist").select("service_slug, zip").is("notified_at", null).limit(20000),
    db().from("contractors").select("*").eq("status", "approved"),
  ]);
  const gaps = serviceGaps({ jobs: (jobs ?? []) as { service_slug: string; zip: string }[], waitlist: (wait ?? []) as { service_slug: string; zip: string }[], contractors: (pros ?? []) as Contractor[], days: 60 })
    .filter((g) => g.level !== "ok");
  const zips = [...new Set(gaps.map((g) => g.zip))];
  const { data: geo } = zips.length ? await db().from("zip_geo").select("zip, city").in("zip", zips.slice(0, 500)) : { data: [] };
  const cityOf = new Map(((geo ?? []) as { zip: string; city: string | null }[]).map((g) => [g.zip, g.city]));
  const out: { trade: string; city: string; inGap: boolean }[] = [];
  const seen = new Set<string>();
  const add = (trade: string, city: string, inGap: boolean) => { const k = `${trade}|${city}`; if (!seen.has(k) && TRADE_SEARCH[trade]) { seen.add(k); out.push({ trade, city, inGap }); } };
  for (const g of gaps) for (const t of getService(g.slug)?.trades ?? []) if (!s.trades.length || s.trades.includes(t)) add(t, cityOf.get(g.zip) ?? "Detroit", true);
  // rotate through the metro for the trades staff asked for (or all trades before launch)
  const want = s.trades.length ? s.trades : TRADES.map((t) => t.id);
  const day = Math.floor(Date.now() / 86400000);
  for (let i = 0; out.length < s.discover_per_day * 3 && i < want.length * METRO.length; i++) add(want[(day + i) % want.length], METRO[(day + Math.floor(i / want.length)) % METRO.length], false);
  return out;
}

export async function discoverLeads(s: LeadSettings): Promise<{ searches: number; added: number }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { searches: 0, added: 0 };
  const list = (await targets(s)).slice(0, s.discover_per_day);
  let added = 0;
  for (const t of list) {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.addressComponents" },
      body: JSON.stringify({ textQuery: `${TRADE_SEARCH[t.trade]} in ${t.city}, MI`, maxResultCount: 20 }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!r?.ok) { if (r) console.error("[places]", r.status, await r.text().catch(() => "")); continue; }
    const j = (await r.json()) as { places?: { id: string; displayName?: { text: string }; formattedAddress?: string; nationalPhoneNumber?: string; websiteUri?: string; rating?: number; userRatingCount?: number; businessStatus?: string; addressComponents?: { longText: string; types: string[] }[] }[] };
    for (const p of j.places ?? []) {
      if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
      if ((p.rating ?? 0) < s.min_rating || (p.userRatingCount ?? 0) < s.min_reviews) continue;
      const comp = (type: string) => p.addressComponents?.find((c) => c.types.includes(type))?.longText ?? null;
      const zip = comp("postal_code");
      const row = {
        source: "google_places", external_id: p.id, business_name: p.displayName?.text ?? "Business", trade: t.trade,
        city: comp("locality") ?? t.city, zip, area: zip?.slice(0, 3) ?? t.city, phone: p.nationalPhoneNumber ?? null, website: p.websiteUri ?? null,
        rating: p.rating ?? null, review_count: p.userRatingCount ?? null, details_expire_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        score: leadScore({ rating: p.rating, reviewCount: p.userRatingCount, website: p.websiteUri, phone: p.nationalPhoneNumber, inGap: t.inGap, licensed: LICENSED.has(t.trade) }),
      };
      const { data: ins } = await db().from("pro_leads").upsert(row, { onConflict: "source,external_id", ignoreDuplicates: true }).select("id");
      if (ins?.length) { added++; await event(ins[0].id, "found", `${TRADE_SEARCH[t.trade]} in ${t.city}`); }
    }
  }
  return { searches: list.length, added };
}

// ─── 2. Enrich: the email on their own website ─────────────────────────────

const UA = `${BRAND.name}Bot/1.0 (+${siteUrl()}/pros)`;
async function allowedByRobots(origin: string): Promise<boolean> {
  const r = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(4000) }).catch(() => null);
  if (!r?.ok) return true;
  const txt = await r.text();
  let applies = false;
  for (const line of txt.split(/\r?\n/)) {
    const [k, ...rest] = line.split(":"); const v = rest.join(":").trim();
    if (/^user-agent$/i.test(k.trim())) applies = v === "*" || v.toLowerCase().includes(BRAND.name.toLowerCase());
    else if (applies && /^disallow$/i.test(k.trim()) && v === "/") return false;
  }
  return true;
}

async function page(url: string): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(6000) }).catch(() => null);
  if (!r?.ok || !(r.headers.get("content-type") ?? "").includes("html")) return "";
  return (await r.text()).slice(0, 400000);
}

export async function enrichLeads(limit = 40): Promise<number> {
  const { data } = await db().from("pro_leads").select("id, website, phone, rating, review_count, trade, score").eq("status", "new").is("email", null).not("website", "is", null).limit(limit);
  let found = 0;
  for (const l of (data ?? []) as { id: string; website: string; phone: string | null; rating: number | null; review_count: number | null; trade: string; score: number }[]) {
    let email: string | null = null;
    try {
      const u = new URL(l.website);
      if (await allowedByRobots(u.origin)) {
        email = extractEmails(await page(u.href), u.hostname)[0] ?? null;
        for (const p of ["/contact", "/contact-us", "/about"]) { if (email) break; email = extractEmails(await page(`${u.origin}${p}`), u.hostname)[0] ?? null; }
      }
    } catch { /* bad URL */ }
    const { count: optedOut } = email ? await db().from("email_optouts").select("email", { count: "exact", head: true }).eq("email", email) : { count: 0 };
    const next = email && !optedOut ? "queued" : l.phone ? "call" : "do_not_contact";
    await db().from("pro_leads").update({ email, status: optedOut ? "unsubscribed" : next, next_send_at: next === "queued" ? new Date().toISOString() : null,
      score: Math.max(l.score, leadScore({ rating: l.rating, reviewCount: l.review_count, email, website: l.website, phone: l.phone, licensed: LICENSED.has(l.trade) })) }).eq("id", l.id);
    if (email) { found++; await event(l.id, "email_found", email); }
  }
  // no website at all: phone → call list
  await db().from("pro_leads").update({ status: "call" }).eq("status", "new").is("website", null).not("phone", "is", null);
  return found;
}

// ─── 3. Send the invitation sequence ────────────────────────────────────────

const typicalPay = new Map<string, string | null>();
function payExample(trade: string): string | null {
  if (typicalPay.has(trade)) return typicalPay.get(trade)!;
  const svc = SERVICES.find((s) => s.trades.includes(trade) && !s.siteVisit);
  const out = svc ? `${money(splitJob(estimate({ slug: svc.slug, answers: defaultAnswers(svc) }).point).payout)} for a typical ${svc.name.toLowerCase()} job` : null;
  typicalPay.set(trade, out);
  return out;
}

async function demandNear(trade: string, area: string | null): Promise<number> {
  const slugs = SERVICES.filter((s) => s.trades.includes(trade)).map((s) => s.slug);
  if (!slugs.length || !area || !/^\d{3}$/.test(area)) return 0;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ count: jobs }, { count: wait }] = await Promise.all([
    db().from("jobs").select("id", { count: "exact", head: true }).in("service_slug", slugs).like("zip", `${area}%`).gte("created_at", since).neq("status", "cancelled"),
    db().from("waitlist").select("id", { count: "exact", head: true }).in("service_slug", slugs).like("zip", `${area}%`).is("notified_at", null),
  ]);
  return (jobs ?? 0) + (wait ?? 0);
}

/** Instantly sends HTML: escape, keep line breaks, make links clickable. */
const toHtml = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}">${u}</a>`).replace(/\n/g, "<br>");

/** Hand today's best queued leads to Instantly, each with its three emails written out. Instantly sends them. */
export async function sendLeadEmails(s: LeadSettings): Promise<{ sent: number; skipped: number }> {
  if (!outreachReady()) return { sent: 0, skipped: 0 };
  const { data } = await db().from("pro_leads").select("*").eq("status", "queued").not("email", "is", null)
    .order("score", { ascending: false }).limit(s.emails_per_day);
  let sent = 0, skipped = 0;
  for (const l of (data ?? []) as { id: string; token: string; email: string; business_name: string; contact_name: string | null; trade: string; city: string | null; area: string | null; phone: string | null; website: string | null }[]) {
    // already applied (any channel) or unsubscribed → don't start
    const [{ data: app }, { count: out }] = await Promise.all([
      db().from("contractor_applications").select("id").ilike("email", l.email).limit(1).maybeSingle(),
      db().from("email_optouts").select("email", { count: "exact", head: true }).eq("email", l.email.toLowerCase()),
    ]);
    if (app) { await db().from("pro_leads").update({ status: "applied", application_id: app.id, next_send_at: null }).eq("id", l.id); skipped++; continue; }
    if (out) { await db().from("pro_leads").update({ status: "unsubscribed", next_send_at: null }).eq("id", l.id); skipped++; continue; }
    const ctx = { businessName: l.business_name, firstName: l.contact_name?.split(" ")[0] ?? null, trade: l.trade, city: l.city,
      payExample: payExample(l.trade), demand: await demandNear(l.trade, l.area), applyUrl: `${siteUrl()}/l/${l.token}`, unsubscribeUrl: unsubscribeUrl(l.email), postalAddress: process.env.BUSINESS_POSTAL_ADDRESS! };
    const variables: Record<string, string> = { handled_lead_id: l.id, apply_url: ctx.applyUrl };
    LEAD_SEQUENCE.forEach((_, i) => { const m = leadEmail({ ...ctx, step: i }); variables[`subject_${i + 1}`] = m.subject; variables[`body_${i + 1}`] = toHtml(m.text); });
    try {
      await addLeadToCampaign({ email: l.email, firstName: ctx.firstName, companyName: l.business_name, phone: l.phone, website: l.website, variables });
    } catch (e) {
      await event(l.id, "send_failed", e instanceof Error ? e.message : String(e));
      skipped++; continue;
    }
    await db().from("pro_leads").update({ status: "emailing", step: 0, next_send_at: null, last_contact_at: new Date().toISOString() }).eq("id", l.id);
    await event(l.id, "handed_to_instantly", `3-email invitation queued in Instantly`);
    sent++;
  }
  return { sent, skipped };
}

/** Instantly events (webhook): sent, opened/clicked, replied, unsubscribed, bounced. */
export async function onInstantlyEvent(e: { type: string; email: string; leadId?: string | null; step?: number | null; text?: string | null }) {
  const email = e.email.trim().toLowerCase();
  const { data: lead } = e.leadId && /^[0-9a-f-]{36}$/.test(e.leadId)
    ? await db().from("pro_leads").select("id, status, step").eq("id", e.leadId).maybeSingle()
    : await db().from("pro_leads").select("id, status, step").ilike("email", email).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!lead) return false;
  const t = e.type.toLowerCase();
  const done = ["applied", "unsubscribed", "do_not_contact"].includes(lead.status);
  if (t.includes("unsub")) {
    await db().from("email_optouts").upsert({ email });
    await db().from("pro_leads").update({ status: "unsubscribed" }).eq("id", lead.id);
  } else if (t.includes("bounce")) {
    if (!done) await db().from("pro_leads").update({ status: "bounced" }).eq("id", lead.id);
  } else if (t.includes("repl")) {
    if (!done) await db().from("pro_leads").update({ status: "replied" }).eq("id", lead.id);
    await raiseAlert("leads", "info", `A pro lead replied (${email})`, `${e.text ? `"${e.text.slice(0, 500)}"\n\n` : ""}Answer from Instantly's Unibox, then mark them in Hub → Pro leads.`);
  } else if (t.includes("click")) {
    if (["queued", "emailing"].includes(lead.status)) await db().from("pro_leads").update({ status: "clicked" }).eq("id", lead.id);
  } else if (t.includes("sent")) {
    await db().from("pro_leads").update({ step: Math.max(Number(lead.step ?? 0), Number(e.step ?? Number(lead.step ?? 0) + 1)), last_contact_at: new Date().toISOString() }).eq("id", lead.id);
  }
  await event(lead.id, `instantly:${t}`, e.text?.slice(0, 300) ?? null, "instantly");
  return true;
}

// ─── Click, conversion, call list, import, clean-up ─────────────────────────

export async function recordLeadClick(token: string): Promise<boolean> {
  if (!/^[a-z0-9]{8,40}$/.test(token)) return false;
  const { data } = await db().from("pro_leads").select("id, status").eq("token", token).maybeSingle();
  if (!data) return false;
  if (["new", "queued", "emailing", "call"].includes(data.status)) await db().from("pro_leads").update({ status: "clicked" }).eq("id", data.id);
  await event(data.id, "clicked");
  return true;
}

/** An application arrived: credit the lead it came from (by link token, else same email or phone). */
export async function markLeadConverted(applicationId: string, a: { token?: string | null; email: string; phone?: string | null }) {
  let lead: { id: string } | null = null;
  if (a.token) lead = (await db().from("pro_leads").select("id").eq("token", a.token).maybeSingle()).data;
  if (!lead) lead = (await db().from("pro_leads").select("id").ilike("email", a.email).limit(1).maybeSingle()).data;
  const digits = (a.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!lead && digits.length === 10) {
    const { data } = await db().from("pro_leads").select("id, phone").not("phone", "is", null).limit(5000);
    lead = ((data ?? []) as { id: string; phone: string }[]).find((l) => l.phone.replace(/\D/g, "").slice(-10) === digits) ?? null;
  }
  if (!lead) return null;
  await db().from("pro_leads").update({ status: "applied", application_id: applicationId, next_send_at: null }).eq("id", lead.id);
  await db().from("contractor_applications").update({ lead_id: lead.id }).eq("id", applicationId);
  await blockInInstantly(a.email); // they applied: stop the rest of the invitation sequence
  await event(lead.id, "applied");
  return lead.id;
}

export async function setLeadStatus(id: string, status: "call" | "not_interested" | "do_not_contact" | "replied" | "queued", note: string | null, actor: string) {
  await db().from("pro_leads").update({ status, next_send_at: status === "queued" ? new Date().toISOString() : null, notes: note }).eq("id", id);
  if (status === "not_interested" || status === "do_not_contact") {
    const { data } = await db().from("pro_leads").select("email").eq("id", id).single();
    if (data?.email) await blockInInstantly(data.email);
  }
  await event(id, `status:${status}`, note, actor);
}

/** CSV: business_name, contact_name, email, phone, city, zip, trade, license_number, website (any order, header row). */
export async function importLeadsCsv(csv: string, defaultTrade: string | null, actor: string): Promise<{ added: number; skipped: number }> {
  const rows = parseCsv(csv);
  if (rows.length < 2) return { added: 0, skipped: 0 };
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/[^a-z]+/g, "_"));
  const col = (r: string[], ...names: string[]) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0 && r[i]?.trim()) return r[i].trim(); } return null; };
  let added = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const name = col(r, "business_name", "business", "company", "name", "licensee_name", "licensee");
    const trade = (col(r, "trade") ?? defaultTrade ?? "").toLowerCase();
    if (!name || !TRADE_SEARCH[trade]) { skipped++; continue; }
    const email = col(r, "email", "email_address")?.toLowerCase() ?? null;
    const phone = col(r, "phone", "phone_number", "telephone");
    const license = col(r, "license_number", "license", "license_no");
    const zip = col(r, "zip", "zip_code", "postal_code")?.slice(0, 5) ?? null;
    const row = {
      source: "csv", external_id: license ?? email ?? `${name}|${phone ?? ""}`, business_name: name, contact_name: col(r, "contact_name", "owner", "contact", "first_name"),
      trade, city: col(r, "city"), zip, area: zip?.slice(0, 3) ?? null, email, phone, website: col(r, "website", "url"), license_number: license,
      status: email ? "queued" : phone ? "call" : "do_not_contact", next_send_at: email ? new Date().toISOString() : null,
      score: leadScore({ email, phone, licensed: Boolean(license) }),
    };
    const { data } = await db().from("pro_leads").upsert(row, { onConflict: "source,external_id", ignoreDuplicates: true }).select("id");
    if (data?.length) { added++; await event(data[0].id, "imported", null, actor); } else skipped++;
  }
  return { added, skipped };
}

function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim()));
}

/** Google's terms: Places content isn't kept past 30 days. Leads that never engaged lose those details (place id kept). */
export async function purgeExpiredDetails(): Promise<number> {
  const { data } = await db().from("pro_leads").update({ phone: null, rating: null, review_count: null, details_expire_at: null })
    .eq("source", "google_places").lt("details_expire_at", new Date().toISOString()).in("status", ["new", "call", "do_not_contact", "not_interested", "unsubscribed", "bounced"]).select("id");
  return data?.length ?? 0;
}

/** The daily run. */
export async function leadEngine() {
  const s = await getLeadSettings();
  if (!s.enabled) return { enabled: false };
  const discovered = await discoverLeads(s).catch((e) => { console.error("[leads discover]", e); return { searches: 0, added: 0 }; });
  const emailsFound = await enrichLeads().catch((e) => { console.error("[leads enrich]", e); return 0; });
  const sent = await sendLeadEmails(s).catch((e) => { console.error("[leads send]", e); return { sent: 0, skipped: 0 }; });
  const purged = await purgeExpiredDetails().catch(() => 0);
  if (!process.env.GOOGLE_PLACES_API_KEY || !outreachReady())
    await raiseAlert("leads", "info", "Pro lead engine is on but not fully set up", `${!process.env.GOOGLE_PLACES_API_KEY ? "GOOGLE_PLACES_API_KEY missing — no automatic discovery (CSV import still works). " : ""}${!outreachReady() ? "INSTANTLY_API_KEY / INSTANTLY_CAMPAIGN_ID / BUSINESS_POSTAL_ADDRESS missing — no leads handed to Instantly." : ""}`);
  return { enabled: true, discovered, emailsFound, sent, purged };
}
