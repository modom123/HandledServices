/*
 * FILE    : apps/web/app/api/account/jobs/[id]/tip/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Customer tips the pro after a finished job — card on file (one tap) or Checkout.
 */
import { deny, getViewer } from "@/lib/auth";
import { tipJob } from "@/lib/growth";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limited = await rateLimit(req, "tip");
  if (limited) return limited;
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { amount } = (await req.json().catch(() => ({}))) as { amount?: number };
  const r = await tipJob((await params).id, Number(amount), v.userId);
  return "error" in r ? deny(400, r.error!) : Response.json(r);
}
