/*
 * FILE    : apps/web/app/(site)/terms/service-agreement/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2030 UTC
 * PURPOSE : Public copy of the customer Service Agreement (linked from the booking checkbox).
 */
import { SERVICE_AGREEMENT, SERVICE_AGREEMENT_TITLE } from "@/lib/service-agreement";

export const metadata = { title: "Service Agreement" };

export default function Terms() {
  return (
    <div className="wrap max-w-3xl py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">{SERVICE_AGREEMENT_TITLE}</h1>
      <p className="mt-2 text-ink-soft">These terms are printed on every invoice and apply to every job you book with us.</p>
      <div className="mt-8 space-y-5">{SERVICE_AGREEMENT.map((s) => <div key={s.h}><h2 className="font-bold">{s.h}</h2><p className="mt-1 text-ink-soft">{s.p}</p></div>)}</div>
    </div>
  );
}
