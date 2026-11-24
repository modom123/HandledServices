/*
 * FILE    : apps/web/app/pro/offers/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * PURPOSE : Uber-style job offer (linked from the offer email/push): payout, countdown,
 *           work order and one-tap accept with the terms agreement.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 * UPDATED : 2026-10-03_0150 UTC — pros can counter with the pay they want.
 * UPDATED : 2026-11-06_1800 UTC — pros see only their net pay (any referral fee already out); no job price or split.
 * UPDATED : 2026-11-13_0030 UTC — after accepting, the address and customer details need the Pro PIN on this device.
 */
import { pinUnlocked } from "@/lib/pro-pin";
import { notFound } from "next/navigation";
import { buildWorkOrder, money, proReferralFee, t as tr, type Job } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { getViewer } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/server";
import { AcceptPanel, WorkOrderView } from "@/components/WorkOrderView";

export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const l = await getLocale();
  const { id } = await params;
  const db = adminClient();
  const { data: offer } = await db.from("job_offers").select("*").eq("id", id).eq("contractor_id", v.contractorId).maybeSingle();
  if (!offer) notFound();
  const { data: job } = await db.from("jobs").select("*").eq("id", offer.job_id).single();
  const won = offer.status === "accepted" && job?.contractor_id === v.contractorId;
  const status = offer.status === "offered" && job?.contractor_id ? "expired" : offer.status;
  const { data: me } = await db.from("contractors").select("agreement_version").eq("id", v.contractorId).maybeSingle();
  // the pro sees their net pay only: any referral fee is already out (never the math)
  const fee = proReferralFee(job as Job, offer.payout, me?.agreement_version);
  const net = offer.payout ? Math.round((Number(offer.payout) - fee) * 100) / 100 : 0;
  // after accepting: the address and customer details still need the Pro PIN on this device
  const w = buildWorkOrder(job as Job, { reveal: won, pinLocked: won && !(await pinUnlocked(v.contractorId!)), payout: offer.payout, locale: l, agreementVersion: me?.agreement_version });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div><div className="text-3xl">{w.icon}</div><h1 className="text-2xl font-bold">{w.title}</h1><p className="text-sm text-ink-soft">{w.when}</p></div>
      <WorkOrderView w={w} locale={l} />
      <AcceptPanel locale={l} offerId={offer.id} payout={offer.payout ? money(net) : tr(l, "Site visit")} payoutAmount={net} counter={offer.counter_payout ? Math.max(0, Number(offer.counter_payout) - fee) : null} expiresAt={offer.expires_at} status={status} jobId={offer.job_id} />
    </div>
  );
}
