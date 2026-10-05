/*
 * FILE    : apps/web/app/hub/bids/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_1954 UTC
 * PURPOSE : Handled Hub → Bids: every public bid we're working, by deadline, with where each one stands in the
 *           five steps (go / no-go → compliance → pricing → review → submit), our win rate and the price benchmarks
 *           we've collected. Start a bid by hand (city, county, state, school…) or from Gov contracts.
 */
import Link from "next/link";
import { BID_SOURCES, BID_STATUS_LABEL, money, type BidSource, type BidStatus } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";
import { BenchmarkForm, NewBidForm } from "@/components/BidWorkspace";

export const dynamic = "force-dynamic";

type Row = { id: string; title: string; agency: string | null; source: BidSource; status: BidStatus; due_at: string | null; our_price: number | null; winning_price: number | null; winner: string | null; owner: string | null };

function due(d: string | null) {
  if (!d) return "no date";
  const h = (new Date(d).getTime() - Date.now()) / 3600000;
  const s = new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" });
  return h < 0 ? `${s} (passed)` : h < 72 ? `${s} — ${Math.round(h)}h left` : `${s} (${Math.floor(h / 24)}d)`;
}

export default async function Bids() {
  const db = adminClient();
  const [{ data }, { data: bench }] = await Promise.all([
    db.from("bids").select("id, title, agency, source, status, due_at, our_price, winning_price, winner, owner").order("due_at", { ascending: true, nullsFirst: false }).limit(500),
    db.from("bid_benchmarks").select("id, item, unit, price, agency, source, award_date").order("created_at", { ascending: false }).limit(50),
  ]);
  const rows = (data ?? []) as Row[];
  const active = rows.filter((r) => ["draft", "pricing", "review", "ready"].includes(r.status));
  const done = rows.filter((r) => !["draft", "pricing", "review", "ready"].includes(r.status));
  const won = rows.filter((r) => r.status === "won").length, lost = rows.filter((r) => r.status === "lost").length;
  const table = (items: Row[]) => (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Bid</th><th className="p-3">Due</th><th className="p-3">Stage</th><th className="p-3">Our price</th><th className="p-3">Owner</th></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className="p-3"><Link href={`/hub/bids/${r.id}`} className="font-semibold text-brand hover:underline">{r.title}</Link><div className="text-xs text-ink-soft">{BID_SOURCES[r.source]}{r.agency ? ` · ${r.agency}` : ""}</div></td>
              <td className="p-3 text-xs">{due(r.due_at)}</td>
              <td className="p-3 text-xs">{BID_STATUS_LABEL[r.status]}{r.status === "lost" && r.winning_price ? ` · won by ${r.winner ?? "?"} at ${money(Number(r.winning_price))}` : ""}</td>
              <td className="p-3 text-xs">{r.our_price ? money(Number(r.our_price)) : "—"}</td>
              <td className="p-3 text-xs">{r.owner ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bids</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Every public bid goes through the same five steps: <b>go / no-go</b> (eligible, staffed, insured, profitable, time), the <b>compliance matrix</b> (the AI reads the solicitation; a person checks off every item), <b>pricing</b> from pros&apos; written prices up, a <b>review</b> sign-off, and <b>submit</b> with the confirmation saved. A bid can&apos;t be marked submitted until all of it is done.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Working" value={active.length} />
        <Stat label="Due in 7 days" value={active.filter((r) => r.due_at && new Date(r.due_at).getTime() - Date.now() < 7 * 86400000).length} />
        <Stat label="Submitted" value={rows.filter((r) => r.status === "submitted").length} hint="awaiting award" />
        <Stat label="Won / lost" value={`${won} / ${lost}`} />
        <Stat label="Win rate" value={won + lost ? `${Math.round((won / (won + lost)) * 100)}%` : "—"} />
      </div>
      <section className="card"><h2 className="mb-3 text-lg font-bold">Start a bid</h2><NewBidForm /><p className="mt-2 text-xs text-ink-soft">Federal notices: open one in <Link href="/hub/gov" className="underline">Gov contracts</Link> and press “Start a bid”.</p></section>
      <section><h2 className="mb-2 text-lg font-bold">Working</h2>{active.length ? table(active) : <p className="text-sm text-ink-soft">No bids in progress.</p>}</section>
      {done.length > 0 && <section><h2 className="mb-2 text-lg font-bold">Submitted, results and no-bids</h2>{table(done)}</section>}
      <section className="card">
        <h2 className="text-lg font-bold">Price benchmarks</h2>
        <p className="mb-3 text-sm text-ink-soft">What work went for before: from award notices, published bid tabulations and our own results (added automatically when you record a result). Use them to sanity-check every price line.</p>
        {bench && bench.length > 0 && (
          <div className="mb-3 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-2">Item</th><th className="p-2">Unit</th><th className="p-2">Price</th><th className="p-2">Agency / source</th><th className="p-2">Date</th></tr></thead>
            <tbody>{bench.map((b) => <tr key={b.id} className="border-t border-line"><td className="p-2">{b.item}</td><td className="p-2">{b.unit}</td><td className="p-2">{money(Number(b.price))}</td><td className="p-2 text-xs">{[b.agency, b.source].filter(Boolean).join(" · ")}</td><td className="p-2 text-xs">{b.award_date ?? ""}</td></tr>)}</tbody></table></div>
        )}
        <BenchmarkForm />
      </section>
    </div>
  );
}
