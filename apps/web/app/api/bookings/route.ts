/*
 * FILE    : apps/web/app/api/bookings/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Create a booking (web, mobile, AI chat). Works for guests and signed-in users.
 */
import { after } from "next/server";
import { afterBooking, BookingSchema, createJob } from "@/lib/jobs";
import { getViewer } from "@/lib/auth";
import { stripeCheckoutUrl } from "@/lib/stripe";

export async function POST(req: Request) {
  const parsed = BookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the form", issues: parsed.error.issues }, { status: 400 });
  const viewer = await getViewer(req);
  try {
    const { job, estimate } = await createJob(parsed.data, viewer?.userId ?? null);
    after(() => afterBooking(job).catch((e) => console.error("[afterBooking]", e)));
    const checkout = estimate.siteVisit ? null : await stripeCheckoutUrl(job);
    return Response.json({ id: job.id, ref: job.ref, status: job.status, estimate, checkout });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Booking failed" }, { status: 500 });
  }
}
