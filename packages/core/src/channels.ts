/*
 * FILE    : packages/core/src/channels.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Omnichannel lead intake and channel reporting (Hub → Lead inbox) and the social calendar (Hub → Social).
 *             CHANNELS        — every place a customer can come from: ads, social, search, reviews, outbound, owned
 *             channelOf       — a booking's or lead's first-touch attribution (utm_*, gclid, fbclid, ttclid, referrer)
 *                               → one channel id, so leads and bookings are counted the same way
 *             normalizeIntake — any lead payload (Zapier / Make, Meta Lead Ads field_data, Google Ads lead forms,
 *                               the website form) → one lead row; tolerant of field names
 *             speedToLeadText — the instant reply when the AI is off (honest: no prices, a booking link and a call)
 *             SOCIAL_CHANNELS / socialSlots / fitCaption — the weekly posting plan and each network's limits
 */
import { BRAND } from "./brand.ts";
import { SERVICE_BY_SLUG } from "./services.ts";

export type ChannelKind = "paid" | "social" | "search" | "reviews" | "outbound" | "owned" | "partner";
export interface Channel { id: string; label: string; emoji: string; kind: ChannelKind }

export const CHANNELS: Channel[] = [
  { id: "facebook", label: "Facebook", emoji: "📘", kind: "social" },
  { id: "instagram", label: "Instagram", emoji: "📸", kind: "social" },
  { id: "tiktok", label: "TikTok", emoji: "🎵", kind: "social" },
  { id: "meta_ads", label: "Meta ads (Facebook / Instagram)", emoji: "📣", kind: "paid" },
  { id: "tiktok_ads", label: "TikTok ads", emoji: "📣", kind: "paid" },
  { id: "google_ads", label: "Google Ads", emoji: "🔎", kind: "paid" },
  { id: "google_lsa", label: "Google Local Services", emoji: "✅", kind: "paid" },
  { id: "applovin", label: "AppLovin", emoji: "📱", kind: "paid" },
  { id: "google", label: "Google search & Maps", emoji: "🗺️", kind: "search" },
  { id: "bing", label: "Bing", emoji: "🔍", kind: "search" },
  { id: "yelp", label: "Yelp", emoji: "⭐", kind: "reviews" },
  { id: "linkedin", label: "LinkedIn", emoji: "💼", kind: "social" },
  { id: "email", label: "Email", emoji: "✉️", kind: "outbound" },
  { id: "phone", label: "Phone", emoji: "📞", kind: "outbound" },
  { id: "sms", label: "Text message", emoji: "💬", kind: "outbound" },
  { id: "website", label: "Website form", emoji: "🌐", kind: "owned" },
  { id: "ai_chat", label: "Website AI chat", emoji: "🤖", kind: "owned" },
  { id: "referral", label: "Referral / partner", emoji: "🤝", kind: "partner" },
  { id: "direct", label: "Direct / unknown", emoji: "➡️", kind: "owned" },
  { id: "other", label: "Other", emoji: "•", kind: "owned" },
];
export const CHANNEL_BY_ID: Record<string, Channel> = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));
export const channelLabel = (id: string | null | undefined) => CHANNEL_BY_ID[id ?? ""]?.label ?? (id || "Direct / unknown");

const ALIASES: [RegExp, string][] = [
  [/^(fb|facebook|facebook\.com|m\.facebook\.com|l\.facebook\.com|lm\.facebook\.com)$/, "facebook"],
  [/^(ig|instagram|instagram\.com|l\.instagram\.com)$/, "instagram"],
  [/^(tiktok|tiktok\.com|vm\.tiktok\.com)$/, "tiktok"],
  [/^(meta|meta_ads|facebook_ads|fb_ads|ig_ads|instagram_ads)$/, "meta_ads"],
  [/^(tiktok_ads|tt_ads)$/, "tiktok_ads"],
  [/^(google_ads|adwords|gads|ppc)$/, "google_ads"],
  [/^(lsa|google_lsa|local_services|localservices)$/, "google_lsa"],
  [/^(applovin|axon)$/, "applovin"],
  [/^(google|google\.com|www\.google\.com|maps\.google\.com|gbp|google_business|gmb)$/, "google"],
  [/^(bing|bing\.com|www\.bing\.com)$/, "bing"],
  [/^(yelp|yelp\.com|www\.yelp\.com|m\.yelp\.com)$/, "yelp"],
  [/^(linkedin|linkedin\.com|www\.linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/^(email|newsletter|instantly|mail)$/, "email"],
  [/^(sms|text)$/, "sms"],
  [/^(phone|call)$/, "phone"],
  [/^(web|website|site|contact_form)$/, "website"],
  [/^(ai_chat|chat|concierge)$/, "ai_chat"],
  [/^(referral|partner|iebc)$/, "referral"],
  [/^(direct|none)$/, "direct"],
];

/** One channel id from a source name, a referrer host, or a full first-touch record. Paid clicks win over organic. */
export function channelOf(a: Record<string, unknown> | string | null | undefined): string {
  if (!a) return "direct";
  if (typeof a === "string") a = { source: a };
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim().toLowerCase() : "");
  const medium = s("utm_medium");
  const paid = /cpc|ppc|paid|ads?$|display|social_paid|paidsocial/.test(medium);
  if (s("gclid") || s("gbraid") || s("wbraid")) return "google_ads";
  if (s("ttclid")) return "tiktok_ads";
  const src = s("utm_source") || s("source") || s("referrer");
  const host = src.replace(/^https?:\/\//, "").split("/")[0];
  for (const [re, id] of ALIASES) if (re.test(host)) {
    if (paid && (id === "facebook" || id === "instagram")) return "meta_ads";
    if (paid && id === "tiktok") return "tiktok_ads";
    if (paid && id === "google") return "google_ads";
    return id;
  }
  if (s("fbclid")) return paid ? "meta_ads" : "facebook";
  if (/google\./.test(host)) return paid ? "google_ads" : "google";
  if (/facebook\./.test(host)) return "facebook";
  return host ? "other" : "direct";
}

export interface IntakeLead {
  name: string | null; email: string | null; phone: string | null; company: string | null; zip: string | null; city: string | null;
  service_slug: string | null; message: string | null; channel: string; campaign: string | null; external_id: string | null;
  sms_consent: boolean; attribution: Record<string, string> | null;
}

const clean = (v: unknown, max = 300) => {
  const t = Array.isArray(v) ? v[0] : v;
  return typeof t === "string" || typeof t === "number" ? String(t).trim().slice(0, max) || null : null;
};
const yes = (v: unknown) => v === true || (typeof v === "string" && /^(true|yes|y|1|on|checked|agree|i agree)$/i.test(v.trim()));
const key = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Common ways people describe the work, checked before the catalog words. */
const SERVICE_PHRASES: [RegExp, string][] = [
  [/move[- ]?out|move[- ]?in clean|deep clean|maid|janitor|office clean|house ?clean|cleaning service/, "house-cleaning"],
  [/carpet|rug|upholster/, "carpet-cleaning"],
  [/window/, "window-cleaning"],
  [/gutter/, "gutter-cleaning"],
  [/lawn|mow|landscap|yard work|grass/, "lawn-care"],
  [/paint/, "interior-painting"],
];
const stem = (w: string) => w.replace(/(ing|ers|er|es|s)$/, "");

/** Find a service from free text ("need my carpets cleaned" → carpet-cleaning). */
export function guessService(text: string | null | undefined): string | null {
  const t = (text ?? "").toLowerCase();
  if (!t) return null;
  if (SERVICE_BY_SLUG[t]) return t;
  for (const [re, slug] of SERVICE_PHRASES) if (re.test(t) && SERVICE_BY_SLUG[slug]) return slug;
  let best: { slug: string; hits: number } | null = null;
  for (const s of Object.values(SERVICE_BY_SLUG)) {
    const words = `${s.slug.replace(/-/g, " ")} ${s.name}`.toLowerCase().split(/[^a-z]+/).map(stem).filter((w) => w.length > 3);
    const hits = new Set(words.filter((w) => t.includes(w))).size;
    if (hits && (!best || hits > best.hits)) best = { slug: s.slug, hits };
  }
  return best?.slug ?? null;
}

/**
 * Any lead payload → one row. Accepts flat objects with common field names (Zapier / Make / website), Meta's
 * `field_data: [{ name, values }]` and Google Ads' `user_column_data: [{ column_id, string_value }]`.
 */
export function normalizeIntake(raw: Record<string, unknown>, channelHint?: string | null): IntakeLead {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (v != null && typeof v !== "object") flat[key(k)] = v;
  for (const f of Array.isArray(raw.field_data) ? raw.field_data : []) { const o = f as { name?: string; values?: unknown[] }; if (o?.name) flat[key(o.name)] = o.values?.[0]; }
  for (const f of Array.isArray(raw.user_column_data) ? raw.user_column_data : []) { const o = f as { column_id?: string; column_name?: string; string_value?: string }; if (o?.column_id) flat[key(o.column_id)] = o.string_value; if (o?.column_name) flat[key(o.column_name)] ??= o.string_value; }
  for (const [k, v] of Object.entries(raw.answers && typeof raw.answers === "object" ? (raw.answers as Record<string, unknown>) : {})) flat[key(k)] ??= v;
  const get = (...names: string[]) => { for (const n of names) { const v = clean(flat[key(n)]); if (v) return v; } return null; };
  const first = get("first_name", "firstname", "given_name"), last = get("last_name", "lastname", "family_name");
  const email = get("email", "email_address", "work_email", "business_email")?.toLowerCase() ?? null;
  const phoneRaw = get("phone", "phone_number", "mobile", "mobile_phone", "work_phone", "cell", "telephone");
  const digits = phoneRaw?.replace(/[^\d+]/g, "") ?? "";
  const message = get("message", "comments", "comment", "notes", "details", "description", "what_do_you_need", "project_details", "question", "inquiry");
  const service = get("service", "service_slug", "service_type", "interest", "what_service", "job_type", "category");
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gcl_id", "fbclid", "ttclid", "referrer", "landing"]) { const v = get(k); if (v) utm[k === "gcl_id" ? "gclid" : k] = v; }
  const hint = channelHint ? channelOf(channelHint) : null;
  const channel = hint && hint !== "other" && hint !== "direct" ? hint : channelOf({ ...utm, source: get("channel", "source", "platform", "lead_source") ?? undefined });
  return {
    name: get("full_name", "name", "fullname", "contact_name") ?? ([first, last].filter(Boolean).join(" ") || null),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    phone: digits.replace(/\D/g, "").length >= 10 ? phoneRaw : null,
    company: get("company", "company_name", "business", "business_name", "organization", "companyname"),
    zip: get("zip", "zip_code", "postal_code", "zipcode", "postcode")?.match(/\d{5}/)?.[0] ?? null,
    city: get("city", "town"),
    service_slug: guessService(service) ?? guessService(message),
    message: [service && !guessService(service) ? `Interested in: ${service}` : null, message].filter(Boolean).join("\n").slice(0, 3000) || null,
    channel: CHANNEL_BY_ID[channel] ? channel : "other",
    campaign: get("campaign", "campaign_name", "utm_campaign", "ad_name", "form_name", "campaign_id"),
    external_id: get("lead_id", "leadgen_id", "id", "external_id", "yelp_lead_id"),
    sms_consent: yes(flat[key("sms_consent")]) || yes(flat[key("text_consent")]) || yes(flat[key("consent_to_text")]),
    attribution: Object.keys(utm).length ? utm : null,
  };
}

/** The instant reply when the AI is unavailable. Honest: no prices or promises, a booking link and a call. */
export function speedToLeadText(l: Pick<IntakeLead, "name" | "service_slug" | "company">, o: { siteUrl: string; phone?: string | null }): { subject: string; text: string } {
  const first = l.name?.split(" ")[0];
  const svc = l.service_slug ? SERVICE_BY_SLUG[l.service_slug] : null;
  const book = `${o.siteUrl}/book${svc ? `?service=${svc.slug}&utm_source=speed_to_lead` : "?utm_source=speed_to_lead"}`;
  return {
    subject: `${BRAND.name}: we got your request${svc ? ` for ${svc.name.toLowerCase()}` : ""}`,
    text: [
      `Hi${first ? ` ${first}` : ""},`,
      "",
      `Thanks for reaching out to ${BRAND.name}${l.company ? ` about ${l.company}` : ""}. A real person on our team will call you shortly${o.phone ? ` from ${o.phone}` : ""}.`,
      "",
      svc ? `If you'd like to see your price and pick a time now, you can book ${svc.name.toLowerCase()} here: ${book}` : `If you'd like to see prices and pick a time now, you can book here: ${book}`,
      "",
      "Just reply to this email with any questions or photos of the job.",
      "",
      `— The ${BRAND.name} team`,
    ].join("\n"),
  };
}

export type SocialChannel = "facebook" | "instagram" | "tiktok";
export const SOCIAL_CHANNELS: Record<SocialChannel, { label: string; maxCaption: number; maxHashtags: number; needsMedia: boolean; video: boolean; bestHourUtc: number }> = {
  facebook: { label: "Facebook", maxCaption: 5000, maxHashtags: 5, needsMedia: false, video: false, bestHourUtc: 17 },
  instagram: { label: "Instagram", maxCaption: 2200, maxHashtags: 30, needsMedia: true, video: false, bestHourUtc: 16 },
  tiktok: { label: "TikTok", maxCaption: 2200, maxHashtags: 8, needsMedia: true, video: true, bestHourUtc: 23 },
};

/** Posting slots for the week starting `weekStart` (a Monday): `perWeek` posts spread over the week at the channel's best hour. */
export function socialSlots(weekStart: Date, channel: SocialChannel, perWeek: number): string[] {
  const n = Math.max(0, Math.min(7, Math.round(perWeek)));
  const plan: number[][] = [[], [2], [1, 3], [0, 2, 4], [0, 1, 3, 4], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6]];
  const days = plan[n];
  return days.map((d) => { const t = new Date(weekStart); t.setUTCDate(t.getUTCDate() + d); t.setUTCHours(SOCIAL_CHANNELS[channel].bestHourUtc, 0, 0, 0); return t.toISOString(); });
}

/** Caption + hashtags trimmed to the network's limits (hashtags capped, never cut mid-tag). */
export function fitCaption(channel: SocialChannel, caption: string, hashtags: string[]): string {
  const c = SOCIAL_CHANNELS[channel];
  const tags = [...new Set(hashtags.map((h) => `#${h.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`).filter((h) => h.length > 1))].slice(0, c.maxHashtags);
  const tail = tags.length ? `\n\n${tags.join(" ")}` : "";
  const room = c.maxCaption - tail.length;
  const body = caption.trim().length > room ? `${caption.trim().slice(0, room - 1).replace(/\s+\S*$/, "")}…` : caption.trim();
  return `${body}${tail}`;
}
