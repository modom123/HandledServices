/*
 * FILE    : apps/web/lib/ai/client.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Shared Claude plumbing: client, model, refusal fallbacks, structured-output
 *           helper and the ai_runs audit log. Every AI feature degrades gracefully —
 *           if ANTHROPIC_API_KEY is missing or a call fails, callers get `null` and use
 *           the deterministic engine in @handled/core instead.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { adminClient } from "../supabase/server";

export const MODEL = "claude-opus-5-5";

/** Server-side refusal fallback: a declined request is re-run on Anthropic's recommended model. */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
} as const;

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
export const anthropic = () => (client ??= new Anthropic());

type Effort = "low" | "medium" | "high";
export type ContentBlocks = Anthropic.Beta.BetaContentBlockParam[];

export async function logRun(entry: {
  kind: string;
  jobId?: string | null;
  input?: unknown;
  output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number } | null;
  ok?: boolean;
}) {
  try {
    await adminClient().from("ai_runs").insert({
      kind: entry.kind,
      job_id: entry.jobId ?? null,
      model: MODEL,
      input: entry.input ?? null,
      output: entry.output ?? null,
      input_tokens: entry.usage?.input_tokens ?? null,
      output_tokens: entry.usage?.output_tokens ?? null,
      ok: entry.ok ?? true,
    } as never);
  } catch {
    // logging must never break a customer flow
  }
}

/**
 * One structured Claude call. Returns the schema-validated object, or null when AI is
 * disabled, the request was refused, or the call failed (callers fall back).
 */
export async function structured<S extends z.ZodType>(opts: {
  kind: string;
  schema: S;
  system: string;
  content: string | ContentBlocks;
  effort?: Effort;
  jobId?: string | null;
  maxTokens?: number;
}): Promise<z.infer<S> | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      ...FALLBACK,
      betas: [...FALLBACK.betas],
      system: opts.system,
      output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.content }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      await logRun({ kind: opts.kind, jobId: opts.jobId, input: summarize(opts.content), output: { stop_reason: res.stop_reason }, usage: res.usage, ok: false });
      return null;
    }
    await logRun({ kind: opts.kind, jobId: opts.jobId, input: summarize(opts.content), output: res.parsed_output, usage: res.usage });
    return res.parsed_output as z.infer<S>;
  } catch (err) {
    console.error(`[ai:${opts.kind}]`, err);
    await logRun({ kind: opts.kind, jobId: opts.jobId, input: summarize(opts.content), output: { error: String(err) }, ok: false });
    return null;
  }
}

/** Keep image payloads out of the audit log. */
function summarize(content: string | ContentBlocks) {
  if (typeof content === "string") return { text: content };
  return { blocks: content.map((b) => (b.type === "text" ? { text: b.text } : { type: b.type })) };
}

export function imageBlocks(urls: string[]): ContentBlocks {
  // HEIC (iPhone) can't be read by the model — skip it rather than fail the whole check
  return urls.filter((u) => !/\.hei[cf](\?|$)/i.test(u)).slice(0, 8).map((url) => ({ type: "image", source: { type: "url", url } }));
}
