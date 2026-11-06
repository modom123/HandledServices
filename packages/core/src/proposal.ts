/*
 * FILE    : packages/core/src/proposal.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-06_0400 UTC
 * PURPOSE : The proposal writer's rules (Hub → Bids → Proposal). Pure functions shared by the server, the screen and tests:
 *             defaultOutline      — a starting outline by solicitation type, used when the AI can't build one
 *             needsInput          — the [[NEEDS: …]] markers the AI leaves wherever a fact isn't in our profile or the documents
 *             proposalGate        — what still blocks submission: every section approved, no open markers, page limits
 *             wordsToPages        — rough page count (≈500 words a page) to warn before a page limit is broken
 *             pricingRequired     — RFIs and sources-sought responses are capability statements with no price form
 */
import type { SolicitationType } from "./bid-engine.ts";

export type ProposalStatus = "outline" | "draft" | "edited" | "approved";
export interface ProposalSectionLite { title: string; status: ProposalStatus; content: string; page_limit?: number | null }
export interface OutlineSection { title: string; guidance: string }

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = { outline: "Outline", draft: "AI draft", edited: "Edited", approved: "Approved" };

const COVER: OutlineSection = { title: "Cover letter", guidance: "One page: the solicitation number, who we are, what we offer, that we accept the terms (or list exceptions), how long the offer is valid, and who signs." };

/** A sensible starting outline when the solicitation's own instructions (Section L / "proposal format") aren't available. */
export function defaultOutline(type: SolicitationType): OutlineSection[] {
  if (type === "rfi" || type === "sources_sought") {
    return [
      { title: "Company information", guidance: "Name, UEI, CAGE, address, point of contact, business size and socio-economic status for the NAICS code in the notice." },
      { title: "Capability statement", guidance: "Answer the notice's capability questions in its order. Show we can do this exact work, with concrete examples." },
      { title: "Relevant experience", guidance: "Projects like this one: customer, dates, size, what we did, results. Only real projects from the profile." },
      { title: "Answers to the agency's questions", guidance: "Answer every question the notice asks, numbered the same way." },
      { title: "Recommendations to the agency", guidance: "Short, useful suggestions (e.g. set it aside for small business, a pilot first, the right NAICS code)." },
    ];
  }
  if (type === "rfq" || type === "ifb") {
    return [
      COVER,
      { title: "Company & capability", guidance: "Who we are, registrations, size status, and why we can do this work." },
      { title: "Approach & schedule", guidance: "How we will do the work, staffing, schedule, and how we meet each performance standard." },
      { title: "Past performance", guidance: "Similar contracts with references. Only real ones from the profile." },
      { title: "Price narrative & assumptions", guidance: "What the price includes and assumes. The numbers come from the price form, never invented." },
    ];
  }
  return [
    COVER,
    { title: "Executive summary", guidance: "The agency's need in its words, our solution, and the three reasons to choose us, tied to the evaluation factors." },
    { title: "Technical approach", guidance: "How we meet every requirement in the statement of work, in its order. Methods, tools, deliverables, schedule." },
    { title: "Management approach & staffing", guidance: "Organization, key personnel (real people only), communication, risk management and transition-in." },
    { title: "Quality control", guidance: "How we measure and assure quality: standards, inspections, corrective action, reporting." },
    { title: "Past performance", guidance: "Similar contracts with customer, dates, value, scope, results and a reference. Only real ones from the profile." },
    { title: "Price narrative & assumptions", guidance: "What the price includes and assumes. The numbers come from the price form, never invented." },
  ];
}

/** The [[NEEDS: …]] markers the AI leaves where a fact is missing, in order, without duplicates. */
export function needsInput(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\[\[\s*NEEDS?\s*:?\s*([^\]]*?)\s*\]\]/gi)) {
    const v = m[1].trim() || "missing information";
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
/** Rough pages at ≈500 words a single-spaced page, rounded up to a tenth. */
export const wordsToPages = (words: number) => Math.ceil((words / 500) * 10) / 10;

/** RFIs and sources-sought notices are answered without a price. */
export const pricingRequired = (type: SolicitationType | null | undefined) => !(type === "rfi" || type === "sources_sought");

/** What the proposal still needs before the bid can be submitted. No sections = no proposal check (a price-only bid). */
export function proposalGate(sections: ProposalSectionLite[]) {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!sections.length) return { missing, warnings, markers: 0 };
  const empty = sections.filter((s) => !s.content.trim());
  if (empty.length) missing.push(`${empty.length} proposal section${empty.length > 1 ? "s" : ""} not written yet`);
  const markers = sections.reduce((n, s) => n + needsInput(s.content).length, 0);
  if (markers) missing.push(`${markers} [[NEEDS]] item${markers > 1 ? "s" : ""} to fill in the proposal`);
  const unapproved = sections.filter((s) => s.status !== "approved").length;
  if (unapproved) missing.push(`${unapproved} proposal section${unapproved > 1 ? "s" : ""} not approved`);
  for (const s of sections) {
    if (s.page_limit && s.page_limit > 0) {
      const pages = wordsToPages(wordCount(s.content));
      if (pages > s.page_limit) warnings.push(`"${s.title}" is about ${pages} pages; the limit is ${s.page_limit}`);
    }
  }
  return { missing, warnings, markers };
}
