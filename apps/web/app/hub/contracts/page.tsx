/*
 * FILE    : apps/web/app/hub/contracts/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_0043 UTC
 * PURPOSE : Handled Hub → Contract library. Every current contract (customers, businesses, pros,
 *           service and trade addenda) with version and how many people accepted it; look up any
 *           customer or pro by email or name to see exactly what they signed; download the whole
 *           library for the lawyer.
 * UPDATED : 2026-10-03_0052 UTC — Spanish download; Spanish column (translated or not).
 */
import Link from "next/link";
import { ALL_CONTRACTS, AUDIENCE_LABEL, spanishOf, type Contract } from "@/lib/contracts";
import { adminClient } from "@/lib/supabase/server";
import { ContractList } from "@/components/ContractList";
import type { AcceptanceRow } from "@/lib/contracts/records";

export const dynamic = "force-dynamic";

export default async function ContractLibrary({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() ?? "";
  const db = adminClient();
  const { data: counts } = await db.from("contract_acceptances").select("contract_key, version").limit(50000);
  const tally = new Map<string, { all: number; current: number }>();
  for (const r of (counts ?? []) as { contract_key: string; version: string }[]) {
    const c = ALL_CONTRACTS.find((x) => x.key === r.contract_key);
    const t = tally.get(r.contract_key) ?? { all: 0, current: 0 };
    t.all++; if (c && c.version === r.version) t.current++;
    tally.set(r.contract_key, t);
  }
  let found: AcceptanceRow[] = [];
  if (q.length >= 3) {
    const like = `%${q.replace(/[%_,()]/g, "")}%`;
    const { data } = await db.from("contract_acceptances").select("id, contract_key, version, title, audience, profile_id, contractor_id, email, signer_name, job_id, method, accepted_at, content_hash, jobs(ref, service_slug)")
      .or(`email.ilike.${like},signer_name.ilike.${like}`).order("accepted_at", { ascending: false }).limit(300);
    found = (data ?? []) as unknown as AcceptanceRow[];
  }
  const groups: Contract["audience"][] = ["customer", "business", "pro"];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contract library</h1>
          <p className="text-sm text-ink-soft">Every agreement we use, and who signed what. Customers and pros see their own signed copies in their accounts.</p>
        </div>
        <div className="flex gap-2"><a href="/api/hub/contracts/export" className="btn-ghost text-sm">⬇ Download all (English)</a><a href="/api/hub/contracts/export?lang=es" className="btn-ghost text-sm">⬇ Español</a></div>
      </div>

      <form className="card flex flex-wrap gap-2" action="/hub/contracts">
        <input name="q" defaultValue={q} className="input flex-1" placeholder="Look up a customer or pro by email or name…" />
        <button className="btn-primary">Find signed contracts</button>
      </form>
      {q.length >= 3 && (
        <section>
          <h2 className="mb-2 font-semibold">Signed by “{q}”</h2>
          <ContractList rows={found} hrefBase="/hub/contracts/signed" empty="No signed contracts for that email or name." />
        </section>
      )}

      {groups.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-lg font-bold">{AUDIENCE_LABEL[g]}</h2>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Contract</th><th className="p-3">Version</th><th className="p-3">Applies to</th><th className="p-3">Español</th><th className="p-3 text-right">Accepted (this version / all)</th></tr></thead>
              <tbody>
                {ALL_CONTRACTS.filter((c) => c.audience === g).map((c) => {
                  const t = tally.get(c.key);
                  return (
                    <tr key={c.key} className="border-t border-line align-top">
                      <td className="p-3"><Link href={`/hub/contracts/${c.key}`} className="font-semibold text-brand underline">{c.title}</Link></td>
                      <td className="p-3 whitespace-nowrap">{c.version}</td>
                      <td className="p-3 text-ink-soft">{c.appliesTo}</td>
                      <td className="p-3">{spanishOf(c) ? <Link href={`/hub/contracts/${c.key}?lang=es`} className="text-brand underline">✓ ver</Link> : "—"}</td>
                      <td className="p-3 text-right whitespace-nowrap">{t ? `${t.current} / ${t.all}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      <p className="text-xs text-ink-soft">These are templates written in plain English. Have counsel review them before launch (Hub → Go-live setup → business &amp; legal checklist). Paragraphs marked “[Confirm with counsel.]” need a lawyer’s decision.</p>
    </div>
  );
}
