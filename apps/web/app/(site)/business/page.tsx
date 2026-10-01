/*
 * FILE    : apps/web/app/(site)/business/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Commercial accounts landing page.
 */
import { BusinessForm } from "@/components/forms";

export const metadata = { title: "For Business" };

const POINTS = [
  ["One vendor for every site", "Cleaning, windows, grounds, snow-season prep, junk-outs and repairs under one contract."],
  ["SLA dashboard", "Every visit time-stamped with photos. See completion and response times by location."],
  ["Prepaid monthly billing", "One invoice per month, paid in advance by card or ACH — PO numbers and cost centers included."],
  ["Backup crews built in", "If a pro can’t make it, AI dispatch re-routes to the next qualified crew automatically."],
];

export default function BusinessPage() {
  return (
    <div className="wrap grid gap-12 py-14 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Facilities services without the vendor juggling.</h1>
        <p className="mt-4 text-lg text-ink-soft">Offices, retail, restaurants, property managers and HOAs use one account for every recurring and one-off service.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {POINTS.map(([t, b]) => <div key={t} className="card"><div className="font-semibold">{t}</div><p className="mt-1 text-sm text-ink-soft">{b}</p></div>)}
        </div>
      </div>
      <BusinessForm />
    </div>
  );
}
