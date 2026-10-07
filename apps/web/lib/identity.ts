/*
 * FILE    : apps/web/lib/identity.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Photo ID verification for pros (onboarding step "Photo ID verified"):
 *             startIdCheck  — Stripe Identity session (photo of a government ID + a matching selfie); the pro
 *                             finishes on Stripe's page. Without Stripe, ops is asked to verify on a short
 *                             video call and mark it in the Hub.
 *             idVerified    — Stripe webhook (identity.verification_session.verified) or staff → id_verified_at,
 *                             then activation is re-checked.
 *           We keep only the result and Stripe's session id, never the ID images (Stripe holds them).
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { getStripe } from "./stripe";
import { siteUrl } from "./notify";
import { raiseAlert } from "./jobs";

const db = () => adminClient();

export async function startIdCheck(contractorId: string): Promise<{ url: string | null; manual: boolean }> {
  const { data: c } = await db().from("contractors").select("business_name, contact_name, email, phone, id_verified_at").eq("id", contractorId).single();
  if (!c) return { url: null, manual: false };
  if (c.id_verified_at) return { url: null, manual: false };
  const s = getStripe();
  if (!s) {
    await db().from("contractors").update({ id_verification: { provider: "manual", status: "requested", at: new Date().toISOString() } }).eq("id", contractorId);
    await raiseAlert("recruiting", "info", `Verify a photo ID: ${c.business_name}`, `${c.contact_name} · ${c.email} · ${c.phone}. Stripe Identity isn't set up, so verify on a short video call (ID next to their face, name matches the W-9), then mark it in Hub → Pros.`);
    return { url: null, manual: true };
  }
  const session = await s.identity.verificationSessions.create({
    type: "document",
    options: { document: { require_matching_selfie: true, require_live_capture: true } },
    metadata: { contractor_id: contractorId },
    return_url: `${siteUrl()}/pro/onboarding?id=done`,
  });
  await db().from("contractors").update({ id_verification: { provider: "stripe", session: session.id, status: session.status, at: new Date().toISOString() } }).eq("id", contractorId);
  return { url: session.url ?? null, manual: false };
}

export async function idVerified(contractorId: string, by: string, session?: string | null) {
  await db().from("contractors").update({ id_verified_at: new Date().toISOString(), id_verification: { provider: session ? "stripe" : "manual", session: session ?? null, status: "verified", by } }).eq("id", contractorId);
  await (await import("./recruiting")).afterOnboardingStep(contractorId, "id").catch((e) => console.error("[id verified]", e));
}

export async function idNeedsRetry(contractorId: string, reason: string | null) {
  await db().from("contractors").update({ id_verification: { provider: "stripe", status: "requires_input", reason, at: new Date().toISOString() } }).eq("id", contractorId);
}
