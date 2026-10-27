/*
 * FILE    : apps/web/app/api/hub/recruiting/roles/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Hub → Recruiting → Openings → New team role (staff). A role on Handled's own team is a Talent search for the
 *           internal client: same pipeline, no fees, open right away and listed on /careers so Indeed applicants can apply.
 *             POST { title, location?, workplace, salary_min?, salary_max?, openings, description?, must_haves?, public }
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { createSearch } from "@/lib/talent";
import { internalClientId } from "@/lib/recruiting-division";

const Body = z.object({
  title: z.string().trim().min(3).max(120), location: z.string().trim().max(120).optional(), workplace: z.enum(["onsite", "hybrid", "remote"]).default("onsite"),
  salary_min: z.coerce.number().min(0).max(1_000_000).optional(), salary_max: z.coerce.number().min(0).max(1_000_000).optional(), openings: z.coerce.number().int().min(1).max(50).default(1),
  description: z.string().max(5000).optional(), must_haves: z.string().max(2000).optional(), public: z.boolean().default(true),
});

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const clientId = await internalClientId();
  if (!clientId) return deny(503, "Run supabase/setup/ADD_RECRUITING_DIVISION_2026-10-27_1700.sql once in Supabase first");
  const d = p.data;
  const r = await createSearch(clientId, { title: d.title, location: d.location || null, workplace: d.workplace, salary_min: d.salary_min ?? null, salary_max: d.salary_max ?? null, openings: d.openings, description: d.description || null, must_haves: d.must_haves || null, type: "contingency" }, v!.fullName ?? v!.email ?? "staff", "open");
  if (!r.ok) return deny(400, r.error);
  // our own team: no fees; listed on /careers unless staff said not to
  await adminClient().from("talent_searches").update({ fee_pct: 0, recruiter_pct: 0, minimum_fee: 0, public: d.public }).eq("id", r.id);
  return Response.json({ ok: true, id: r.id });
}
