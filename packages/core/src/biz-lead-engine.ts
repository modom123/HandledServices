/*
 * FILE    : packages/core/src/biz-lead-engine.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Business sales engine rules (demand side; the pro lead engine is lead-engine.ts):
 *             BIZ_SEGMENTS   — who we sell to and what to offer each: property managers (unit turnovers,
 *                              cleanouts, make-readies), real estate brokerages (move-out cleans, listing
 *                              prep), home stagers (furniture moves), self-storage (abandoned-unit cleanouts),
 *                              furniture & appliance stores (same-day delivery)
 *             bizLeadScore   — 0–100: reachable by email, established (reviews), size signals
 *             bizLeadEmail   — 3 emails (day 0, 4, 10) with a pilot offer; honest, CAN-SPAM footer
 *           Cold email to businesses only; LinkedIn and phone stay manual (no automated texts — TCPA).
 * UPDATED : 2026-10-05_0130 UTC — job-posting track (from the owner's cover letter): a business that posted a job (Indeed and
 *           similar) for a cleaner, handyman, maintenance tech, groundskeeper or mover gets "book the work as a
 *           service instead of hiring for it": cost comparison, upfront prices, vetted pros, guarantee, pilot offer.
 *           bizLeadEmail uses it when the lead has a job title; bizCoverLetter is the same letter for sending by hand.
 *           Leads are added by hand in the Hub (job sites don't allow scraping). New segment: offices & facilities.
 * UPDATED : 2026-10-05_2134 UTC — teaming partners (segment 'partner'): tracked as leads, never sent the sales sequence or blasts.
 * UPDATED : 2026-10-06_0606 UTC — cleaning push: property managers and offices lead with cleaning (move-out cleans, recurring office cleaning).
 */
import { BRAND } from "./brand.ts";

export type BizSegment = "property_manager" | "real_estate" | "stager" | "storage" | "retail" | "facilities";

/**
 * Teaming partners (firms we bid public contracts with) live in biz_leads too, so they're tracked in one place,
 * but they are never sold to: no discovery, no email sequence, no Email Center blasts. Outreach is by hand.
 */
export const BIZ_PARTNER_SEGMENT = "partner";
export const BIZ_PARTNER_LABEL = "Teaming partner (public bids)";

export const BIZ_SEGMENTS: Record<BizSegment, { label: string; search: string; services: string[]; hook: string; pilotJob: string }> = {
  property_manager: { label: "Property managers", search: "property management company", services: ["house-cleaning", "unit-turnover", "carpet-cleaning", "window-cleaning", "junk-removal", "handyman"],
    hook: "move-out deep cleans and rent-ready turnovers booked in a minute: the clean, carpets and windows, plus touch-ups and haul-away when a unit needs them, with before-and-after photos of every room", pilotJob: "your next move-out clean" },
  real_estate: { label: "Real estate brokerages", search: "real estate agency", services: ["house-cleaning", "junk-removal", "power-washing", "handyman", "staging-transport"],
    hook: "listing prep and move-out deep cleans booked in a minute, with photos your clients can see", pilotJob: "your next listing prep or move-out clean" },
  stager: { label: "Home stagers", search: "home staging company", services: ["staging-transport", "house-cleaning", "junk-removal"],
    hook: "staging furniture picked up, delivered, placed and picked up again when the listing closes — one booking for both trips", pilotJob: "your next staging install" },
  storage: { label: "Self-storage facilities", search: "self storage facility", services: ["junk-removal", "junk-container", "small-moves", "power-washing", "snow-removal"],
    hook: "abandoned-unit cleanouts and haul-away on call, plus moving help you can offer your tenants", pilotJob: "your next unit cleanout" },
  retail: { label: "Furniture & appliance stores", search: "furniture store", services: ["retail-delivery", "large-item-removal", "junk-removal"],
    hook: "same-day large-item delivery for your customers by a 2-person crew, with haul-away of the old piece and photo proof", pilotJob: "your next customer deliveries" },
  facilities: { label: "Offices, hotels & facilities", search: "office building management", services: ["house-cleaning", "window-cleaning", "carpet-cleaning", "power-washing", "handyman", "junk-removal"],
    hook: "office and common-area cleaning on your schedule (nightly, weekly or monthly), plus carpets and windows, by the same vetted crew each visit, with photos of every clean", pilotJob: "your first office cleaning" },
};

/** What a job posting's title tells us they need (job-posting track). */
export function jobPostNeed(jobTitle: string): { work: string; examples: string } {
  const t = jobTitle.toLowerCase();
  if (/clean|janitor|custodian|housekeep|porter|maid/.test(t)) return { work: "cleaning", examples: "turnover and move-out cleans, recurring office and common-area cleaning, and deep cleans" };
  if (/landscap|lawn|grounds|snow|garden/.test(t)) return { work: "grounds work", examples: "lawn care, landscaping clean-ups, snow removal and power washing" };
  if (/mover|moving|deliver|driver|haul|junk/.test(t)) return { work: "moving and hauling", examples: "small moves, deliveries, cleanouts and haul-away" };
  if (/paint/.test(t)) return { work: "painting", examples: "unit repaints, touch-ups and make-readies" };
  return { work: "maintenance and repairs", examples: "handyman repairs, make-ready punch lists, fixture and appliance installs, cleanouts and turnovers" };
}

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
  /** Job-posting track: the role they posted (e.g. "Maintenance Technician") and where (e.g. "Indeed"). */
  jobTitle?: string | null;
  postingSource?: string | null;
}

/** The job-posting letter (owner's cover letter, kept to what we can promise). Plain text, no footer. */
function jobPostLetter(c: BizLeadEmailCtx, closing: string, reply = "Just reply to this email."): { subject: string; text: string } {
  const title = c.jobTitle!.trim();
  const where = c.postingSource ? ` on ${c.postingSource}` : "";
  const need = jobPostNeed(title);
  const hi = c.firstName ? `Hi ${c.firstName},` : "Dear Hiring Manager,";
  const a = /^[aeiou]/i.test(title) ? "an" : "a";
  const pilot = c.pilotPct > 0 && c.pilotJobs > 0 ? `up to ${c.pilotPct}% off ${c.pilotJobs === 1 ? "your first job" : `your first ${c.pilotJobs} jobs`}` : null;
  return {
    subject: `Your ${title} posting${where}: a service instead of a hire`,
    text: `${hi}

I saw that ${c.businessName} posted a job${where} for ${a} ${title}${c.city ? ` in ${c.city}` : " in the Detroit area"}. Finding reliable people for ${need.work} is hard, so here's another option: book the work as a service from ${BRAND.name}, only when you need it, instead of hiring for the role.

${BRAND.name} is one app for the work your properties need: ${need.examples}, and everything else from cleaning to lawn care and snow removal. You book online in about a minute; a vetted, insured local pro does the job.

Hiring for the role:
• Beyond the hourly pay: payroll taxes, workers' comp, insurance and benefits
• Paying for the whole shift, even between turnovers and repair tickets
• Recruiting, interviewing, scheduling and covering call-outs

Booking it with ${BRAND.name}:
• Pay only for the jobs you book: no payroll, no idle hours
• An upfront, all-in price in about a minute, no callbacks. The price only changes if the job turns out different from what you described, and only after you approve it
• Every pro is ID- and background-checked, insured, licensed where required and rated on every job
• Live arrival tracking and before-and-after photos of every job
• One business account for all your properties; your favorite pros get your jobs first. Invoicing is available for approved accounts
• If a job isn't right, we redo it free or refund it within ${BRAND.guaranteeDays} days

${pilot ? `To try us with no risk, you get ${pilot}. ` : ""}Set up your business account in two minutes: ${c.signupUrl}

Do you have 5 minutes this week for a quick call? ${reply}

${closing}`,
  };
}

/** The job-posting letter for sending by hand (print, PDF or a job site's message), signed by a person. */
export function bizCoverLetter(c: BizLeadEmailCtx & { senderName: string; senderTitle?: string | null; phone?: string | null; email?: string | null; site?: string | null }): { subject: string; text: string } {
  const sig = [`Best regards,`, c.senderName, c.senderTitle, BRAND.legalName, [c.phone, c.email].filter(Boolean).join(" · "), c.site].filter(Boolean).join("\n");
  return jobPostLetter(c, sig, c.phone ? `Reply anytime or call me at ${c.phone}.` : "Reply anytime.");
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
  if (c.jobTitle?.trim()) {
    const title = c.jobTitle.trim();
    const need = jobPostNeed(title);
    const jp = [
      jobPostLetter(c, `Best regards,\nThe ${BRAND.name} team`),
      { subject: `Re: your ${title} posting`, text: `${hi === `Hi ${c.businessName} team,` ? "Hi again," : hi}\n\nQuick follow-up. If the ${title} role is still open, you can cover the ${need.work} with ${BRAND.name} while you look, or instead of hiring: book only the jobs you need, at an upfront price, done by vetted, insured pros.${pilot ? ` The pilot offer (${pilot}) still stands.` : ""}\n\nTwo-minute setup: ${c.signupUrl}\n\nThe ${BRAND.name} team` },
      { subject: `Last note from ${BRAND.name}`, text: `${hi === `Hi ${c.businessName} team,` ? "Hello," : hi}\n\nI won't keep emailing. Whenever you need ${need.work} done, while the role is open or when someone calls out, we're one booking away: ${c.signupUrl}\n\nBest,\nThe ${BRAND.name} team` },
    ];
    const j = jp[Math.min(c.step, jp.length - 1)];
    return { subject: j.subject, text: j.text + foot };
  }
  const m = bodies[Math.min(c.step, bodies.length - 1)];
  return { subject: m.subject, text: m.text + foot };
}
