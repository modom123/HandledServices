/*
 * FILE    : apps/web/components/ContractView.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Renders a contract — the short version first, then the full text — for the public
 *           /terms pages, a person's frozen signed copy (My contracts) and the Hub library.
 *           Print-friendly (the print button saves it as PDF in any browser).
 */
import type { ContractSection } from "@/lib/contracts/types";
import { PrintButton } from "./PrintButton";

export function ContractView({ title, version, appliesTo, summary, sections, signed }: {
  title: string; version: string; appliesTo?: string; summary?: string[]; sections: ContractSection[];
  /** Shown on a person's signed copy. */
  signed?: { by?: string | null; at: string; method: string; hash: string; job?: string | null };
}) {
  return (
    <article className="contract space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-ink-soft">Version {version}{appliesTo ? ` · ${appliesTo}` : ""}</p>
        {signed && (
          <p className="mt-3 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">
            ✓ Accepted {signed.by ? <>by <b>{signed.by}</b> </> : ""}on {new Date(signed.at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })} ({signed.method === "signature" ? "e-signature" : signed.method === "booking" ? "accepted at booking" : signed.method === "checkout" ? "accepted at checkout" : "accepted online"}){signed.job ? ` · booking ${signed.job}` : ""}.
            <span className="mt-1 block break-all text-[11px] opacity-70">This is the exact text you agreed to. Fingerprint (SHA-256): {signed.hash}</span>
          </p>
        )}
        <div className="mt-3 print:hidden"><PrintButton /></div>
      </header>
      {summary?.length ? (
        <section className="rounded-2xl border border-line bg-paper p-5">
          <h2 className="font-bold">The short version</h2>
          <ul className="mt-2 space-y-1.5 text-sm">{summary.map((s) => <li key={s} className="flex gap-2"><span className="text-brand">•</span><span>{s}</span></li>)}</ul>
          <p className="mt-3 text-xs text-ink-soft">This summary helps you read the agreement; the full text below is what governs.</p>
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
