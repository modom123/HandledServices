/*
 * FILE    : apps/web/lib/ai/resume.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1900 UTC
 * PURPOSE : Résumé reader. Staff upload the résumé of a pro they've phone-interviewed (Hub → Recruiting → Add an
 *           approved pro) and this fills in the form: name, email, phone, ZIP, years of experience, trades and skills
 *           (only our TRADES / TRADE_PROFILES ids), and a short summary. PDF or photo (Word can't be read — staff type it).
 *           Advisory only: staff check the form before they approve.
 */
import "server-only";
import { z } from "zod";
import { TRADES, TRADE_PROFILES } from "@handled/core";
import { structured, type ContentBlocks } from "./client";

const ResumeSchema = z.object({
  readable: z.boolean().describe("False if this isn't a résumé or work history, or can't be read"),
  full_name: z.string().describe("As printed, else empty"),
  email: z.string().describe("As printed, else empty"),
  phone: z.string().describe("As printed, else empty"),
  zip: z.string().describe("5-digit ZIP of their address if printed, else empty"),
  business_name: z.string().describe("Their own business name if they run one, else empty"),
  years_experience: z.number().describe("Total years doing this kind of hands-on work, from the dates; 0 if unclear"),
  trades: z.array(z.string()).describe("Trade ids from the list that the work history clearly shows, best first, at most 5"),
  specialties: z.array(z.string()).describe("Skill ids from the list that the work history clearly shows"),
  summary: z.string().describe("2–3 short lines: recent relevant jobs, tools/equipment, licenses or certifications"),
});
export type ResumeRead = z.infer<typeof ResumeSchema>;

const IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const canReadResume = (contentType: string) => contentType === "application/pdf" || (IMAGE as readonly string[]).includes(contentType);

export async function aiReadResume(r: { data: string; contentType: string }): Promise<ResumeRead | null> {
  if (!canReadResume(r.contentType)) return null;
  const block = r.contentType === "application/pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: r.data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: r.contentType as (typeof IMAGE)[number], data: r.data } };
  const trades = TRADES.map((t) => `${t.id} (${t.label})`).join(", ");
  const skills = TRADES.map((t) => `${t.id}: ${(TRADE_PROFILES[t.id]?.specialties ?? []).map((s) => s.id).join(", ")}`).filter((x) => !x.endsWith(": ")).join("\n");
  const out = await structured({
    kind: "resume_reader",
    schema: ResumeSchema,
    system: "You read résumés of tradespeople for a home-services company and fill in a form. Copy contact details exactly as printed; never invent them. Choose trades and skills only from the ids given, and only when the work history shows them.",
    content: [block, { type: "text", text: `Trade ids: ${trades}\n\nSkill ids by trade:\n${skills}` }] as ContentBlocks,
    effort: "low",
    maxTokens: 4000,
  });
  if (!out) return null;
  const tradeIds = new Set(TRADES.map((t) => t.id));
  const picked = out.trades.filter((t) => tradeIds.has(t)).slice(0, 5);
  const skillIds = new Set(picked.flatMap((t) => (TRADE_PROFILES[t]?.specialties ?? []).map((s) => s.id)));
  return { ...out, trades: picked, specialties: out.specialties.filter((s) => skillIds.has(s)) };
}
