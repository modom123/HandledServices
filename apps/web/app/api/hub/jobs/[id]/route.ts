/*
 * FILE    : apps/web/app/api/hub/jobs/[id]/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Staff: edit a job — status, firm price after site visit, date, assign a pro directly, approve QA.
 */
import { z } from "zod";
import { JOB_STATUSES, splitJob } from "@handled/core";
import { deny, getViewer, isStaff } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { addEvent, finalizeJob, markPaid, sendPaymentLink } from "@/lib/jobs";
import { amountDue, chargeSavedCard } from "@/lib/stripe";
import type { Job } from "@handled/core";

const Patch = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  price_final: z.number().min(0).optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time_window: z.enum(["morning", "midday", "afternoon", "flexible"]).optional(),
  contractor_id: z.string().uuid().nullable().optional(),
  priority: z.enum(["normal", "high", "urgent"]).optional(),
  approve_qa: z.boolean().optional(),
  mark_paid: z.object({ amount: z.number().positive(), method: z.string().max(80) }).optional(),
  send_payment_link: z.boolean().optional(),
  charge_balance: z.boolean().optional(),
  note: z.string().max(2000).optional(),
  instructions: z.string().max(4000).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const v = await getViewer(req);
  if (!isStaff(v)) return deny();
  const { id } = await ctx.params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Invalid update");
  const { approve_qa, note, mark_paid, send_payment_link, charge_balance, ...patch } = parsed.data;
  const db = adminClient();
  const { data: job } = await db.from("jobs").select("*").eq("id", id).single();
  if (!job) return deny(404, "Not found");

  const who = v!.fullName ?? v!.email;
  if (mark_paid) {
    await addEvent(id, "human_touch", `Marked paid (${mark_paid.method})`, who, false);
    await markPaid(id, { amount: mark_paid.amount, via: `${who} · ${mark_paid.method}`, kind: job.deposit_paid_at || Number(job.amount_paid) ? "balance" : "upfront" });
    return Response.json({ ok: true });
  }
  if (charge_balance) {
    const due = amountDue(job as Job, "balance");
    if (!due) return deny(409, "Nothing owed");
    const got = await chargeSavedCard(job as Job, due, "balance");
    if (!got) return Response.json({ error: "No saved card, or the card was declined — email a payment link instead" }, { status: 402 });
    await addEvent(id, "human_touch", `Charged balance to saved card`, who, false);
    await markPaid(id, { amount: got, via: `${who} · saved card`, kind: "balance" });
    return Response.json({ ok: true });
  }
  if (send_payment_link) {
    const url = await sendPaymentLink(job);
    return url ? Response.json({ ok: true, url }) : Response.json({ error: "Stripe isn't configured — collect payment and use Mark paid" }, { status: 503 });
  }
  // Paid upfront: nobody can put a pro on unpaid work (free site visits and remedy jobs excepted).
  if (patch.contractor_id && !job.paid_at && !job.remedy && job.status !== "site_visit")
    return deny(409, "Collect payment before assigning a pro");
  if (approve_qa) {
    await addEvent(id, "human_touch", "QA approved manually", who, false);
    await finalizeJob(id, note ?? "Your job is complete and passed our quality check.");
    return Response.json({ ok: true });
  }
  const update: Record<string, unknown> = { ...patch };
  if (patch.price_final !== undefined) {
    update.contractor_payout = splitJob(patch.price_final, job.service_slug).payout;
    update.estimate_low = patch.price_final;
    update.estimate_high = patch.price_final;
  }
  if (patch.contractor_id) update.status = patch.status ?? "assigned";
  const { error } = await db.from("jobs").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await addEvent(id, "human_touch", `Edited: ${Object.keys(patch).join(", ") || "note"}`, who, false);
  if (patch.price_final !== undefined) {
    await addEvent(id, "quoted", `Firm price: $${patch.price_final} — pay to lock in your pro.`, who);
    if (!job.paid_at) {
      const { data: fresh } = await db.from("jobs").select("*").eq("id", id).single();
      await sendPaymentLink(fresh);
    }
  }
  if (note) await addEvent(id, "note", note, who, false);
  return Response.json({ ok: true });
}
