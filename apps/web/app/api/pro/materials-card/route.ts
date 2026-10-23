/*
 * FILE    : apps/web/app/api/pro/materials-card/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : The pro's Handled materials card (Stripe Issuing).
 *             GET  — card status, whether cards are on, the terms state, recent swipes (approved and declined, with why)
 *             POST { action: "accept_terms" }  — accept Stripe's Authorized User Terms (date + IP recorded), then the card is made
 *             POST { action: "create" }        — make (or refresh) the card
 *             POST { action: "freeze" | "unfreeze" } — lost phone, or done for the season
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { clientIp } from "@/lib/ratelimit";
import { acceptCardTerms, ensureMaterialsCard, issuingReady, setCardStatus } from "@/lib/issuing";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const db = adminClient();
  const [{ data: me }, { data: events }] = await Promise.all([
    db.from("contractors").select("materials_card_id, materials_card_last4, materials_card_status, card_terms_accepted_at, card_job_id").eq("id", v.contractorId).single(),
    db.from("materials_card_events").select("amount, merchant_name, approved, reason, created_at, job_id").eq("contractor_id", v.contractorId).order("created_at", { ascending: false }).limit(20),
  ]);
  return Response.json({ enabled: issuingReady(), card: me?.materials_card_id ? { last4: me.materials_card_last4, status: me.materials_card_status } : null, termsAccepted: Boolean(me?.card_terms_accepted_at), activeJob: me?.card_job_id ?? null, events: events ?? [] });
}

const Body = z.object({ action: z.enum(["accept_terms", "create", "freeze", "unfreeze"]) });

export async function POST(req: Request) {
  const v = await getViewer(req);
  if (!v?.contractorId) return deny(403, "Pro account required");
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return deny(400, "action required");
  if (!issuingReady()) return deny(409, "Materials cards aren't switched on yet");
  if (b.data.action === "accept_terms") await acceptCardTerms(v.contractorId, clientIp(req));
  if (b.data.action === "freeze" || b.data.action === "unfreeze") {
    const r = await setCardStatus(v.contractorId, b.data.action === "freeze" ? "inactive" : "active");
    return r.ok ? Response.json(r) : deny(409, r.error ?? "Couldn't change the card");
  }
  const r = await ensureMaterialsCard(v.contractorId);
  return r.ok ? Response.json(r) : deny(409, r.error);
}
