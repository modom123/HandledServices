/*
 * FILE    : apps/web/app/api/account/jobs/[id]/counters/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0154 UTC
 * PURPOSE : The customer's view of pros' counter offers on their job (the app uses it; the website
 *           reads them server-side). First name, rating, jobs done, the price it makes, their note.
 */
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { id } = await ctx.params;
  const { data: mine } = await v.db.from("jobs").select("id").eq("id", id).eq("customer_id", v.userId).maybeSingle(); // the customer only: RLS also lets an offered or assigned pro read the job
  if (!mine) return deny(404, "Not found");
  const { data } = await adminClient().from("job_offers").select("id, counter_price, counter_note, contractors(contact_name, rating, jobs_completed)").eq("job_id", id).eq("status", "countered").order("counter_price");
  const counters = ((data ?? []) as unknown as { id: string; counter_price: number; counter_note: string | null; contractors: { contact_name: string; rating: number; jobs_completed: number } | null }[])
    .map((o) => ({ id: o.id, who: String(o.contractors?.contact_name ?? "Pro").split(" ")[0], rating: Number(o.contractors?.rating ?? 5), jobs: Number(o.contractors?.jobs_completed ?? 0), price: Number(o.counter_price), note: o.counter_note }));
  return Response.json({ counters });
}
