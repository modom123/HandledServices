/*
 * FILE    : apps/web/lib/contracts/index.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : The contract library: every customer, business and pro contract, and which ones
 *           apply when —
 *             bookingContracts(slug, business)  — accepted with each booking
 *             proSigningSet(trades)             — signed by a pro in onboarding
 *           Plus a content hash so a person's frozen copy can be proven unchanged.
 */
import { createHash } from "node:crypto";
import { getService } from "@handled/core";
import type { Contract } from "./types";
import { BUSINESS_MSA, CUSTOMER_ADDENDA, CUSTOMER_CONTRACTS, MEMBERSHIP_PROMO_TERMS, SERVICE_AGREEMENT, TERMS_OF_USE } from "./customer";
import { PRO_ADDENDA, PRO_AGREEMENT, PRO_BACKGROUND_CHECK_NOTICE, PRO_CODE_OF_CONDUCT, PRO_CONTRACTS, PRO_DEACTIVATION_POLICY, PRO_LOCATION_CONSENT } from "./pro";

export type { Contract, ContractSection, ContractAudience } from "./types";
export { BUSINESS_MSA, MEMBERSHIP_PROMO_TERMS, PRO_AGREEMENT, SERVICE_AGREEMENT, TERMS_OF_USE };

export const ALL_CONTRACTS: Contract[] = [...CUSTOMER_CONTRACTS, ...PRO_CONTRACTS];

export const getContract = (key: string) => ALL_CONTRACTS.find((c) => c.key === key) ?? null;

export const AUDIENCE_LABEL: Record<Contract["audience"], string> = { customer: "Customers", business: "Businesses", pro: "Pros (contractors)" };

/** Service-specific customer addenda for a service. */
export const addendaForService = (slug: string) => CUSTOMER_ADDENDA.filter((a) => a.services?.includes(slug));

/** Trade-specific pro addenda. */
export const addendaForTrades = (trades: string[]) => PRO_ADDENDA.filter((a) => a.trades?.some((t) => trades.includes(t)));

/** Accepted with every booking: Terms of Use, the Service Agreement, the addenda for that service, and the MSA for business bookings. */
export function bookingContracts(slug: string, business = false): Contract[] {
  return [TERMS_OF_USE, SERVICE_AGREEMENT, ...(business ? [BUSINESS_MSA] : []), ...(getService(slug) ? addendaForService(slug) : [])];
}

/** Signed by a pro (one e-signature covers the set): the agreement, its policies, consents and the addenda for their trades. */
export function proSigningSet(trades: string[]): Contract[] {
  return [PRO_AGREEMENT, PRO_CODE_OF_CONDUCT, PRO_DEACTIVATION_POLICY, PRO_BACKGROUND_CHECK_NOTICE, PRO_LOCATION_CONSENT, ...addendaForTrades(trades)];
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
