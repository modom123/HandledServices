/*
 * FILE    : apps/web/lib/ai/concierge.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Customer-facing AI concierge (website + mobile chat). Answers questions,
 *           recommends the right service, gives instant estimates from the real pricing
 *           engine and captures leads. It never promises a price outside the engine.
 */
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BRAND, SERVICES, estimate, getService, moneyRange } from "@handled/core";
import { FALLBACK, MODEL, aiEnabled, anthropic, logRun } from "./client";
import { adminClient } from "../supabase/server";

const catalog = SERVICES.map((s) => `- ${s.slug}: ${s.name} — ${s.tagline} (from $${s.minimum}${s.siteVisit ? ", firm price after site visit" : ""})`).join("\n");

const SYSTEM = `You are the ${BRAND.name} concierge. ${BRAND.pitch}
Services (slug: name):
${catalog}

How to help:
- Figure out which service fits, ask at most 2 short questions, then call get_estimate with your best answers.
- Quote only numbers returned by get_estimate, as a range. Mention that photos + notes at booking can tighten the price.
- For tree work and remodels, explain a pro confirms the firm price on a free site visit.
- When the customer is ready, point them to /book?service=<slug>. If they'd rather be called, collect name + phone/email and call save_lead.
- Payment: customers pay the full price upfront when they book (site visits for tree work, remodels and HVAC are free; they pay once the firm quote is approved). ${BRAND.promise}
- Be warm and brief (under 90 words). Plain text, no markdown headings.`;

const tools = [
  betaZodTool({
    name: "get_estimate",
    description: "Instant price estimate from the company pricing engine. Unknown answers fall back to typical defaults.",
    inputSchema: z.object({
      service_slug: z.string(),
      answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe("Question id → answer; see list_questions"),
      frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).optional(),
    }),
    run: async ({ service_slug, answers, frequency }) => {
      const svc = getService(service_slug);
      if (!svc) return `Unknown service ${service_slug}`;
      const defaults = Object.fromEntries(svc.questions.map((q) => [q.id, q.default]));
      const e = estimate({ slug: service_slug, answers: { ...defaults, ...answers }, frequency });
      return JSON.stringify({ range: moneyRange(e.low, e.high), per: frequency && frequency !== "once" ? "visit" : "job", site_visit_required: e.siteVisit, items: e.items });
    },
  }),
  betaZodTool({
    name: "list_questions",
    description: "The pricing questions (ids, options, defaults) for a service.",
    inputSchema: z.object({ service_slug: z.string() }),
    run: async ({ service_slug }) => JSON.stringify(getService(service_slug)?.questions ?? "unknown service"),
  }),
  betaZodTool({
    name: "save_lead",
    description: "Save a callback request so a coordinator reaches out.",
    inputSchema: z.object({
      name: z.string(), email: z.string().optional(), phone: z.string().optional(), zip: z.string().optional(),
      service_slug: z.string().optional(), message: z.string(),
    }),
    run: async (lead) => {
      const { error } = await adminClient().from("leads").insert({ ...lead, source: "ai_chat" });
      return error ? `Could not save: ${error.message}` : "Saved — a coordinator will reach out within 1 business hour.";
    },
  }),
];

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function conciergeReply(history: ChatTurn[]): Promise<string> {
  if (!aiEnabled()) return `Our AI concierge is offline right now. You can book instantly at /book or call ${BRAND.supportPhone}.`;
  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.content }));
  try {
    const final = await anthropic().beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 4000,
      ...FALLBACK,
      betas: [...FALLBACK.betas],
      output_config: { effort: "low" },
      system: SYSTEM,
      tools,
      max_iterations: 6,
      messages,
    });
    await logRun({ kind: "concierge", input: { last: history.at(-1)?.content }, usage: final.usage });
    if (final.stop_reason === "refusal") return `I can't help with that here, but our team can: ${BRAND.supportPhone}.`;
    return final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim() || "Could you tell me a bit more?";
  } catch (err) {
    console.error("[ai:concierge]", err);
    return `Sorry — I hit a snag. You can book at /book or call ${BRAND.supportPhone}.`;
  }
}
