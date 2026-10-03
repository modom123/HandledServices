/*
 * FILE    : apps/web/app/hub/contracts/[key]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0043 UTC
 * PURPOSE : Hub → one contract: the current text, and the latest people who accepted it.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getService } from "@handled/core";
import { getContract } from "@/lib/contracts";
import { adminClient } from "@/lib/supabase/server";
import { ContractView } from "@/components/ContractView";

export const dynamic = "force-dynamic";

export default async function HubContract({ params }: { params: Promise<{ key: string }> }) {
  const c = getContract((await params).key);
  if (!c) notFound();
  const { data: recent } = await adminClient().from("contract_acceptances").select("id, version, email, signer_name, method, accepted_at, jobs(ref)").eq("contract_key", c.key).order("accepted_at", { ascending: false }).limit(50);
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
      <div className="card">
        <Link href="/hub/contracts" className="text-sm text-brand print:hidden">← Contract library</Link>
        {(c.services?.length || c.trades?.length) ? <p className="mt-3 text-xs text-ink-soft">{c.services?.length ? `Services: ${c.services.map((s) => getService(s)?.name ?? s).join(", ")}` : `Trades: ${c.trades!.join(", ")}`}</p> : null}
        <div className="mt-4"><ContractView title={c.title} version={c.version} appliesTo={c.appliesTo} summary={c.summary} sections={c.sections} /></div>
      </div>
      <aside className="card h-fit text-sm print:hidden">
        <div className="font-semibold">Latest acceptances</div>
        {!recent?.length ? <p className="mt-2 text-ink-soft">None yet.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {(recent as unknown as { id: string; version: string; email: string | null; signer_name: string | null; method: string; accepted_at: string; jobs: { ref: string } | null }[]).map((r) => (
              <li key={r.id} className="py-2">
                <Link href={`/hub/contracts/signed/${r.id}`} className="text-brand underline">{r.signer_name ?? r.email ?? "—"}</Link>
                <div className="text-xs text-ink-soft">{new Date(r.accepted_at).toLocaleDateString("en-US")} · v{r.version} · {r.method}{r.jobs?.ref ? ` · ${r.jobs.ref}` : ""}</div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
