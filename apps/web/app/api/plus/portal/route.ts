/*
 * FILE    : apps/web/app/api/plus/portal/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Manage or cancel Handled Plus (Stripe billing portal).
 */
import { deny, getViewer } from "@/lib/auth";
import { membershipPortal } from "@/lib/growth";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const url = await membershipPortal(v.email, v.userId);
  return url ? Response.json({ url }) : deny(404, "No active membership found");
}
