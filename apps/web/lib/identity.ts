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
 * UPDATED : 2026-11-06_0645 UTC — fixes for pros stuck on "Verify my ID": the result is fetched from Stripe on page load and
 *           when the button is pressed (refreshIdCheck), so a missing webhook no longer leaves a finished check
 *           unverified; if Stripe Identity can't start (not activated on the account), the pro gets a clear message and
 *           a video-call check, and staff get an alert with Stripe's reason. "Processing" is shown while Stripe reviews.
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { getStripe } from "./stripe";
import { siteUrl } from "./notify";
import { raiseAlert } from "./jobs";

const db = () => adminClient();

export async function startIdCheck(contractorId: string): Promise<{ url: string | null; manual: boolean; verified?: boolean; message?: string }> {
  const { data: c } = await db().from("contractors").select("business_name, contact_name, email, phone, id_verified_at").eq("id", contractorId).single();
  if (!c) return { url: null, manual: false };
  if (c.id_verified_at) return { url: null, manual: false, verified: true, message: "Your ID is already verified." };
  // a check they already finished on Stripe's page counts even if Stripe's notification never reached us
  if ((await refreshIdCheck(contractorId)) === "verified") return { url: null, manual: false, verified: true, message: "Your ID is verified." };
  const s = getStripe();
  if (!s) {
    await db().from("contractors").update({ id_verification: { provider: "manual", status: "requested", at: new Date().toISOString() } }).eq("id", contractorId);
    await raiseAlert("recruiting", "info", `Verify a photo ID: ${c.business_name}`, `${c.contact_name} · ${c.email} · ${c.phone}. Stripe Identity isn't set up, so verify on a short video call (ID next to their face, name matches the W-9), then mark it in Hub → Pros.`);
    return { url: null, manual: true };
  }
  let session: Awaited<ReturnType<typeof s.identity.verificationSessions.create>>;
  try {
    session = await s.identity.verificationSessions.create({
      type: "document",
      options: { document: { require_matching_selfie: true, require_live_capture: true } },
      metadata: { contractor_id: contractorId },
      return_url: `${siteUrl()}/pro/onboarding?id=done`,
    });
  } catch (e) {
    // most often: Stripe Identity isn't activated on the account yet (Stripe Dashboard → Identity). Don't leave the pro stuck.
    const why = e instanceof Error ? e.message : String(e);
    console.error("[id check]", why);
    await db().from("contractors").update({ id_verification: { provider: "manual", status: "requested", error: why.slice(0, 300), at: new Date().toISOString() } }).eq("id", contractorId);
    await raiseAlert("recruiting", "warn", `Photo ID check couldn't start: ${c.business_name}`, `Stripe said: "${why.slice(0, 300)}". If Stripe Identity isn't activated, turn it on in the Stripe Dashboard → Identity. Until then, verify ${c.contact_name} (${c.email} · ${c.phone}) on a short video call (ID next to their face, name matches the W-9) and press "Mark ID verified" in Hub → Pros.`);
    return { url: null, manual: true, message: "We couldn't start the online ID check, so we'll verify your ID on a short video call instead. We'll contact you to schedule it." };
  }
  if (!session.url) return { url: null, manual: false, message: "Stripe didn't return a link — please try again in a minute." };
  await db().from("contractors").update({ id_verification: { provider: "stripe", session: session.id, status: session.status, at: new Date().toISOString() } }).eq("id", contractorId);
  return { url: session.url, manual: false };
}

export async function idVerified(contractorId: string, by: string, session?: string | null) {
  await db().from("contractors").update({ id_verified_at: new Date().toISOString(), id_verification: { provider: session ? "stripe" : "manual", session: session ?? null, status: "verified", by } }).eq("id", contractorId);
  await (await import("./recruiting")).afterOnboardingStep(contractorId, "id").catch((e) => console.error("[id verified]", e));
}

/**
 * Ask Stripe for the latest result of the pro's ID check and record it. This makes the check work even when the Stripe
 * webhook isn't subscribed to identity.verification_session.* events. Safe to call on every page load (one API call,
 * only while a Stripe check is open).
 */
export async function refreshIdCheck(contractorId: string): Promise<"verified" | "requires_input" | "processing" | "requires_start" | "none"> {
  const { data: c } = await db().from("contractors").select("id_verified_at, id_verification").eq("id", contractorId).maybeSingle();
  if (!c) return "none";
  if (c.id_verified_at) return "verified";
  const v = (c.id_verification ?? {}) as { provider?: string; session?: string; status?: string };
  const s = getStripe();
  if (v.provider !== "stripe" || !v.session || !s) return "none";
  try {
    const vs = await s.identity.verificationSessions.retrieve(v.session);
    if (vs.status === "verified") { await idVerified(contractorId, "stripe_identity", vs.id); return "verified"; }
    if (vs.status === "requires_input" && vs.last_error) { if (v.status !== "requires_input") await idNeedsRetry(contractorId, vs.last_error.reason ?? vs.last_error.code ?? null); return "requires_input"; }
    if (vs.status === "processing") {
      if (v.status !== "processing") await db().from("contractors").update({ id_verification: { ...v, status: "processing", at: new Date().toISOString() } }).eq("id", contractorId);
      return "processing";
    }
    return "requires_start"; // opened but not finished: "Verify my ID" makes a fresh link
  } catch (e) {
    console.error("[id check refresh]", e);
    return "none";
  }
}

export async function idNeedsRetry(contractorId: string, reason: string | null) {
  await db().from("contractors").update({ id_verification: { provider: "stripe", status: "requires_input", reason, at: new Date().toISOString() } }).eq("id", contractorId);
}
