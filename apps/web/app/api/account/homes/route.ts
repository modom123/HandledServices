/*
 * FILE    : apps/web/app/api/account/homes/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0005 UTC
 * PURPOSE : My homes — the signed-in customer's saved home profiles (customer_homes).
 *             GET                 — my homes
 *             POST { id?, ...home } — add or update one (address, entry instructions, key / lockbox, key holder, pets,
 *                                   parking, preferences)
 *             DELETE ?id=         — remove one (past bookings keep their address)
 *           Entry details go only to the pro assigned to a booking at that home, never to pros with an offer.
 */
import { z } from "zod";
import { cleanHome } from "@handled/core";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Home = z.object({
  id: z.string().uuid().optional(),
  label: z.string().max(60).optional().nullable(),
  address: z.string().trim().min(3).max(200), city: z.string().trim().min(2).max(80), state: z.string().trim().length(2), zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
  entry_instructions: z.string().max(1000).optional().nullable(), key_info: z.string().max(500).optional().nullable(), key_holder: z.string().max(200).optional().nullable(),
  pets: z.string().max(500).optional().nullable(), parking: z.string().max(500).optional().nullable(), preferences: z.string().max(1000).optional().nullable(),
});
const missing = (m: string) => (/customer_homes/.test(m) ? "Saved homes aren't switched on yet — please try again later" : m);

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in");
  const { data, error } = await adminClient().from("customer_homes").select("*").eq("customer_id", v.userId).order("created_at");
  return error ? deny(500, missing(error.message)) : Response.json({ homes: data ?? [] });
}

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in");
  const b = Home.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, b.error.issues[0]?.path.join(".") === "zip" ? "Enter a 5-digit ZIP" : "Check the address");
  const row = { ...cleanHome(b.data), updated_at: new Date().toISOString() };
  const db = adminClient();
  const res = b.data.id
    ? await db.from("customer_homes").update(row).eq("id", b.data.id).eq("customer_id", v.userId).select("id").maybeSingle()
    : await db.from("customer_homes").insert({ ...row, customer_id: v.userId }).select("id").maybeSingle();
  if (res.error) return deny(500, missing(res.error.message));
  if (!res.data) return deny(404, "Not found");
  return Response.json({ ok: true, id: res.data.id });
}

export async function DELETE(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in");
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return deny(400, "id required");
  const { error } = await adminClient().from("customer_homes").delete().eq("id", id).eq("customer_id", v.userId);
  return error ? deny(500, missing(error.message)) : Response.json({ ok: true });
}
