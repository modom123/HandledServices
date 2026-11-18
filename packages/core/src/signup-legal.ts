/*
 * FILE    : packages/core/src/signup-legal.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2200 UTC
 * PURPOSE : Sign-up compliance checks (owner, 2026-11-17: "wire our AI legal & compliance team to take care of actions as
 *           people sign up"). Pure rules: given who just signed up, the review items the Legal & Compliance agents
 *           (IEBC: Olivia Grant, Rafael Ortiz, Margaret Okonkwo) get as tasks. They research and draft; anything
 *           binding waits for a person and, where it says so, a licensed attorney. Nothing here is legal advice.
 *             signupLegalChecks(event) → LegalCheck[]
 *             STRICT_CLASSIFICATION_STATES — states with an ABC-style test for independent contractors
 */

import { stateForZip, stateName } from "./us-states.ts";

/**
 * States that use an ABC-style (or similarly strict) test for whether a worker is an independent contractor, for wage
 * or unemployment law. A pro there gets a classification review. A screening list for attorney review, not a ruling.
 */
export const STRICT_CLASSIFICATION_STATES: Record<string, string> = {
  CA: "ABC test (AB 5) for wage and unemployment law",
  MA: "ABC test for wage law",
  NJ: "ABC test for wage and unemployment law",
  IL: "ABC test for unemployment and wage-payment law",
  CT: "ABC test for unemployment",
  VT: "ABC test for unemployment and workers' comp",
  WA: "strict independent-contractor tests for construction and unemployment (L&I / ESD)",
  NE: "ABC test for construction contractors",
};

/** States where Handled takes bookings today (seo.ts SERVICE_AREA). Kept here as codes so this module stays standalone. */
const LAUNCHED = new Set(["MI", "NY", "NJ", "NV", "WA"]);

export type LegalArea = "pros" | "contracts" | "regulations" | "permits";
export interface LegalCheck {
  /** stable key per person, so a re-sign-up never makes a second task for the same check */
  key: string;
  area: LegalArea;
  severity: "info" | "warn";
  title: string;
  /** what to research or draft, for the agent */
  todo: string;
  /** true when the answer needs a licensed attorney before anything binding is done */
  attorney: boolean;
}

export type SignupEvent =
  | {
      kind: "pro";
      name: string;
      zips: string[];
      state?: string | null;
      trades: string[];
      /** trades that need a license (core LICENSED_TRADES) */
      licensedTrades: string[];
      licenseGiven: boolean;
      insured: boolean;
      /** does this ZIP / state already have another approved pro (i.e. is this the first pro there)? */
      firstInState?: boolean;
    }
  | { kind: "partner"; name: string; partnerKind: string; company?: string | null; agreementVersion: string | null; currentVersion: string; state?: string | null };

export function signupLegalChecks(e: SignupEvent): LegalCheck[] {
  const out: LegalCheck[] = [];
  if (e.kind === "pro") {
    const st = (e.state || stateForZip(e.zips.find((z) => /^\d{5}$/.test(z)) ?? null) || "").toUpperCase() || null;
    const sn = stateName(st) ?? "their state";
    const licensed = e.trades.filter((t) => e.licensedTrades.includes(t));
    if (licensed.length && !e.licenseGiven) {
      out.push({ key: "license", area: "pros", severity: "warn", attorney: false,
        title: `License needed: ${e.name} (${licensed.join(", ")}, ${st ?? "state unknown"})`,
        todo: `Find what ${sn} (and the pro's city or county) requires for ${licensed.join(", ")} work, name the board and the license type, and draft a short note asking the pro for their license number and expiry. Until it's verified they get no licensed jobs.` });
    }
    if (!e.insured) {
      out.push({ key: "insurance", area: "pros", severity: "warn", attorney: false,
        title: `No liability insurance yet: ${e.name}`,
        todo: `The pro said they don't carry general liability. Draft a note on our minimum coverage (see the onboarding checklist) and where they can get it; they can't be approved without a certificate on file.` });
    }
    if (st && STRICT_CLASSIFICATION_STATES[st]) {
      out.push({ key: `classification-${st}`, area: "regulations", severity: "warn", attorney: true,
        title: `Worker classification review: ${e.name} in ${sn}`,
        todo: `${sn} uses an ${STRICT_CLASSIFICATION_STATES[st]}. Check the pro has their own business (entity or DBA, EIN, other clients, own tools and insurance) and list anything in how we dispatch or pay them there that a licensed attorney should look at.` });
    }
    if (st && !LAUNCHED.has(st) && e.firstInState !== false) {
      out.push({ key: `new-state-${st}`, area: "regulations", severity: "info", attorney: true,
        title: `New state: first pro in ${sn} (${e.name})`,
        todo: `Services open in ${sn} when this pro is approved. Summarize what Handled needs there before taking bookings: sales tax on home services and whether we must register to collect it, a business registration or foreign-qualification filing, home-improvement contractor rules for the platform, and any marketplace-facilitator rules. Flag each for a licensed attorney or accountant.` });
    }
    return out;
  }
  // partners
  const sn = stateName(e.state) ?? null;
  if (e.agreementVersion !== e.currentVersion) {
    out.push({ key: `agreement-${e.currentVersion}`, area: "contracts", severity: "warn", attorney: false,
      title: `Partner agreement not current: ${e.name}`,
      todo: `They're on ${e.agreementVersion ?? "no signed agreement"}; the current one is ${e.currentVersion}. Draft a short email asking them to sign it from their portal.` });
  }
  if (e.partnerKind === "realtor" || e.partnerKind === "property_manager") {
    out.push({ key: "referral-fee-rules", area: "regulations", severity: "warn", attorney: true,
      title: `Referral-fee rules: ${e.name}${e.company ? ` (${e.company})` : ""}`,
      todo: `${e.partnerKind === "realtor" ? "A real-estate agent" : "A property manager"} gets paid for referrals. Check ${sn ?? "their state"}'s real-estate license-law rules on referral fees and any RESPA concern, and draft a disclosure: whether their brokerage or employer allows it, and whether they must tell the owner or client they're paid for the referral. A property manager referring work on a client's property must disclose the fee to that owner.` });
  }
  if (e.partnerKind === "contractor" || e.partnerKind === "business") {
    out.push({ key: "conflict-check", area: "contracts", severity: "info", attorney: false,
      title: `Conflict check: ${e.name}${e.company ? ` (${e.company})` : ""}`,
      todo: `Check whether they compete with our pros or employ any of them, and whether the agreement's non-solicitation of pros and customers covers it. Flag anything unusual.` });
  }
  return out;
}
