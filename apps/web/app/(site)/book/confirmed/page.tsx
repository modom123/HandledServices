/*
 * FILE    : apps/web/app/(site)/book/confirmed/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-04_1934 UTC — ?billed=1: booked on a business account's invoice.
 */
import Link from "next/link";
import { BRAND } from "@handled/core";

export const metadata = { title: "Booking confirmed" };

export default async function Confirmed({ searchParams }: { searchParams: Promise<{ ref?: string; paid?: string; unpaid?: string; billed?: string }> }) {
  const { ref, paid, unpaid, billed } = await searchParams;
  return (
    <div className="wrap py-20">
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
