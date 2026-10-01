/*
 * FILE    : apps/web/app/api/bookings/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-01_1900 UTC — Paid upfront: returns a Stripe Checkout URL for the
 *           final price; nothing is dispatched until payment clears (site visits excepted).
 * PURPOSE : Create a booking (web, mobile, AI chat). Works for guests and signed-in users.
 */
import { after } from "next/server";
import { BookingSchema, createJob, onBooked } from "@/lib/jobs";
import { getViewer } from "@/lib/auth";
import { paymentCheckoutUrl } from "@/lib/stripe";
import { getService } from "@handled/core";
import { GET as availability } from "../availability/route";

export const maxDuration = 60; // AI price check runs before payment when notes/photos are present

export async function POST(req: Request) {
  const parsed = BookingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the form", issues: parsed.error.issues }, { status: 400 });
  const svcDef = getService(parsed.data.service_slug)!;
  if (svcDef.leadDays && parsed.data.scheduled_date) {
    const days = (new Date(`${parsed.data.scheduled_date}T12:00:00`).getTime() - Date.now()) / 86400000;
    if (days < svcDef.leadDays - 1) return Response.json({ error: `${svcDef.name} needs at least ${svcDef.leadDays} days' notice — call us for anything sooner.` }, { status: 400 });
  }
  // the calendar may be a few minutes old — re-check the slot before taking payment
  if (parsed.data.scheduled_date) {
    const a = await (await availability(new Request(`http://local/api/availability?service=${parsed.data.service_slug}&zip=${parsed.data.zip}`))).json();
    const day = a.days?.find((d: { date: string }) => d.date === parsed.data.scheduled_date);
    const w = parsed.data.time_window;
    if (a.mode === "live" && day && (day.closed || day.level === "full" || (w !== "flexible" && day.windows[w] === 0)))
      return Response.json({ error: "That time just filled up — please pick another slot." }, { status: 409 });
  }
  const viewer = await getViewer(req);
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const { job, estimate } = await createJob(parsed.data, viewer?.userId ?? null, ip);
    const checkout = job.status === "site_visit" ? null : await paymentCheckoutUrl(job);
    after(() => onBooked(job, checkout).catch((e) => console.error("[onBooked]", e)));
    return Response.json({ id: job.id, ref: job.ref, status: job.status, price: job.price_final, estimate, checkout });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Booking failed" }, { status: 500 });
  }
}
