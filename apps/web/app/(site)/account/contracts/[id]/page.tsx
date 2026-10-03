/*
 * FILE    : apps/web/app/(site)/account/contracts/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : One signed contract — the frozen copy the customer agreed to, with when/how and its
 *           SHA-256 fingerprint. Only the person who accepted it (or staff, in the Hub) can see it.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { acceptance } from "@/lib/contracts/records";
import { ContractView } from "@/components/ContractView";

export const dynamic = "force-dynamic";

export default async function SignedContract({ params }: { params: Promise<{ id: string }> }) {
  const v = await getViewer();
  const { id } = await params;
  if (!v) redirect(`/login?next=/account/contracts/${id}`);
  const a = await acceptance(id);
  if (!a || !(a.profile_id === v.userId || (a.email && a.email === v.email.toLowerCase()))) notFound();
  return (
    <div className="wrap max-w-3xl py-12">
      <Link href="/account/contracts" className="text-sm text-brand print:hidden">← My contracts</Link>
      <div className="mt-4"><ContractView title={a.title} version={a.version} appliesTo={a.sections.appliesTo} summary={a.sections.summary} sections={a.sections.sections}
        signed={{ by: a.signer_name, at: a.accepted_at, method: a.method, hash: a.content_hash, job: a.jobs?.ref }} /></div>
    </div>
  );
}
