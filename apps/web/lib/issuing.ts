/*
 * FILE    : apps/web/lib/issuing.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_2200 UTC
 * PURPOSE : The Handled materials card (Stripe Issuing): pros buy job materials with our card at approved vendors instead
 *           of their own money. One virtual card per pro (works in Apple Pay / Google Pay once added from the card page),
 *           limited to the merchant categories of the pro's trades.
 *             issuingReady()       — Issuing switched on (MATERIALS_CARDS=on) and Stripe configured
 *             acceptCardTerms()    — the pro accepts Stripe's Authorized User Terms (date + IP, required by Stripe)
 *             ensureMaterialsCard() — cardholder + virtual card, created once, categories kept in step with the trades
 *             cardDetailsKey()     — an ephemeral key so the pro's browser can show the card number (Issuing Elements)
 *             decideAuthorization() — real-time yes/no on every swipe (issuing_authorization.request): an approved vendor
 *                                    for the job's trade, the job in progress, and within its materials allowance. Approved
 *                                    swipes become materials on the job (source "card") waiting for a receipt photo.
 *             recordTransaction()  — the final amount when the store settles; refunds lower it
 *             authorizationClosed() — a swipe that never settled (reversed or expired) comes off the job
 *           Card swipes are charged to the customer at cost at the end of the job with the receipts (lib/materials.ts).
 */
import "server-only";
import Stripe from "stripe";
import { cardCategoriesFor, cardDecision, getService, materialsAllowance, mergePolicy, money, type Contractor } from "@handled/core";
import { adminClient } from "./supabase/server";
import { getStripe } from "./stripe";
import { vendorList } from "./materials";
import { addEvent, raiseAlert } from "./jobs";

const db = () => adminClient();

/** Materials cards are on: Stripe Issuing approved for the account and MATERIALS_CARDS=on in Vercel. */
export const issuingReady = () => Boolean(getStripe() && (process.env.MATERIALS_CARDS ?? "").toLowerCase() === "on");

/** The pro accepts Stripe's Authorized User Terms (shown on the card page) — recorded with the date and IP. */
export async function acceptCardTerms(contractorId: string, ip: string | null) {
  await db().from("contractors").update({ card_terms_accepted_at: new Date().toISOString(), card_terms_ip: ip ?? "0.0.0.0" }).eq("id", contractorId);
}

const e164 = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : undefined;
};

/** Create the pro's cardholder and virtual card once; keep the card's categories in step with their trades. */
export async function ensureMaterialsCard(contractorId: string): Promise<{ ok: true; cardId: string; last4: string } | { ok: false; error: string }> {
  const s = getStripe();
  if (!s || !issuingReady()) return { ok: false, error: "Materials cards aren't switched on yet" };
  const { data: c } = await db().from("contractors").select("*").eq("id", contractorId).single();
  const pro = c as (Contractor & Record<string, unknown>) | null;
  if (!pro) return { ok: false, error: "Pro not found" };
  if (pro.status !== "approved") return { ok: false, error: "Your account has to be active first" };
  if (!pro.card_terms_accepted_at) return { ok: false, error: "Accept the cardholder terms first" };
  const categories = cardCategoriesFor(pro.trades);
  if (!categories.length) return { ok: false, error: "Your trades don't buy materials — no card needed" };
  const street = String(pro.base_address ?? pro.address_line ?? ""), city = String(pro.base_city ?? pro.city ?? ""), state = String(pro.base_state ?? pro.state ?? "MI"), zip = String(pro.base_zip ?? pro.zip ?? "");
  if (!street || !city || !zip) return { ok: false, error: "Add your business address in your profile first (the card's billing address)" };
  const name = String(pro.legal_name || pro.contact_name).trim();
  const [first, ...rest] = name.split(/\s+/);
  try {
    let holder = pro.stripe_cardholder_id ?? null;
    if (!holder) {
      const h = await s.issuing.cardholders.create({
        type: "individual", name: name.slice(0, 24), email: pro.email, phone_number: e164(pro.phone),
        billing: { address: { line1: street, city, state, postal_code: zip, country: "US" } },
        individual: { first_name: first, last_name: rest.join(" ") || first, card_issuing: { user_terms_acceptance: { date: Math.floor(new Date(String(pro.card_terms_accepted_at)).getTime() / 1000), ip: String(pro.card_terms_ip ?? "0.0.0.0") } } },
        metadata: { contractor_id: pro.id },
      }, { idempotencyKey: `cardholder-${pro.id}` });
      holder = h.id;
      await db().from("contractors").update({ stripe_cardholder_id: holder }).eq("id", pro.id);
    }
    const controls: Stripe.Issuing.CardCreateParams.SpendingControls = {
      allowed_categories: categories as Stripe.Issuing.CardCreateParams.SpendingControls.AllowedCategory[],
      // job-by-job limits are checked live on every swipe; this is the backstop per purchase and per day
      spending_limits: [{ amount: 150000, interval: "per_authorization" }, { amount: 300000, interval: "daily" }],
    };
    if (pro.materials_card_id) {
      const card = await s.issuing.cards.update(pro.materials_card_id, { spending_controls: controls, status: "active" });
      await db().from("contractors").update({ materials_card_status: card.status, materials_card_last4: card.last4 }).eq("id", pro.id);
      return { ok: true, cardId: card.id, last4: card.last4 };
    }
    const card = await s.issuing.cards.create({ cardholder: holder, currency: "usd", type: "virtual", status: "active", spending_controls: controls, metadata: { contractor_id: pro.id, purpose: "materials" } }, { idempotencyKey: `materials-card-${pro.id}` });
    await db().from("contractors").update({ materials_card_id: card.id, materials_card_last4: card.last4, materials_card_status: card.status }).eq("id", pro.id);
    return { ok: true, cardId: card.id, last4: card.last4 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Freeze or unfreeze a pro's card (Hub, or the pro losing their phone). */
export async function setCardStatus(contractorId: string, status: "active" | "inactive") {
  const s = getStripe();
  const { data: pro } = await db().from("contractors").select("materials_card_id").eq("id", contractorId).single();
  if (!s || !pro?.materials_card_id) return { ok: false, error: "No card" };
  const card = await s.issuing.cards.update(pro.materials_card_id, { status });
  await db().from("contractors").update({ materials_card_status: card.status }).eq("id", contractorId);
  return { ok: true, status: card.status };
}

/** Ephemeral key for Issuing Elements: the browser shows the card number, Stripe never sends it to our server. */
export async function cardDetailsKey(contractorId: string, nonce: string) {
  const s = getStripe();
  const { data: pro } = await db().from("contractors").select("materials_card_id").eq("id", contractorId).single();
  if (!s || !pro?.materials_card_id) return null;
  const key = await s.ephemeralKeys.create({ nonce, issuing_card: pro.materials_card_id }, { apiVersion: Stripe.API_VERSION });
  return { secret: key.secret, cardId: pro.materials_card_id };
}

/** Is this authorization made in person (chip, tap, swipe) — online and keyed-in purchases are card-not-present. */
const inPerson = (a: Stripe.Issuing.Authorization) => !["online", "keyed_in"].includes(a.authorization_method);

/**
 * Real-time decision for a swipe (Stripe waits about 2 seconds). Approved → the purchase is put on the job as materials
 * (source "card"), waiting for its receipt photo. Every decision is logged for the Hub and the pro.
 */
export async function decideAuthorization(a: Stripe.Issuing.Authorization): Promise<{ approved: boolean; reason?: string }> {
  const holder = typeof a.card.cardholder === "string" ? a.card.cardholder : a.card.cardholder?.id;
  const amount = (a.pending_request?.amount ?? a.amount) / 100;
  const merchant = a.merchant_data?.name ?? null, category = a.merchant_data?.category ?? null;
  const { data: pro } = await db().from("contractors").select("id, trades, card_job_id, profile_id").eq("stripe_cardholder_id", holder).maybeSingle();
  const log = async (approved: boolean, reason: string | null, jobId: string | null) => {
    await db().from("materials_card_events").insert({ contractor_id: pro?.id ?? null, job_id: jobId, stripe_authorization_id: a.id, amount, merchant_name: merchant, merchant_category: category, approved, reason });
  };
  if (!pro) { await log(false, "card isn't linked to a pro", null); return { approved: false, reason: "unknown cardholder" }; }
  const { data: job } = pro.card_job_id ? await db().from("jobs").select("id, ref, status, service_slug, materials_high, price_final").eq("id", pro.card_job_id).maybeSingle() : { data: null };
  const jobTrades = job ? (getService(job.service_slug)?.trades ?? []).filter((t) => (pro.trades as string[]).includes(t)) : [];
  const { data: spentRows } = job ? await db().from("job_expenses").select("amount").eq("job_id", job.id).in("status", ["pending", "approved", "billed", "paid"]) : { data: [] };
  const spent = (spentRows ?? []).reduce((t: number, r: { amount: number }) => t + Number(r.amount), 0);
  const { data: settings } = await db().from("pro_program_settings").select("settings").eq("id", 1).maybeSingle();
  const policy = mergePolicy((settings?.settings ?? {}) as never);
  const d = cardDecision({ amount, merchantName: merchant, category, cardPresent: inPerson(a), job, jobTrades, spent, allowance: job ? materialsAllowance(job, policy.materials.maxShareOfPrice) : 0 }, await vendorList());
  if (!d.approved) {
    await log(false, d.reason, job?.id ?? null);
    return { approved: false, reason: d.reason };
  }
  await log(true, null, job!.id);
  await db().from("job_expenses").insert({
    job_id: job!.id, contractor_id: pro.id, amount, description: `Materials card — ${d.vendor.name}`, status: "approved", decided_by: "materials card",
    decided_at: new Date().toISOString(), source: "card", vendor_id: d.vendor.id, merchant_name: merchant, stripe_authorization_id: a.id,
  });
  await addEvent(job!.id, "materials", `Materials card: ${money(amount)} at ${d.vendor.name} (receipt photo due)`, "pro", false);
  return { approved: true };
}

/** The store settled the purchase: record the final amount (refunds lower it). */
export async function recordTransaction(t: Stripe.Issuing.Transaction) {
  const authId = typeof t.authorization === "string" ? t.authorization : t.authorization?.id;
  if (!authId) return;
  const { data: e } = await db().from("job_expenses").select("id, amount, job_id, status").eq("stripe_authorization_id", authId).maybeSingle();
  if (!e) return;
  // purchases come in negative from the cardholder's side, refunds positive
  const delta = -t.amount / 100;
  const amount = t.type === "refund" ? Math.max(0, Math.round((Number(e.amount) - Math.abs(delta)) * 100) / 100) : Math.abs(delta);
  if (amount <= 0) {
    await db().from("job_expenses").update({ status: "rejected", notes: "Refunded at the store", stripe_transaction_id: t.id }).eq("id", e.id);
    return;
  }
  if (["paid", "billed"].includes(e.status) && Math.abs(amount - Number(e.amount)) > 0.005)
    await raiseAlert("materials", "warn", "Materials card amount changed after billing", `${money(Number(e.amount))} → ${money(amount)}: adjust the customer's charge or refund by hand.`, e.job_id);
  await db().from("job_expenses").update({ amount, stripe_transaction_id: t.id }).eq("id", e.id);
}

/** A swipe that was approved but never settled (reversed or expired) comes off the job. */
export async function authorizationClosed(a: Stripe.Issuing.Authorization) {
  if (a.status !== "reversed" && !(a.status === "closed" && !(a.transactions?.length))) return;
  await db().from("job_expenses").update({ status: "rejected", notes: "Card purchase cancelled or never completed" }).eq("stripe_authorization_id", a.id).eq("status", "approved").is("stripe_transaction_id", null);
}
