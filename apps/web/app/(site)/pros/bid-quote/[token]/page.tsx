/*
 * FILE    : apps/web/app/(site)/pros/bid-quote/[token]/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : A pro's private link to quote a public bid in writing: their price per line, how much they can cover,
 *           and whether they're a small business. No login. A quote, never an offer of work.
 */
import { notFound } from "next/navigation";
import { BRAND } from "@handled/core";
import { quoteByToken } from "@/lib/bids";
import { BidQuoteForm } from "@/components/BidQuoteForm";

export const metadata = { title: "Price request", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function BidQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const f = await quoteByToken(token);
  if (!f) notFound();
  const closed = ["submitted", "won", "lost", "cancelled", "no_bid"].includes(f.bid.status);
  const summary = (f.bid.ai_summary as { summary?: string } | null)?.summary;
  return (
    <div className="wrap max-w-3xl space-y-5 py-8">
      <div>
        <div className="text-sm text-ink-soft">Price request from {BRAND.name}</div>
        <h1 className="text-2xl font-bold">{f.bid.title}</h1>
        <p className="text-sm text-ink-soft">{f.bid.agency ?? ""}{f.bid.term_years ? ` · about ${f.bid.term_years} year${Number(f.bid.term_years) === 1 ? "" : "s"}` : ""}</p>
        {summary && <p className="mt-2 text-sm">{summary}</p>}
      </div>
      <div className="card text-sm">
        <p><b>{f.quote.contractor?.business_name}</b>, please give your business&apos;s own price for each line you&apos;d want to do. Leave a line blank if it isn&apos;t your kind of work.</p>
        <p className="mt-2 text-ink-soft">This is a request for your quote, not an offer of work. If {BRAND.name} wins, the work is offered to you as a written subcontract with the contract&apos;s requirements, and you decide whether to take it. Your prices stay between us.</p>
      </div>
      {closed ? <p className="card text-sm">This bid is closed. Thank you.</p> : (
        <BidQuoteForm token={token} lines={f.lines.map((l) => ({ id: l.id, item: l.item, unit: l.unit, qty: Number(l.qty), years: Number(l.years) }))}
          initial={{ status: f.quote.status, prices: (f.quote.prices ?? {}) as Record<string, number>, capacity: f.quote.capacity, small_business: f.quote.small_business, note: f.quote.note }} />
      )}
    </div>
  );
}
