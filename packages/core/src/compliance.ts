/*
 * FILE    : packages/core/src/compliance.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * UPDATED : 2026-10-04_2204 UTC — agreement v5 and Service Agreement v7 (first looks, favorites, open job board).
 * UPDATED : 2026-10-03_0042 UTC — AGREEMENT_VERSION v3 and SERVICE_AGREEMENT_VERSION v5 (full contract library).
 * UPDATED : 2026-10-03_0151 UTC — v4 / v6 for market pricing.
 * PURPOSE : Subcontractor onboarding & 1099 rules shared by the Handled Hub, the pro
 *           portal and IEBC agents. Pros are independent contractors (their own business,
 *           tools, insurance and schedule; free to accept or decline any job) — never
 *           employees. A pro can't be activated until every required step is done.
 * UPDATED : 2026-10-04_1934 UTC — photo ID verification step (ID + selfie via Stripe Identity, or staff on a video call).
 * UPDATED : 2026-10-06_2010 UTC — work-area step needs the pro's place of business (street address), not just a ZIP.
 * UPDATED : 2026-10-09_0300 UTC — Handled +5 points paid by customers (commission about 20% → 37%, take band 15–40%; pro pay unchanged).
 * UPDATED : 2026-10-12_0005 UTC — work-area detail shows "only ZIPs …" when the pro limits offers to their ZIP list.
 * UPDATED : 2026-10-28_0122 UTC — AGREEMENT_VERSION v10: referral partner fee (pro pays half).
 * UPDATED : 2026-10-15_0300 UTC — SERVICE_AGREEMENT_VERSION v8: book now, pay after, or pay in full for 5% off.
 * UPDATED : 2026-10-18_0248 UTC — resume and profile photo steps; missingUploads() and uploadReminderDue() for the
 *           "missing uploads" reminders to pros who are already live.
 * UPDATED : 2026-10-18_0415 UTC — W-9 tax classifications incl. LLCs taxed as S/C corporations; form1099() decides
 *           who gets a 1099-NEC (corporations are exempt); BUSINESS_ENTITY_TYPES for signing on a business's behalf.
 * UPDATED : 2026-10-19_1320 UTC — insuranceRequired(trades): a pro whose trades only cover insurance-optional services
 *           (remote business work, errands, courier, personal assistant) can be activated without a COI; the step shows optional.
 * UPDATED : 2026-10-23_1600 UTC — license step lists carpentry, masonry and roofing.
 */
import { SERVICES } from "./services.ts";
import { COVERAGES, coverageValid, glMinimum, requiredCoverages, specialtiesFor, type CoverageKey } from "./vetting.ts";

export const AGREEMENT_VERSION = "2026-10-v10"; // v10: referral partner fee — the pro pays half of a partner's 25% one-time / 10% repeat / 15% account share, shown on the work order; v9: commission about 20% → 37% with customer prices raised to match (pro pay in dollars unchanged), take band 15–40%; v8: Washington pros — customer clause limited to soliciting (RCW 49.62), Washington law and courts; v7: instant pay fee 1.75% (was 1.5%); v6: cancelling — 24h+ free, 6–24h short notice (no penalty), under 6h late; optional backup standby (paid only for work done); v5: first looks (business account pros, customer favorites, crew requests) and the open job board ("Jobs near you"); v4: market pricing — counters, sliding commission, booking fee (v3: full plain-English agreement + policies, consents, trade addenda)
/** Customer Service Agreement (printed on every invoice). Bump when the terms change. */
export const SERVICE_AGREEMENT_VERSION = "2026-10-v8"; // v8: book now, pay after (25% at booking, hold when the pro starts, rest when done) or pay in full for 5% off; v7: favorites and asking for a pro or crew member (first look, never guaranteed); v6: name your price, pro counters, raises, booking fee (v5: full plain-English agreement + addenda)
/** Cancellation inside 24 hours of the arrival window, or a lockout, keeps this fee. */
export const LATE_CANCEL_FEE = 49;

/** Trades whose services legally require a licensed tradesperson. */
export const LICENSED_TRADES: string[] = [...new Set(SERVICES.filter((s) => s.licensed).flatMap((s) => s.trades.filter((t) => t !== "handyman")))];

/** W-9 federal tax classification (line 3). An LLC is listed by how it's taxed. */
export const ENTITY_TYPES = ["individual", "sole_prop", "llc", "llc_s_corp", "llc_c_corp", "s_corp", "c_corp", "partnership"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];
/** Taxed as a corporation: no 1099-NEC for their service payments. */
export const CORPORATE_ENTITY_TYPES: readonly EntityType[] = ["s_corp", "c_corp", "llc_s_corp", "llc_c_corp"];
/** A company (not a person): the agreement is signed by someone on its behalf. */
export const BUSINESS_ENTITY_TYPES: readonly EntityType[] = ["llc", "llc_s_corp", "llc_c_corp", "s_corp", "c_corp", "partnership"];

/**
 * 1099-NEC for a pro's year: "file" (at or over the threshold), "under" (below it), or "exempt"
 * (taxed as a corporation: S/C corps and LLCs that elected either). Unknown classification → treated as reportable.
 * Exceptions (e.g. attorneys' fees, medical payments) don't apply to Handled's trades; your accountant confirms each January.
 */
export function form1099(entityType: string | null | undefined, total: number, taxYear: number): "file" | "under" | "exempt" {
  if (CORPORATE_ENTITY_TYPES.includes(entityType as EntityType)) return "exempt";
  return total >= necThreshold(taxYear) ? "file" : "under";
}

/**
 * Form 1099-NEC reporting threshold by tax year. $600 through 2025; the 2025 tax law
 * raised it to $2,000 for payments made from 2026 (indexed for inflation after 2026).
 * Confirm the current figure with your accountant each January.
 */
export function necThreshold(taxYear: number): number {
  return taxYear <= 2025 ? 600 : 2000;
}

export interface ComplianceInput {
  status: string;
  trades: string[];
  legal_name: string | null;
  tin_last4: string | null;
  w9_received_at: string | null;
  agreement_version: string | null;
  agreement_signed_at: string | null;
  insured_until: string | null;
  license_number: string | null;
  license_expires: string | null;
  background_checked: boolean;
  payout_method: string | null;
  specialties?: string[] | null;
  coverage?: Record<string, string> | null;
  base_zip?: string | null;
  base_address?: string | null;
  base_city?: string | null;
  availability?: { days: number[]; windows: string[] } | null;
  service_radius_mi?: number | null;
  service_zips?: string[] | null;
  zips_only?: boolean | null;
  /** Photo ID matched to a selfie (Stripe Identity) or checked by staff on a video call. */
  id_verified_at?: string | null;
  resume_uploaded_at?: string | null;
  photo_uploaded_at?: string | null;
}

export interface Step {
  key: "w9" | "agreement" | "specialties" | "area" | "resume" | "photo" | "coi" | "license" | "id" | "background" | "payout" | `coverage:${CoverageKey}`;
  label: string;
  done: boolean;
  detail: string;
  /** Expires within 30 days — renew before it lapses. */
  expiring?: boolean;
  /** Not needed for this pro's work: shown, never blocks activation. */
  optional?: boolean;
}

/**
 * Does this pro need a general liability certificate? Yes when any service their trades can take requires it
 * (or their trades match no service at all); no when every one of those services is insuranceOptional.
 */
export function insuranceRequired(trades: string[]): boolean {
  const theirs = SERVICES.filter((s) => s.trades.some((t) => trades.includes(t)));
  return !theirs.length || theirs.some((s) => !s.insuranceOptional);
}

const soon = (d: string | null, days = 30) => Boolean(d) && new Date(d!).getTime() < Date.now() + days * 86400000;
const valid = (d: string | null) => Boolean(d) && new Date(d!).getTime() >= Date.now() - 86400000;

export function onboardingChecklist(c: ComplianceInput): { steps: Step[]; complete: boolean; licenseRequired: boolean } {
  const licenseRequired = c.trades.some((t) => LICENSED_TRADES.includes(t));
  const steps: Step[] = [
    { key: "w9", label: "W-9 on file", done: Boolean(c.w9_received_at && c.legal_name && c.tin_last4), detail: c.legal_name ? `${c.legal_name} · TIN •••${c.tin_last4 ?? "?"}` : "Legal name, tax classification and TIN" },
    { key: "agreement", label: "Independent contractor agreement signed", done: c.agreement_version === AGREEMENT_VERSION && Boolean(c.agreement_signed_at), detail: c.agreement_signed_at ? `v${c.agreement_version} · ${c.agreement_signed_at.slice(0, 10)}` : `Current version ${AGREEMENT_VERSION}` },
    { key: "specialties", label: "Specialties chosen", done: Boolean(c.specialties?.length) || !specialtiesFor(c.trades).length, detail: c.specialties?.length ? `${c.specialties.length} selected` : "What you do best: we send you those jobs first" },
    { key: "area", label: "Work area & hours", done: Boolean(c.base_zip && c.base_address), detail: c.base_zip && c.base_address ? `From ${c.base_address}, ${c.base_city ?? ""} ${c.base_zip}, ${c.zips_only && c.service_zips?.length ? `only ZIPs ${c.service_zips.slice(0, 6).join(", ")}${c.service_zips.length > 6 ? "…" : ""}` : `up to ${c.service_radius_mi ?? 25} mi`} · ${c.availability?.days?.length ? `${c.availability.days.length} days a week` : "any day"}` : "Your place of business, how far you'll drive or which ZIP codes, which days and times you work" },
    { key: "resume", label: "Resume uploaded", done: Boolean(c.resume_uploaded_at), detail: c.resume_uploaded_at ? `Uploaded ${c.resume_uploaded_at.slice(0, 10)}` : "Your work history and experience (PDF or Word)" },
    { key: "photo", label: "Profile photo uploaded", done: Boolean(c.photo_uploaded_at), detail: c.photo_uploaded_at ? `Uploaded ${c.photo_uploaded_at.slice(0, 10)}` : "A clear, friendly photo of your face" },
    insuranceRequired(c.trades)
      ? { key: "coi", label: "Insurance certificate (COI) verified", done: valid(c.insured_until), detail: c.insured_until ? `Valid until ${c.insured_until}` : `General liability, $${(glMinimum(c.trades) / 1e6).toFixed(0)}M per occurrence minimum, Handled named as additional insured`, expiring: valid(c.insured_until) && soon(c.insured_until) }
      : { key: "coi", label: "Insurance certificate (COI) — optional", done: true, optional: true, detail: valid(c.insured_until) ? `Valid until ${c.insured_until}` : "Not required for your work (remote work, errands, courier, assistant)" },
  ];
  // trade-specific coverage (commercial auto, bond, food license…) + workers' comp or a no-employees statement
  const required = requiredCoverages(c.trades);
  const needs: CoverageKey[] = [...new Set<CoverageKey>([...required, "workers_comp"])];
  for (const k of needs) {
    const v = c.coverage?.[k];
    const ok = coverageValid(c.coverage, k, new Date(), !required.includes(k)); // remodelers need a real workers' comp policy
    steps.push({
      key: `coverage:${k}`,
      label: k === "workers_comp" ? "Workers' comp (or no-employees statement)" : `${COVERAGES[k].label} verified`,
      done: ok,
      detail: v === "exempt" ? "No employees: statement signed" : v ? `Valid until ${v}` : COVERAGES[k].detail,
      expiring: ok && v !== "exempt" && soon(v ?? null),
    });
  }
  if (licenseRequired)
    steps.push({ key: "license", label: "Trade license verified", done: Boolean(c.license_number) && valid(c.license_expires), detail: c.license_number ? `#${c.license_number} · until ${c.license_expires ?? "?"}` : "Required for plumbing, electrical, HVAC, painting, carpentry, masonry, roofing, remodeling, food service, passenger transportation, freight carriers (USDOT number) and medical couriers (HIPAA training)", expiring: valid(c.license_expires) && soon(c.license_expires) });
  steps.push(
    { key: "id", label: "Photo ID verified", done: Boolean(c.id_verified_at), detail: c.id_verified_at ? `Verified ${c.id_verified_at.slice(0, 10)}` : "A quick photo of your ID and a selfie (or a short video call with us)" },
    { key: "background", label: "Background check cleared", done: c.background_checked, detail: c.background_checked ? "Cleared" : "Consent + check through your screening provider" },
    { key: "payout", label: "Payout method set", done: Boolean(c.payout_method), detail: c.payout_method ? c.payout_method.toUpperCase() : "Bank (ACH) or Stripe Connect" },
  );
  return { steps, complete: steps.every((s) => s.done), licenseRequired };
}

export type UploadKey = "resume" | "photo";

/** Resume / profile photo the pro still has to upload. */
export function missingUploads(c: Pick<ComplianceInput, "resume_uploaded_at" | "photo_uploaded_at">): UploadKey[] {
  return [...(c.resume_uploaded_at ? [] : ["resume" as const]), ...(c.photo_uploaded_at ? [] : ["photo" as const])];
}

/** Days between "missing uploads" reminders to live pros, and how many they get at most. */
export const UPLOAD_REMINDER_EVERY_DAYS = 4;
export const UPLOAD_REMINDER_MAX = 3;

/** A live pro missing uploads: is a reminder due now? First one right away, then every few days, then stop. */
export function uploadReminderDue(sent: number, lastAt: string | null | undefined, now = new Date()): boolean {
  if (sent >= UPLOAD_REMINDER_MAX) return false;
  if (!lastAt) return true;
  return (now.getTime() - new Date(lastAt).getTime()) / 86400000 >= UPLOAD_REMINDER_EVERY_DAYS;
}
