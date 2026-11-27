/*
 * FILE    : apps/web/app/api/hub/market/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0149 UTC
 * PURPOSE : Staff override for a service's market factor (Hub → Market pricing):
 *           POST { service_slug, area?, manual_factor | null }. null hands it back to learning.
 * UPDATED : 2026-10-11_0451 UTC — admins only (pricing setting).
 * UPDATED : 2026-11-27_1800 UTC — { action: "research_add" | "research_delete" }: market research the AI quote learns from.
 */
import { z } from "zod";
import { MARKET_BOUNDS, getService } from "@handled/core";
import { ADMINS_ONLY, deny, getViewer, isAdmin, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { refreshMarketFactors } from "@/lib/market";

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  if (!isAdmin(v)) return deny(403, ADMINS_ONLY);
  const raw = await req.json().catch(() => null);
  if (raw?.action === "relearn") return Response.json(await refreshMarketFactors());
  if (raw?.action === "research_add") {
    const r = z.object({ service_slug: z.string(), area: z.string().regex(/^(all|\d{3})$/).default("all"), low: z.number().positive().nullable().optional(), typical: z.number().positive().max(1000000),
      high: z.number().positive().nullable().optional(), source: z.string().max(200).nullable().optional(), note: z.string().max(500).nullable().optional() }).safeParse(raw);
    if (!r.success || !getService(r.data.service_slug)) return deny(400, "Pick a service and enter the typical price (and a ZIP area of 3 digits, or leave it blank for all)");
    const { error } = await adminClient().from("market_research").insert({ ...r.data, low: r.data.low ?? null, high: r.data.high ?? null, source: r.data.source ?? null, note: r.data.note ?? null, created_by: v!.email });
    return error ? deny(500, /relation|schema cache/i.test(error.message) ? "Run supabase/setup/RUN_ONCE_MARKET_RESEARCH_2026-11-27_1800.sql in Supabase first" : error.message) : Response.json({ ok: true });
  }
  if (raw?.action === "research_delete") {
    const id = z.string().uuid().safeParse(raw.id);
    if (!id.success) return deny(400, "Bad id");
    await adminClient().from("market_research").delete().eq("id", id.data);
    return Response.json({ ok: true });
  }
  const b = z.object({ service_slug: z.string(), area: z.string().regex(/^(all|\d{3})$/).default("all"), manual_factor: z.number().min(MARKET_BOUNDS.min).max(MARKET_BOUNDS.max).nullable() }).safeParse(raw);
  if (!b.success || !getService(b.data.service_slug)) return deny(400, `Factor between ${MARKET_BOUNDS.min} and ${MARKET_BOUNDS.max}, or empty to let it learn`);
  const { error } = await adminClient().from("market_factors").upsert({ service_slug: b.data.service_slug, area: b.data.area, manual_factor: b.data.manual_factor, updated_at: new Date().toISOString(), updated_by: v!.email }, { onConflict: "service_slug,area" });
  return error ? deny(500, error.message) : Response.json({ ok: true });
}
