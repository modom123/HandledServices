/*
 * FILE    : apps/web/app/api/applications/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Subcontractor application → stored + AI pre-screen for the ops team.
 */
import { after } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/server";
import { aiScreenApplication } from "@/lib/ai/screen";
import { opsEmail, sendEmail } from "@/lib/notify";

const Body = z.object({
  business_name: z.string().min(2), contact_name: z.string().min(2), email: z.string().email(), phone: z.string().min(7),
  trades: z.array(z.string()).min(1), zips: z.string().max(400).optional(), years_experience: z.coerce.number().int().min(0).max(80).optional(),
  crew_size: z.coerce.number().int().min(1).max(200).optional(), insured: z.boolean().default(false), license_number: z.string().max(80).optional(),
  has_vehicle: z.boolean().default(true), message: z.string().max(2000).optional(),
  specialties: z.array(z.string().max(40)).max(40).default([]), coverages_held: z.array(z.enum(["auto", "workers_comp", "bond", "liquor"])).default([]),
  equipment: z.string().max(500).optional(), references_text: z.string().max(1000).optional(), work_links: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the form" }, { status: 400 });
  const db = adminClient();
  const { data, error } = await db.from("contractor_applications").insert(parsed.data).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  after(async () => {
    const screen = await aiScreenApplication(parsed.data);
    if (screen) await db.from("contractor_applications").update({ ai_screen: screen }).eq("id", data.id);
    if (opsEmail()) await sendEmail(opsEmail(), `New pro application: ${parsed.data.business_name}`, `Trades: ${parsed.data.trades.join(", ")}\nAI: ${screen?.recommendation ?? "n/a"} (${screen?.score ?? "-"})`);
  });
  return Response.json({ ok: true });
}
