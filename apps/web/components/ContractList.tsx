/*
 * FILE    : apps/web/components/ContractList.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0040 UTC
 * PURPOSE : A person's signed contracts, newest first, grouped by when they were accepted
 *           (one booking or one signing = one group). Used in My contracts and the Hub.
 * UPDATED : 2026-10-03_0051 UTC — Spanish titles.
 */
import Link from "next/link";
import { getContract, localized } from "@/lib/contracts";
import type { AcceptanceRow } from "@/lib/contracts/records";

export function ContractList({ rows, hrefBase, empty, es = false }: { rows: AcceptanceRow[]; hrefBase: string; empty: string; es?: boolean }) {
  if (!rows.length) return <p className="card text-sm text-ink-soft">{empty}</p>;
  const groups = new Map<string, AcceptanceRow[]>();
  for (const r of rows) { const k = `${r.accepted_at.slice(0, 16)}|${r.job_id ?? ""}|${r.method}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  const how = (m: string) => (es ? { booking: "al reservar", signature: "firma electrónica", checkout: "al pagar", click: "en línea" } : { booking: "at booking", signature: "e-signature", checkout: "at checkout", click: "online" })[m as "booking"] ?? m;
  return (
    <div className="space-y-3">
      {[...groups.values()].map((g) => {
        const first = g[0];
        return (
          <div key={first.id} className="card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <div className="font-semibold">{new Date(first.accepted_at).toLocaleString(es ? "es-US" : "en-US", { dateStyle: "medium", timeStyle: "short" })} · {how(first.method)}{first.signer_name ? ` · ${first.signer_name}` : ""}</div>
              {first.jobs?.ref && <div className="text-ink-soft">{es ? "Reserva" : "Booking"} {first.jobs.ref}</div>}
            </div>
            <ul className="mt-2 divide-y divide-line text-sm">
              {g.map((r) => {
                const current = getContract(r.contract_key);
                const outdated = current && current.version !== r.version;
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={`${hrefBase}/${r.id}`} className="text-brand underline">{es && current ? localized(current, "es").title : r.title}</Link>
                    <span className="text-xs text-ink-soft">v{r.version}{outdated ? (es ? ` · versión actual ${current.version}` : ` · current is ${current.version}`) : ""}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
