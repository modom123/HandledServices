/*
 * FILE    : apps/web/lib/contracts/index.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : The contract library: every customer, business and pro contract, and which ones
 *           apply when —
 *             bookingContracts(slug, business)  — accepted with each booking
 *             proSigningSet(trades)             — signed by a pro in onboarding
 *           Plus a content hash so a person's frozen copy can be proven unchanged.
 * UPDATED : 2026-10-03_0050 UTC — Spanish: localized(contract, lang) from the translations in es.ts.
 * UPDATED : 2026-10-05_2034 UTC — Handled Talent client agreement (recruiting services).
 * UPDATED : 2026-11-06_0311 UTC — state addenda (state.ts): New York, New Jersey and Nevada. bookingContracts(slug, business, zip) adds the
 *           one for the service address; proSigningSet(trades, where) adds the ones for where the pro is based and works.
 */
import { createHash } from "node:crypto";
import { getService } from "@handled/core";
import type { Contract, ContractTranslation } from "./types";
import { CONTRACTS_ES } from "./es";
import { BUSINESS_MSA, CUSTOMER_ADDENDA, CUSTOMER_CONTRACTS, MEMBERSHIP_PROMO_TERMS, SERVICE_AGREEMENT, TERMS_OF_USE } from "./customer";
import { TALENT_CLIENT_AGREEMENT } from "./talent";
import { STATE_CUSTOMER_ADDENDA, STATE_PRO_ADDENDA, customerStateAddendum, proStateAddenda, type ProWhere } from "./state";
import { PRO_ADDENDA, PRO_CREW_ADDENDUM, PRO_AGREEMENT, PRO_BACKGROUND_CHECK_NOTICE, PRO_CODE_OF_CONDUCT, PRO_CONTRACTS, PRO_DEACTIVATION_POLICY, PRO_LOCATION_CONSENT } from "./pro";

export type { Contract, ContractSection, ContractAudience, ContractTranslation } from "./types";
export { BUSINESS_MSA, MEMBERSHIP_PROMO_TERMS, PRO_AGREEMENT, PRO_CREW_ADDENDUM, SERVICE_AGREEMENT, TERMS_OF_USE };

export const ALL_CONTRACTS: Contract[] = [...CUSTOMER_CONTRACTS, ...STATE_CUSTOMER_ADDENDA, TALENT_CLIENT_AGREEMENT, ...PRO_CONTRACTS, ...STATE_PRO_ADDENDA];
export { STATE_CUSTOMER_ADDENDA, STATE_PRO_ADDENDA, customerStateAddendum, proStateAddenda };
export { TALENT_CLIENT_AGREEMENT };

export const getContract = (key: string) => ALL_CONTRACTS.find((c) => c.key === key) ?? null;

export const AUDIENCE_LABEL: Record<Contract["audience"], string> = { customer: "Customers", business: "Businesses", pro: "Pros (contractors)" };

/** Service-specific customer addenda for a service. */
export const addendaForService = (slug: string) => CUSTOMER_ADDENDA.filter((a) => a.services?.includes(slug));

/** Trade-specific pro addenda. */
export const addendaForTrades = (trades: string[]) => PRO_ADDENDA.filter((a) => a.trades?.some((t) => trades.includes(t)));

/**
 * Accepted with every booking: Terms of Use, the Service Agreement, the addenda for that service, the MSA for business
 * bookings, and the state addendum for the service address (New York, New Jersey, Nevada).
 */
export function bookingContracts(slug: string, business = false, zip?: string | null): Contract[] {
  const state = customerStateAddendum(zip);
  return [TERMS_OF_USE, SERVICE_AGREEMENT, ...(business ? [BUSINESS_MSA] : []), ...(getService(slug) ? addendaForService(slug) : []), ...(state ? [state] : [])];
}

/**
 * Signed by a pro (one e-signature covers the set): the agreement, its policies, consents, the addenda for their trades,
 * and the state addenda for where they're based and the ZIPs they cover (New York, New Jersey, Nevada).
 */
export function proSigningSet(trades: string[], where: ProWhere = {}): Contract[] {
  return [PRO_AGREEMENT, PRO_CODE_OF_CONDUCT, PRO_DEACTIVATION_POLICY, PRO_BACKGROUND_CHECK_NOTICE, PRO_LOCATION_CONSENT, ...addendaForTrades(trades), ...proStateAddenda(where)];
}

/** SHA-256 of exactly what was shown — stored with each acceptance. */
export function contractHash(c: Pick<Contract, "key" | "version" | "title" | "sections">): string {
  return createHash("sha256").update(JSON.stringify({ key: c.key, version: c.version, title: c.title, sections: c.sections })).digest("hex");
}

/** Plain text / Markdown of a contract (Hub download, docs export). */
export function contractMarkdown(c: Contract): string {
  return [
    `## ${c.title}`,
    `Version ${c.version} · ${AUDIENCE_LABEL[c.audience]} · ${c.appliesTo}`,
    c.services?.length ? `Applies to services: ${c.services.map((s) => getService(s)?.name ?? s).join(", ")}` : "",
    c.trades?.length ? `Applies to trades: ${c.trades.join(", ")}` : "",
    `### The short version\n${c.summary.map((s) => `- ${s}`).join("\n")}`,
    ...c.sections.map((s) => `### ${s.h}\n${s.p}`),
  ].filter(Boolean).join("\n\n");
}

/** The contract in a language; falls back to English (translated: false) when no translation exists. */
export function localized(c: Contract, lang: string | null | undefined): ContractTranslation & { translated: boolean; lang: "en" | "es" } {
  const es = lang === "es" ? CONTRACTS_ES[c.key] : undefined;
  if (es && es.sections.length === c.sections.length) return { ...es, translated: true, lang: "es" };
  return { title: c.title, appliesTo: c.appliesTo, summary: c.summary, sections: c.sections, translated: false, lang: lang === "es" ? "es" : "en" };
}

/** Spanish translation of a contract, if there is a complete one. */
export const spanishOf = (c: Contract) => { const es = CONTRACTS_ES[c.key]; return es && es.sections.length === c.sections.length ? es : null; };
