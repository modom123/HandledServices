/*
 * FILE    : apps/web/app/api/business/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0302 UTC — monthly budget and how soon they want to start.
 * UPDATED : 2026-10-02_0316 UTC — per-IP abuse limit (lib/ratelimit).
 * UPDATED : 2026-10-04_1934 UTC — the contact becomes the account admin (business portal); sales-engine leads marked converted.
 * PURPOSE : Commercial account inquiry (offices, property managers, retail, HOAs).
 */
import { z } from "zod";
import { adminClient } from "@/lib/supabase/server";
import { opsEmail, sendEmail } from "@/lib/notify";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({
  company: z.string().min(2), contact_name: z.string().min(2), email: z.string().email(), phone: z.string().optional(),
  locations: z.coerce.number().int().min(1).max(5000).default(1), services_needed: z.array(z.string()).default([]), notes: z.string().max(2000).optional(),
  monthly_budget: z.coerce.number().min(0).max(10_000_000).nullable().optional(), start_by: z.enum(["asap", "this_week", "two_weeks", "month", "flexible"]).nullable().optional(),
  /** From a sales-engine email link (/business?lead=…). */
  lead: z.string().max(40).nullable().optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the form" }, { status: 400 });
  const { lead, ...data } = parsed.data;
  const { data: acct, error } = await adminClient().from("business_accounts").insert({ ...data, email: data.email.toLowerCase() }).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // the person who asked becomes the account admin: signing in with this email opens the business portal
  await adminClient().from("business_members").upsert({ account_id: acct.id, email: data.email.toLowerCase(), role: "admin" }, { onConflict: "account_id,email" });
  if (lead) await (await import("@/lib/biz-leads")).leadConverted(lead, acct.id).catch(() => {});
  if (opsEmail()) await sendEmail(opsEmail(), `Business lead: ${parsed.data.company}`, JSON.stringify(parsed.data, null, 2));
  return Response.json({ ok: true });
}
