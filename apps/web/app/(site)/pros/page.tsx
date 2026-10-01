/*
 * FILE    : apps/web/app/(site)/pros/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Subcontractor recruiting page + application.
 */
import { ApplyForm } from "@/components/forms";
import { BRAND } from "@handled/core";

export const metadata = { title: "Become a Pro" };

const PERKS = [
  ["No lead fees, ever", "You’re paid for finished jobs, not for the chance to bid."],
  ["Pre-priced, pre-sold work", "Every offer shows the scope and your payout up front. Accept with one tap."],
  ["Paid fast", "Payouts are approved the moment the job passes photo QA."],
  ["We run the office", "Sales, scheduling, reminders, collections and customer support — handled."],
];

export default function ProsPage() {
  return (
    <div className="wrap grid gap-12 py-14 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Fill your calendar. Skip the sales calls.</h1>
        <p className="mt-4 text-lg text-ink-soft">{BRAND.name} sends insured, independent pros pre-priced jobs in their area. You do great work; our AI handles the rest.</p>
        <div className="mt-8 space-y-5">
          {PERKS.map(([t, b]) => (
            <div key={t} className="flex gap-3"><span className="mt-0.5 text-brand">✓</span><div><div className="font-semibold">{t}</div><div className="text-sm text-ink-soft">{b}</div></div></div>
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-soft">Requirements: general liability insurance, background check, smartphone, reliable transportation. Licensed trades must hold a valid license.</p>
      </div>
      <ApplyForm />
    </div>
  );
}
