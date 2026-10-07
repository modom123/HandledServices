/*
 * FILE    : apps/web/app/(site)/contact/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_1640 UTC
 * PURPOSE : Contact page: support email and phone, the business mailing address (BUSINESS_POSTAL_ADDRESS), service areas,
 *           and where to go for bookings, pros, businesses and partners.
 */
import Link from "next/link";
import { BRAND } from "@handled/core";

export const metadata = { title: "Contact us" };

export default function Contact() {
  const address = process.env.BUSINESS_POSTAL_ADDRESS?.trim();
  return (
    <div className="wrap max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">Contact us</h1>
      <p className="mt-2 text-ink-soft">Real people answer. Most messages get a reply within one business day.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card"><div className="font-semibold">Email</div><a className="text-brand underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></div>
        <div className="card"><div className="font-semibold">Phone / text</div><a className="text-brand underline" href={`tel:${BRAND.supportPhone.replace(/[^\d+]/g, "")}`}>{BRAND.supportPhone}</a></div>
        <div className="card sm:col-span-2"><div className="font-semibold">Mailing address</div><p className="text-ink-soft">{BRAND.legalName}{address ? <><br />{address}</> : null}</p></div>
      </div>
      <div className="mt-8 space-y-2 text-sm">
        <p><b>About a booking?</b> Open it in <Link href="/account" className="underline">My bookings</Link> to message us and your pro. Something not right? We make it right within {BRAND.guaranteeDays} days.</p>
        <p><b>Pros:</b> <Link href="/pros" className="underline">join as a pro</Link> or sign in to the Pro portal. <b>Businesses:</b> <Link href="/business" className="underline">business accounts</Link>. <b>Partners:</b> <Link href="/partners" className="underline">referral program</Link>.</p>
        <p className="text-ink-soft">Legal: <Link href="/terms" className="underline">Terms</Link> · <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/accessibility" className="underline">Accessibility</Link></p>
      </div>
    </div>
  );
}
