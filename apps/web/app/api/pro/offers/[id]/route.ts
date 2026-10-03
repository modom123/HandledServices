/*
 * FILE    : apps/web/app/api/pro/offers/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_2043 UTC — Uber-style offers: GET returns the work order (exact address
 *           only after acceptance); accepting requires agreeing to the work order terms,
 *           recorded with version, time and IP.
 * UPDATED : 2026-10-02_1412 UTC — work order in the pro's language.
 * UPDATED : 2026-10-03_0149 UTC — counter: "I'll do it for $X" (the customer decides).
 * PURPOSE : Pro: view, accept or pass on a job offer (web portal + mobile app).
 */
import { z } from "zod";
import { proCounter } from "@/lib/market";
import { buildWorkOrder, type Job } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { acceptOffer, declineOffer } from "@/lib/jobs";
import { localeOf } from "@/lib/push";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const db = adminClient();
  const { data: offer } = await db.from("job_offers").select("*").eq("id", id).eq("contractor_id", v.contractorId).maybeSingle();
  if (!offer) return deny(404, "Offer not found");
  const { data: job } = await db.from("jobs").select("*").eq("id", offer.job_id).single();
  const won = offer.status === "accepted" && job?.contractor_id === v.contractorId;
  const live = offer.status === "offered" && new Date(offer.expires_at) > new Date() && !job?.contractor_id;
  return Response.json({
    offer: { id: offer.id, status: live ? "offered" : offer.status === "offered" ? "expired" : offer.status, payout: offer.payout, expires_at: offer.expires_at, job_id: offer.job_id },
    workOrder: buildWorkOrder(job as Job, { reveal: won, payout: offer.payout, locale: await localeOf(v.userId) }),
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), accept_terms: z.literal(true, { message: "Agree to the work order to accept" }) }),
  z.object({ action: z.literal("decline") }),
  z.object({ action: z.literal("counter"), payout: z.coerce.number().min(1).max(100000), note: z.string().max(500).default("") }),
]);

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const { id } = await ctx.params;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return deny(400, body.error.issues[0]?.message ?? "action required");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (body.data.action === "counter") { const r = await proCounter(id, v.contractorId, body.data.payout, body.data.note); return Response.json(r, { status: r.ok ? 200 : 409 }); }
  const result = body.data.action === "accept" ? await acceptOffer(id, v.contractorId, { ip }) : await declineOffer(id, v.contractorId);
  return Response.json(result, { status: result.ok ? 200 : 409 });
}
