/*
 * FILE    : apps/web/app/pro/contracts/[id]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : One contract the pro signed — the frozen copy, when, how, fingerprint. Own copies only.
 * UPDATED : 2026-10-03_0051 UTC — shown in the language they signed in; switch to the other.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { acceptance, signedCopy } from "@/lib/contracts/records";
import { ContractView } from "@/components/ContractView";

export const dynamic = "force-dynamic";

export default async function ProSignedContract({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const v = await getViewer();
  const a = await acceptance((await params).id);
  if (!v?.contractorId || !a || a.contractor_id !== v.contractorId) notFound();
  const c = signedCopy(a, (await searchParams).lang ?? a.locale);
  return (
    <div className="wrap max-w-3xl py-10">
      <Link href="/pro/contracts" className="text-sm text-brand print:hidden">← {c.lang === "es" ? "Mis contratos" : "My contracts"}</Link>
      <div className="mt-4"><ContractView title={c.title} version={a.version} appliesTo={c.appliesTo} summary={c.summary} sections={c.sections} lang={c.lang} translated={c.translated}
        otherLangHref={a.sections.es ? `/pro/contracts/${a.id}?lang=${c.lang === "es" ? "en" : "es"}` : undefined}
        signed={{ by: a.signer_name, at: a.accepted_at, method: a.method, hash: a.content_hash, locale: a.locale }} /></div>
    </div>
  );
}
