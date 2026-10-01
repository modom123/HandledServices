/*
 * FILE    : apps/web/lib/ai/qa.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : AI quality assurance. When a pro marks a job done, Claude compares the
 *           completion photos to what was booked. Passing jobs close automatically;
 *           anything doubtful goes to a human in the ops hub before the customer is
 *           charged and the pro is paid.
 */
import "server-only";
import { z } from "zod";
import { getService, type Job } from "@handled/core";
import { imageBlocks, structured } from "./client";

const QaSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  issues: z.array(z.string()),
  customer_summary: z.string().describe("Short, friendly completion note for the customer"),
  needs_human_review: z.boolean(),
});
export type AiQa = z.infer<typeof QaSchema>;

export async function aiQualityCheck(job: Job, completionPhotoUrls: string[], proNote: string | null): Promise<AiQa | null> {
  if (!completionPhotoUrls.length) return null;
  const svc = getService(job.service_slug);
  return structured({
    kind: "qa",
    jobId: job.id,
    schema: QaSchema,
    system:
      "You review completion photos from subcontracted home-service crews. Judge whether the photos show the booked work " +
      "done to a professional standard. Be fair: photos are phone shots. Fail only for visible problems or missing scope; " +
      "set needs_human_review when the photos don't show enough to judge.",
    content: [
      ...imageBlocks(completionPhotoUrls),
      {
        type: "text",
        text: `Booked: ${svc?.name}\nIncludes: ${svc?.includes.join("; ")}\nAnswers: ${JSON.stringify(job.answers)}\nCustomer notes: ${job.notes ?? "(none)"}\nPro's completion note: ${proNote ?? "(none)"}`,
      },
    ],
    effort: "low",
  });
}
