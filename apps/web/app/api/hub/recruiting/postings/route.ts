/*
 * FILE    : apps/web/app/api/hub/recruiting/postings/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_1700 UTC
 * PURPOSE : Hub → Recruiting: an opening's Indeed posting and status.
 *             POST { key: "pro:<trade>" | "staff:<id>" | "client:<id>", indeed_url?, posted?, paused?, public? }
 *           Pro trades → recruiting_postings; searches → talent_searches (indeed_url / indeed_posted_at, public, on hold).
 */
import { z } from "zod";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";

const Body = z.object({
  key: z.string().regex(/^(pro:[a-z_]+|(staff|client):[0-9a-f-]{36})$/), indeed_url: z.string().trim().url().max(500).or(z.literal("")).optional(),
  posted: z.boolean().optional(), paused: z.boolean().optional(), public: z.boolean().optional(),
});

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return deny(400, "Check the Indeed link (it must start with https://)");
  const { key, indeed_url, posted, paused } = p.data;
  const who = v!.fullName ?? v!.email ?? "staff";
  const now = new Date().toISOString();
  const db = adminClient();
  if (key.startsWith("pro:")) {
    const { data: cur } = await db.from("recruiting_postings").select("*").eq("opening_key", key).maybeSingle();
    const row = {
      opening_key: key, updated_by: who, updated_at: now,
      indeed_url: indeed_url === undefined ? cur?.indeed_url ?? null : indeed_url || null,
      posted_at: posted === false ? null : posted || indeed_url ? cur?.posted_at ?? now : cur?.posted_at ?? null,
      paused: paused ?? cur?.paused ?? false,
    };
    const { error } = await db.from("recruiting_postings").upsert(row, { onConflict: "opening_key" });
    return error ? deny(500, error.message.includes("recruiting_postings") ? "Run ADD_RECRUITING_DIVISION_2026-10-27_1700.sql in Supabase first" : error.message) : Response.json({ ok: true });
  }
  const id = key.split(":")[1];
  const patch: Record<string, unknown> = {};
  if (indeed_url !== undefined) { patch.indeed_url = indeed_url || null; if (indeed_url) patch.indeed_posted_at = now; }
  if (posted === true && indeed_url === undefined) patch.indeed_posted_at = now;
  if (posted === false) { patch.indeed_posted_at = null; patch.indeed_url = null; }
  if (paused !== undefined) patch.status = paused ? "on_hold" : "open";
  if (p.data.public !== undefined) patch.public = p.data.public;
  const { error } = await db.from("talent_searches").update(patch).eq("id", id);
  return error ? deny(500, error.message) : Response.json({ ok: true });
}
