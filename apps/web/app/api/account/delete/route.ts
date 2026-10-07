/*
 * FILE    : apps/web/app/api/account/delete/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Delete my account (web and app). Body must include { confirm: "DELETE" }.
 */
import { deny, getViewer } from "@/lib/auth";
import { deleteAccount } from "@/lib/account";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  if (v.role === "admin" || v.role === "dispatcher") return deny(403, "Staff accounts are removed by an admin in Supabase.");
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "DELETE") return deny(400, 'Type DELETE to confirm');
  const r = await deleteAccount(v.userId, v.email, v.contractorId);
  return r.ok ? Response.json(r) : deny(409, r.error!);
}
