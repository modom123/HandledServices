/*
 * FILE    : apps/web/app/api/hub/markets/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1513 UTC
 * PURPOSE : Staff: add a market (city) or pause / resume one. POST { name, state, zip_prefixes[] } or { id, active }.
 *           A ZIP prefix can belong to one market only, so jobs are never counted twice.
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Body = z.union([
  z.object({ name: z.string().trim().min(2).max(80), state: z.string().trim().length(2), zip_prefixes: z.array(z.string().regex(/^\d{3}$/)).min(1).max(30) }),
  z.object({ id: z.string().uuid(), active: z.boolean() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Name, 2-letter state and 3-digit ZIP prefixes");
  const db = adminClient();
  if ("id" in b.data) {
    const { error } = await db.from("markets").update({ active: b.data.active }).eq("id", b.data.id);
    return error ? deny(500, error.message) : Response.json({ ok: true });
  }
  const prefixes = [...new Set(b.data.zip_prefixes)];
  const { data: taken } = await db.from("markets").select("name, zip_prefixes").overlaps("zip_prefixes", prefixes);
  if (taken?.length) return deny(409, `Already in ${taken.map((m: { name: string }) => m.name).join(", ")}: ${prefixes.filter((p) => taken.some((m: { zip_prefixes: string[] }) => m.zip_prefixes.includes(p))).join(", ")}`);
  const { error } = await db.from("markets").insert({ name: b.data.name, state: b.data.state.toUpperCase(), zip_prefixes: prefixes });
  return error ? deny(500, error.message) : Response.json({ ok: true });
}
