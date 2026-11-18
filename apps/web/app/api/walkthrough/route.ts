/*
 * FILE    : apps/web/app/api/walkthrough/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2350 UTC
 * PURPOSE : Free walkthroughs, public (businesses book themselves).
 *             GET  — the open times (next ~2 weeks, in the business's time zone)
 *             POST { kind, start, name, company, email, phone?, address?, city?, state?, zip?, needs?, properties?, landing?, lead?, attribution? }
 *           Rate-limited like every public form. Returns { ok, token } (their manage link is /walkthrough/<token>).
 */
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { supabaseConfigured } from "@/lib/supabase/env";
import { bookWalkthrough, openSlots } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";
const ready = () => supabaseConfigured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function GET() {
  if (!ready()) return Response.json({ enabled: false, days: [], timeZone: "America/Detroit" });
  return Response.json(await openSlots());
}

const Body = z.object({
  kind: z.enum(["onsite", "call"]),
  start: z.string().datetime({ offset: true }),
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional(),
  state: z.string().trim().max(2).nullable().optional(),
  zip: z.string().trim().regex(/^\d{5}$/).nullable().optional().or(z.literal("")),
  needs: z.string().trim().max(2000).nullable().optional(),
  properties: z.number().int().min(1).max(10000).nullable().optional(),
  landing: z.string().max(40).nullable().optional(),
  lead: z.string().max(40).nullable().optional(),
  attribution: z.record(z.string(), z.string().max(200)).nullable().optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Check your details: name, company, a valid email and a time." }, { status: 400 });
  if (!b.data.phone?.replace(/\D/g, "")) return Response.json({ error: "Add a phone number so we can reach you." }, { status: 400 });
  if (!ready()) return Response.json({ error: "Booking isn't available right now — call or email us." }, { status: 503 });
  const r = await bookWalkthrough({ ...b.data, zip: b.data.zip || null });
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
