/*
 * FILE    : apps/web/app/(site)/partner/grow/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-10_1445 UTC
 * PURPOSE : Partner Success: "Grow your partner business". The roadmap that fits the partner (by the kind they signed up
 *           as; ?path= switches), with live progress from their real numbers (lib/partners partnerGrowthStats). The view
 *           is components/PartnerGrow.tsx; the roadmaps and plays are core partner-success.ts.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { PARTNER_ROADMAPS, roadmapFor } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { partnerFor, partnerGrowthStats } from "@/lib/partners";
import { PartnerGrow } from "@/components/PartnerGrow";

export const metadata = { title: "Grow your partner business" };
export const dynamic = "force-dynamic";

export default async function Grow({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  const q = await searchParams;
  const v = await getViewer();
  if (!v) redirect("/login?next=/partner/grow");
  const partner = await partnerFor(v);
  if (!partner) return (
    <div className="wrap py-12"><div className="card mx-auto max-w-lg text-center">
      <h1 className="text-xl font-bold">Join the Partner Program first</h1>
      <p className="mt-2 text-sm text-ink-soft">The growth roadmaps track your own customers and earnings.</p>
      <Link href="/partners#join" className="btn-primary mt-4 inline-block">Become a partner</Link>
    </div></div>
  );
  const suggested = roadmapFor(partner.kind);
  const roadmap = PARTNER_ROADMAPS.find((r) => r.id === q.path) ?? suggested;
  return <PartnerGrow roadmap={roadmap} stats={await partnerGrowthStats(partner)} suggested={suggested.id} />;
}
