/*
 * FILE    : packages/core/src/call-desk.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0015 UTC
 * PURPOSE : The Call desk (Hub → Business leads → Call desk): cold and warm calls to businesses, made by people.
 *             CALL_OUTCOMES — what happened on a call and what it does to the lead (status, when to call again)
 *             applyCallOutcome — the lead's next status / next call date / attempt count after a call
 *             callQueue     — today's list: callbacks due, then replies, clicks, teaming partners (federal primes),
 *                             then phone-only leads; best score first; nobody called more than MAX_ATTEMPTS times
 *             callScript    — a short opener, the questions to ask and a voicemail, by segment
 *           Calls are live and made by a person: no autodialer, no prerecorded or AI voice, no texts (TCPA).
 *           "Do not call" is permanent.
 */
import { BRAND } from "./brand.ts";
import { BIZ_PARTNER_SEGMENT, BIZ_SEGMENTS, type BizSegment } from "./biz-lead-engine.ts";
import { addBusinessDays } from "./pro-fairness.ts";

export const MAX_CALL_ATTEMPTS = 6;
export const DEFAULT_CALL_GOAL = 30;

export type CallOutcome = "no_answer" | "voicemail" | "gatekeeper" | "talked" | "interested" | "callback" | "not_interested" | "do_not_call" | "wrong_number";

export const CALL_OUTCOMES: Record<CallOutcome, { label: string; emoji: string; status?: string; retryDays?: number; reached: boolean; hint: string }> = {
  no_answer: { label: "No answer", emoji: "📵", retryDays: 2, reached: false, hint: "Tries again in 2 business days" },
  voicemail: { label: "Left voicemail", emoji: "📨", retryDays: 3, reached: false, hint: "Tries again in 3 business days" },
  gatekeeper: { label: "Gatekeeper", emoji: "🚪", retryDays: 2, reached: false, hint: "Got the right name? Put it in the note" },
  talked: { label: "Talked — follow up", emoji: "💬", status: "replied", retryDays: 5, reached: true, hint: "Calls back in 5 business days" },
  interested: { label: "Interested!", emoji: "🔥", status: "replied", retryDays: 1, reached: true, hint: "Book the walkthrough; calls back tomorrow" },
  callback: { label: "Call back on…", emoji: "📅", reached: true, hint: "Pick the date they asked for" },
  not_interested: { label: "Not interested", emoji: "👎", status: "not_interested", reached: true, hint: "Off the list; email stops too" },
  do_not_call: { label: "Do not contact", emoji: "⛔", status: "do_not_contact", reached: true, hint: "Never call or email again" },
  wrong_number: { label: "Wrong number", emoji: "❌", reached: false, hint: "Removes the number" },
};

/** The next call: `days` business days out (weekends skipped), at the start of the Detroit work day (14:00 UTC). */
function callDay(from: Date, days: number): Date {
  const d = addBusinessDays(from, days);
  d.setUTCHours(14, 0, 0, 0);
  return d;
}

export interface CallLeadState { status: string; call_attempts: number | null; phone: string | null }

/** What a call outcome does to the lead. `callbackAt` is required for 'callback'. */
export function applyCallOutcome(l: CallLeadState, outcome: CallOutcome, now = new Date(), callbackAt?: Date | null): { status: string; next_call_at: string | null; call_attempts: number; phone: string | null; last_call_outcome: CallOutcome; last_called_at: string } {
  const o = CALL_OUTCOMES[outcome];
  const attempts = (l.call_attempts ?? 0) + 1;
  const final = ["converted", "do_not_contact", "unsubscribed"].includes(l.status);
  let status = final ? l.status : o.status ?? l.status;
  let next: Date | null = outcome === "callback" ? (callbackAt ?? callDay(now, 1)) : o.retryDays != null ? callDay(now, o.retryDays) : null;
  if (["not_interested", "do_not_call", "wrong_number"].includes(outcome)) next = null;
  // never reached after the last attempt: stop calling (the lead stays, marked for email only)
  if (!o.reached && attempts >= MAX_CALL_ATTEMPTS) next = null;
  if (final) next = null;
  if (status === "call" && o.reached && outcome !== "not_interested" && outcome !== "do_not_call") status = "replied";
  return {
    status, next_call_at: next ? next.toISOString() : null, call_attempts: attempts,
    phone: outcome === "wrong_number" ? null : l.phone, last_call_outcome: outcome, last_called_at: now.toISOString(),
  };
}

export interface QueueLead {
  id: string; business_name: string; segment: string; status: string; phone: string | null; score: number;
  next_call_at: string | null; call_attempts: number | null; last_called_at?: string | null;
}

export type QueueReason = "callback" | "replied" | "clicked" | "partner" | "phone_only";
export const QUEUE_REASON_LABEL: Record<QueueReason, string> = {
  callback: "Callback due", replied: "Replied — warm", clicked: "Clicked our email", partner: "Teaming partner / federal prime", phone_only: "Cold call (no email found)",
};

/** Who to call today, in order. Only leads with a phone, never called today, not over the attempt limit. */
export function callQueue<T extends QueueLead>(leads: T[], now = new Date(), max = 60): (T & { reason: QueueReason })[] {
  const endOfDay = new Date(now); endOfDay.setUTCHours(23, 59, 59, 999);
  const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
  const rank: Record<QueueReason, number> = { callback: 0, replied: 1, clicked: 2, partner: 3, phone_only: 4 };
  const out: (T & { reason: QueueReason })[] = [];
  for (const l of leads) {
    if (!l.phone || ["converted", "do_not_contact", "unsubscribed", "not_interested", "bounced"].includes(l.status)) continue;
    if (l.last_called_at && new Date(l.last_called_at) >= dayStart) continue;
    if ((l.call_attempts ?? 0) >= MAX_CALL_ATTEMPTS && !l.next_call_at) continue;
    const due = l.next_call_at ? new Date(l.next_call_at) <= endOfDay : null;
    if (due === false) continue; // a callback set for a later day
    const reason: QueueReason | null = due ? "callback"
      : l.status === "replied" ? "replied"
      : l.status === "clicked" ? "clicked"
      : l.segment === BIZ_PARTNER_SEGMENT && l.status === "call" ? "partner"
      : l.status === "call" ? "phone_only" : null;
    if (reason) out.push({ ...l, reason });
  }
  return out.sort((a, b) => rank[a.reason] - rank[b.reason] || b.score - a.score).slice(0, max);
}

export interface CallScript { opener: string; questions: string[]; voicemail: string; close: string }

/** A short, honest script. No prices, discounts or promises on the phone: book the free walkthrough or quote. */
export function callScript(l: { business_name: string; contact_name?: string | null; segment: string; reason?: QueueReason }, caller = "[your name]"): CallScript {
  const first = l.contact_name?.split(" ")[0] ?? null;
  const ask = first ? `Hi, is this ${first}?` : `Hi, who handles ${l.segment === BIZ_PARTNER_SEGMENT ? "subcontractors and small-business partners" : "cleaning and maintenance"} for ${l.business_name}?`;
  if (l.segment === BIZ_PARTNER_SEGMENT) {
    return {
      opener: `${ask} This is ${caller} with ${BRAND.name} in Detroit. We're a small business with vetted local crews for landscaping, painting, carpet cleaning, construction support and facility work. I saw ${l.business_name} holds federal contracts in that work, and I'm calling to see if you use small-business subcontractors in Michigan.`,
      questions: ["Who's your small-business liaison or the project manager for those sites?", "Do you have sites or surge work where a local crew would help?", "What do you need from a subcontractor to get on your list (SAM.gov registration, insurance, references)?"],
      voicemail: `Hi, this is ${caller} with ${BRAND.name} in Detroit. We're a small business that can support your federal work in Michigan as a subcontractor: landscaping, painting, carpet cleaning and facility work. I'd love to get on your subcontractor list. You can reach me at [your number]. Again, ${caller} with ${BRAND.name}. Thanks.`,
      close: "Can I send our capability statement and insurance certificate to you today?",
    };
  }
  const seg = BIZ_SEGMENTS[l.segment as BizSegment] ?? BIZ_SEGMENTS.facilities;
  const warm = l.reason === "replied" ? "Thanks for getting back to our email — " : l.reason === "clicked" ? "I sent you a quick email last week — " : "";
  return {
    opener: `${ask} This is ${caller} with ${BRAND.name}, a Detroit company. ${warm}We do ${seg.hook}. I'm calling to see if it's worth a quick look for ${l.business_name}.`,
    questions: ["Who handles that for you today, and how's it going?", "What's the one thing you'd change about it?", "How often do you need it (weekly, monthly, between tenants)?"],
    voicemail: `Hi, this is ${caller} with ${BRAND.name} in Detroit. We do ${seg.hook}. I'd be glad to do a free walkthrough and quote for ${l.business_name}. You can reach me at [your number]. Again, ${caller} with ${BRAND.name}. Thanks.`,
    close: `Could I come by for a free 15-minute walkthrough and send you a quote — no commitment? What day works?`,
  };
}
