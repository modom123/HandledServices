/*
 * FILE    : apps/web/app/api/pro/crew/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1311 UTC
 * PURPOSE : Pro company → crew. POST JSON:
 *             { action: "sign", signer_name }            — sign the Crew Addendum (needed before adding anyone)
 *             { action: "add", full_name, email, phone?, locale, role, trades[], years_experience?, license_number? }
 *             { action: "remove", id }                   — they no longer work for the company
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { addCrewMember, removeCrewMember, signCrewAddendum } from "@/lib/crew";
import { requestMeta } from "@/lib/contracts/record";
import { getLocale } from "@/lib/locale";

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
