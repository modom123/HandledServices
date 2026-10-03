/*
 * FILE    : apps/web/app/hub/contracts/signed/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0043 UTC
 * PURPOSE : Hub → one signed contract: the frozen copy, plus the evidence of acceptance
 *           (who, email, booking, method, time, IP, device, SHA-256 fingerprint).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { contractHash } from "@/lib/contracts";
import { acceptance } from "@/lib/contracts/records";
import { ContractView } from "@/components/ContractView";

export const dynamic = "force-dynamic";

export default async function HubSigned({ params }: { params: Promise<{ id: string }> }) {
  const a = await acceptance((await params).id);
  if (!a) notFound();
  const intact = contractHash({ key: a.contract_key, version: a.version, title: a.title, sections: a.sections.sections }) === a.content_hash;
  return (
    <div className="card">
      <Link href={`/hub/contracts?q=${encodeURIComponent(a.email ?? a.signer_name ?? "")}`} className="text-sm text-brand print:hidden">← Everything this person signed</Link>
      <dl className="mt-4 grid gap-x-6 gap-y-1 rounded-xl bg-paper p-4 text-sm sm:grid-cols-2">
        <div><dt className="inline text-ink-soft">Signer: </dt><dd className="inline">{a.signer_name ?? "—"}</dd></div>
        <div><dt className="inline text-ink-soft">Email: </dt><dd className="inline">{a.email ?? "—"}</dd></div>
        <div><dt className="inline text-ink-soft">Who: </dt><dd className="inline">{a.contractor_id ? <Link className="text-brand underline" href={`/hub/pros/${a.contractor_id}`}>Pro record</Link> : a.audience}</dd></div>
        <div><dt className="inline text-ink-soft">Booking: </dt><dd className="inline">{a.job_id ? <Link className="text-brand underline" href={`/hub/jobs/${a.job_id}`}>{a.jobs?.ref ?? "open"}</Link> : "—"}</dd></div>
        <div><dt className="inline text-ink-soft">IP: </dt><dd className="inline">{a.ip ?? "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="inline text-ink-soft">Device: </dt><dd className="inline break-all">{a.user_agent ?? "—"}</dd></div>
        <div className="sm:col-span-2"><dt className="inline text-ink-soft">Text check: </dt><dd className="inline">{intact ? "✓ matches the fingerprint taken at signing" : "⚠ does not match the fingerprint — investigate"}</dd></div>
      </dl>
      <div className="mt-6"><ContractView title={a.title} version={a.version} appliesTo={a.sections.appliesTo} summary={a.sections.summary} sections={a.sections.sections}
        signed={{ by: a.signer_name, at: a.accepted_at, method: a.method, hash: a.content_hash, job: a.jobs?.ref }} /></div>
    </div>
  );
}
