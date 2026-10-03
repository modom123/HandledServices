/*
 * FILE    : apps/web/lib/ai/quote.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2334 UTC — never underbid: the AI corrects quantities the photos
 *           contradict (re-priced by the rules engine), may raise up to 40% and cut at most 10%;
 *           anything bigger becomes a free site visit (aiPriceDecision in @handled/core).
 * UPDATED : 2026-10-03_0148 UTC — baseline uses the learned local market factor.
 * PURPOSE : AI quote review. Claude reads the customer's answers, notes and photos and
 *           proposes a price for the work that's really there.
 */
import "server-only";
import { z } from "zod";
import { AI_MAX_CUT, aiPriceDecision, applyCorrections, estimate, getService, roundTo, type Answers, type Estimate, type Frequency, type PriceAction } from "@handled/core";
import { imageBlocks, structured } from "./client";

const QuoteSchema = z.object({
  corrected_answers: z.array(z.object({
    question_id: z.string().describe("id of the question whose answer the photos or notes contradict"),
    value: z.string().describe("the corrected answer (a number, an option value, or true/false)"),
    reason: z.string().describe("what in the photos or notes shows this, in plain words"),
  })).describe("Only where the photos or notes clearly show a different quantity or option than the customer entered. Empty if the answers look right."),
  proposed_price: z.number().describe("Best single-visit price in USD for the corrected scope"),
  confidence: z.enum(["low", "medium", "high"]),
  needs_site_visit: z.boolean().describe("True if a firm price is impossible without seeing the job in person"),
  adjustments: z.array(z.object({ reason: z.string(), amount: z.number() })).describe("Changes vs the corrected baseline, + or -"),
  customer_summary: z.string().describe("1-2 friendly sentences explaining the price to the customer"),
  ops_notes: z.string().describe("Anything the crew or dispatcher should know (access, hazards, upsells)"),
  risk_flags: z.array(z.string()).describe("e.g. 'possible hazmat', 'scope larger than stated', 'power lines'"),
});
export type AiQuote = z.infer<typeof QuoteSchema> & {
  final_price: number; low: number; high: number;
  /** price = book at final_price · site_visit = too big or unclear for an instant price */
  action: PriceAction; action_reason: string;
  /** The answers after corrections (what the job is booked and priced on). */
  answers: Answers;
  changes: { label: string; from: string; to: string; reason: string }[];
  baseline_point: number;
};

const SYSTEM = `You are the pricing analyst for a home & business services company that sends vetted subcontractors.
You receive the customer's answers to the booking questions, the deterministic price they produce, their notes and
photos. Your job is to make sure the job is priced for the work that is really there, so it is never underbid:
1. Compare every answer with the photos and notes. If they clearly show a different quantity or option (more rooms,
   a bigger driveway, a full truckload instead of a quarter, a second item), return a correction for that question.
2. Propose a fair single-visit price for the corrected scope. Stay close to the rules price unless the photos or notes
   show extra difficulty (heavy items, stairs, heavy soiling, tight access) or less work.
3. Set needs_site_visit when nobody could price it firmly from photos (structural, hidden damage, unclear scope).
Never invent services the customer did not ask for. Flag safety risks (power lines, asbestos-era materials, hazardous
waste, structural issues).`;

export async function aiQuote(input: {
  slug: string;
  answers: Answers;
  frequency: Frequency;
  notes?: string | null;
  photoUrls?: string[];
  rush?: boolean;
  jobId?: string | null;
  /** Language for what the customer reads (customer_summary, action_reason, change reasons). */
  locale?: "en" | "es";
  /** Learned local market factor (lib/market). */
  market?: number;
}): Promise<{ baseline: Estimate; ai: AiQuote | null }> {
  const baseline = estimate({ slug: input.slug, answers: input.answers, frequency: input.frequency, rush: input.rush, market: input.market });
  const svc = getService(input.slug)!;
  const hasSignal = Boolean(input.notes?.trim()) || Boolean(input.photoUrls?.length);
  if (!hasSignal) return { baseline, ai: null }; // nothing for the AI to add — skip the call

  const questions = svc.questions.map((q) => q.type === "number" ? `- ${q.id}: ${q.label} (number ${q.min}–${q.max}${q.unit ? ` ${q.unit}` : ""})`
    : q.type === "select" ? `- ${q.id}: ${q.label} (one of: ${q.options.map((o) => `${o.value}=${o.label}`).join(", ")})`
    : `- ${q.id}: ${q.label} (true/false)`).join("\n");
  const text = [
    `Service: ${svc.name}`,
    `Questions:\n${questions}`,
    `Customer's answers: ${JSON.stringify(input.answers)}`,
    `Frequency: ${input.frequency}`,
    `Rules-engine line items: ${JSON.stringify(baseline.items)}`,
    `Rules-engine price: $${baseline.point} (minimum $${svc.minimum})`,
    `Customer notes: ${input.notes?.trim() || "(none)"}`,
    input.photoUrls?.length ? `${input.photoUrls.length} photo(s) attached.` : "No photos.",
    ...(input.locale === "es" ? ["The customer reads Spanish: write customer_summary, action_reason and every change's from/to/reason in Spanish (formal usted). Keep ids, numbers and option values unchanged."] : []),
  ].join("\n");

  const out = await structured({
    kind: "quote",
    jobId: input.jobId,
    schema: QuoteSchema,
    system: SYSTEM,
    content: [...imageBlocks(input.photoUrls ?? []), { type: "text", text }],
    effort: "low",
  });
  if (!out) return { baseline, ai: null };
  // corrections are re-priced by the rules engine, not taken on trust
  const fixed = applyCorrections(input.slug, input.answers, out.corrected_answers);
  const corrected = estimate({ slug: input.slug, answers: fixed.answers, frequency: input.frequency, rush: input.rush, market: input.market });
  const d = aiPriceDecision(corrected, out.proposed_price, { needsSiteVisit: out.needs_site_visit, confidence: out.confidence });
  // never more than 10% under what the customer's own answers price at
  const final = Math.max(d.final, Math.round(baseline.point * (1 - AI_MAX_CUT)));
  const step = final >= 5000 ? 250 : final >= 1000 ? 25 : 5;
  return {
    baseline,
    ai: {
      ...out,
      action: d.action,
      action_reason: d.reason,
      answers: fixed.answers,
      changes: fixed.changes,
      baseline_point: baseline.point,
      final_price: final,
      low: roundTo(final * svc.spread[0], step),
      high: roundTo(final * svc.spread[1], step),
    },
  };
}
