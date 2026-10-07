/*
 * FILE    : packages/core/src/rfp.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0841 UTC
 * PURPOSE : The business Request for Proposal: the scope of work a facilities buyer gives us in 3 short steps
 *           (company → scope → timing), in one shape the website form, the API, the Hub and the ops email share.
 *           rfpSummary() turns it into plain lines (email, notes); rfpFollowUp() lists what's still missing so the
 *           account manager's follow-up call fills the gaps instead of starting over. RFP_NEXT_STEPS is the
 *           process we promise the buyer, shown on the form and after they send it.
 */
import { getService } from "./services.ts";

export const SQFT_RANGES = [
  { id: "lt2500", label: "Under 2,500 sq ft" },
  { id: "2500_10k", label: "2,500–10,000 sq ft" },
  { id: "10k_25k", label: "10,000–25,000 sq ft" },
  { id: "25k_50k", label: "25,000–50,000 sq ft" },
  { id: "50k_plus", label: "50,000+ sq ft" },
  { id: "not_sure", label: "Not sure" },
] as const;

export const RFP_FREQUENCIES = [
  { id: "nightly", label: "Nightly (5×/week)" },
  { id: "2_3_week", label: "2–3× a week" },
  { id: "weekly", label: "Weekly" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Monthly" },
  { id: "quarterly", label: "Quarterly / seasonal" },
  { id: "one_time", label: "One-time project" },
  { id: "as_needed", label: "As needed (on call)" },
] as const;

export const RFP_HOURS = [
  { id: "business", label: "During business hours" },
  { id: "after_hours", label: "After hours / evenings" },
  { id: "overnight", label: "Overnight" },
  { id: "weekends", label: "Weekends" },
] as const;

export const RFP_VENDOR = [
  { id: "none", label: "No — this is new" },
  { id: "replacing", label: "Yes — looking to replace them" },
  { id: "adding", label: "Yes — adding coverage or sites" },
] as const;

export const RFP_TERMS = [
  { id: "month_to_month", label: "Month to month" },
  { id: "six_months", label: "6 months" },
  { id: "twelve_months", label: "12 months +" },
  { id: "not_sure", label: "Not sure yet" },
] as const;

export const RFP_DECISION = [
  { id: "me", label: "I decide" },
  { id: "team", label: "Me plus my team / owner" },
  { id: "formal_bid", label: "Formal bid or RFP with a deadline" },
] as const;

export const RFP_WALKTHROUGH = [
  { id: "weekday_am", label: "Weekday mornings" },
  { id: "weekday_pm", label: "Weekday afternoons" },
  { id: "evenings", label: "Evenings" },
  { id: "weekends", label: "Weekends" },
] as const;

export const RFP_CONTACT = [
  { id: "call", label: "Phone call" },
  { id: "email", label: "Email" },
  { id: "text", label: "Text" },
] as const;

type Id<T extends readonly { id: string }[]> = T[number]["id"];

export interface RfpScope {
  sqft: Id<typeof SQFT_RANGES>;
  /** Main site address, or city / ZIP. */
  site: string;
  /** Per service: how often, and anything specific (rooms, floors, items). */
  services: { slug: string; frequency: Id<typeof RFP_FREQUENCIES>; note?: string }[];
  hours: Id<typeof RFP_HOURS>[];
  vendor: Id<typeof RFP_VENDOR>;
  /** What isn't working today (or what success looks like). */
  pain?: string;
  term: Id<typeof RFP_TERMS>;
  decision: Id<typeof RFP_DECISION>;
  /** YYYY-MM-DD, when decision = formal_bid. */
  bidDue?: string | null;
  walkthrough: Id<typeof RFP_WALKTHROUGH>[];
  contact: Id<typeof RFP_CONTACT>;
}

/** What happens after they send it — the same four steps everywhere. */
export const RFP_NEXT_STEPS = [
  { t: "We call you within 1 business day", b: "Your account manager confirms the scope and fills any gaps (10–15 minutes)." },
  { t: "Free walkthrough", b: "We walk your site with you at a time you pick, or by video for simple jobs." },
  { t: "Written proposal per site", b: "Scope, frequency and one fixed price per site and service. No hourly surprises." },
  { t: "Approve and start", b: "Sign online, add a card or ACH, and your first visit is scheduled." },
] as const;

const label = <T extends readonly { id: string; label: string }[]>(list: T, id: string | null | undefined) => list.find((x) => x.id === id)?.label ?? id ?? "—";

/** Plain-language scope, one line per item (ops email, notes, Hub). */
export function rfpSummary(s: RfpScope, o: { locations?: number; industry?: string | null; startBy?: string | null; budget?: number | null } = {}): string[] {
  return [
    `Sites: ${o.locations ?? 1} · ${label(SQFT_RANGES, s.sqft)}${s.site ? ` · ${s.site}` : ""}${o.industry ? ` · ${o.industry}` : ""}`,
    ...s.services.map((x) => `• ${getService(x.slug)?.name ?? x.slug}: ${label(RFP_FREQUENCIES, x.frequency)}${x.note ? ` — ${x.note}` : ""}`),
    `When work can happen: ${s.hours.length ? s.hours.map((h) => label(RFP_HOURS, h)).join(", ") : "—"}`,
    `Current vendor: ${label(RFP_VENDOR, s.vendor)}${s.pain ? ` — ${s.pain}` : ""}`,
    `Start: ${o.startBy ?? "—"} · Term: ${label(RFP_TERMS, s.term)}${o.budget ? ` · Budget ~$${o.budget.toLocaleString("en-US")}/mo` : ""}`,
    `Decision: ${label(RFP_DECISION, s.decision)}${s.decision === "formal_bid" && s.bidDue ? ` (due ${s.bidDue})` : ""}`,
    `Walkthrough: ${s.walkthrough.length ? s.walkthrough.map((w) => label(RFP_WALKTHROUGH, w)).join(", ") : "any time"} · Prefers: ${label(RFP_CONTACT, s.contact)}`,
  ];
}

/** What to ask on the follow-up call: the gaps the form couldn't fill. */
export function rfpFollowUp(s: RfpScope, o: { locations?: number; budget?: number | null; phone?: string | null } = {}): string[] {
  const q: string[] = [];
  if (s.sqft === "not_sure") q.push("Approximate square footage (or floors / rooms / restrooms)");
  if (!s.site || s.site.length < 8) q.push("Full site address(es) and access (keys, alarm codes, loading dock, parking)");
  if ((o.locations ?? 1) > 1) q.push(`List of all ${o.locations} locations — same scope at each, or different?`);
  for (const x of s.services) if (!x.note) q.push(`${getService(x.slug)?.name ?? x.slug}: what exactly is in scope (areas, counts, supplies included?)`);
  if (!s.hours.length) q.push("When can crews work (business hours, after hours, weekends)?");
  if (s.vendor !== "none") q.push("What the current vendor costs and does — and what isn't working");
  if (!o.budget) q.push("Budget range per month (or per visit)");
  if (s.decision === "formal_bid") q.push(`Bid documents, required forms, insurance certificates${s.bidDue ? ` — due ${s.bidDue}` : " and the due date"}`);
  if (s.decision === "team") q.push("Who else signs off, and what they need to see");
  if (s.contact === "call" && !o.phone) q.push("Best phone number (they prefer a call but left none)");
  q.push("Insurance / COI requirements and any vendor onboarding (W-9, portal, badges)");
  return q;
}
