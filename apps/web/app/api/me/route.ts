/*
 * FILE    : apps/web/app/api/me/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Who am I — used by the mobile app to pick customer vs pro mode.
 */
import { getViewer } from "@/lib/auth";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user: { id: v.userId, email: v.email, role: v.role, name: v.fullName, contractorId: v.contractorId } });
}
