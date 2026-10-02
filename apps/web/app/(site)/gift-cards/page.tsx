/*
 * FILE    : apps/web/app/(site)/gift-cards/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Buy a Handled gift card ($25–$1,000): emailed to the recipient once paid, good for
 *           any service, balance carries over between bookings.
 */
import { BRAND } from "@handled/core";
import { GiftCardForm } from "@/components/GiftCardForm";

export const metadata = { title: "Gift cards", description: `Give a clean house, a mowed lawn or a night out in a limo. ${BRAND.name} gift cards for any service.` };

export default async function GiftCards({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return (
    <div className="wrap grid gap-10 py-14 lg:grid-cols-2">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Gift cards</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Give them a day off. 🎁</h1>
        <p className="mt-4 text-lg text-ink-soft">A deep clean for new parents, lawn care for Mom, a black car for the big night. Good for every {BRAND.name} service; any balance carries over to the next booking.</p>
        <ul className="mt-6 space-y-2 text-sm"><li>✓ Emailed instantly once paid</li><li>✓ Used at checkout — enter the code</li><li>✓ Vetted, insured pros and our make-it-right guarantee</li></ul>
      </div>
      {sent ? <div className="card h-fit text-center"><div className="text-4xl">🎉</div><h2 className="mt-2 text-xl font-bold">Gift card sent</h2><p className="mt-2 text-sm text-ink-soft">We emailed the code to the recipient and a copy to you.</p></div> : <GiftCardForm />}
    </div>
  );
}
