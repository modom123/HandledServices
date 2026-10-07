/*
 * FILE    : apps/web/app/api/cron/sweep/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0233 UTC — pro promises: real acceptance/on-time stats and referral bonuses
 *           daily; Mondays the free weekly payout run (after the guaranteed-minimum top-ups).
 * UPDATED : 2026-10-02_0302 UTC — alerts when an open job reaches or passes the customer's needed-by date.
 * UPDATED : 2026-10-02_0255 UTC — clears pro phone locations older than 12h and lapsed on-call flags.
 * UPDATED : 2026-10-02_2247 UTC — tells waitlisted customers when a pro now covers their ZIP.
 * UPDATED : 2026-10-03_0027 UTC — unpaid bookings get the payment link on day 1, 3 and 7 (was once);
 *           saved prices get follow-ups on day 1 and 4.
 * UPDATED : 2026-10-03_0149 UTC — no pro yet after a while → the customer is nudged to raise their offer.
 * PURPOSE : Vercel cron (daily, see vercel.json) — expire stale offers and re-dispatch, flag jobs
 *           at risk, nudge QA backlog, collect balances, recruiting follow-ups, pro pay.
 * UPDATED : 2026-10-04_1934 UTC — business invoices on the 1st; invoice reminders and terms holds daily.
 * UPDATED : 2026-10-05_0418 UTC — Pro Rewards: release pending points, milestones, inactivity expiry.
 * UPDATED : 2026-10-05_2034 UTC — Handled Talent: invoice hires on their start date and retainer payments when due.
 * UPDATED : 2026-10-07_0110 UTC — Mondays: referral partner commissions (lib/partners).
 * UPDATED : 2026-10-06_0726 UTC — security: cronAuthorized() (fails closed without a 16+ character CRON_SECRET, constant-time).
 */
import { adminClient } from "@/lib/supabase/server";
import { collectBalances, raiseAlert, redispatchExpired } from "@/lib/jobs";
import { grantStipends, payReferralBonuses, refreshProStats, runGuarantee, runWeeklyPayouts } from "@/lib/pro-benefits";
import { recruitingSweep } from "@/lib/recruiting";
import { clearStaleLocations } from "@/lib/roster";
import { notifyWaitlist } from "@/lib/waitlist";
import { sendBookingFollowups, sendQuoteFollowups } from "@/lib/reminders";
import { nudgeLowOffers } from "@/lib/market";
import { invoiceSweep, runInvoices } from "@/lib/business";
import { cronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const db = adminClient();
  const now = new Date().toISOString();

  // 1. Expired offers → re-dispatch (also runs every 10 minutes: /api/cron/dispatch)
  const { expired, redispatched } = await redispatchExpired();

  // 2. Unassigned jobs within 24h → critical alert (once per job)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const { data: atRisk } = await db.from("jobs").select("id, ref").is("contractor_id", null).in("status", ["scheduled", "dispatched"]).lte("scheduled_date", tomorrow);
  for (const j of atRisk ?? []) {
    const { count } = await db.from("ops_alerts").select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("kind", "unassigned_24h");
    if (!count) await raiseAlert("unassigned_24h", "critical", `${j.ref} has no pro and is due within 24h`, "Call pros directly or reschedule with the customer.", j.id);
  }

  // 2b. Past or at the customer's deadline and not done → alert once per job per day
  const { data: deadlines } = await db.from("jobs").select("id, ref, needed_by, status, urgency, contractor_id").not("needed_by", "is", null).lte("needed_by", tomorrow).not("status", "in", "(completed,cancelled)");
  for (const j of (deadlines ?? []) as { id: string; ref: string; needed_by: string; status: string; urgency: string | null; contractor_id: string | null }[]) {
    const late = j.needed_by < now.slice(0, 10);
    const kind = late ? "deadline_late" : "deadline_due";
    const { count } = await db.from("ops_alerts").select("id", { count: "exact", head: true }).eq("job_id", j.id).eq("kind", kind);
    if (!count) await raiseAlert(kind, late ? "critical" : "warn", `${j.ref} ${late ? "is past" : "is due by"} the customer's date (${j.needed_by})`, `${j.contractor_id ? "A pro is assigned" : "No pro yet"} · status ${j.status}${j.urgency ? ` · asked for: ${j.urgency.replace("_", " ")}` : ""}. Confirm a time with the customer or reassign.`, j.id);
  }

  // 3. QA backlog older than 4h
  const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString();
  const { count: qaBacklog } = await db.from("jobs").select("id", { count: "exact", head: true }).eq("status", "qa_review").lt("updated_at", fourHoursAgo);

  // 4. Booked but unpaid → payment link on day 1, 3 and 7; saved prices → follow-ups on day 1 and 4
  const reminded = await sendBookingFollowups().catch((e) => { console.error("[booking followups]", e); return 0; });
  const quoteFollowups = await sendQuoteFollowups().catch((e) => { console.error("[quote followups]", e); return 0; });
  const offerNudges = await nudgeLowOffers().catch((e) => { console.error("[offer nudges]", e); return 0; }); // no pro yet → suggest raising

  // 5. Balances due after a deposit → charge the saved card, else payment link + alert
  const balances = await collectBalances();
  const stipends = await grantStipends();
  const recruiting = await recruitingSweep(); // setup reminders, stuck applicants, drop-offs, auto-activation
  const locationsCleared = await clearStaleLocations(); // privacy: forget old phone locations
  const stats = await refreshProStats(); // acceptance + on-time → tiers and dispatch ranking
  const referrals = await payReferralBonuses();
  const waitlist = await notifyWaitlist().catch((e) => { console.error("[waitlist]", e); return 0; }); // their area is open now → tell them
  const monday = new Date().getUTCDay() === 1;
  const guarantee = monday ? await runGuarantee() : null; // Mondays: last week's minimums
  const payouts = monday ? await runWeeklyPayouts() : null; // Mondays: free weekly payout to every pro
  const partnerPayouts = monday ? await (await import("@/lib/partners")).runPartnerPayouts().catch((e) => { console.error("[partner payouts]", e); return null; }) : null; // Mondays: referral commissions
  // business accounts on terms: invoices on the 1st (last month's jobs); reminders and holds daily
  const invoices = new Date().getUTCDate() === 1 ? await runInvoices().catch((e) => { console.error("[invoices]", e); return 0; }) : null;
  const billing = await invoiceSweep().catch((e) => { console.error("[invoice sweep]", e); return null; });
  const rewards = await (await import("@/lib/rewards")).releaseRewards().catch((e) => { console.error("[rewards]", e); return null; });
  const talent = await (await import("@/lib/talent")).talentSweep().catch((e) => { console.error("[talent]", e); return null; });

  return Response.json({ partnerPayouts, invoices, billing, rewards, talent, offerNudges, quoteFollowups, waitlist, locationsCleared, balances, stipends, stats, referrals, guarantee, payouts, recruiting, reminded, expired, redispatched, atRisk: atRisk?.length ?? 0, qaBacklog: qaBacklog ?? 0 });
}
