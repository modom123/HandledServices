/*
 * FILE    : apps/web/app/pro/contracts/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * UPDATED : 2026-10-03_0051 UTC — Spanish copies note.
 * PURPOSE : Pro portal → My contracts. Everything the pro signed (Independent Contractor
 *           Agreement, Code of Conduct, Deactivation Policy, consents, trade addenda), with
 *           frozen copies, and a nudge to re-sign when a newer version is out.
 */
import Link from "next/link";
import { AGREEMENT_VERSION, t as tr } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { proAcceptances } from "@/lib/contracts/records";
import { ContractList } from "@/components/ContractList";

export const dynamic = "force-dynamic";

export default async function ProContracts() {
  const v = await getViewer();
  if (!v?.contractorId) return null;
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const rows = process.env.SUPABASE_SERVICE_ROLE_KEY ? await proAcceptances(v.contractorId) : [];
  const signedCurrent = rows.some((r) => r.contract_key === "pro-agreement" && r.version === AGREEMENT_VERSION);
  return (
    <div className="wrap max-w-3xl py-10">
      <h1 className="text-2xl font-bold">{t("My contracts")}</h1>
      <p className="mt-1 text-ink-soft">{t("Every agreement you signed, with the exact text as it was when you signed.")}</p>
      {l === "es" && <p className="mt-2 text-sm text-ink-soft">Los acuerdos que aceptó en español se guardan en español y en inglés. Si hay alguna diferencia, prevalece la versión en inglés.</p>}
      {!signedCurrent && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">{l === "es" ? <>Hay una versión nueva del acuerdo (v{AGREEMENT_VERSION}). <Link href="/pro/onboarding" className="font-semibold underline">Revísela y fírmela</Link> para seguir recibiendo ofertas.</> : <>There’s a new version of the agreement (v{AGREEMENT_VERSION}). <Link href="/pro/onboarding" className="font-semibold underline">Review and sign it</Link> to keep getting offers.</>}</p>}
      <div className="mt-6"><ContractList rows={rows} hrefBase="/pro/contracts" es={l === "es"} empty={t("Nothing yet — sign your agreement in setup and your copies will appear here.")} /></div>
      <p className="mt-6 text-sm"><Link href="/terms" className="text-brand underline">{t("See all current terms & agreements")}</Link></p>
    </div>
  );
}
