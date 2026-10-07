/*
 * FILE    : apps/web/lib/ai/concierge.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — asks how soon they need it and their budget; passes both to /book and leads.
 * PURPOSE : Customer-facing AI concierge (website + mobile chat). Answers questions,
 *           recommends the right service, gives instant estimates from the real pricing
 *           engine and captures leads. It never promises a price outside the engine.
 * UPDATED : 2026-10-06_0752 UTC — runs with the shared mission, standing and assigned tasks (kept internal: never told to customers).
 * UPDATED : 2026-10-07_1830 UTC — get_estimate takes the ZIP and applies the area price level.
 */
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BRAND, SERVICES, estimate, getService, moneyRange } from "@handled/core";
import { FALLBACK, MODEL, aiEnabled, anthropic, logRun } from "./client";
import { systemFor } from "./agent-tasks";
import { adminClient } from "../supabase/server";

const catalog = SERVICES.map((s) => `- ${s.slug}: ${s.name} — ${s.tagline} (from $${s.minimum}${s.siteVisit ? ", firm price after site visit" : ""})`).join("\n");

const SYSTEM = `You are the ${BRAND.name} concierge. ${BRAND.pitch}
Services (slug: name):
${catalog}

How to help:
- Figure out which service fits, ask at most 2 short questions, then call get_estimate with your best answers.
- Also ask how soon they need it (asap, this_week, two_weeks, month or flexible) and, if it helps, their budget. If our price is above their budget, suggest a smaller scope, a flexible date (no priority fee) or a recurring plan — never promise a lower price.
- Quote only numbers returned by get_estimate, as a range. Mention that photos + notes at booking can tighten the price.
- For tree work, remodels, HVAC, commercial or very large painting and other big jobs, explain a pro confirms the firm price on a free site visit.
- Some services need photos at booking (e.g. junk removal, repairs, painting); tell the customer which shots help.
- When the customer is ready, point them to /book?service=<slug>&when=<asap|this_week|two_weeks|month|flexible>&budget=<number, if given>. If they'd rather be called, collect name + phone/email and call save_lead.
- Payment: customers pay the full price upfront when they book (site visits are free; they pay once the firm quote is approved). ${BRAND.promise}
- Be warm and brief (under 90 words). Plain text, no markdown headings.
- Always reply in the customer's language: if they write in Spanish, answer in Spanish ("usted").`;

const tools = [
  betaZodTool({
    name: "get_estimate",
    description: "Instant price estimate from the company pricing engine. Unknown answers fall back to typical defaults.",
    inputSchema: z.object({
      service_slug: z.string(),
      answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).describe("Question id → answer; see list_questions"),
      frequency: z.enum(["once", "weekly", "biweekly", "monthly", "quarterly"]).optional(),
      zip: z.string().regex(/^\d{5}$/).optional().describe("The customer's 5-digit ZIP if known — prices differ by area (Seattle area and Washington cost more)"),
    }),
    run: async ({ service_slug, answers, frequency, zip }) => {
      const svc = getService(service_slug);
      if (!svc) return `Unknown service ${service_slug}`;
      const defaults = Object.fromEntries(svc.questions.map((q) => [q.id, q.default]));
      const region = zip ? await (await import("../launch")).regionFactor(zip) : 1;
      const e = estimate({ slug: service_slug, answers: { ...defaults, ...answers }, frequency, region });
      return JSON.stringify({ range: moneyRange(e.low, e.high), ...(zip ? {} : { note: "Prices vary by area: ask for the ZIP to quote exactly (Washington is higher)." }), per: frequency && frequency !== "once" ? "visit" : "job", site_visit_required: e.siteVisit, items: e.items });
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
      when: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).optional().describe("How soon they need it"),
      budget: z.number().optional().describe("What they want to spend, dollars"),
    }),
    run: async ({ when, budget, ...lead }) => {
      const extra = [when && `Needs it: ${when.replace("_", " ")}`, budget && `Budget: $${budget}`].filter(Boolean).join(" · ");
      const { error } = await adminClient().from("leads").insert({ ...lead, message: extra ? `${lead.message}\n${extra}` : lead.message, source: "ai_chat" });
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
      system: await systemFor("concierge", SYSTEM),
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
