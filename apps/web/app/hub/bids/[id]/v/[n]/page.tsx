/*
 * FILE    : apps/web/app/hub/bids/[id]/v/[n]/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_2043 UTC
 * PURPOSE : One submitted version of a bid, exactly as it was sent (frozen record): why it was sent, what changed from
 *           the version before (prices line by line, lines added / removed, the total), the price sheet, the compliance
 *           matrix, the review sign-off, pros' prices and the files (each version openable), plus the confirmation.
 *           Printable.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { REQ_KIND_LABEL, RESUBMIT_REASONS, REVIEW_CHECKS, SOLICITATION_TYPES, compareSubmissions, type ReqKind, type ResubmitReason, type SolicitationType } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import type { Snapshot } from "@/lib/bids";
import { DocOpen, PrintButton } from "@/components/BidWorkspace";

export const dynamic = "force-dynamic";
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export default async function SubmissionVersion({ params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const num = Number(n);
  if (!/^[0-9a-f-]{36}$/.test(id) || !Number.isInteger(num) || num < 1) notFound();
  const db = adminClient();
  const [{ data: sub }, { data: prev }, { data: docs }] = await Promise.all([
    db.from("bid_submissions").select("*").eq("bid_id", id).eq("number", num).maybeSingle(),
    db.from("bid_submissions").select("number, snapshot, our_price").eq("bid_id", id).eq("number", num - 1).maybeSingle(),
    db.from("bid_documents").select("id, kind, name, version, created_at").eq("bid_id", id),
  ]);
  if (!sub) notFound();
  const s = sub.snapshot as Snapshot;
  const p = prev?.snapshot as Snapshot | undefined;
  const cmp = p ? compareSubmissions({ lines: p.pricing.lines, total: p.pricing.totals.totalPrice }, { lines: s.pricing.lines, total: s.pricing.totals.totalPrice }) : null;
  const confirmation = (docs ?? []).find((d) => d.id === sub.confirmation_doc_id);
  const sent = (sub.document_ids as string[]).map((x) => (docs ?? []).find((d) => d.id === x)).filter(Boolean) as { id: string; kind: string; name: string; version: number }[];
  const kinds = [...new Set(s.requirements.map((r) => r.kind))] as ReqKind[];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden"><Link href={`/hub/bids/${id}`} className="text-sm text-brand">← Back to the bid</Link><PrintButton /></div>
      <div>
        <div className="text-xs text-ink-soft">{(SOLICITATION_TYPES[s.bid.solicitation_type as SolicitationType] ?? "").split(" — ")[0]}{s.bid.solicitation_number ? ` · ${s.bid.solicitation_number}` : ""} · {s.bid.agency ?? ""}</div>
        <h1 className="text-2xl font-bold">{s.bid.title} — version {sub.number}</h1>
        <p className="text-sm">Submitted {new Date(sub.submitted_at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "full", timeStyle: "short" })} by {sub.submitted_by} · {sub.number === 1 ? "Initial submission" : RESUBMIT_REASONS[sub.reason as ResubmitReason] ?? sub.reason}{sub.change_note ? ` — ${sub.change_note}` : ""}</p>
        <p className="text-sm">Due {s.bid.due_at ? new Date(s.bid.due_at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "medium", timeStyle: "short" }) : "—"}{s.bid.submit_method ? ` · Submitted via: ${s.bid.submit_method}` : ""}</p>
        <p className="mt-1 text-xs text-ink-soft">This record is permanent: it can&apos;t be edited. Changes go into a new version.</p>
      </div>
      {cmp && (
        <section className="card text-sm">
          <h2 className="text-lg font-bold">What changed from version {prev!.number}</h2>
          <p className="mt-1">Total {usd(cmp.totalFrom)} → <b>{usd(cmp.totalTo)}</b> ({cmp.diff >= 0 ? "+" : ""}{usd(cmp.diff)}, {cmp.pct >= 0 ? "+" : ""}{cmp.pct}%)</p>
          {cmp.changed.length > 0 && <ul className="mt-2 list-disc pl-5">{cmp.changed.map((c) => <li key={c.item}>{c.item}: {usd(c.from)} → {usd(c.to)} per {c.unit}{c.qtyFrom !== c.qtyTo ? ` (qty ${c.qtyFrom} → ${c.qtyTo})` : ""}</li>)}</ul>}
          {cmp.added.length > 0 && <p className="mt-1">Added: {cmp.added.join(", ")}</p>}
          {cmp.removed.length > 0 && <p className="mt-1">Removed: {cmp.removed.join(", ")}</p>}
          {!cmp.changed.length && !cmp.added.length && !cmp.removed.length && <p className="mt-1 text-ink-soft">Prices unchanged — see the documents for what was revised.</p>}
        </section>
      )}
      <section className="card">
        <h2 className="mb-2 text-lg font-bold">Price sheet</h2>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-left uppercase tracking-wide text-ink-soft"><tr><th className="p-2">Item</th><th className="p-2">Unit</th><th className="p-2 text-right">Qty / yr</th><th className="p-2 text-right">Years</th><th className="p-2 text-right">Pro cost</th><th className="p-2 text-right">Bid / unit</th><th className="p-2 text-right">Margin</th><th className="p-2 text-right">Total</th></tr></thead>
          <tbody>{s.pricing.lines.map((l) => <tr key={l.id} className="border-t border-line"><td className="p-2">{l.item}</td><td className="p-2">{l.unit}</td><td className="p-2 text-right">{l.qty}</td><td className="p-2 text-right">{l.years}</td><td className="p-2 text-right">{l.pro_unit_cost ? usd(l.pro_unit_cost) : "—"}</td><td className="p-2 text-right font-semibold">{usd(l.unitPrice)}</td><td className="p-2 text-right">{l.marginPct}%</td><td className="p-2 text-right">{usd(l.totalPrice)}</td></tr>)}</tbody>
          <tfoot className="border-t border-line font-semibold"><tr><td className="p-2" colSpan={5}>Per year {usd(s.pricing.totals.yearPrice)} · cost {usd(s.pricing.totals.totalCost)} · profit {usd(s.pricing.totals.totalProfit)} ({s.pricing.totals.marginPct}%)</td><td className="p-2 text-right" colSpan={3}>Bid total {usd(s.pricing.totals.totalPrice)}</td></tr></tfoot>
        </table></div>
        <p className="mt-2 text-xs text-ink-soft">Assumptions: supervision {s.pricing.assumptions.supervisionPct}%, insurance {s.pricing.assumptions.insurancePct}%, admin {s.pricing.assumptions.adminPct}%, contingency {s.pricing.assumptions.contingencyPct}%, bonds {s.pricing.assumptions.bondPct}%, {s.pricing.assumptions.paymentDays} days to get paid at {s.pricing.assumptions.costOfMoneyPct}%/yr, margin {s.pricing.assumptions.marginPct}%.</p>
      </section>
      <section className="card text-sm">
        <h2 className="mb-2 text-lg font-bold">Files sent</h2>
        {sent.length ? <ul className="space-y-1">{sent.map((d) => <li key={d.id}>{d.kind.replace("_", " ")}: {d.name} (v{d.version}) · <DocOpen bidId={id} docId={d.id} label="open" /></li>)}</ul> : <p className="text-ink-soft">No files recorded.</p>}
        <p className="mt-2"><b>Confirmation:</b> {confirmation ? <>{confirmation.name} · <DocOpen bidId={id} docId={confirmation.id} label="open" /></> : "—"}</p>
      </section>
      <section className="card text-sm">
        <h2 className="mb-2 text-lg font-bold">Compliance matrix ({s.requirements.filter((r) => r.done).length} of {s.requirements.length} checked)</h2>
        {kinds.map((k) => (
          <div key={k} className="mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{REQ_KIND_LABEL[k] ?? k}</div>
            <ul>{s.requirements.filter((r) => r.kind === k).map((r, i) => <li key={i}>{r.done ? "☑" : "☐"} {r.text}{r.response_ref ? <span className="text-ink-soft"> → {r.response_ref}</span> : ""}{r.done_by ? <span className="text-xs text-ink-soft"> ({r.done_by})</span> : ""}</li>)}</ul>
          </div>
        ))}
      </section>
      <section className="card text-sm">
        <h2 className="mb-2 text-lg font-bold">Review sign-off</h2>
        <ul>{REVIEW_CHECKS.map((c) => <li key={c.id}>{s.review.checks[c.id] ? "☑" : "☐"} {c.text}</li>)}</ul>
        <p className="mt-1 text-xs text-ink-soft">Signed off by {s.review.reviewer ?? "—"}{s.review.reviewed_at ? ` · ${new Date(s.review.reviewed_at).toLocaleString("en-US", { timeZone: "America/Detroit" })}` : ""}</p>
      </section>
      {s.quotes.length > 0 && (
        <section className="card text-sm">
          <h2 className="mb-2 text-lg font-bold">Pros&apos; prices behind this version</h2>
          <ul>{s.quotes.map((q, i) => <li key={i}>{q.business_name} · {q.status}{Object.keys(q.prices).length ? ` · ${s.pricing.lines.filter((l) => q.prices[l.id]).map((l) => `${l.item}: ${usd(Number(q.prices[l.id]))}`).join(", ")}` : ""}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
