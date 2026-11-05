/*
 * FILE    : apps/web/app/api/pro/onboarding/upload/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-04_2345 UTC
 * PURPOSE : Pro onboarding uploads, step 1 of 2: POST { step, name, type, size } → { path, token, type }, a one-time signed
 *           upload into the private pro-docs bucket. The browser sends the file straight to storage (no 4.5 MB Vercel
 *           limit), then saves the step on /api/pro/onboarding with file_path = path, which checks the file is there.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { docUploadTicket, isDocStep } from "@/lib/photos";

const Body = z.object({ step: z.string(), name: z.string().max(240), type: z.string().max(120), size: z.number().int().nonnegative() });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success || !isDocStep(b.data.step)) return deny(400, "Unknown upload");
  try {
    return Response.json(await docUploadTicket(v.contractorId, b.data.step, b.data.name, b.data.type, b.data.size));
  } catch (e) {
    return deny(400, e instanceof Error ? e.message : "Upload failed");
  }
}
