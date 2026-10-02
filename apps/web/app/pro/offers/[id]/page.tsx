/*
 * FILE    : apps/web/app/pro/offers/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * PURPOSE : Uber-style job offer (linked from the offer email/push): payout, countdown,
 *           work order and one-tap accept with the terms agreement.
 * UPDATED : 2026-10-02_1440 UTC — Spanish (pro portal)
 */
import { notFound } from "next/navigation";
import { buildWorkOrder, money, t as tr, type Job } from "@handled/core";
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
  const w = buildWorkOrder(job as Job, { reveal: won, payout: offer.payout, locale: l });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div><div className="text-3xl">{w.icon}</div><h1 className="text-2xl font-bold">{w.title}</h1><p className="text-sm text-ink-soft">{w.when}</p></div>
      <WorkOrderView w={w} locale={l} />
      <AcceptPanel locale={l} offerId={offer.id} payout={offer.payout ? money(offer.payout) : tr(l, "Site visit")} expiresAt={offer.expires_at} status={status} jobId={offer.job_id} />
    </div>
  );
}
