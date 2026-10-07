/*
 * FILE    : apps/web/app/(site)/terms/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Index of every current agreement — for customers, businesses and pros — each with its
 *           plain-English short version. Signed copies live in each person's account.
 * UPDATED : 2026-10-03_0051 UTC — English / Spanish.
 */
import Link from "next/link";
import { ALL_CONTRACTS, AUDIENCE_LABEL, localized, type Contract } from "@/lib/contracts";
import { getLocale } from "@/lib/locale";

const AUDIENCE_ES: Record<Contract["audience"], string> = { customer: "Clientes", business: "Empresas", pro: "Profesionales (contratistas)" };

export const metadata = { title: "Terms & agreements" };

export default async function TermsIndex({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const es = ((await searchParams).lang ?? (await getLocale())) === "es";
  const q = es ? "?lang=es" : "";
  const groups: Contract["audience"][] = ["customer", "business", "pro"];
  return (
    <div className="wrap max-w-4xl py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">{es ? "Términos y acuerdos" : "Terms & agreements"}</h1>
      {es ? <p className="mt-2 text-ink-soft">Todos los acuerdos que usamos, en lenguaje sencillo. Cada uno empieza con una versión corta. Sus copias firmadas están en su cuenta, en <Link href="/account/contracts" className="text-brand underline">Mis contratos</Link> (profesionales: <Link href="/pro/contracts" className="text-brand underline">Portal → Mis contratos</Link>). Si una traducción difiere del inglés, prevalece la versión en inglés. <Link href="/terms?lang=en" className="text-brand underline">English</Link></p>
        : <p className="mt-2 text-ink-soft">Every agreement we use, in plain English. Each one starts with a short version. Your signed copies are in your account under <Link href="/account/contracts" className="text-brand underline">My contracts</Link> (pros: <Link href="/pro/contracts" className="text-brand underline">Pro portal → My contracts</Link>). <Link href="/terms?lang=es" className="text-brand underline">Español</Link></p>}
      {groups.map((g) => (
        <section key={g} className="mt-10">
          <h2 className="text-xl font-bold">{es ? AUDIENCE_ES[g] : AUDIENCE_LABEL[g]}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ALL_CONTRACTS.filter((c) => c.audience === g).map((c) => {
              const v = localized(c, es ? "es" : "en");
              return (
                <Link key={c.key} href={`/terms/${c.key}${q}`} className="card block hover:border-brand">
                  <div className="font-semibold">{v.title}</div>
                  <div className="mt-1 text-xs text-ink-soft">v{c.version} · {v.appliesTo}</div>
                  <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{v.summary[0]}</p>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
