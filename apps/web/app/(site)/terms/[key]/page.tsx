/*
 * FILE    : apps/web/app/(site)/terms/[key]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Public copy of any current contract: /terms/service-agreement, /terms/terms-of-use,
 *           /terms/pro-agreement, the service and trade addenda… (replaces the old static
 *           service-agreement page; same URL).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractView } from "@/components/ContractView";
import { getContract } from "@/lib/contracts";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const c = getContract((await params).key);
  return { title: c?.title ?? "Terms" };
}

export default async function TermsPage({ params }: { params: Promise<{ key: string }> }) {
  const c = getContract((await params).key);
  if (!c) notFound();
  return (
    <div className="wrap max-w-3xl py-14">
      <Link href="/terms" className="text-sm text-brand print:hidden">← All terms &amp; agreements</Link>
      <div className="mt-4"><ContractView title={c.title} version={c.version} appliesTo={c.appliesTo} summary={c.summary} sections={c.sections} /></div>
    </div>
  );
}
