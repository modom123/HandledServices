/*
 * FILE    : packages/core/src/outreach-ai.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2335 UTC
 * PURPOSE : Rules for AI-written marketing and outreach email, sent from handledsvc.net (the marketing / outreach
 *           domain; booking and receipt email stays on handledsvc.com so cold email can never hurt it).
 *             OUTREACH_DOMAIN / COMPANY_DOMAIN — which domain sends what
 *             outreachDomainProblem — refuses to send cold email from the company domain (or a free mailbox)
 *             splitOutreachFooter   — the legal footer is always added by code, never written by the AI
 *             checkOutreachDraft    — guardrails an AI-personalized cold email must pass, else the plain template
 *                                     is sent: the lead's own link, no other links, no prices or $ amounts, no
 *                                     discount other than the pilot set in the Hub, no made-up placeholders, no
 *                                     "unsubscribe" text (the footer has it), short like a person writes,
 *                                     no deceptive "Re:/Fwd:" on a first email, no ALL-CAPS or spam words
 *             checkReplyDraft       — the same honesty rules for an AI-drafted answer to a reply
 *             CAMPAIGN_GOALS        — starting points for the Email Center's AI campaign writer
 */
import { BRAND } from "./brand.ts";

/** The marketing / cold-outreach domain. Mailboxes live here (e.g. mark@handledsvc.net). */
export const OUTREACH_DOMAIN = "handledsvc.net";
/** The company domain: bookings, receipts, invoices, the website. Never used for cold email. */
export const COMPANY_DOMAIN = "handledsvc.com";

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|msn|aol|icloud|me|proton|protonmail)\./i;

/** Why this mailbox must not send cold outreach (null = fine). */
export function outreachDomainProblem(user: string | null | undefined, companyDomains: string[] = [COMPANY_DOMAIN]): string | null {
  const u = (user ?? "").trim().toLowerCase();
  const domain = u.split("@")[1] ?? "";
  if (!u || !domain) return "OUTREACH_SMTP_USER is not set (use a mailbox on handledsvc.net, e.g. mark@handledsvc.net).";
  if (companyDomains.map((d) => d.toLowerCase()).includes(domain))
    return `${domain} is the company domain (bookings and receipts). Cold outreach must come from ${OUTREACH_DOMAIN}.`;
  if (FREE_MAIL.test(domain)) return `${domain} is a free mailbox; outreach must come from ${OUTREACH_DOMAIN}.`;
  return null;
}

/** Split an outreach email into the part a person (or the AI) writes and the legal footer added by code. */
export function splitOutreachFooter(text: string): { body: string; footer: string } {
  const i = text.lastIndexOf("\n\n—\n");
  return i < 0 ? { body: text, footer: "" } : { body: text.slice(0, i), footer: text.slice(i) };
}

const SPAM = /\b(act now|100% free|risk[- ]free|guaranteed results|no obligation|limited time|click here|buy now|winner|urgent|cash bonus|best price|lowest price|cheapest)\b/i;
const URL_RE = /https?:\/\/[^\s)>\]]+/gi;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export interface OutreachDraftRules {
  /** The lead's own link (must appear exactly once or more; no other links allowed). */
  signupUrl: string;
  /** The only discount the email may mention (0 = none). */
  pilotPct: number;
  /** First email in a thread (a "Re:" subject would be deceptive). */
  firstEmail: boolean;
  maxWords?: number;
}

/** Problems with an AI-written cold email (empty = OK to send). The footer is added afterwards by code. */
export function checkOutreachDraft(d: { subject: string; body: string }, r: OutreachDraftRules): string[] {
  const p: string[] = [];
  const subject = d.subject.trim(), body = d.body.trim();
  const max = r.maxWords ?? 170;
  if (!subject) p.push("empty subject");
  if (subject.length > 78) p.push("subject too long");
  if (/[A-Z]{5,}/.test(subject.replace(/\b(LLC|HVAC|ASAP)\b/g, ""))) p.push("ALL-CAPS in subject");
  if (/!{1,}/.test(subject)) p.push("exclamation mark in subject");
  if (r.firstEmail && /^\s*(re|fw|fwd)\s*:/i.test(subject)) p.push('"Re:/Fwd:" on a first email is deceptive');
  if (words(body) < 25) p.push("body too short");
  if (words(body) > max) p.push(`body over ${max} words`);
  const urls = body.match(URL_RE) ?? [];
  if (!urls.some((u) => u.replace(/[.,;:!?]+$/, "") === r.signupUrl)) p.push("the lead's link is missing");
  if (urls.some((u) => u.replace(/[.,;:!?]+$/, "") !== r.signupUrl)) p.push("links other than the lead's own link");
  p.push(...honesty(`${subject}\n${body}`, r.pilotPct));
  if (/unsubscribe/i.test(body)) p.push("unsubscribe text belongs in the footer only");
  if (SPAM.test(`${subject} ${body}`)) p.push("spammy wording");
  return p;
}

/** Problems with an AI-drafted answer to a business's reply (empty = OK to show for sending). */
export function checkReplyDraft(text: string, allowedUrls: string[], pilotPct = 0): string[] {
  const p: string[] = [];
  const t = text.trim();
  if (words(t) < 5) p.push("too short");
  if (words(t) > 220) p.push("over 220 words");
  const urls = (t.match(URL_RE) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""));
  if (urls.some((u) => !allowedUrls.includes(u))) p.push("links we didn't provide");
  p.push(...honesty(t, pilotPct));
  return p;
}

function honesty(text: string, pilotPct: number): string[] {
  const p: string[] = [];
  if (/\$\s?\d|\d+\s?(dollars|usd)\b/i.test(text)) p.push("a price or $ amount (prices only come from the pricing engine)");
  const pcts = [...text.matchAll(/(\d{1,3})\s?%/g)].map((m) => Number(m[1]));
  // 25% to book is a real policy; the pilot discount is the only other number allowed
  if (pcts.some((n) => n !== 25 && n !== pilotPct)) p.push("a percentage that isn't our policy or the pilot offer");
  if (/\[[^\]]{2,40}\]|\{\{[^}]*\}\}|<[A-Z_ ]{3,}>/.test(text)) p.push("an unfilled placeholder");
  return p;
}

/** Starting points for the Email Center's AI campaign writer (staff can type their own goal instead). */
export const CAMPAIGN_GOALS: { key: string; label: string; goal: string }[] = [
  { key: "seasonal", label: "Seasonal push", goal: `The work customers need this season (e.g. fall cleanup, gutters, snow removal, holiday cleaning) — book early to get the date they want.` },
  { key: "winback", label: "Win back lapsed customers", goal: "Customers who haven't booked in 90+ days: a friendly check-in, what's new, and an easy way to book again." },
  { key: "new_service", label: "Announce a service", goal: "Announce a service customers may not know we offer, with who it's for and how to book." },
  { key: "biz_followup", label: "Business accounts update", goal: "Business account members: recurring cleaning and turnover work, one account for every property, priority scheduling." },
  { key: "reviews", label: "Ask for referrals", goal: `Happy customers: refer a friend or neighbor; ${BRAND.name} is local, vetted and priced up front.` },
  { key: "pros", label: "Pro network news", goal: "Approved pros: network news and how to get more of the jobs they want. Never pressure to take jobs." },
];
