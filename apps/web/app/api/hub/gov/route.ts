/*
 * FILE    : apps/web/app/api/hub/gov/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_1441 UTC
 * PURPOSE : Staff controls for government contracts (SAM.gov). POST JSON:
 *             { action: "settings", enabled, naics[], state, keywords, ptypes[], days_back, daily_call_budget, certifications[] }
 *             { action: "search", naics[], state, keywords, ptypes[], days_back, set_aside? }  — search SAM.gov now
 *             { action: "describe", notice_id }        — fetch the full notice text (1 API call)
 *             { action: "summarize", notice_id }       — AI bid / no-bid brief
 *             { action: "status", notice_id, status?, notes?, owner? }
 *             { action: "ask_pros", notice_id, contractor_ids[] }  — email matching pros about the work
 *             { action: "interest", notice_id, contractor_id, status, note? }  — record a pro's answer
 * UPDATED : 2026-10-19_2015 UTC — Contract Awards API:
 *             { action: "awards", naics[], state, keywords, months_back, pages, awardee_uei? }  — search awards now
 *             { action: "award_settings", awards_enabled, awards_months_back, awards_pages, awards_naics[] }  — the Monday awards run
 *             { action: "award_status", award_key, status?, notes? }  — watch / ignore a recompete lead
 * UPDATED : 2026-10-19_2330 UTC — settings take daily_picks; { action: "pick_now" } runs the AI bid desk's daily picks now.
 */
import { z } from "zod";
import { SAM_NOTICE_TYPES, SET_ASIDES } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { aiBidSummary, askPros, getGovSettings, govDailyPicks, govReady, loadDescription, runAwardSearch, runGovSearch, setAwardStatus, setGovStatus, setProInterest } from "@/lib/gov";

const naics = z.array(z.string().regex(/^\d{6}$/)).max(20);
const ptypes = z.array(z.string().refine((p) => p in SAM_NOTICE_TYPES)).max(9);
const state = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).nullable().or(z.literal("").transform(() => null));
const keywords = z.string().trim().max(100).nullable().optional();
const id = z.string().trim().min(1).max(120);

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), enabled: z.boolean(), naics, state, keywords, ptypes, days_back: z.number().int().min(1).max(364), daily_call_budget: z.number().int().min(1).max(1000), certifications: z.array(z.string().refine((c) => c in SET_ASIDES)).max(16), daily_picks: z.number().int().min(0).max(20).optional() }),
  z.object({ action: z.literal("pick_now") }),
  z.object({ action: z.literal("search"), naics, state, keywords, ptypes, days_back: z.number().int().min(1).max(364), set_aside: z.string().refine((c) => c in SET_ASIDES).nullable().optional() }),
  z.object({ action: z.literal("describe"), notice_id: id }),
  z.object({ action: z.literal("summarize"), notice_id: id }),
  z.object({ action: z.literal("status"), notice_id: id, status: z.enum(["new", "reviewing", "bidding", "submitted", "won", "lost", "passed"]).optional(), notes: z.string().max(5000).nullable().optional(), owner: z.string().max(120).nullable().optional() }),
  z.object({ action: z.literal("ask_pros"), notice_id: id, contractor_ids: z.array(z.string().uuid()).min(1).max(50) }),
  z.object({ action: z.literal("interest"), notice_id: id, contractor_id: z.string().uuid(), status: z.enum(["asked", "interested", "not_interested"]), note: z.string().max(1000).nullable().optional() }),
  z.object({ action: z.literal("awards"), naics, state, keywords, months_back: z.number().int().min(1).max(60), pages: z.number().int().min(1).max(20), awardee_uei: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{12}$/).nullable().optional().or(z.literal("").transform(() => null)) }),
  z.object({ action: z.literal("award_settings"), awards_enabled: z.boolean(), awards_months_back: z.number().int().min(1).max(60), awards_pages: z.number().int().min(1).max(20), awards_naics: naics.min(1) }),
  z.object({ action: z.literal("award_status"), award_key: z.string().trim().min(1).max(200), status: z.enum(["new", "watching", "ignored"]).optional(), notes: z.string().max(5000).nullable().optional() }),
]);

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "Check the request");
  const d = b.data;
  const actor = v!.email ?? "staff";
  switch (d.action) {
    case "settings": {
      const { action: _a, ...row } = d;
      const { error } = await adminClient().from("gov_settings").upsert({ id: 1, ...row, keywords: row.keywords || null, updated_at: new Date().toISOString(), updated_by: actor });
      return error ? deny(500, error.message) : Response.json({ ok: true });
    }
    case "search": {
      if (!govReady()) return deny(400, "Set SAM_API_KEY in Vercel first (see Gov contracts → setup)");
      const r = await runGovSearch({ naics: d.naics, state: d.state, keywords: d.keywords ?? null, ptypes: d.ptypes, days_back: d.days_back, setAside: d.set_aside ?? null }, actor);
      return Response.json({ ok: true, result: r });
    }
    case "describe": {
      const r = await loadDescription(d.notice_id, actor);
      return Response.json(r, { status: r.ok ? 200 : 400 });
    }
    case "summarize": {
      const r = await aiBidSummary(d.notice_id, actor);
      return Response.json(r, { status: r.ok ? 200 : 400 });
    }
    case "status": {
      const { action: _a, notice_id, ...patch } = d;
      await setGovStatus(notice_id, patch);
      return Response.json({ ok: true });
    }
    case "ask_pros":
      return Response.json({ ok: true, ...(await askPros(d.notice_id, d.contractor_ids, actor)) });
    case "interest":
      await setProInterest(d.notice_id, d.contractor_id, d.status, d.note ?? null);
      return Response.json({ ok: true });
    case "pick_now": {
      if (!govReady()) return deny(400, "Set SAM_API_KEY in Vercel first (see Gov contracts → setup)");
      return Response.json({ ok: true, result: await govDailyPicks((await getGovSettings()).daily_picks || 5, "AI bid desk") });
    }
    case "awards": {
      if (!govReady()) return deny(400, "Set SAM_API_KEY in Vercel first (see Gov contracts → setup)");
      const r = await runAwardSearch({ naics: d.naics, state: d.state, keywords: d.keywords ?? null, months_back: d.months_back, pages: d.pages, awardee_uei: d.awardee_uei ?? null }, actor);
      return Response.json({ ok: true, result: r });
    }
    case "award_settings": {
      const { action: _a, ...row } = d;
      const { error } = await adminClient().from("gov_settings").update({ ...row, updated_at: new Date().toISOString(), updated_by: actor }).eq("id", 1);
      return error ? deny(500, error.message) : Response.json({ ok: true });
    }
    case "award_status": {
      const { action: _a, award_key, ...patch } = d;
      await setAwardStatus(award_key, patch);
      return Response.json({ ok: true });
    }
  }
}
