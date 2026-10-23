/*
 * FILE    : apps/web/app/api/pro/materials-card/key/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : POST { nonce } — an ephemeral key so the pro's browser can show their materials card number with Stripe's Issuing
 *           Elements. The number goes from Stripe straight to the browser; it never passes through our server.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { cardDetailsKey, issuingReady } from "@/lib/issuing";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = z.object({ nonce: z.string().min(5).max(200) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "nonce required");
  if (!issuingReady()) return deny(409, "Materials cards aren't switched on yet");
  const k = await cardDetailsKey(v.contractorId, b.data.nonce);
  return k ? Response.json(k) : deny(404, "No card yet");
}
