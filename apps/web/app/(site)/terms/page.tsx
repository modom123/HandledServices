/*
 * FILE    : apps/web/app/(site)/terms/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : Index of every current agreement — for customers, businesses and pros — each with its
 *           plain-English short version. Signed copies live in each person's account.
 */
import Link from "next/link";
import { ALL_CONTRACTS, AUDIENCE_LABEL, type Contract } from "@/lib/contracts";

export const metadata = { title: "Terms & agreements" };

export default function TermsIndex() {
  const groups: Contract["audience"][] = ["customer", "business", "pro"];
  return (
    <div className="wrap max-w-4xl py-14">
      <h1 className="text-3xl font-extrabold tracking-tight">Terms &amp; agreements</h1>
      <p className="mt-2 text-ink-soft">Every agreement we use, in plain English. Each one starts with a short version. Your signed copies are in your account under <Link href="/account/contracts" className="text-brand underline">My contracts</Link> (pros: <Link href="/pro/contracts" className="text-brand underline">Pro portal → My contracts</Link>).</p>
      {groups.map((g) => (
        <section key={g} className="mt-10">
          <h2 className="text-xl font-bold">{AUDIENCE_LABEL[g]}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ALL_CONTRACTS.filter((c) => c.audience === g).map((c) => (
              <Link key={c.key} href={`/terms/${c.key}`} className="card block hover:border-brand">
                <div className="font-semibold">{c.title}</div>
                <div className="mt-1 text-xs text-ink-soft">v{c.version} · {c.appliesTo}</div>
                <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{c.summary[0]}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
