/*
 * FILE    : apps/web/app/hub/growth/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Growth — where bookings come from (first-touch source, last 30 days), Handled Plus
 *           members and monthly revenue, promo codes (create / on-off / uses), gift card balances
 *           outstanding, referral rewards, tips to pros, and open chargebacks.
 */
import { HANDLED_PLUS, money } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Badge, Empty, Stat } from "@/components/ui";
import { NewPromo, PromoToggle } from "@/components/PromoAdmin";

export const dynamic = "force-dynamic";
type Rec = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default async function Growth() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return <Empty>Connect Supabase (service role key) to see growth numbers.</Empty>;
  const db = adminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: jobs }, { count: members }, { data: promos }, { data: tips }, { data: disputes }] = await Promise.all([
    db.from("jobs").select("attribution, price_final, paid_at, discount, member_benefit").gte("created_at", since).limit(5000),
    db.from("memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    db.from("promo_codes").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("tips").select("amount").eq("status", "paid").gte("created_at", since),
    db.from("payment_disputes").select("*").is("closed_at", null).order("created_at", { ascending: false }),
  ]);
  const bySource = new Map<string, { bookings: number; paid: number; revenue: number }>();
  for (const j of (jobs ?? []) as Rec[]) {
    const src = (j.attribution?.source as string) ?? "unknown";
    const row = bySource.get(src) ?? { bookings: 0, paid: 0, revenue: 0 };
    row.bookings++;
    if (j.paid_at) { row.paid++; row.revenue += Number(j.price_final ?? 0); }
    bySource.set(src, row);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const all = (promos ?? []) as Rec[];
  const staffCodes = all.filter((p) => p.source === "staff");
  const giftOut = all.filter((p) => p.kind === "gift" && p.active).reduce((t, p) => t + Number(p.balance ?? 0), 0);
  const discounts = ((jobs ?? []) as Rec[]).reduce((t, j) => t + Number(j.discount ?? 0) + Number(j.member_benefit ?? 0), 0);
  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-bold">Growth</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={`${HANDLED_PLUS.name} members`} value={members ?? 0} hint={`${money((members ?? 0) * HANDLED_PLUS.monthly)}/month`} />
        <Stat label="Gift card balances owed" value={money(giftOut)} />
        <Stat label="Discounts given (30d)" value={money(discounts)} hint="from our share" />
        <Stat label="Tips to pros (30d)" value={money((tips ?? []).reduce((t: number, x: Rec) => t + Number(x.amount), 0))} />
        <Stat label="Open chargebacks" value={(disputes ?? []).length} />
      </div>

      <section>
        <h2 className="mb-3 text-xl font-bold">Where bookings come from (last 30 days)</h2>
        {!sources.length ? <Empty>No bookings yet. Use utm_source links in ads (e.g. ?utm_source=google&utm_campaign=spring) to see them here.</Empty> : (
          <div className="card overflow-x-auto p-0"><table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Source</th><th className="p-3">Bookings</th><th className="p-3">Paid</th><th className="p-3">Paid rate</th><th className="p-3">Revenue</th></tr></thead>
            <tbody>{sources.map(([src, r]) => <tr key={src} className="border-t border-line"><td className="p-3 font-semibold">{src}</td><td className="p-3">{r.bookings}</td><td className="p-3">{r.paid}</td><td className="p-3">{Math.round((r.paid / r.bookings) * 100)}%</td><td className="p-3">{money(r.revenue)}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Promo codes</h2>
        <NewPromo />
        <div className="card mt-4 overflow-x-auto p-0"><table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft"><tr><th className="p-3">Code</th><th className="p-3">Offer</th><th className="p-3">Uses</th><th className="p-3">Rules</th><th className="p-3">Status</th></tr></thead>
          <tbody>{staffCodes.map((p) => (
            <tr key={p.code} className="border-t border-line"><td className="p-3 font-mono font-semibold">{p.code}</td><td className="p-3">{p.kind === "percent" ? `${p.value}% off` : `${money(p.value)} off`}</td><td className="p-3">{p.uses}{p.max_uses ? ` / ${p.max_uses}` : ""}</td>
              <td className="p-3 text-xs text-ink-soft">{[p.first_job_only && "first job", Number(p.min_order) && `min ${money(p.min_order)}`, p.expires_at && `until ${String(p.expires_at).slice(0, 10)}`, p.note].filter(Boolean).join(" · ") || "—"}</td>
              <td className="p-3"><Badge tone={p.active ? "green" : "slate"}>{p.active ? "on" : "off"}</Badge> <PromoToggle code={p.code} active={p.active} /></td></tr>
          ))}</tbody>
        </table></div>
        <p className="mt-2 text-xs text-ink-soft">Discounts always come out of our share — never the pro’s pay — and we keep at least 5% of every job. Referral codes (REF-…) and gift cards (GIFT-…) are created automatically.</p>
      </section>

      {(disputes ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Open chargebacks</h2>
          <div className="space-y-2">{(disputes as Rec[]).map((d) => <div key={d.id} className="card text-sm"><b>{money(d.amount)}</b> · {d.reason} · {d.status} · respond by {String(d.evidence_due_by ?? "").slice(0, 10) || "see Stripe"}{d.job_id ? <> · <a className="underline" href={`/hub/jobs/${d.job_id}`}>job</a></> : null}</div>)}</div>
        </section>
      )}
    </div>
  );
}
