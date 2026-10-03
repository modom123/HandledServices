/*
 * FILE    : apps/web/lib/contracts/types.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0037 UTC
 * PURPOSE : Shape of every contract Handled uses. One source of truth: the same text renders on
 *           the website (/terms/…), prints on invoices, is signed in the pro portal, and is
 *           exported to docs/CONTRACTS_*.md for attorney review (scripts/build-contracts-md.ts).
 *           TEMPLATES — not legal advice; have counsel in each state review before use.
 */

export type ContractAudience = "customer" | "business" | "pro";

export interface ContractSection {
  /** Heading, numbered: "4. Payment". */
  h: string;
  /** Body. Plain English. Paragraphs separated by a blank line ("\n\n"); bullet lines start with "• ". */
  p: string;
}

export interface Contract {
  /** URL slug: /terms/<key> (customers & businesses) or /pro/terms/<key> style keys for pros. */
  key: string;
  title: string;
  /** Bump when the meaning changes. Customer contracts are accepted per booking; pro contracts are re-signed. */
  version: string;
  audience: ContractAudience;
  /** Who signs / when it applies, one sentence. */
  appliesTo: string;
  /** "The short version" — 4–8 plain-English bullets shown above the full text. Not a substitute for it. */
  summary: string[];
  sections: ContractSection[];
  /** Service slugs an addendum applies to (addenda only). */
  services?: string[];
  /** Pro trades an addendum applies to (pro addenda only). */
  trades?: string[];
}
