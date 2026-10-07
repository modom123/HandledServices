/*
 * FILE    : apps/web/app/api/account/favorites/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : Customer favorites (lib/favorites.ts).
 *             GET                          — my favorite pros (and crew members)
 *             POST { job_id, crew? }       — favorite the pro on one of my jobs (crew: its crew member)
 *             DELETE ?id=<favorite id>     — remove a favorite
 *           A favorite gets the first look at my next booking for that kind of work — never guaranteed.
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { addFavorite, myFavorites, removeFavorite } from "@/lib/favorites";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in");
  return Response.json({ favorites: await myFavorites(v.userId) });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in");
  const b = z.object({ job_id: z.string().uuid(), crew: z.boolean().optional() }).safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "job_id required");
  const r = await addFavorite(v.userId, b.data.job_id, b.data.crew ?? false);
  return Response.json(r, { status: r.ok ? 200 : 409 });
}

export async function DELETE(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in");
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return deny(400, "id required");
  return Response.json(await removeFavorite(v.userId, id));
}
