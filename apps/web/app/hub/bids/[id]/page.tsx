/*
 * FILE    : apps/web/app/hub/bids/[id]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : One bid's workspace, in the order a bid is done: details → 1. go / no-go → 2. documents and the AI reading →
 *           3. compliance matrix → 4. pricing → 5. pros' written prices → 6. review & submit → result. The gate at the top
 *           says exactly what's still missing.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { BID_SOURCES, BID_STATUS_LABEL, goDecision, type BidSource, type BidStatus } from "@handled/core";
import { loadBid } from "@/lib/bids";
import { aiEnabled } from "@/lib/ai/client";
import {
  BidDocuments, BidFields, BidPricing, BidProQuotes, BidResult, BidStatusButtons, ComplianceMatrix, GoNoGo, ReviewSubmit,
  type WsBid, type WsDoc, type WsLine, type WsQuote, type WsReq,
} from "@/components/BidWorkspace";

export const dynamic = "force-dynamic";

function Step({ n, title, done, children, open = true }: { n: string; title: string; done?: boolean; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="card">
      <summary className="cursor-pointer text-lg font-bold">{done ? "✅" : "⬜"} {n}. {title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export default async function BidPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await loadBid(id);
  if (!d) notFound();
  const b = d.bid;
  const go = goDecision(b.go ?? {});
  const open = d.requirements.filter((r) => r.required && !r.done).length;
  const priced = d.lines.length > 0 && d.lines.every((l) => Number(l.pro_unit_cost) > 0);
  const committed = d.quotes.filter((q) => q.status === "committed").length;
  const hasConfirmation = d.documents.some((x) => x.kind === "confirmation");
  const closed = ["submitted", "won", "lost", "cancelled", "no_bid"].includes(b.status);
  const ai = b.ai_summary;
  const dueH = b.due_at ? (new Date(b.due_at).getTime() - Date.now()) / 3600000 : null;
  const ws = b as unknown as WsBid;
  return (
    <div className="space-y-4">
      <Link href="/hub/bids" className="text-sm text-brand">← Bids</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs text-ink-soft">{BID_SOURCES[b.source as BidSource]}{b.solicitation_number ? ` · ${b.solicitation_number}` : ""} · {BID_STATUS_LABEL[b.status as BidStatus]}</div>
          <h1 className="text-2xl font-bold">{b.title}</h1>
          <div className="text-sm text-ink-soft">{b.agency ?? ""}{b.link && <> · <a href={b.link} target="_blank" rel="noreferrer" className="underline">posting ↗</a></>}{b.notice_id && <> · <Link href={`/hub/gov/${encodeURIComponent(b.notice_id)}`} className="underline">SAM.gov notice</Link></>}</div>
          {b.due_at && <div className={`mt-1 text-sm font-semibold ${dueH !== null && dueH < 72 ? "text-rose-700" : ""}`}>Due {new Date(b.due_at).toLocaleString("en-US", { timeZone: "America/Detroit", dateStyle: "full", timeStyle: "short" })}{dueH !== null && dueH > 0 ? ` (${dueH < 72 ? `${Math.round(dueH)} hours` : `${Math.floor(dueH / 24)} days`} left)` : dueH !== null ? " (passed)" : ""}{b.questions_due_at ? ` · questions due ${new Date(b.questions_due_at).toLocaleDateString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric" })}` : ""}</div>}
        </div>
        <BidStatusButtons b={ws} />
      </div>
      {!closed && (
        <div className={`rounded-xl p-3 text-sm ${d.gate.ready ? "bg-green-50" : "bg-amber-50"}`}>
          <b>{d.gate.ready ? "Ready to submit." : `Before this can be submitted (${d.gate.missing.length}):`}</b> {d.gate.missing.join(" · ")}
          {d.gate.warnings.length > 0 && <div className="text-amber-900">⚠ {d.gate.warnings.join(" · ")}</div>}
        </div>
      )}
      {b.status === "no_bid" && <p className="rounded-xl bg-slate-100 p-3 text-sm">No bid{b.no_bid_reason ? `: ${b.no_bid_reason}` : ""}.</p>}
      {ai && (
        <div className="card text-sm">
          <div className="font-semibold">What the solicitation asks for</div>
          <p className="mt-1">{ai.summary}</p>
          {ai.red_flags?.length > 0 && <ul className="mt-2 text-amber-900">{ai.red_flags.map((f) => <li key={f}>⚠ {f}</li>)}</ul>}
          {b.submit_method && <p className="mt-2"><b>How to submit:</b> {b.submit_method}</p>}
          <p className="mt-1 text-xs text-ink-soft">AI reading — confirm against the documents.</p>
        </div>
      )}
      <Step n="0" title="Details" open={!b.due_at}><BidFields b={ws} /></Step>
      <Step n="1" title={`Go / no-go${go.decision === "go" ? " — go" : go.decision === "no_go" ? " — no go" : ""}`} done={go.decision === "go"} open={go.decision !== "go"}><GoNoGo b={ws} /></Step>
      <Step n="2" title={`Documents (${d.documents.length})`} done={d.documents.some((x) => x.kind === "rfq")}><BidDocuments bidId={b.id} docs={d.documents as WsDoc[]} aiReady={aiEnabled()} /></Step>
      <Step n="3" title={`Compliance matrix (${open} open)`} done={d.requirements.length > 0 && open === 0}><ComplianceMatrix bidId={b.id} reqs={d.requirements as WsReq[]} /></Step>
      <Step n="4" title={`Pricing${d.gate.pricing.totals.totalPrice ? ` — ${d.gate.pricing.totals.totalPrice.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}` : ""}`} done={priced}><BidPricing b={ws} lines={d.lines as WsLine[]} best={d.best} /></Step>
      <Step n="5" title={`Pros' written prices (${committed} committed)`} done={committed > 0} open={!closed}><BidProQuotes bidId={b.id} quotes={d.quotes as unknown as WsQuote[]} lines={d.lines as WsLine[]} /></Step>
      <Step n="6" title="Review & submit" done={["submitted", "won", "lost"].includes(b.status)}><ReviewSubmit b={ws} gate={d.gate} hasConfirmation={hasConfirmation} /></Step>
      {["submitted", "won", "lost"].includes(b.status) && <Step n="7" title="Result & debrief" done={["won", "lost"].includes(b.status)}><BidResult b={ws} lines={d.lines as WsLine[]} /></Step>}
    </div>
  );
}
