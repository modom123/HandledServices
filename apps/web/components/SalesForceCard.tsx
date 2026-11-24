/*
 * FILE    : apps/web/components/SalesForceCard.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0105 UTC
 * PURPOSE : The partner page's Sales Force card (lib/sales-force.ts salesForceView): rank and commission, totals since day
 *           one, what's left for the next rank, team and recruit link, recent Sales Force pay, and the 90-day revenue
 *           leaderboard. Independent contractors (1099).
 */
import Link from "next/link";
import { LEADERBOARD, SALES_RANKS, money, type SalesRank } from "@handled/core";
import { CopyButton } from "@/components/PartnerUI";

const pct = (r: number) => `${Math.round(r * 100)}%`;
const KIND: Record<string, string> = { override: "Team share", walkthrough: "Walkthrough held", first_sale: "First-sale bonus", promotion: "Promotion bonus" };

type View = {
  rank: SalesRank;
  numbers: { profit: number; deals: number; clients: number; teamProfit: number; teamDeals: number; reps: number; revenue90: number; selling: boolean };
  next: { rank: SalesRank; gaps: string[] }[];
  board: { id: string; name: string; place: number; revenue90: number; rank: SalesRank }[];
  place: { place: number; reward: string | null; revenue90: number } | null;
  pay: { kind: string; amount: number; status: string; note: string | null; created_at: string }[];
  leader: { name: string; rank: SalesRank } | null;
  teamSize: number;
  recruitLink: string;
};

export function SalesForceCard({ v, ladderRate }: { v: View; ladderRate: number }) {
  const r = SALES_RANKS[v.rank];
  const rate = Math.max(r.sellerShare, ladderRate);
  return (
    <section id="sales-force" className="card scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">Handled Sales Force</div>
          <h2 className="text-xl font-bold">{r.title}</h2>
          <p className="text-sm text-ink-soft">{pct(rate)} of our profit on what you sell{r.override ? ` · ${pct(r.override)} on your team's sales` : ""}{r.bookShare ? ` · ${pct(r.bookShare)} on your clients after year one` : ""}{v.leader ? ` · on ${v.leader.name}'s team` : ""}</p>
        </div>
        <Link href="/careers/sales#chart" className="text-sm font-semibold text-brand underline">The promotion chart</Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {[["Profit you've made Handled", money(v.numbers.profit)], ["Deals", String(v.numbers.deals)], ["Clients won", String(v.numbers.clients)], ...(v.teamSize ? [["Team profit", money(v.numbers.teamProfit)]] : [["Revenue, last 90 days", money(v.numbers.revenue90)]])].map(([k, x]) => (
          <div key={k} className="rounded-lg border border-line p-2"><div className="text-xs text-ink-soft">{k}</div><div className="text-lg font-bold">{x}</div></div>
        ))}
      </div>
      <p className="text-xs text-ink-soft">Totals since your first day. They only go up, so you never lose a rank.</p>

      {v.next.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {v.next.map((n) => (
            <div key={n.rank} className="rounded-lg bg-paper p-3 text-sm">
              <div className="font-semibold">Next: {SALES_RANKS[n.rank].title} ({pct(SALES_RANKS[n.rank].sellerShare)}{SALES_RANKS[n.rank].override ? ` + ${pct(SALES_RANKS[n.rank].override)} team` : ""})</div>
              {n.gaps.length ? <ul className="mt-1 space-y-0.5">{n.gaps.map((g) => <li key={g}>• {g}</li>)}</ul> : <p className="mt-1 text-emerald-700">You qualify: it's applied overnight.</p>}
            </div>
          ))}
        </div>
      )}

      {(v.rank !== "associate" && v.rank !== "ae") && (
        <div className="rounded-lg border border-line p-3 text-sm">
          <div className="font-semibold">Build your team ({v.teamSize} so far)</div>
          <p className="mt-1 text-ink-soft">Anyone who joins from your link is on your team. When they sell, you earn your team share, as long as you keep selling too.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><code className="break-all rounded bg-paper px-2 py-1 text-xs">{v.recruitLink}</code><CopyButton text={v.recruitLink} /></div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-sm font-semibold">Leaderboard: revenue, last {LEADERBOARD.windowDays} days</div>
          {v.board.length ? <ol className="mt-1 space-y-0.5 text-sm">{v.board.map((b) => <li key={b.id} className={`flex justify-between ${v.place && b.place === v.place.place && b.revenue90 === v.place.revenue90 ? "font-bold text-brand-dark" : ""}`}><span>#{b.place} {b.name}</span><span className="tabular-nums">{money(b.revenue90)}</span></li>)}</ol> : <p className="mt-1 text-sm text-ink-soft">No sales in the last {LEADERBOARD.windowDays} days yet.</p>}
          <p className="mt-1 text-xs text-ink-soft">{v.place ? `You're #${v.place.place}.${v.place.reward ? ` ${v.place.reward}.` : ""}` : "Close a sale to get on the board."}</p>
        </div>
        <div>
          <div className="text-sm font-semibold">Sales Force pay</div>
          {v.pay.length ? <ul className="mt-1 space-y-0.5 text-sm">{v.pay.map((p, i) => <li key={i} className="flex justify-between gap-2"><span>{KIND[p.kind] ?? p.kind}{p.note ? <span className="text-xs text-ink-soft"> · {p.note}</span> : null}</span><span className="tabular-nums">{money(Number(p.amount))}{p.status === "paid" ? " ✓" : ""}</span></li>)}</ul> : <p className="mt-1 text-sm text-ink-soft">Walkthroughs held, team shares and bonuses show up here. Paid Mondays with your commissions.</p>}
        </div>
      </div>
      <p className="text-xs text-ink-soft">You're an independent contractor (1099): your hours, your methods, where you sell. Training and mentoring are free and optional.</p>
    </section>
  );
}
