/*
 * FILE    : apps/web/app/(site)/careers/sales/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0020 UTC
 * UPDATED : 2026-11-18_0056 UTC — independent contractors (1099): your hours, your methods; training optional; leader retainer instead
 *           of salary; contractor note.
 * UPDATED : 2026-11-18_0120 UTC — the 90-day revenue leaderboard (recognition and perks; rank stays cumulative).
 * UPDATED : 2026-11-18_0110 UTC — everything cumulative: total profit made for Handled, total deals, clients won, team totals;
 *           ranks never go down; from-zero timeline at 4, 3 and 2 deals a month.
 * UPDATED : 2026-11-18_0100 UTC — the chart leads with the profit made for Handled (own and team, 90 days): promotions follow the
 *           same money the commission rises with.
 * UPDATED : 2026-11-18_0050 UTC — the promotion chart (commission, deals in 90 days, active clients, team deals and clients) and
 *           the from-zero timeline; promotion targets are counts, not dollars.
 * UPDATED : 2026-11-18_0040 UTC — "Three ways to $100K a year" from commercial business services (core PATHS_TO_100K / earningsPlan).
 * PURPOSE : The Handled Sales Force careers page: start as an Associate Account Executive and grow to VP of Sales.
 *           Two paths (Seller and Leader), what each rank earns (shown per $1,000 of profit sold), how promotions work,
 *           how people grow with the company (salary, profit share, new markets), example months, fair rules, apply.
 *           Rules from core sales-force.ts. Live (2026-11-18): indexed, linked from /careers; ?leader=CODE (a leader's
 *           recruit link) carries to the sign-up so the new rep joins that team.
 * UPDATED : 2026-11-19_1600 UTC — headline pay from Partner Program v7 (20% → 50% on direct sales); the chart notes reps get the higher of the two.
 * UPDATED : 2026-11-24_1700 UTC — one chart: every rank shows the rate a sale really pays (core rankSaleRate — Associate 20%, not
 *           the 15% that was never paid); the "higher of the two" footnote is gone.
 * UPDATED : 2026-11-24_2200 UTC — canonical URL (SEO review).
 * UPDATED : 2026-11-27_2100 UTC — Path 2 · Sell has its own sign-up here (#join, the Sales Force form); Apply buttons scroll to it.
 */
import Link from "next/link";
import { PartnerSignUp } from "@/components/PartnerUI";
import { rankSaleRate, DIRECT_BONUS, REFERRAL_LADDER, CONTRACTOR, LEADER_RETAINER, FAST_MONEY, PATHS_TO_100K, earningsPlan, promotionChart, sellerTimeline, LEADERBOARD, PROFIT_SHARE, PARTNER_KINDS, partnerTerms, RANK_ORDER, SALES_POOL, SALES_RANKS, exampleMonth, nextRanks, type SalesRank } from "@handled/core";

export const metadata = { alternates: { canonical: "/careers/sales" }, title: "Sales careers: Associate AE to VP of Sales", description: "Start as an Associate Account Executive and grow to VP of Sales. Share of the profit you sell, a book that keeps paying, and leadership that pays." };

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct = (r: number) => `${Math.round(r * 100)}%`;

const SELLER: SalesRank[] = ["associate", "ae", "senior_ae", "principal_ae"];
const LEADER: SalesRank[] = ["team_lead", "manager", "director", "vp"];

function req(r: SalesRank): string {
  const q = SALES_RANKS[r].requires;
  const bits = [
    q.profit && `${money(q.profit)} profit for Handled from your clients`,
    q.teamProfit && `${money(q.teamProfit)} from your team`,
    q.deals && `${q.deals} deals`,
    q.clients && `${q.clients} clients won`,
    q.reps && `${q.reps} reps with a deal on your team`,
    q.leaders && `${q.leaders} leaders reporting to you`,
    q.teamDeals && `${q.teamDeals.toLocaleString("en-US")} team deals`,
  ].filter(Boolean);
  if (!bits.length) return "Where everyone starts";
  return `${bits.join(" · ")} (totals since you started)${q.approval ? ", plus owner approval" : ""}`;
}

const num = (n: number) => (n ? n.toLocaleString("en-US") : "—");

/** The promotion chart: one row per rank, the same numbers the app measures. */
function PromotionChart() {
  const rows = promotionChart();
  const paces = [4, 3, 2].map((d) => ({ d, t: sellerTimeline(d).slice(1) }));
  return (
    <section id="chart" className="wrap scroll-mt-24 py-10 sm:py-14 pro:sm:py-10">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">The promotion chart</h2>
      <p className="mt-2 max-w-3xl text-ink-soft">Everyone starts from zero. Your commission rises with the money you make Handled, and so do your promotions: the main number is the total profit your clients have made Handled since your first day (your team’s, for leaders). Deals and clients won are the minimums, so the profit comes from real clients. Everything adds up and never resets, so you never lose a rank. The app counts all of it for you.</p>
      <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr><th className="p-3">Rank</th><th className="p-3 text-right">Your rate on a sale</th><th className="p-3 text-right">Team share</th><th className="p-3 text-right">Total profit you’ve made Handled</th><th className="p-3 text-right">Team total profit</th><th className="p-3 text-right">Total deals</th><th className="p-3 text-right">Clients won</th><th className="p-3 text-right">Team deals</th><th className="p-3">Also</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank} className={`border-t border-line ${r.path === "leader" ? "bg-paper/50" : ""}`}>
                <td className="p-3"><div className="font-semibold">{r.title}</div><div className="text-[11px] text-ink-soft">{r.path === "leader" ? "Leader path" : r.path === "seller" ? "Seller path" : "Start"}</div></td>
                <td className="p-3 text-right font-bold">{pct(rankSaleRate(r.rank))}</td>
                <td className="p-3 text-right">{r.team ? pct(r.team) : "—"}</td>
                <td className="p-3 text-right font-semibold">{r.profit ? money(r.profit) : "—"}</td>
                <td className="p-3 text-right font-semibold">{r.teamProfit ? money(r.teamProfit) : "—"}</td>
                <td className="p-3 text-right">{num(r.deals)}</td>
                <td className="p-3 text-right">{num(r.clients)}</td>
                <td className="p-3 text-right">{num(r.teamDeals)}</td>
                <td className="p-3 text-xs">{[r.reps && `${r.reps} reps with a deal`, r.leaders && `${r.leaders} leaders`, r.approval && "owner approval", r.bonus && `${money(r.bonus)} bonus`].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-sm"><b>Starting from zero</b> with {money(1500)}-a-month commercial accounts:
        <ul className="mt-1 space-y-0.5">{paces.map(({ d, t }) => <li key={d}>• {d} deals a month{d === 4 ? " (about one a week)" : ""}: {t.map((x) => `${SALES_RANKS[x.rank].short} in month ${x.month}`).join(", ")}</li>)}</ul>
        Leaders move up as their team’s totals grow.</div>
      <p className="mt-2 text-xs text-ink-soft">A deal is a paid sale: a new client, or a new service or site for a client you already have. Profit is what Handled keeps after paying the pro, on every job your clients book, new and repeat, for as long as they book. Your rate on a sale is your share of that profit at that rank (it can be higher: it keeps rising with the profit you make us, up to {pct(REFERRAL_LADDER.topRate + DIRECT_BONUS)}); team share is on your whole team’s sales. All totals count from your first day.</p>
    </section>
  );
}

export default async function SalesCareers({ searchParams }: { searchParams: Promise<{ leader?: string }> }) {
  // a leader's recruit link (?leader=CODE) carries through to the sign-up, so the new rep joins their team
  const leader = (await searchParams).leader;
  // the sign-up is on this page (#join); a leader's recruit link keeps ?leader= in the URL, which the form reads
  const APPLY = "#join";
  void leader;
  const examples = [
    { rank: "ae" as const, who: "Account Executive, month 4", m: exampleMonth({ rank: "ae", homeJobs: 20, homeProfitEach: 100, newAccounts: 2, accountProfitMonthly: 375, bookAccounts: 6 }), note: "20 home jobs, 2 new office accounts, 6 accounts from earlier months still paying" },
    { rank: "senior_ae" as const, who: "Senior AE", m: exampleMonth({ rank: "senior_ae", homeJobs: 10, homeProfitEach: 100, newAccounts: 4, accountProfitMonthly: 375, bookAccounts: 15 }), note: "10 home jobs, 4 new accounts, 15 accounts still paying" },
    { rank: "manager" as const, who: "Sales Manager", m: exampleMonth({ rank: "manager", homeJobs: 5, homeProfitEach: 100, newAccounts: 2, accountProfitMonthly: 375, bookAccounts: 10, teamProfit: 40_000 }), note: "own sales plus 5% of a team bringing in $40,000 profit a month" },
  ];
  const Rank = ({ r }: { r: SalesRank }) => {
    const x = SALES_RANKS[r];
    return (
      <li className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-lg font-bold">{x.title}</div>
          {x.promotionBonus > 0 && <span className="rounded-full bg-gold-light/40 px-2 py-0.5 text-xs font-semibold">{money(x.promotionBonus)} promotion bonus</span>}
        </div>
        <p className="mt-1 text-sm text-ink-soft">{x.role}</p>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-paper p-2"><dt className="text-[11px] text-ink-soft">Your sales</dt><dd className="font-bold">{pct(rankSaleRate(r))}</dd></div>
          <div className="rounded-lg bg-paper p-2"><dt className="text-[11px] text-ink-soft">Your book, year 2+</dt><dd className="font-bold">{x.bookShare ? pct(x.bookShare) : "—"}</dd></div>
          <div className="rounded-lg bg-paper p-2"><dt className="text-[11px] text-ink-soft">Your team’s sales</dt><dd className="font-bold">{x.override ? pct(x.override) : "—"}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-ink-soft">On {money(1000)} of profit you sell: <b>{money(1000 * rankSaleRate(r))}</b>{x.override ? <> · on {money(1000)} your team sells: <b>{money(1000 * x.override)}</b></> : null}</p>
        <p className="mt-2 text-xs"><span className="font-semibold">To get here:</span> {req(r)}</p>
        <ul className="mt-2 space-y-0.5 text-xs">{x.perks.map((p) => <li key={p}>✓ {p}</li>)}</ul>
        {nextRanks(r).length > 0 && <p className="mt-2 text-xs text-ink-soft">Next: {nextRanks(r).map((n) => SALES_RANKS[n].short).join(" or ")}</p>}
      </li>
    );
  };
  return (
    <div>
      <section className="bg-brand-deep text-white">
        <div className="wrap py-10 md:py-16 pro:md:py-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-light">The Handled Sales Force</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Start as an Account Executive. Grow to VP of Sales.</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">Build your own sales business with Handled. You earn a real share of the profit on every customer you bring in, keep earning on the accounts you keep, and move up on numbers you can see. As Handled opens new cities, our own people lead them.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={APPLY} className="btn bg-white px-6 py-3 text-base text-brand-deep hover:bg-gold-light">Apply in 2 minutes</Link>
            <a href="#chart" className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">See the promotion chart</a>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-4">
            {[[pct(REFERRAL_LADDER.baseRate + DIRECT_BONUS) + " → " + pct(REFERRAL_LADDER.topRate + DIRECT_BONUS), "of the profit on what you sell, rising as you grow"], [money(FAST_MONEY.walkthroughHeld), "for every walkthrough held"], ["7 ranks", "from Associate AE to VP"], ["Every Monday", "paid by direct deposit"]].map(([a, b]) => (
              <li key={b} className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15"><div className="text-xl font-bold">{a}</div><div className="text-sm text-white/75">{b}</div></li>
            ))}
          </ul>
        </div>
      </section>

      <PromotionChart />

      <section id="path" className="wrap scroll-mt-24 pb-10 sm:pb-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Two paths up, both pay</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Everyone starts as an Associate AE, with free training and a mentor if you want them. After Senior AE you choose: keep selling and become a Principal AE, or build a team and lead it to VP of Sales. You can switch paths.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div><h3 className="mb-3 font-bold uppercase tracking-wide text-ink-soft">Seller path</h3><ol className="space-y-3">{SELLER.map((r) => <Rank key={r} r={r} />)}</ol></div>
          <div><h3 className="mb-3 font-bold uppercase tracking-wide text-ink-soft">Leader path (from Senior AE)</h3><ol className="space-y-3">{LEADER.map((r) => <Rank key={r} r={r} />)}</ol></div>
        </div>
      </section>

      <section id="100k" className="wrap scroll-mt-24 pb-10 sm:pb-14">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Three ways to $100K a year</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Commercial business services are where the money is: offices, property managers, clinics and facilities that need cleaning and upkeep every week. One account at {money(1500)} a month earns you a share of about {money(earningsPlan(PATHS_TO_100K[0].plan).profitPerAccount)} of profit every month it stays.</p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {PATHS_TO_100K.map((p) => {
            const e = earningsPlan(p.plan);
            return (
              <div key={p.id} className="card flex flex-col">
                <div className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{p.title}</div>
                <div className="text-lg font-bold">{p.who}</div>
                <div className="mt-3 flex items-baseline gap-3"><div><div className="text-[11px] text-ink-soft">Year 1</div><div className="text-xl font-bold">{money(e.year1)}</div></div><div><div className="text-[11px] text-ink-soft">Year 2 on</div><div className="text-3xl font-extrabold text-brand">{money(e.year2)}</div></div></div>
                <div className="mt-3 text-xs font-semibold">Your week:</div>
                <ul className="mt-1 space-y-1 text-sm">{p.week.map((w) => <li key={w}>✓ {w}</li>)}</ul>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-soft">Examples, not a promise. They assume {money(1500)}-a-month accounts, about 1 in 3 walkthroughs becoming an account and 3% of accounts leaving each month. Year 2 is higher because the accounts you closed keep paying you.</p>
      </section>

      <section className="border-y border-line bg-paper-deep py-10 sm:py-14 pro:sm:py-10">
        <div className="wrap">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Grow with the company</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="card"><div className="font-bold">A retainer at the top</div><p className="mt-1 text-sm text-ink-soft">Directors earn a {money(LEADER_RETAINER.director!.monthly)}-a-month leadership retainer and the VP {money(LEADER_RETAINER.vp!.monthly)} a month, on top of commission, once their team’s profit can carry it.</p></div>
            <div className="card"><div className="font-bold">A share of the profit you build</div><p className="mt-1 text-sm text-ink-soft">Directors share {pct(PROFIT_SHARE.director!.share)} of {PROFIT_SHARE.director!.of}; the VP shares {pct(PROFIT_SHARE.vp!.share)} of {PROFIT_SHARE.vp!.of}, paid quarterly.</p></div>
            <div className="card"><div className="font-bold">New cities, led by our people</div><p className="mt-1 text-sm text-ink-soft">Every new market opens a Director and Manager seat. Our own leaders get first claim before we hire from outside.</p></div>
          </div>
        </div>
      </section>

      <section className="wrap py-10 sm:py-14 pro:sm:py-10">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What a month can look like</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {examples.map((e) => <div key={e.who} className="card"><div className="text-sm text-ink-soft">{e.who}</div><div className="text-3xl font-extrabold">{money(e.m)}</div><p className="mt-1 text-xs text-ink-soft">{e.note}</p></div>)}
        </div>
        <p className="mt-3 text-xs text-ink-soft">Examples, not a promise: they assume about $100 profit on a home job and $375 a month on an office account. What you earn depends on what you sell.</p>
      </section>

      <section className="border-t border-line bg-paper-deep py-10 sm:py-14 pro:sm:py-10">
        <div className="wrap grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>✓ <b>Paid on profit, shown in dollars.</b> The app shows what you’ll earn before you sell.</li>
              <li>✓ <b>Paid every Monday</b> after the job is done and paid. If it’s refunded within {SALES_POOL.clawbackDays} days, that pay comes back out.</li>
              <li>✓ <b>Fast money while you learn:</b> {money(FAST_MONEY.walkthroughHeld)} for every walkthrough held, {money(FAST_MONEY.firstSale)} for your first sale.</li>
              <li>✓ <b>Promotions on your totals,</b> shown in the app with exactly what’s left to the next rank.</li>
              <li>✓ <b>Your rank never goes down:</b> everything counts from your first day and keeps adding up.</li>
              <li>✓ <b>The leaderboard:</b> your revenue in the last {LEADERBOARD.windowDays} days ranks you against the team. {LEADERBOARD.rewards.map((r) => r.reward).join(". ")}.</li>
              <li>✓ <b>Free, optional training:</b> the Handled Sales Academy and a mentor, whenever you want them.</li>
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Fair rules</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {CONTRACTOR.promises.map((p) => <li key={p}>✓ {p}.</li>)}
              <li>✓ No fees, no kits, nothing to buy. Ever.</li>
              <li>✓ Leaders earn only on real jobs sold to real customers, never on sign-ups.</li>
              <li>✓ Leaders keep selling themselves to earn on their team.</li>
              <li>✓ Up to {pct(SALES_POOL.firstYearMax)} of our profit on a new customer’s first year goes to the sales force.</li>
            </ul>
            <Link href={APPLY} className="btn-primary mt-6 inline-block px-8 py-3 text-base">Apply in 2 minutes</Link>
            <p className="mt-3 text-xs text-ink-soft">Everyone in the Handled Sales Force is an independent contractor (1099), not an employee. Titles show your commission level. We send a {CONTRACTOR.form} each year you earn $600 or more.</p>
          </div>
        </div>
      </section>
      <section id="join" className="scroll-mt-20 border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold">Join the Sales Force</h2>
            <p className="mt-2 text-sm text-ink-soft">Two minutes. No fee, no quota. Your first sale makes you an Associate Account Executive.</p>
            <div className="mt-4"><PartnerSignUp path="sell" kinds={Object.entries(PARTNER_KINDS).filter(([k]) => k !== "pro")} defaultKind="sales_rep" /></div>
          </div>
          <div>
            <h2 className="text-lg font-bold">Partner terms</h2>
            <p className="mt-1 text-sm">The full terms are in the <a href="/terms/referral-partner-agreement" className="font-semibold text-brand underline">Referral Partner Agreement</a>. You agree to them when you sign up.</p>
            <details className="mt-3 rounded-xl border border-line bg-white p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-brand">Read the terms ({partnerTerms().length} points)</summary>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">{partnerTerms().map((t, i) => <li key={i}>{t}</li>)}</ol>
            </details>
            <p className="mt-4 text-sm">Rather just send us customers? <Link href="/partners/refer" className="font-semibold text-brand underline">Path 1 · Refer</Link></p>
          </div>
        </div>
      </section>
    </div>
  );
}

// every rank appears once on the page (seller path + leader path)
void RANK_ORDER;
