/*
 * FILE    : apps/web/app/(site)/pay/thanks/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2053 UTC
 * PURPOSE : Landing page after paying a Quick Charge link.
 */
import Link from "next/link";
import { BRAND } from "@handled/core";

export const metadata = { title: "Payment received" };

export default function Thanks() {
  return (
    <div className="wrap py-20"><div className="card mx-auto max-w-lg text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand text-2xl text-white">✓</div>
      <h1 className="mt-5 text-2xl font-bold">Payment received — thank you!</h1>
      <p className="mt-3 text-ink-soft">A receipt is on its way to your email. Questions? {BRAND.supportEmail} · {BRAND.supportPhone}</p>
      <Link href="/home" className="btn-ghost mt-6">Back to {BRAND.name}</Link>
    </div></div>
  );
}
