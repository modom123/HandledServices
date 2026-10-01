/*
 * FILE    : apps/web/lib/ai/screen.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : First-pass screening of subcontractor applications. Advisory only — a
 *           human approves every pro, and insurance/background checks are verified
 *           outside the AI.
 */
import "server-only";
import { z } from "zod";
import { structured } from "./client";

const ScreenSchema = z.object({
  recommendation: z.enum(["approve_after_checks", "interview", "decline"]),
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  verify: z.array(z.string()).describe("Documents or facts ops must verify before approval"),
});
export type AiScreen = z.infer<typeof ScreenSchema>;

export function aiScreenApplication(app: Record<string, unknown>) {
  return structured({
    kind: "screen",
    schema: ScreenSchema,
    system:
      "You screen subcontractor applications for a home-services marketplace. Evaluate fit for the trades they selected, " +
      "experience, crew size and insurance. Never base the recommendation on name, age, gender, race, religion, national " +
      "origin or any other protected characteristic — only on business qualifications. Always list insurance, license (where " +
      "the trade needs one) and background check under `verify`.",
    content: JSON.stringify(app),
    effort: "low",
  });
}
