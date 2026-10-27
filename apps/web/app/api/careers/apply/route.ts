/*
 * FILE    : apps/web/app/api/careers/apply/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Public: apply for a role on /careers/[id] (our own team or a client's role). The applicant joins that search's
 *           pipeline (Hub → Recruiting → Pipeline → Team & client roles), gets a confirmation email, and ops is told.
 *           Where they came from (utm_source, e.g. indeed) is kept as the candidate's source. Rate-limited.
 *             POST { search_id, full_name, email, phone?, location?, linkedin?, summary, source? }
 */
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { applyToRole } from "@/lib/recruiting-division";

const Body = z.object({
  search_id: z.string().uuid(), full_name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), phone: z.string().max(40).optional(),
  location: z.string().max(120).optional(), linkedin: z.string().max(300).optional(), summary: z.string().trim().min(20, "Tell us a little about your experience").max(4000),
  source: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: p.error.issues[0]?.message ?? "Please check the form" }, { status: 400 });
  const d = p.data;
  const source = (d.source || "careers page").toLowerCase().replace(/[^a-z0-9 _-]/g, "").slice(0, 40) || "careers page";
  const r = await applyToRole(d.search_id, { full_name: d.full_name, email: d.email.toLowerCase(), phone: d.phone || null, location: d.location || null, linkedin: d.linkedin || null, summary: d.summary, source }, { requirePublic: true });
  return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.error }, { status: 400 });
}
