/*
 * FILE    : apps/web/app/(site)/terms/[key]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Public copy of any current contract: /terms/service-agreement, /terms/terms-of-use,
 *           /terms/pro-agreement, the service and trade addenda… (replaces the old static
 *           service-agreement page; same URL).
 * UPDATED : 2026-10-03_0051 UTC — English / Spanish (?lang=, else the visitor's language).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContractView } from "@/components/ContractView";
import { getContract, localized } from "@/lib/contracts";
import { getLocale } from "@/lib/locale";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const c = getContract((await params).key);
  return { title: c?.title ?? "Terms" };
}

export default async function TermsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ lang?: string }> }) {
  const c = getContract((await params).key);
  if (!c) notFound();
  const want = (await searchParams).lang ?? (await getLocale());
  const v = localized(c, want);
  const es = v.lang === "es";
  return (
    <div className="wrap max-w-3xl py-14">
      <Link href={es ? "/terms?lang=es" : "/terms"} className="text-sm text-brand print:hidden">← {es ? "Todos los términos y acuerdos" : "All terms & agreements"}</Link>
      <div className="mt-4"><ContractView title={v.title} version={c.version} appliesTo={v.appliesTo} summary={v.summary} sections={v.sections} lang={v.lang} translated={v.translated} otherLangHref={`/terms/${c.key}?lang=${es ? "en" : "es"}`} /></div>
    </div>
  );
}
