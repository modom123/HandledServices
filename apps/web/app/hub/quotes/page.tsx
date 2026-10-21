/*
 * FILE    : apps/web/app/hub/quotes/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Hub → Marketplace: request-a-quote activity (requests, who was asked, quotes and prices, booked or not) and
 *           how pros price their services (pro price cards: how many pros, median % per service).
 */
import Link from "next/link";
import { SERVICE_BY_SLUG, money, rateStats } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Marketplace() {
  const db = adminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: reqs }, { data: rates }, { data: jobs }] = await Promise.all([
    db.from("quote_requests").select("id, token, service_slug, city, zip, contact_name, status, created_at, quote_bids(status, price, contractors(business_name))").gte("created_at", since).order("created_at", { ascending: false }).limit(200),
    db.from("pro_rates").select("service_slug, pct").eq("active", true).limit(5000),
    db.from("jobs").select("priced_by, price_final").gte("created_at", since).neq("status", "cancelled").limit(20000),
  ]);
  type Bid = { status: string; price: number | null; contractors: { business_name: string } | null };
  const rows = (reqs ?? []) as unknown as { id: string; token: string; service_slug: string; city: string | null; zip: string; contact_name: string; status: string; created_at: string; quote_bids: Bid[] }[];
  const bySvc = new Map<string, number[]>();
  for (const r of rates ?? []) bySvc.set(r.service_slug, [...(bySvc.get(r.service_slug) ?? []), Number(r.pct)]);
  const priced = (k: string) => (jobs ?? []).filter((j) => (j.priced_by ?? "engine") === k);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketplace</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Pros set their own prices (80–175% of ours) and customers choose, still all upfront. Big jobs can get up to 3 firm quotes in 24 hours (<Link href="/quote-request" className="text-brand underline">public form</Link>). Handled’s commission and booking fee are the same on every price.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Bookings (30d)" value={(jobs ?? []).length} />
        <Stat label="At a pro's price" value={priced("pro_rate").length} />
        <Stat label="From a quote" value={priced("quote").length} />
        <Stat label="Named price" value={priced("offer").length} />
        <Stat label="Quote requests (30d)" value={rows.length} hint={`${rows.filter((r) => r.status === "booked").length} booked`} />
      </div>
      <section>
        <h2 className="mb-2 text-lg font-bold">Quote requests</h2>
        {rows.length ? (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Job</th><th className="p-3">Customer</th><th className="p-3">Quotes</th><th className="p-3">Status</th></tr></thead>
              <tbody>{rows.map((r) => {
                const quoted = r.quote_bids.filter((b) => b.price);
                return (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="p-3"><a href={`/quote/${r.token}`} target="_blank" className="font-semibold text-brand hover:underline">{SERVICE_BY_SLUG[r.service_slug]?.name ?? r.service_slug}</a><div className="text-xs text-ink-soft">{r.city ?? r.zip} · {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div></td>
                    <td className="p-3 text-xs">{r.contact_name}</td>
                    <td className="p-3 text-xs">{r.quote_bids.length} asked · {quoted.length} quoted{quoted.length ? <div>{quoted.map((b) => `${b.contractors?.business_name ?? "pro"} ${money(Number(b.price))}${b.status === "chosen" ? " ✓" : ""}`).join(" · ")}</div> : null}</td>
                    <td className="p-3 text-xs capitalize">{r.status}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-ink-soft">No quote requests in the last 30 days.</p>}
      </section>
      <section>
        <h2 className="mb-2 text-lg font-bold">How pros price their services</h2>
        {bySvc.size ? (
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Service</th><th className="p-3">Pros with their own price</th><th className="p-3">Median</th><th className="p-3">Middle half</th></tr></thead>
              <tbody>{[...bySvc.entries()].sort((a, b) => b[1].length - a[1].length).map(([slug, pcts]) => { const st = rateStats(pcts); return (
                <tr key={slug} className="border-t border-line"><td className="p-3">{SERVICE_BY_SLUG[slug]?.name ?? slug}</td><td className="p-3">{pcts.length}</td><td className="p-3">{st.median != null ? `${st.median}%` : "—"}</td><td className="p-3">{st.low != null ? `${st.low}%–${st.high}%` : "—"}</td></tr>
              ); })}</tbody>
            </table>
          </div>
        ) : <p className="text-sm text-ink-soft">No pro has set their own price yet (Pro portal → My prices).</p>}
      </section>
    </div>
  );
}
