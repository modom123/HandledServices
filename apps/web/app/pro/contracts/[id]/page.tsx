/*
 * FILE    : apps/web/app/pro/contracts/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : One contract the pro signed — the frozen copy, when, how, fingerprint. Own copies only.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { acceptance } from "@/lib/contracts/records";
import { ContractView } from "@/components/ContractView";

export const dynamic = "force-dynamic";

export default async function ProSignedContract({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  const a = await acceptance((await params).id);
  if (!v?.contractorId || !a || a.contractor_id !== v.contractorId) notFound();
  return (
    <div className="wrap max-w-3xl py-10">
      <Link href="/pro/contracts" className="text-sm text-brand print:hidden">← My contracts</Link>
      <div className="mt-4"><ContractView title={a.title} version={a.version} appliesTo={a.sections.appliesTo} summary={a.sections.summary} sections={a.sections.sections}
        signed={{ by: a.signer_name, at: a.accepted_at, method: a.method, hash: a.content_hash }} /></div>
    </div>
  );
}
