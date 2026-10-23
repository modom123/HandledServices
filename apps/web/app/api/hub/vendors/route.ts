/*
 * FILE    : apps/web/app/api/hub/vendors/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : Hub → Vendors: the approved vendor list pros may buy materials from (materials card and receipts).
 *             GET  — the merged list (built-in + Hub changes)
 *             POST { id?, name, match[], groups[], online, active } — add a vendor, or change one (a built-in id turns it on/off)
 *           Admins only for changes.
 */
import { z } from "zod";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { vendorList } from "@/lib/materials";

const GROUPS = ["building", "plumbing_hvac", "electrical", "paint", "garden", "auto_parts", "appliance_parts", "general", "grocery_pharmacy"] as const;

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  return Response.json({ vendors: await vendorList() });
}

const Body = z.object({
  id: z.string().trim().max(60).regex(/^[a-z0-9_]*$/).optional(),
  name: z.string().trim().min(2).max(80),
  match: z.array(z.string().trim().min(2).max(60)).min(1).max(10),
  groups: z.array(z.enum(GROUPS)).min(1),
  online: z.boolean().default(false),
  active: z.boolean().default(true),
});

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = p.data;
  const id = d.id || d.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
  const { error } = await adminClient().from("approved_vendors").upsert({ id, name: d.name, match: d.match.map((m) => m.toLowerCase()), groups: d.groups, online: d.online, active: d.active, updated_at: new Date().toISOString(), updated_by: v!.fullName ?? v!.email });
  if (error) return deny(500, /approved_vendors/.test(error.message) ? "Run supabase/setup/ADD_MATERIALS_CARDS_2026-10-23_2200.sql first" : error.message);
  return Response.json({ ok: true, id });
}
