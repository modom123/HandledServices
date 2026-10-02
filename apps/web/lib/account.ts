/*
 * FILE    : apps/web/lib/account.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Delete my account (required by Apple and Google; also the right thing to do).
 *           Refused while the person has work in progress — upcoming paid bookings must be
 *           cancelled first, and pros must finish or hand off assigned jobs and be paid out.
 *           What goes: login, profile, phone numbers, push devices, notifications, saved inbox,
 *           photos of their home on open jobs, membership (Stripe subscription cancelled).
 *           What stays (the law requires it): invoices and payments — kept with name and email
 *           only, for tax records; a pro's W-9 / 1099 data for IRS retention, marked offboarded.
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { getStripe } from "./stripe";
import { sendEmail } from "./notify";
import { BRAND } from "@handled/core";

const db = () => adminClient();
const OPEN = ["scheduled", "dispatched", "assigned", "in_progress", "qa_review", "site_visit"];

export async function deleteAccount(userId: string, email: string, contractorId: string | null) {
  // customer side: no open paid bookings
  const { data: open } = await db().from("jobs").select("ref, status, paid_at, deposit_paid_at").eq("customer_id", userId).in("status", OPEN);
  const live = (open ?? []).filter((j: { paid_at: string | null; deposit_paid_at: string | null; status: string }) => j.paid_at || j.deposit_paid_at || j.status === "site_visit");
  if (live.length) return { ok: false, error: `You have ${live.length} upcoming booking${live.length > 1 ? "s" : ""} (${live.map((j: { ref: string }) => j.ref).join(", ")}). Cancel ${live.length > 1 ? "them" : "it"} from My bookings first, or contact support.` };
  // pro side: nothing assigned, nothing owed
  if (contractorId) {
    const [{ count: jobs }, { count: owed }] = await Promise.all([
      db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).in("status", ["assigned", "in_progress", "qa_review"]),
      db().from("payouts").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).in("status", ["pending", "approved", "held"]),
    ]);
    if (jobs) return { ok: false, error: `You have ${jobs} assigned job(s). Finish them or ask support to reassign them first.` };
    if (owed) return { ok: false, error: "You still have money on its way. We'll be able to delete your account after your next payout." };
  }

  // membership: stop billing
  const s = getStripe();
  const { data: subs } = await db().from("memberships").select("id, stripe_subscription_id").or(`profile_id.eq.${userId},email.ilike.${email.replace(/[,()]/g, "")}`).in("status", ["active", "past_due", "pending"]);
  for (const m of (subs ?? []) as { id: string; stripe_subscription_id: string | null }[]) {
    if (s && m.stripe_subscription_id) await s.subscriptions.cancel(m.stripe_subscription_id).catch(() => {});
    await db().from("memberships").update({ status: "canceled", canceled_at: new Date().toISOString(), profile_id: null }).eq("id", m.id);
  }

  // unpaid / never-booked requests: drop personal details; paid history keeps name + email only
  await db().from("jobs").update({ status: "cancelled" }).eq("customer_id", userId).in("status", ["requested", "quoted"]);
  await db().from("jobs").update({ contact_phone: "deleted", notes: null, photos: [], attribution: null }).eq("customer_id", userId);
  await db().from("push_tokens").delete().eq("profile_id", userId);
  await db().from("notifications").delete().eq("profile_id", userId);
  await db().from("promo_codes").update({ active: false }).eq("owner_profile_id", userId).eq("source", "referral");

  if (contractorId) {
    await db().from("contractors").update({
      status: "suspended", offboarded_at: new Date().toISOString(), offboard_reason: "Account deleted by the pro",
      phone: "deleted", last_lat: null, last_lng: null, last_located_at: null, on_call_until: null, profile_id: null,
    }).eq("id", contractorId);
  }

  // the login itself (profile row cascades)
  const { error } = await db().auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: `Couldn't delete the login: ${error.message}` };
  await sendEmail(email, `Your ${BRAND.name} account was deleted`, `Your ${BRAND.name} account and personal details have been deleted. We keep invoices and payment records (name and email only) for as long as tax law requires${contractorId ? ", and your tax forms (W-9 / 1099) for IRS retention" : ""}.\n\nIf you didn't ask for this, reply to this email right away.\n\n— ${BRAND.name}`);
  return { ok: true };
}
