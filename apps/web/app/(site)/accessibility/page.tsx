/*
 * FILE    : apps/web/app/(site)/accessibility/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_1640 UTC
 * PURPOSE : Accessibility statement: our WCAG 2.1 AA goal, what we do, known limits, and how to get help or report a barrier.
 *           TEMPLATE — have counsel review before launch.
 */
import Link from "next/link";
import { BRAND } from "@handled/core";

export const metadata = { title: "Accessibility" };

export default function Accessibility() {
  return (
    <div className="wrap max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">Accessibility</h1>
      <p className="mt-2 text-ink-soft">{BRAND.legalName} wants everyone to be able to book and manage services, including people who use screen readers, keyboard navigation, magnification or voice control.</p>
      <div className="mt-8 space-y-5">
        <div><h2 className="font-bold">Our goal</h2><p className="mt-1 text-ink-soft">We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1, level AA, on our website and app.</p></div>
        <div><h2 className="font-bold">What we do</h2><p className="mt-1 text-ink-soft">Readable text and color contrast, labeled form fields, keyboard-friendly menus, page language set for English and Spanish, and descriptions on images that carry meaning. We check new pages before they go live.</p></div>
        <div><h2 className="font-bold">Known limits</h2><p className="mt-1 text-ink-soft">Some photos uploaded by customers and pros may not have descriptions, and some documents from partners (such as insurance certificates) may not be fully accessible. We&apos;re working on it.</p></div>
        <div><h2 className="font-bold">Need help or found a barrier?</h2><p className="mt-1 text-ink-soft">We&apos;ll book for you by phone or email, and fix what we can. Contact us at <a className="underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a> or {BRAND.supportPhone}, and tell us the page and what happened. We reply within two business days.</p></div>
      </div>
      <p className="mt-8 text-sm text-ink-soft"><Link href="/contact" className="underline">Contact us</Link> · <Link href="/privacy" className="underline">Privacy</Link> · <Link href="/terms" className="underline">Terms</Link></p>
    </div>
  );
}
