/*
 * FILE    : apps/web/app/api/pay/sheet/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0708 UTC
 * PURPOSE : The mobile app's in-place payment (Apple Pay, Google Pay or card). Returns a Stripe
 *           PaymentSheet for what's owed on the job now, or the Checkout link when the sheet isn't
 *           available (sales tax on, no publishable key). Allowed for the signed-in customer who owns
 *           the job, or for whoever just booked it (job id + the booking's contact email), so guests
 *           can pay right after booking.
 *             POST { job_id, email? } → { mode: "sheet", clientSecret, publishableKey, amount, merchantName }
 *                                      | { mode: "checkout", url, amount } | 409 nothing to pay
 */
import { z } from "zod";
import { deny, getViewer } from "@/lib/auth";
import { getJob } from "@/lib/jobs";
import { amountDue, createPaymentSheet } from "@/lib/stripe";
import { rateLimit } from "@/lib/ratelimit";

const Body = z.object({ job_id: z.string().uuid(), email: z.string().email().optional() });

export async function POST(req: Request) {
  const limited = await rateLimit(req, "pay");
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return deny(400, "Missing booking");
  const job = await getJob(parsed.data.job_id);
  if (!job) return deny(404, "Booking not found");
  // who may pay: the signed-in owner (RLS-scoped read), or the person who just booked (same contact email)
  const v = await getViewer(req);
  const owns = v ? Boolean((await v.db.from("jobs").select("id").eq("id", job.id).maybeSingle()).data) : false;
  const sameEmail = Boolean(parsed.data.email) && parsed.data.email!.trim().toLowerCase() === (job.contact_email ?? "").trim().toLowerCase();
  if (!owns && !sameEmail) return deny(403, "Sign in to pay for this booking");
  if (job.status === "cancelled" || job.status === "site_visit" || job.billed_on_terms) return deny(409, "Nothing to pay now");
  if (!job.price_final || amountDue(job) <= 0) return deny(409, "Nothing to pay now");
  try {
    const sheet = await createPaymentSheet(job);
    if (sheet.mode === "none") return deny(503, "Online payment isn't set up yet — we'll call you to take payment.");
    return Response.json(sheet, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[pay/sheet]", e);
    return deny(502, "Couldn't start the payment. Please try again.");
  }
}
