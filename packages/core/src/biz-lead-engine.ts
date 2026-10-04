/*
 * FILE    : packages/core/src/biz-lead-engine.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Business sales engine rules (demand side; the pro lead engine is lead-engine.ts):
 *             BIZ_SEGMENTS   — who we sell to and what to offer each: property managers (unit turnovers,
 *                              cleanouts, make-readies), real estate brokerages (move-out cleans, listing
 *                              prep), home stagers (furniture moves), self-storage (abandoned-unit cleanouts),
 *                              furniture & appliance stores (same-day delivery)
 *             bizLeadScore   — 0–100: reachable by email, established (reviews), size signals
 *             bizLeadEmail   — 3 emails (day 0, 4, 10) with a pilot offer; honest, CAN-SPAM footer
 *           Cold email to businesses only; LinkedIn and phone stay manual (no automated texts — TCPA).
 */
import { BRAND } from "./brand.ts";

export type BizSegment = "property_manager" | "real_estate" | "stager" | "storage" | "retail";

export const BIZ_SEGMENTS: Record<BizSegment, { label: string; search: string; services: string[]; hook: string; pilotJob: string }> = {
  property_manager: { label: "Property managers", search: "property management company", services: ["unit-turnover", "junk-removal", "house-cleaning", "handyman", "lawn-care", "snow-removal"],
    hook: "rent-ready unit turnovers in one booking: cleanout, deep clean, touch-ups and a punch list, with before-and-after photos of every room", pilotJob: "your next unit turnover" },
  real_estate: { label: "Real estate brokerages", search: "real estate agency", services: ["house-cleaning", "junk-removal", "power-washing", "handyman", "staging-transport"],
    hook: "listing prep and move-out deep cleans booked in a minute, with photos your clients can see", pilotJob: "your next listing prep or move-out clean" },
  stager: { label: "Home stagers", search: "home staging company", services: ["staging-transport", "house-cleaning", "junk-removal"],
    hook: "staging furniture picked up, delivered, placed and picked up again when the listing closes — one booking for both trips", pilotJob: "your next staging install" },
  storage: { label: "Self-storage facilities", search: "self storage facility", services: ["junk-removal", "junk-container", "small-moves", "power-washing", "snow-removal"],
    hook: "abandoned-unit cleanouts and haul-away on call, plus moving help you can offer your tenants", pilotJob: "your next unit cleanout" },
  retail: { label: "Furniture & appliance stores", search: "furniture store", services: ["retail-delivery", "large-item-removal", "junk-removal"],
    hook: "same-day large-item delivery for your customers by a 2-person crew, with haul-away of the old piece and photo proof", pilotJob: "your next customer deliveries" },
};

export interface BizLeadFacts { rating?: number | null; reviewCount?: number | null; email?: string | null; website?: string | null; phone?: string | null }

/** 0–100. Reachable by email matters most; a real, reviewed local business next. */
export function bizLeadScore(l: BizLeadFacts): number {
  let s = 0;
  const r = Number(l.rating ?? 0), n = Number(l.reviewCount ?? 0);
  if (l.email) s += 40; else if (l.phone) s += 10;
  if (l.website) s += 10;
  if (r) s += Math.max(0, Math.min(20, (r - 3.5) * 13));
  s += n >= 20 ? 30 : n >= 5 ? 18 : n > 0 ? 8 : 0;
  return Math.round(Math.min(100, s));
}

export const BIZ_LEAD_SEQUENCE = [0, 4, 10] as const;

export interface BizLeadEmailCtx {
  step: number;
  businessName: string;
  firstName?: string | null;
  segment: BizSegment;
  city?: string | null;
  pilotPct: number;
  pilotJobs: number;
  signupUrl: string;
  unsubscribeUrl: string;
  postalAddress: string;
}

/** The invitation sequence (plain text; the sender turns it into HTML). */
export function bizLeadEmail(c: BizLeadEmailCtx): { subject: string; text: string } {
  const seg = BIZ_SEGMENTS[c.segment];
  const hi = c.firstName ? `Hi ${c.firstName},` : `Hi ${c.businessName} team,`;
  const where = c.city ? ` in ${c.city}` : " around Detroit";
  const pilot = c.pilotPct > 0 && c.pilotJobs > 0 ? `up to ${c.pilotPct}% off ${c.pilotJobs === 1 ? "your first job" : `your first ${c.pilotJobs} jobs`}` : null;
  const foot = `\n\n—\n${BRAND.legalName} · ${c.postalAddress}\nThis is a business email from ${BRAND.name}. Not interested? One click and we won't email again: ${c.unsubscribeUrl}`;
  const bodies = [
    {
      subject: `${seg.pilotJob[0].toUpperCase()}${seg.pilotJob.slice(1)}${pilot ? `, ${pilot}` : ""}`,
      text: `${hi}\n\nI'm reaching out from ${BRAND.name}, a home and business services company${where}. We handle ${seg.hook}.\n\n• Vetted, insured, background-checked pros\n• Upfront prices, booked in about a minute, with live arrival tracking\n• Every property on one business account; your favorite pros get your jobs first\n• If a job isn't right, we redo it free or refund it\n\n${pilot ? `To try us, ${seg.pilotJob} is ${pilot}. ` : ""}Set up your account in two minutes: ${c.signupUrl}\n\nThanks,\nThe ${BRAND.name} team`,
    },
    {
      subject: `Re: ${seg.pilotJob}`,
      text: `${hi}\n\nQuick follow-up. Teams like yours use ${BRAND.name} so they can stop chasing contractors: one account, upfront prices, photos of every job and one monthly view of everything.${pilot ? ` The pilot offer (${pilot}) still stands.` : ""}\n\nTwo-minute setup: ${c.signupUrl}\n\nThe ${BRAND.name} team`,
    },
    {
      subject: `Last note from ${BRAND.name}`,
      text: `${hi}\n\nI won't keep emailing. If ${seg.pilotJob}${where} ever needs a reliable crew, the door's open: ${c.signupUrl}\n\nBest,\nThe ${BRAND.name} team`,
    },
  ];
  const m = bodies[Math.min(c.step, bodies.length - 1)];
  return { subject: m.subject, text: m.text + foot };
}
