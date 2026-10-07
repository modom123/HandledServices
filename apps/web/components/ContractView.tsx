/*
 * FILE    : apps/web/components/ContractView.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * UPDATED : 2026-10-03_0050 UTC — English / Spanish: language switch, Spanish labels, and the
 *           "English controls" notice on translations.
 * PURPOSE : Renders a contract — the short version first, then the full text — for the public
 *           /terms pages, a person's frozen signed copy (My contracts) and the Hub library.
 *           Print-friendly (the print button saves it as PDF in any browser).
 */
import Link from "next/link";
import type { ContractSection } from "@/lib/contracts/types";
import { PrintButton } from "./PrintButton";

const L = {
  en: { version: "Version", short: "The short version", shortNote: "This summary helps you read the agreement; the full text below is what governs.", accepted: "Accepted", by: "by", on: "on", booking: "booking", exact: "This is the exact text you agreed to. Fingerprint (SHA-256):", how: { signature: "e-signature", booking: "accepted at booking", checkout: "accepted at checkout", click: "accepted online" }, readIn: "Read in", other: "Español", translation: "", language: "Accepted in English" },
  es: { version: "Versión", short: "La versión corta", shortNote: "Este resumen le ayuda a leer el acuerdo; lo que rige es el texto completo de abajo.", accepted: "Aceptado", by: "por", on: "el", booking: "reserva", exact: "Este es el texto exacto que usted aceptó. Huella digital (SHA-256):", how: { signature: "firma electrónica", booking: "aceptado al reservar", checkout: "aceptado al pagar", click: "aceptado en línea" }, readIn: "Leer en", other: "English", translation: "Esta es una traducción al español para su comodidad. Si hay alguna diferencia entre esta traducción y la versión en inglés, prevalece la versión en inglés.", language: "Aceptado en español" },
} as const;

export function ContractView({ title, version, appliesTo, summary, sections, signed, lang = "en", otherLangHref, translated = lang === "es" }: {
  title: string; version: string; appliesTo?: string; summary?: string[]; sections: ContractSection[];
  /** Shown on a person's signed copy. */
  signed?: { by?: string | null; at: string; method: string; hash: string; job?: string | null; locale?: string | null };
  lang?: "en" | "es";
  /** Link to the same contract in the other language. */
  otherLangHref?: string;
  /** False when Spanish was asked for but no translation exists yet (English shown). */
  translated?: boolean;
}) {
  const T = L[lang];
  return (
    <article className="contract space-y-6" lang={translated ? lang : "en"}>
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{T.version} {version}{appliesTo ? ` · ${appliesTo}` : ""}</p>
        {lang === "es" && translated && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">{T.translation}</p>}
        {lang === "es" && !translated && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">La traducción al español de este documento estará disponible pronto. Se muestra la versión en inglés.</p>}
        {signed && (
          <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">
            ✓ {T.accepted} {signed.by ? <>{T.by} <b>{signed.by}</b> </> : ""}{T.on} {new Date(signed.at).toLocaleString(lang === "es" ? "es-US" : "en-US", { dateStyle: "long", timeStyle: "short" })} ({T.how[signed.method as keyof typeof T.how] ?? signed.method}){signed.job ? ` · ${T.booking} ${signed.job}` : ""}{signed.locale ? ` · ${L[signed.locale === "es" ? "es" : "en"].language}` : ""}.
            <span className="mt-1 block break-all text-[11px] opacity-70">{T.exact} {signed.hash}</span>
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 print:hidden">
          <PrintButton />
          {otherLangHref && <Link href={otherLangHref} className="text-sm text-brand underline">{T.readIn} {T.other}</Link>}
        </div>
      </header>
      {summary?.length ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-bold">{T.short}</h2>
          <ul className="mt-2 space-y-1.5 text-sm">{summary.map((s) => <li key={s} className="flex gap-2"><span className="text-brand">•</span><span>{s}</span></li>)}</ul>
          <p className="mt-3 text-xs text-ink-soft">{T.shortNote}</p>
        </section>
      ) : null}
      <div className="space-y-5">
        {sections.map((s) => (
          <section key={s.h} className="break-inside-avoid">
            <h2 className="font-bold">{s.h}</h2>
            <div className="mt-1 space-y-2 text-ink-soft">{s.p.split("\n\n").map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
