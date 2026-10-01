/*
 * FILE    : apps/web/lib/ai/quote.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : AI quote review. Claude reads the customer's answers, notes and photos and
 *           proposes a price adjustment to the deterministic baseline. The result is
 *           clamped by clampAiPrice() so the AI can't wildly over- or under-charge.
 */
import "server-only";
import { z } from "zod";
import { clampAiPrice, estimate, getService, roundTo, type Answers, type Estimate, type Frequency } from "@handled/core";
import { imageBlocks, structured } from "./client";

const QuoteSchema = z.object({
  proposed_price: z.number().describe("Best single price for one visit in USD, after considering photos and notes"),
  confidence: z.enum(["low", "medium", "high"]),
  needs_site_visit: z.boolean().describe("True if a firm price is impossible without seeing the job in person"),
  adjustments: z.array(z.object({ reason: z.string(), amount: z.number() })).describe("Changes vs the baseline, + or -"),
  customer_summary: z.string().describe("1-2 friendly sentences explaining the price to the customer"),
  ops_notes: z.string().describe("Anything the crew or dispatcher should know (access, hazards, upsells)"),
  risk_flags: z.array(z.string()).describe("e.g. 'possible hazmat', 'scope larger than stated', 'power lines'"),
});
export type AiQuote = z.infer<typeof QuoteSchema> & { final_price: number; low: number; high: number };

const SYSTEM = `You are the pricing analyst for a home & business services company that sends vetted subcontractors.
You receive a deterministic baseline price built from the customer's answers. Your job: check the answers against
the free-text notes and any photos, and propose a fair single-visit price. Stay close to the baseline unless the
notes or photos clearly show more or less work than the answers describe. Never invent services the customer did
not ask for. Flag safety risks (power lines, asbestos-era materials, hazardous waste, structural issues).`;

export async function aiQuote(input: {
  slug: string;
  answers: Answers;
  frequency: Frequency;
  notes?: string | null;
  photoUrls?: string[];
  rush?: boolean;
  jobId?: string | null;
}): Promise<{ baseline: Estimate; ai: AiQuote | null }> {
  const baseline = estimate({ slug: input.slug, answers: input.answers, frequency: input.frequency, rush: input.rush });
  const svc = getService(input.slug)!;
  const hasSignal = Boolean(input.notes?.trim()) || Boolean(input.photoUrls?.length);
  if (!hasSignal) return { baseline, ai: null }; // nothing for the AI to add — skip the call

  const text = [
    `Service: ${svc.name}`,
    `Answers: ${JSON.stringify(input.answers)}`,
    `Frequency: ${input.frequency}`,
    `Baseline line items: ${JSON.stringify(baseline.items)}`,
    `Baseline price: $${baseline.point} (allowed range after review: ±40%, minimum $${svc.minimum})`,
    `Customer notes: ${input.notes?.trim() || "(none)"}`,
    input.photoUrls?.length ? `${input.photoUrls.length} photo(s) attached.` : "No photos.",
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
  const final = clampAiPrice(baseline, out.proposed_price);
  const step = final >= 5000 ? 250 : final >= 1000 ? 25 : 5;
  return {
    baseline,
    ai: {
      ...out,
      final_price: final,
      low: roundTo(final * svc.spread[0], step),
      high: roundTo(final * svc.spread[1], step),
    },
  };
}
