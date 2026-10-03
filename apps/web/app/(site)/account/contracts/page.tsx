/*
 * FILE    : apps/web/app/(site)/account/contracts/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Customer → My contracts. Every agreement they accepted (Terms of Use, Service
 *           Agreement and service addenda with each booking, Business Services Agreement,
 *           Plus / gift card terms), with a frozen copy of the exact text.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { t as tr } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { customerAcceptances } from "@/lib/contracts/records";
import { ContractList } from "@/components/ContractList";

export const metadata = { title: "My contracts" };
export const dynamic = "force-dynamic";

export default async function MyContracts() {
  const v = await getViewer();
  if (!v) redirect("/login?next=/account/contracts");
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const rows = process.env.SUPABASE_SERVICE_ROLE_KEY ? await customerAcceptances(v.userId, v.email) : [];
  return (
    <div className="wrap max-w-3xl py-12">
      <Link href="/account" className="text-sm text-brand">← {t("My account")}</Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">{t("My contracts")}</h1>
      <p className="mt-2 text-ink-soft">{t("Every agreement you accepted, with the exact text as it was when you agreed. Print or save any of them as a PDF.")}</p>
      {l === "es" && <p className="mt-2 text-sm text-ink-soft">{t("The legal text of our agreements is in English. If you have questions, write to us.")}</p>}
      <div className="mt-6"><ContractList rows={rows} hrefBase="/account/contracts" es={l === "es"} empty={t("Nothing yet — the agreements for each booking will appear here.")} /></div>
      <p className="mt-6 text-sm"><Link href="/terms" className="text-brand underline">{t("See all current terms & agreements")}</Link></p>
    </div>
  );
}
