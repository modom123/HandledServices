/*
 * FILE    : apps/web/app/(site)/book/confirmed/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-04_1934 UTC — ?billed=1: booked on a business account's invoice.
 * UPDATED : 2026-10-20_0100 UTC — tells the ad pixels about the booking (ConversionPing, same id as the server event).
 */
import Link from "next/link";
import { BRAND } from "@handled/core";
import { ConversionPing } from "@/components/ConversionPing";
import { adminClient } from "@/lib/supabase/server";

export const metadata = { title: "Booking confirmed" };

export default async function Confirmed({ searchParams }: { searchParams: Promise<{ ref?: string; paid?: string; unpaid?: string; billed?: string }> }) {
  const { ref, paid, unpaid, billed } = await searchParams;
  // the booking's value for the ad pixels (the ref is the booking's own id; nothing else is shown)
  const conv = ref && /^[A-Z0-9-]{4,20}$/i.test(ref) && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await adminClient().from("jobs").select("ref, price_final").eq("ref", ref).maybeSingle().then((r) => r.data, () => null) : null;
  return (
    <div className="wrap py-20">
      {conv && <ConversionPing id={conv.ref} value={Number(conv.price_final ?? 0) || null} />}
      <div className="card mx-auto max-w-lg text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-2xl text-white">✓</div>
        <h1 className="mt-5 text-2xl font-bold">{unpaid ? "Almost there" : paid ? "Paid & locked in" : billed ? "Booked on your account" : "You’re booked"}{ref ? ` — ${ref}` : ""}</h1>
        <p className="mt-3 text-ink-soft">
          {billed
            ? "It goes on your company’s monthly invoice. We’re matching a vetted pro now, and you’ll get an email when they confirm."
            : unpaid
            ? "Your booking is saved but not paid yet. Pay from My Bookings to lock in your pro — we dispatch as soon as it’s paid."
            : paid
              ? "Payment received. We’re matching you with a vetted pro now and you’ll get an email when they confirm."
              : "We’ll be in touch shortly. You’ll get an email at every step."}
        </p>
        <p className="mt-3 text-sm font-medium text-brand-dark">{BRAND.promise}</p>
        <p className="mt-3 text-sm text-ink-soft">Sign in with the same email to track status, message your pro and see photos.</p>
        <div className="mt-6 flex justify-center gap-3"><Link href={billed ? "/account/business" : "/login?next=/account"} className="btn-primary">{billed ? "Your business account" : "Track my booking"}</Link><Link href="/" className="btn-ghost">Home</Link></div>
      </div>
    </div>
  );
}
