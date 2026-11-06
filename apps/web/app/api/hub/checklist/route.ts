/*
 * FILE    : apps/web/app/api/hub/checklist/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1346 UTC
 * PURPOSE : Staff: tick / untick a business & legal launch item, with an optional note.
 * UPDATED : 2026-11-04_1759 UTC — no manual entry needed: GET lists every item with its state; POST takes one item
 *           ({ key, done, note? }) or many ({ items: [...] }); an agent, Zapier or a script can call it with
 *           `Authorization: Bearer <GOLIVE_API_KEY>` (done_by is then "API" or the `by` given, e.g. "IEBC agent").
 */
import { z } from "zod";
import { LAUNCH_CHECKLIST } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { goLiveKeyOk } from "@/lib/golive-autopilot";

const Item = z.object({ key: z.string(), done: z.boolean(), note: z.string().max(500).optional() });
const Body = z.union([Item, z.object({ items: z.array(Item).min(1).max(50), by: z.string().max(80).optional() })]);

async function who(req: Request): Promise<string | null> {
  if (goLiveKeyOk(req)) return "API";
  const v = await getViewer(req);
  return isStaff(v) ? v!.fullName ?? v!.email : null;
}

export async function GET(req: Request) {
  if (!(await who(req))) return deny(403, "Staff only");
  const { data } = await adminClient().from("launch_checklist").select("key, done_at, done_by, note");
  const by = new Map((data ?? []).map((t) => [t.key, t]));
  return Response.json({ items: LAUNCH_CHECKLIST.map((i) => ({ ...i, done_at: by.get(i.key)?.done_at ?? null, done_by: by.get(i.key)?.done_by ?? null, note: by.get(i.key)?.note ?? null })) });
}

export async function POST(req: Request) {
  const actor = await who(req);
  if (!actor) return deny(403, "Staff only");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Send { key, done, note? } or { items: [{ key, done, note? }] }");
  const items = "items" in b.data ? b.data.items : [b.data];
  const by = "items" in b.data && b.data.by && actor === "API" ? `API · ${b.data.by}` : actor;
  const unknown = items.filter((i) => !LAUNCH_CHECKLIST.some((x) => x.key === i.key)).map((i) => i.key);
  if (unknown.length) return deny(400, `Unknown item(s): ${unknown.join(", ")}`);
  const now = new Date().toISOString();
  // one row at a time: a row without a note must keep the note it has
  let error: { message: string } | null = null;
  for (const i of items) {
    const r = await adminClient().from("launch_checklist").upsert({
      key: i.key, done_at: i.done ? now : null, done_by: i.done ? by : null,
      ...(i.note !== undefined ? { note: i.note || null } : {}), updated_at: now,
    });
    if (r.error) { error = r.error; break; }
  }
  return error ? deny(500, error.message) : Response.json({ ok: true, updated: items.length });
}
