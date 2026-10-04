/*
 * FILE    : apps/web/app/api/pro/board/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : Open job board ("Jobs near you", lib/board.ts).
 *             GET  ?locale=es        — jobs this pro qualifies for that nobody has taken (city/ZIP only)
 *             POST { job_id }        — claim one: a 15-minute hold; returns offerId → the usual offer page
 *                                      (web /pro/offers/[id], app /pro/offer/[id]) to read the work order and accept
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { boardFor, claimFromBoard } from "@/lib/board";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const locale = new URL(req.url).searchParams.get("locale") === "es" ? "es" : "en";
  return Response.json({ jobs: await boardFor(v.contractorId, locale) });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = z.object({ job_id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "job_id required");
  const r = await claimFromBoard(v.contractorId, b.data.job_id);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}
