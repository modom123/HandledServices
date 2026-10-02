/*
 * FILE    : apps/web/app/api/plus/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Join Handled Plus → Stripe subscription Checkout (signed-in customers).
 */
import { deny, getViewer } from "@/lib/auth";
import { startMembership } from "@/lib/growth";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in to join");
  const r = await startMembership({ email: v.email, profileId: v.userId, name: v.fullName });
  return r.url ? Response.json(r) : deny(409, r.error ?? "Try again");
}
