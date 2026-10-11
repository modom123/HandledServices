/*
 * FILE    : packages/core/src/lead-engine.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0206 UTC
 * PURPOSE : Pro lead engine rules (pure, tested):
 *             TRADE_SEARCH   — what to search for each trade (Google Places text search)
 *             leadScore      — 0–100: reviews, rating, reachable by email, in a supply gap
 *             extractEmails  — contact emails from a business's own web page, best first
 *             LEAD_SEQUENCE  — 3 emails (day 0, 3, 8), then stop
 *             leadEmail      — the invitation copy (honest, specific, with unsubscribe + address)
 * UPDATED : 2026-10-03_1413 UTC — the pay example in the invitation is labeled an estimate.
 * UPDATED : 2026-10-05_0438 UTC — security trade.
 * UPDATED : 2026-10-06_0526 UTC — wildlife trade (dead animal removal).
 * UPDATED : 2026-10-06_0637 UTC — trades: small engine, dock & door, fire extinguisher, foundation, used oil.
 * UPDATED : 2026-10-11_0608 UTC — remote trades: web design, business formation, consulting, AI automation.
 * UPDATED : 2026-10-11_1625 UTC — pickHunterEmail: the best outreach address from a Hunter.io domain search (owner for pros,
 *           facilities / operations / office manager for business customers; confident, own domain, never jobs/HR/billing).
 */
import { BRAND } from "./brand.ts";

/** Google Places text-search phrase per trade ("<phrase> near <city>"). */
export const TRADE_SEARCH: Record<string, string> = {
  cleaning: "house cleaning service", windows: "window cleaning service", carpet: "carpet cleaning", organizing: "professional organizer",
  gutters: "gutter cleaning", lawn: "lawn care service", tree: "tree service", snow: "snow removal service", pet_waste: "pet waste removal",
  pet_care: "dog walker", pressure_washing: "pressure washing service", errands: "courier service", medical_courier: "medical courier",
  auto_detailing: "mobile car detailing", hauling: "junk removal", wildlife: "wildlife removal", waste_oil: "used oil recycling service", dumpster: "dumpster rental", handyman: "handyman",
  small_engine: "small engine repair", dock_door: "commercial overhead door repair", fire_safety: "fire extinguisher service", foundation: "foundation repair contractor",
  remodel: "remodeling contractor", painting: "house painter", plumbing: "plumber", electrical: "electrician", hvac: "HVAC contractor",
  low_voltage: "security camera installer", transportation: "limousine service", event_planner: "event planner", catering: "caterer",
  food_truck: "food truck", dj_music: "DJ service", rentals: "party rental", venue: "event venue",
  security: "security guard company",
  recruiter: "independent recruiter",
  web_design: "web design agency", business_formation: "business formation service", consulting: "small business consultant", ai_automation: "AI automation agency",
  freight: "trucking company",
};

/** Plain-English trade name for the email ("house cleaning", "electrical"). */
export const TRADE_WORD: Record<string, string> = {
  cleaning: "house cleaning", windows: "window cleaning", carpet: "carpet cleaning", organizing: "organizing", gutters: "gutter cleaning",
  lawn: "lawn care", tree: "tree work", snow: "snow removal", pet_waste: "pet waste removal", pet_care: "dog walking and pet sitting",
  pressure_washing: "power washing", errands: "courier and errands", medical_courier: "medical courier", auto_detailing: "car detailing",
  hauling: "junk removal", wildlife: "dead animal removal", waste_oil: "used oil pickup", dumpster: "container rental", handyman: "handyman",
  small_engine: "small engine repair", dock_door: "dock and door service", fire_safety: "fire extinguisher service", foundation: "foundation repair", remodel: "remodeling", painting: "painting",
  plumbing: "plumbing", electrical: "electrical", hvac: "HVAC", low_voltage: "camera and low-voltage", transportation: "transportation",
  event_planner: "event planning", catering: "catering", food_truck: "food truck", dj_music: "DJ and music", rentals: "event rentals", venue: "event venue",
  security: "event security",
  recruiter: "recruiting",
  web_design: "web design", business_formation: "business formation", consulting: "business consulting", ai_automation: "AI automation",
  freight: "freight delivery",
};

export interface LeadFacts { rating?: number | null; reviewCount?: number | null; email?: string | null; website?: string | null; phone?: string | null; inGap?: boolean; licensed?: boolean }

/** 0–100. Established-but-small beats huge: 10–150 reviews is the sweet spot for "wants more work". */
export function leadScore(l: LeadFacts): number {
  let s = 0;
  const r = Number(l.rating ?? 0), n = Number(l.reviewCount ?? 0);
  if (r) s += Math.max(0, Math.min(30, (r - 3.5) * 20));        // 4.0★ → 10, 5.0★ → 30
  s += n >= 10 && n <= 150 ? 20 : n > 150 ? 10 : n >= 3 ? 8 : 0;
  if (l.email) s += 25; else if (l.phone) s += 8;
  if (l.website) s += 5;
  if (l.inGap) s += 15;
  if (l.licensed) s += 5;
  return Math.round(Math.min(100, s));
}

const JUNK = /(example\.|sentry|wixpress|godaddy|domain\.com|yourname|email\.com|@2x|\.png|\.jpg|\.webp|\.svg|noreply|no-reply|privacy@|abuse@|webmaster@)/i;
const PREFERRED = /^(info|contact|office|hello|service|sales|book|admin|support)@/i;

/** Emails found on a business's own page; same-domain and "info@"-style first; junk removed. */
export function extractEmails(html: string, siteHost?: string | null): string[] {
  const found = new Set<string>();
  const text = html.replace(/&#64;|\[at\]|\(at\)/gi, "@").replace(/%40/g, "@");
  for (const m of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const e = m[0].toLowerCase().replace(/^mailto:/, "").replace(/[.,;]+$/, "");
    if (!JUNK.test(e) && e.length < 80) found.add(e);
  }
  const host = (siteHost ?? "").replace(/^www\./, "").toLowerCase();
  const rank = (e: string) => (host && e.endsWith(`@${host}`) ? 0 : 2) + (PREFERRED.test(e) ? 0 : 1);
  return [...found].sort((a, b) => rank(a) - rank(b));
}

/** One address from a Hunter.io domain search (GET /v2/domain-search). */
export interface HunterEmail {
  value: string;
  type?: "personal" | "generic" | null;
  confidence?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  verification?: { status?: string | null } | null;
}

/** Who we want to reach: a pro company's owner, or the person at a business who buys services. */
export type HunterTarget = "owner" | "decision_maker";

const HUNTER_MIN_CONFIDENCE = 70;
const NOT_FOR_OUTREACH = /^(jobs|careers|hr|recruit\w*|privacy|legal|abuse|webmaster|postmaster|billing|accounting|invoices?|ap|payroll|press|media|investors?)@/;
const OWNER_ROLE = /owner|founder|president|ceo|principal|proprietor|partner/i;
const BUYER_ROLE = /facilit|property|building|maintenance|office manager|operations|purchas|procure|general manager|owner|president|ceo|founder|director|administrator/i;
const GENERIC_OK = /^(info|office|contact|hello|sales|service|admin|team|manager)@/;

/**
 * The best address for an outreach email from a Hunter.io domain search: on the business's own domain, confident
 * (70%+), not marked invalid, never a no-reply / jobs / HR / billing inbox; then the right role first (owner for pros,
 * facilities / operations / office manager for business customers), then a general inbox, then confidence.
 */
export function pickHunterEmail(emails: HunterEmail[], domain: string, target: HunterTarget): { email: string; name: string | null; position: string | null; confidence: number } | null {
  const host = domain.replace(/^www\./, "").toLowerCase();
  const role = target === "owner" ? OWNER_ROLE : BUYER_ROLE;
  const ok = emails.filter((e) => {
    const v = (e.value ?? "").toLowerCase();
    const at = v.split("@")[1] ?? "";
    return v.length < 80 && (at === host || at.endsWith(`.${host}`) || (host.endsWith(`.${at}`) && at.includes("."))) && !JUNK.test(v) && !NOT_FOR_OUTREACH.test(v)
      && (e.confidence ?? 0) >= HUNTER_MIN_CONFIDENCE && e.verification?.status !== "invalid";
  });
  const score = (e: HunterEmail) => (e.position && role.test(e.position) ? 40 : 0) + (GENERIC_OK.test(e.value.toLowerCase()) ? 20 : 0) + (e.confidence ?? 0) / 10;
  const best = ok.sort((a, b) => score(b) - score(a))[0];
  if (!best) return null;
  const name = [best.first_name, best.last_name].filter(Boolean).join(" ").trim() || null;
  return { email: best.value.toLowerCase(), name, position: best.position ?? null, confidence: best.confidence ?? 0 };
}

/** Days after the first email for each step. After the last one, we stop. */
export const LEAD_SEQUENCE = [0, 3, 8] as const;
export function nextSendAt(stepsSent: number, from = new Date()): Date | null {
  if (stepsSent >= LEAD_SEQUENCE.length) return null;
  const gap = LEAD_SEQUENCE[stepsSent] - (LEAD_SEQUENCE[stepsSent - 1] ?? 0);
  return new Date(from.getTime() + gap * 86400000);
}

export interface LeadEmailCtx {
  step: number;
  businessName: string;
  firstName?: string | null;
  trade: string;
  city?: string | null;
  /** A real example from the pricing engine: "$63 for a standard mow". */
  payExample?: string | null;
  /** Real demand only (from bookings / waitlist) — omitted when we don't have it. */
  demand?: number | null;
  applyUrl: string;
  unsubscribeUrl: string;
  postalAddress: string;
}

/** The invitation. Honest and specific; identifies itself as a business solicitation (CAN-SPAM). */
export function leadEmail(c: LeadEmailCtx): { subject: string; text: string } {
  const hi = c.firstName ? `Hi ${c.firstName},` : `Hi ${c.businessName} team,`;
  const trade = TRADE_WORD[c.trade] ?? c.trade;
  const where = c.city ? ` in ${c.city}` : " around Detroit";
  const demand = c.demand && c.demand > 0 ? `Right now we have ${c.demand} ${trade} request${c.demand === 1 ? "" : "s"}${where} and not enough pros to cover them. ` : "";
  const pay = c.payExample ? ` (an estimate at today's suggested prices: about ${c.payExample})` : "";
  const foot = `\n\n—\n${BRAND.legalName} · ${c.postalAddress}\nThis is a business invitation from ${BRAND.name}. Not interested? One click and we won't email again: ${c.unsubscribeUrl}\n¿Prefiere español? ${c.applyUrl}${c.applyUrl.includes("?") ? "&" : "?"}lang=es`;
  const bodies = [
    {
      subject: `More ${trade} jobs${where} — paid upfront, no lead fees`,
      text: `${hi}\n\nI'm reaching out from ${BRAND.name}, a new home-services company${where}. ${demand}We send independent pros like ${c.businessName} prepaid, pre-scoped jobs near them — you see the pay before you accept${pay}, and you can pass or name your own price.\n\n• No lead fees, no subscription — we only earn when you get paid\n• The customer pays upfront; you're paid weekly (or instantly)\n• You pick the jobs, the days and how far you drive; keep your own customers\n\nIt takes about 5 minutes to apply: ${c.applyUrl}\n\nThanks,\nThe ${BRAND.name} team`,
    },
    {
      subject: `Re: ${trade} jobs${where}`,
      text: `${hi}\n\nQuick follow-up. Pros on ${BRAND.name} fill gaps in their week with nearby jobs that are already paid for — no quoting, no chasing invoices. If a job isn't worth it to you, counter with the pay you want and the customer decides.\n\nApply in 5 minutes: ${c.applyUrl}\n\nThe ${BRAND.name} team`,
    },
    {
      subject: `Last note from ${BRAND.name}`,
      text: `${hi}\n\nI won't keep emailing. If extra ${trade} work${where} would help — prepaid jobs, weekly payouts, no fees to you — the door's open: ${c.applyUrl}\n\nEither way, best of luck this season.\nThe ${BRAND.name} team`,
    },
  ];
  const b = bodies[Math.min(c.step, bodies.length - 1)];
  return { subject: b.subject, text: b.text + foot };
}
