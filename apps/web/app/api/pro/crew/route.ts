/*
 * FILE    : apps/web/app/api/pro/crew/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Pro company → crew. POST JSON:
 *             { action: "sign", signer_name }            — sign the Crew Addendum (needed before adding anyone)
 *             { action: "add", full_name, email, phone?, locale, role, trades[], years_experience?, license_number? }
 *             { action: "remove", id }                   — they no longer work for the company
 * UPDATED : 2026-10-03_1337 UTC — GET for the mobile app: the crew, whether it can be sent yet, and (?job=<id>) who can
 *           take that job.
 * UPDATED : 2026-10-04_2204 UTC — ?job=<id> also returns the customer's crew member request (requested) and whether the
 *           customer asked for this pro (askedForYou).
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { addCrewMember, listCrew, removeCrewMember, signCrewAddendum } from "@/lib/crew";
import { adminClient } from "@/lib/supabase/server";
import { crewCanTake, crewReady, type Contractor } from "@handled/core";
import { requestMeta } from "@/lib/contracts/record";
import { getLocale } from "@/lib/locale";
import { crewRequest } from "@/lib/favorites";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sign"), signer_name: z.string().trim().min(2).max(120), agree: z.literal(true) }),
  z.object({ action: z.literal("add"), full_name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: z.string().trim().max(30).optional().nullable(),
    locale: z.enum(["en", "es"]).default("en"), role: z.enum(["lead", "helper", "apprentice", "licensed"]), trades: z.array(z.string()).max(10).default([]),
    years_experience: z.number().int().min(0).max(70).optional().nullable(), license_number: z.string().trim().max(60).optional().nullable() }),
  z.object({ action: z.literal("remove"), id: z.string().uuid() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const d = b.data;
  const r = d.action === "sign" ? await signCrewAddendum(v.contractorId, d.signer_name, { ...requestMeta(req), locale: await getLocale() })
    : d.action === "add" ? await addCrewMember(v.contractorId, { full_name: d.full_name, email: d.email, phone: d.phone ?? null, locale: d.locale, role: d.role, trades: d.trades, years_experience: d.years_experience ?? null, license_number: d.license_number || null })
    : await removeCrewMember(v.contractorId, d.id);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const db = adminClient();
  const jobId = new URL(req.url).searchParams.get("job");
  const [{ data: c }, crew, { data: job }] = await Promise.all([
    db.from("contractors").select("crew_attested_at, coverage, trades").eq("id", v.contractorId).single(),
    listCrew(v.contractorId),
    jobId ? db.from("jobs").select("service_slug, crew_member_id, contractor_id, preferred_contractor_id, requested_crew_member_id").eq("id", jobId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const mine = job && job.contractor_id === v.contractorId ? job : null;
  const requested = mine ? await crewRequest(mine, v.contractorId) : null;
  return Response.json({
    attested: Boolean(c?.crew_attested_at), ready: crewReady((c ?? {}) as Pick<Contractor, "crew_attested_at" | "coverage">), trades: c?.trades ?? [], crew,
    ...(mine ? { askedForYou: mine.preferred_contractor_id === v.contractorId, requested: requested ? { id: requested.id, name: requested.name.split(" ")[0] } : null, current: mine.crew_member_id ?? null, options: crew.map((m) => ({ id: m.id, name: m.full_name, why: crewCanTake(m, mine.service_slug) })) } : {}),
  });
}
