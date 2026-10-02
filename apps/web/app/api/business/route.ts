/*
 * FILE    : apps/web/app/api/business/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — monthly budget and how soon they want to start.
 * PURPOSE : Commercial account inquiry (offices, property managers, retail, HOAs).
 */
import { z } from "zod";
import { adminClient } from "@/lib/supabase/server";
import { opsEmail, sendEmail } from "@/lib/notify";

const Body = z.object({
  company: z.string().min(2), contact_name: z.string().min(2), email: z.string().email(), phone: z.string().optional(),
  locations: z.coerce.number().int().min(1).max(5000).default(1), services_needed: z.array(z.string()).default([]), notes: z.string().max(2000).optional(),
  monthly_budget: z.coerce.number().min(0).max(10_000_000).nullable().optional(), start_by: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the form" }, { status: 400 });
  const { error } = await adminClient().from("business_accounts").insert(parsed.data);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (opsEmail()) await sendEmail(opsEmail(), `Business lead: ${parsed.data.company}`, JSON.stringify(parsed.data, null, 2));
  return Response.json({ ok: true });
}
