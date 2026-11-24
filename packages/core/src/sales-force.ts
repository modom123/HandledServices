/*
 * FILE    : packages/core/src/sales-force.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0020 UTC
 * PURPOSE : The Handled Sales Force: a career, not a gig. Builds on the Partner Program's 15% → 45% ladder: each rank is a
 *           step up that ladder, reached by clear rank targets instead of the $1M profit curve.
 *           Everyone starts as an Associate Account Executive and can grow
 *           to VP of Sales, on one of two paths that pay equally well:
 *             Seller path  — Associate AE → Account Executive → Senior AE → Principal AE (top individual sellers)
 *             Leader path  — Senior AE → Team Lead → Sales Manager → Director of Sales → VP of Sales
 *           Pay is a share of the PROFIT Handled earns on the customers the team brings in, shown to reps in dollars:
 *             SALES_POOL      — up to 60% of our profit in a new customer's first 12 months goes to the sales force
 *                               (seller + their leaders); Handled keeps every unfilled share
 *             seller share    — the 15% → 45% ladder, now with titles: Associate 15%, AE 20%, Senior AE 25%, Principal 35%,
 *                               Team Lead 30%, Manager 35%, Director 40%, VP 45% of the profit on what they sell
 *             book share      — 5–10% of the profit on their customers after year 1, while they're active (they keep
 *                               earning on accounts they keep happy)
 *             leader override — Team Lead 8%, Manager 5%, Director 4%, VP 3% of the profit on their org's sales,
 *                               only on real, paid jobs to real customers, never on sign-ups (not a pyramid)
 *             fast money      — $25 for every walkthrough held, $100 first-sale bonus, paid the next Monday
 *             promotion bonus — one-time cash when you move up
 *           Growing with the company:
 *             LEADER_RETAINER — Directors and the VP earn a monthly leadership retainer (1099) once their region's profit
 *                               supports it
 *             PROFIT_SHARE    — Directors share in their region's profit, the VP in the company's
 *             new markets     — each new city opens a Director and Manager seat; current leaders get first claim
 *           Promotions follow the money and everything is CUMULATIVE from day one: total profit made for Handled (team
 *           total for leaders), with total deals, clients won, reps developed and leaders as minimums; plus refund rate.
 *           Totals only go up, so a rank, and its commission, is never lost. promotionChart() is the one chart everyone
 *           sees; sellerTimeline() shows the month each rank is reached starting from zero.
 *           salesPay() splits one job's profit across the seller and their leaders, never more than the pool.
 * UPDATED : 2026-11-18_0105 UTC — live pay: sellerRate (never below the ladder rate already earned), teamOverrides (within the
 *           60% pool), autoPromote (cumulative totals, leader path first, VP waits for the owners).
 * UPDATED : 2026-11-18_0056 UTC — everyone is an independent contractor (1099, owner decision): the Sales Academy is optional, not a
 *           promotion requirement; leaders mentor and support (they don't direct how reps work); the Director / VP salary
 *           became a monthly 1099 leadership retainer (LEADER_RETAINER); reps choose their hours, methods and where they sell.
 * UPDATED : 2026-11-18_0120 UTC — leaderboard (LEADERBOARD, leaderboard()): last-90-days revenue ranks who's on top right now, for
 *           recognition and perks; promotions stay cumulative.
 * UPDATED : 2026-11-18_0110 UTC — everything cumulative (owner): total profit made for Handled, total deals, clients won, reps
 *           developed, team totals; ranks never go down (rank protection removed).
 * UPDATED : 2026-11-18_0100 UTC — promotions follow the money: profit made for Handled in the last 90 days (own clients; team for
 *           leaders) is the main measure, the same thing the commission rises with; deals and active clients are minimums.
 * UPDATED : 2026-11-18_0050 UTC — promotions measured on counts (deals, active clients, team deals / clients), not profit dollars;
 *           everyone starts from zero (sellerTimeline).
 * UPDATED : 2026-11-18_0040 UTC — the path to $100K a year from commercial business services: accountProfit (business prices),
 *           earningsPlan (24 months: shares, book, overrides, churn, walkthrough pay), PATHS_TO_100K (three ways).
 *           All numbers are a plan to review with an attorney (1099 vs W-2, overrides, clawbacks) before launch.
 */

import { splitJob } from "./pricing.ts";

export type SalesRank = "associate" | "ae" | "senior_ae" | "principal_ae" | "team_lead" | "manager" | "director" | "vp";
export type SalesPath = "start" | "seller" | "leader";

export interface RankRule {
  title: string; short: string; path: SalesPath; level: number;
  /** share of our profit on what they sell, a new customer's first 12 months */
  sellerShare: number;
  /** share of our profit on their customers after the first 12 months, while active */
  bookShare: number;
  /** share of our profit on sales made by everyone in their org (0 for sellers) */
  override: number;
  /** one-time cash on reaching this rank */
  promotionBonus: number;
  /** what it takes to get here: totals since they started (cumulative) */
  requires: RankRequirement;
  /** what this rank is about, in one line */
  role: string;
  perks: string[];
}

export interface RankRequirement {
  from: SalesRank[];
  /** total profit their clients have made Handled since they started (every job, new and repeat) — the main measure */
  profit?: number;
  /** total profit their whole org has made Handled, their own included (leaders) */
  teamProfit?: number;
  /** total deals they closed (a deal = a paid sale: a new client, or a new service or site for a client) */
  deals?: number;
  /** total clients they won */
  clients?: number;
  /** reps they brought onto their team who have closed a deal */
  reps?: number;
  /** leaders reporting to them (Team Leads for a Manager, Managers for a Director, Directors for the VP) */
  leaders?: number;
  /** total deals closed by their whole org, their own included */
  teamDeals?: number;
  /** most refunds allowed, as a share of their deals */
  maxRefundRate?: number;
  /** finished the Sales Academy for this rank */
  academy?: boolean;
  /** owners approve (VP) */
  approval?: boolean;
}

export const SALES_POOL = {
  /** most of our profit (first 12 months of a new customer) that goes to the sales force, all ranks together */
  firstYearMax: 0.6,
  /** months a new customer counts as "new" */
  newMonths: 12,
  /** leaders must keep selling to earn overrides: personal profit per quarter */
  leaderMinPersonalProfit: 2_000,
  /** paid after the job is done and paid; taken back if refunded within this many days */
  clawbackDays: 30,
} as const;

export const FAST_MONEY = { walkthroughHeld: 25, firstSale: 100, weeklyWalkthroughCap: 20 } as const;

export const SALES_RANKS: Record<SalesRank, RankRule> = {
  associate: {
    title: "Associate Account Executive", short: "Associate AE", path: "start", level: 1,
    sellerShare: 0.15, bookShare: 0, override: 0, promotionBonus: 0,
    requires: { from: [] },
    role: "Learn the product at your own pace, book walkthroughs and close your first clients.",
    perks: ["Free Sales Academy and a mentor, if you want them", "$25 for every walkthrough held, $100 for your first sale", "Paid every Monday"],
  },
  ae: {
    title: "Account Executive", short: "AE", path: "seller", level: 2,
    sellerShare: 0.20, bookShare: 0.05, override: 0, promotionBonus: 250,
    requires: { from: ["associate"], profit: 5_000, deals: 5, clients: 3 },
    role: "Sell to homes and small businesses wherever you choose; build a book of repeat clients.",
    perks: ["Your own book: 5% of the profit on your customers after year one", "Business cards and an @handledsvc.net email"],
  },
  senior_ae: {
    title: "Senior Account Executive", short: "Senior AE", path: "seller", level: 3,
    sellerShare: 0.25, bookShare: 0.08, override: 0, promotionBonus: 500,
    requires: { from: ["ae"], profit: 25_000, deals: 15, clients: 10, maxRefundRate: 0.05 },
    role: "Commercial accounts: offices, property managers, facilities. Help new Associates if you like.",
    perks: ["First pick of warm leads from the AI outreach engine", "Protected accounts: nobody else sells to your customers"],
  },
  principal_ae: {
    title: "Principal Account Executive", short: "Principal AE", path: "seller", level: 4,
    sellerShare: 0.35, bookShare: 0.10, override: 0, promotionBonus: 1_500,
    requires: { from: ["senior_ae"], profit: 150_000, deals: 40, clients: 30, maxRefundRate: 0.05 },
    role: "Our biggest accounts and multi-site contracts. Top of the seller path.",
    perks: ["Exclusive named accounts", "President's Club eligibility", "Seat on the sales council"],
  },
  team_lead: {
    title: "Team Lead", short: "Team Lead", path: "leader", level: 4,
    sellerShare: 0.30, bookShare: 0.08, override: 0.08, promotionBonus: 1_000,
    requires: { from: ["senior_ae", "principal_ae"], teamProfit: 150_000, reps: 3, teamDeals: 40, maxRefundRate: 0.05 },
    role: "Bring reps onto your team and mentor the ones who want help; you earn when they earn.",
    perks: ["8% of the profit on your team's sales", "Free leadership track in the Sales Academy"],
  },
  manager: {
    title: "Sales Manager", short: "Manager", path: "leader", level: 5,
    sellerShare: 0.35, bookShare: 0.08, override: 0.05, promotionBonus: 2_500,
    requires: { from: ["team_lead"], teamProfit: 750_000, leaders: 2, reps: 10, teamDeals: 150, maxRefundRate: 0.05 },
    role: "Support a city's Team Leads and reps with leads, tools and know-how.",
    perks: ["5% of the profit on everyone under you", "Quarterly team bonus pool"],
  },
  director: {
    title: "Director of Sales", short: "Director", path: "leader", level: 6,
    sellerShare: 0.40, bookShare: 0.10, override: 0.04, promotionBonus: 5_000,
    requires: { from: ["manager"], teamProfit: 3_000_000, leaders: 3, teamDeals: 500, maxRefundRate: 0.04 },
    role: "Grow a region: help open new cities and bring on Managers.",
    perks: ["Monthly leadership retainer once your region supports it", "Share of your region's profit", "First claim to run new markets"],
  },
  vp: {
    title: "VP of Sales", short: "VP", path: "leader", level: 7,
    sellerShare: 0.45, bookShare: 0.10, override: 0.03, promotionBonus: 10_000,
    requires: { from: ["director"], teamProfit: 10_000_000, leaders: 2, teamDeals: 1500, approval: true },
    role: "Work with the owners to grow the whole sales force and the next Directors.",
    perks: ["Executive leadership retainer", "Share of company profit", "Seat at the leadership table"],
  },
};

export const RANK_ORDER: SalesRank[] = ["associate", "ae", "senior_ae", "principal_ae", "team_lead", "manager", "director", "vp"];
export const LEADER_RANKS: SalesRank[] = ["team_lead", "manager", "director", "vp"];

/** Everyone is an independent contractor (1099): they choose their hours, methods and where they sell. */
export const CONTRACTOR = {
  status: "1099",
  form: "1099-NEC",
  promises: [
    "You choose your hours, where you sell and how you sell",
    "No quotas, no required schedule, no required meetings",
    "Training and mentoring are free and optional",
    "Ranks raise your commission; nobody loses work for missing a target",
  ],
} as const;

/** Directors and the VP earn a monthly leadership retainer (1099) when the profit their team brings in can carry it. */
export const LEADER_RETAINER: Partial<Record<SalesRank, { monthly: number; whenQuarterlyTeamProfit: number }>> = {
  director: { monthly: 6_250, whenQuarterlyTeamProfit: 250_000 },
  vp: { monthly: 10_000, whenQuarterlyTeamProfit: 1_000_000 },
};

/** Growing with the company: a share of the profit they help build, paid quarterly, on top of everything else. */
export const PROFIT_SHARE: Partial<Record<SalesRank, { share: number; of: string }>> = {
  director: { share: 0.02, of: "their region's net profit" },
  vp: { share: 0.01, of: "Handled's company-wide net profit" },
};

/** Everything is cumulative, so ranks never go down. */
export const RANKS_NEVER_DROP = true;

export interface RepNumbers {
  rank: SalesRank;
  /** totals since they started: profit made for Handled (own clients, and whole org), deals, clients, reps, leaders */
  profit: number; teamProfit: number; deals: number; clients: number; reps: number; leaders: number; teamDeals: number;
  refundRate: number; academyDone: SalesRank[];
}

/** What's still missing for one rank (empty = ready to promote; VP also needs owner approval). All totals, all-time. */
export function promotionGaps(n: RepNumbers, to: SalesRank): string[] {
  const r = SALES_RANKS[to].requires;
  const out: string[] = [];
  const money = (x: number) => `$${Math.ceil(x).toLocaleString("en-US")}`;
  const more = (need: number | undefined, have: number, one: string, many: string) => { if (need && have < need) out.push(`${need - have} more ${need - have === 1 ? one : many}`); };
  if (!r.from.includes(n.rank)) out.push(`Reach ${r.from.map((x) => SALES_RANKS[x].short).join(" or ")} first`);
  if (r.profit && n.profit < r.profit) out.push(`${money(r.profit - n.profit)} more profit for Handled from your clients`);
  if (r.teamProfit && n.teamProfit < r.teamProfit) out.push(`${money(r.teamProfit - n.teamProfit)} more profit for Handled from your team`);
  more(r.deals, n.deals, "deal", "deals");
  more(r.clients, n.clients, "client", "clients");
  more(r.reps, n.reps, "rep on your team with a deal", "reps on your team with a deal");
  more(r.leaders, n.leaders, "leader reporting to you", "leaders reporting to you");
  more(r.teamDeals, n.teamDeals, "team deal", "team deals");
  if (r.maxRefundRate != null && n.refundRate > r.maxRefundRate) out.push(`Refunds under ${Math.round(r.maxRefundRate * 100)}% of your deals`);
  if (r.academy && !n.academyDone.includes(to)) out.push(`Finish the ${SALES_RANKS[to].short} Sales Academy`);
  if (r.approval) out.push("Owner approval");
  return out;
}

/** One row per rank for the promotion chart: commission, team share, and the totals to reach it. */
export function promotionChart() {
  return RANK_ORDER.map((k) => {
    const r = SALES_RANKS[k];
    return { rank: k, title: r.title, path: r.path, commission: r.sellerShare, book: r.bookShare, team: r.override, bonus: r.promotionBonus,
      profit: r.requires.profit ?? 0, teamProfit: r.requires.teamProfit ?? 0, deals: r.requires.deals ?? 0, clients: r.requires.clients ?? 0,
      reps: r.requires.reps ?? 0, leaders: r.requires.leaders ?? 0, teamDeals: r.requires.teamDeals ?? 0, approval: Boolean(r.requires.approval), from: r.requires.from };
  });
}

/**
 * Starting from zero: the month a seller reaches each seller rank at a steady pace of new deals a month (each a new
 * client on a `accountMonthly` account, clients leaving at `churn` a month). All totals are cumulative.
 */
export function sellerTimeline(dealsPerMonth: number, churn = 0.03, months = 36, accountMonthly = 1500): { rank: SalesRank; month: number }[] {
  const out: { rank: SalesRank; month: number }[] = [{ rank: "associate", month: 0 }];
  const ladder: SalesRank[] = ["ae", "senior_ae", "principal_ae"];
  const perClient = accountProfit(accountMonthly);
  let clients = 0, profit = 0, i = 0;
  for (let m = 1; m <= months && i < ladder.length; m++) {
    clients = clients * (1 - churn) + dealsPerMonth;
    profit += clients * perClient;
    const deals = dealsPerMonth * m;
    while (i < ladder.length) {
      const r = SALES_RANKS[ladder[i]].requires;
      if (profit >= (r.profit ?? 0) && deals >= (r.deals ?? 0) && deals >= (r.clients ?? 0)) { out.push({ rank: ladder[i], month: m }); i++; } else break;
    }
  }
  return out;
}

/** The ranks someone can move up to next (one seller step and/or one leader step). */
export function nextRanks(rank: SalesRank): SalesRank[] {
  return RANK_ORDER.filter((r) => SALES_RANKS[r].requires.from.includes(rank));
}

export interface PayLine { who: "seller" | SalesRank; rank: SalesRank; share: number; amount: number }

/**
 * One job's sales pay. `profit` = our profit on the job (price − pro payout − refunds); `seller` = the seller's rank;
 * `leaders` = their leaders from nearest up (e.g. [team_lead, manager, director, vp]), each counted once by rank, and
 * only if they're still selling (`selling` false = no override). `newCustomer` false = the seller's book share only.
 * The total never exceeds SALES_POOL.firstYearMax of the profit; Handled keeps the rest. Cents, rounded down.
 */
export function salesPay(o: { profit: number; seller: SalesRank; leaders?: { rank: SalesRank; selling?: boolean }[]; newCustomer?: boolean }): { lines: PayLine[]; total: number; handledKeeps: number } {
  const cents = Math.max(0, Math.round(o.profit * 100));
  const lines: PayLine[] = [];
  const pay = (who: PayLine["who"], rank: SalesRank, share: number) => { if (share > 0) lines.push({ who, rank, share, amount: Math.floor(cents * share) / 100 }); };
  const isNew = o.newCustomer !== false;
  pay("seller", o.seller, isNew ? SALES_RANKS[o.seller].sellerShare : SALES_RANKS[o.seller].bookShare);
  if (isNew) {
    const seen = new Set<SalesRank>();
    // a leader who also sold the job doesn't override their own sale at their own rank
    if (LEADER_RANKS.includes(o.seller)) seen.add(o.seller);
    for (const l of o.leaders ?? []) {
      if (!LEADER_RANKS.includes(l.rank) || seen.has(l.rank) || l.selling === false) continue;
      seen.add(l.rank);
      pay(l.rank, l.rank, SALES_RANKS[l.rank].override);
    }
  }
  // never more than the pool
  const cap = Math.floor(cents * SALES_POOL.firstYearMax) / 100;
  let total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  while (total > cap && lines.length > 1) { const cut = lines.pop()!; total = Math.round((total - cut.amount) * 100) / 100; }
  return { lines, total, handledKeeps: Math.round((cents / 100 - total) * 100) / 100 };
}

/** A quick picture of a month at a rank, for the careers page (illustration, not a promise). */
export function exampleMonth(o: { rank: SalesRank; homeJobs: number; homeProfitEach: number; newAccounts: number; accountProfitMonthly: number; bookAccounts?: number; teamProfit?: number }): number {
  const r = SALES_RANKS[o.rank];
  const fast = (o.homeJobs + o.newAccounts) * FAST_MONEY.walkthroughHeld * 0.5; // about half of sales start with a walkthrough
  const sales = o.homeJobs * o.homeProfitEach * r.sellerShare + o.newAccounts * o.accountProfitMonthly * r.sellerShare;
  const book = (o.bookAccounts ?? 0) * o.accountProfitMonthly * r.sellerShare; // accounts sold in earlier months still paying
  const team = (o.teamProfit ?? 0) * r.override;
  return Math.round(fast + sales + book + team);
}

// ─── The path to $100K: commercial business services ────────────────────────


/** What one commercial account is worth to Handled a month at business prices (our profit after the pro's pay). */
export const accountProfit = (monthlyBill: number) => (monthlyBill > 0 ? splitJob(monthlyBill, undefined, { business: true }).take : 0);

export interface EarningsPlan {
  rank: SalesRank;
  /** new commercial accounts the person closes a month */
  accountsPerMonth: number;
  /** what one account bills a month (business price), e.g. weekly office cleaning */
  accountMonthly: number;
  /** reps in their org (leaders) and the accounts each closes a month */
  teamReps?: number;
  teamAccountsPerRep?: number;
  /** share of accounts lost each month (default 3%) */
  monthlyChurn?: number;
  /** walkthroughs it takes to close one account (default 3) */
  walkthroughsPerAccount?: number;
}

/**
 * Month-by-month earnings over 24 months: each account pays the seller share for its first 12 months, then the book
 * share; leaders earn their override on the team's accounts in their first 12 months; $25 per walkthrough held;
 * accounts churn. year2 is the run rate once the book is built. An illustration, not a promise.
 */
export function earningsPlan(p: EarningsPlan): { year1: number; year2: number; profitPerAccount: number; walkthroughsPerMonth: number } {
  const r = SALES_RANKS[p.rank];
  const profit = accountProfit(p.accountMonthly);
  const churn = p.monthlyChurn ?? 0.03;
  const wpa = p.walkthroughsPerAccount ?? 3;
  const team = (p.teamReps ?? 0) * (p.teamAccountsPerRep ?? 0);
  const months: number[] = [];
  for (let t = 0; t < 24; t++) {
    let m = Math.min(p.accountsPerMonth * wpa, FAST_MONEY.weeklyWalkthroughCap * 4.33) * FAST_MONEY.walkthroughHeld;
    for (let s = 0; s <= t; s++) {
      const alive = Math.pow(1 - churn, t - s);
      const share = t - s < SALES_POOL.newMonths ? r.sellerShare : r.bookShare;
      m += p.accountsPerMonth * alive * profit * share;
      if (t - s < SALES_POOL.newMonths) m += team * alive * profit * r.override;
    }
    months.push(m);
  }
  const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0));
  return { year1: sum(months.slice(0, 12)), year2: sum(months.slice(12)), profitPerAccount: Math.round(profit), walkthroughsPerMonth: Math.round(p.accountsPerMonth * wpa) };
}

/** Three ways to $100K a year from commercial business services (year 2, once the book is built). */
export const PATHS_TO_100K: { id: string; title: string; who: string; plan: EarningsPlan; week: string[] }[] = [
  {
    id: "seller", title: "Top seller", who: "Senior Account Executive",
    plan: { rank: "senior_ae", accountsPerMonth: 4, accountMonthly: 1500 },
    week: ["Book 3 walkthroughs (warm leads from our AI outreach, your calls and visits)", "Close about 1 commercial account a week (offices, property managers, clinics)", "Check in with your accounts so they stay and grow"],
  },
  {
    id: "principal", title: "Big accounts", who: "Principal Account Executive",
    plan: { rank: "principal_ae", accountsPerMonth: 3, accountMonthly: 1500 },
    week: ["2 walkthroughs on larger, multi-site accounts", "Close 3 accounts a month", "Grow each account: add services and locations"],
  },
  {
    id: "leader", title: "Team builder", who: "Team Lead",
    plan: { rank: "team_lead", accountsPerMonth: 1, accountMonthly: 1500, teamReps: 6, teamAccountsPerRep: 2 },
    week: ["Your team of 6 reps each closes 2 accounts a month", "Mentor the reps who ask for help on their walkthroughs", "Still close about 1 account a month yourself"],
  },
];

// ─── The leaderboard: last 90 days of revenue ───────────────────────────────

/**
 * Promotions are cumulative and never go down; the LEADERBOARD shows who is selling the most right now: the revenue
 * (what their clients paid, new and repeat) in the last 90 days. It decides recognition and perks, never rank or pay rates.
 */
export const LEADERBOARD = {
  windowDays: 90,
  metric: "revenue",
  rewards: [
    { top: 1, reward: "#1 of the quarter: President's Club trip and first pick of warm leads next quarter" },
    { top: 3, reward: "Top 3: first pick of warm leads from the AI outreach engine next quarter" },
    { top: 10, reward: "Top 10: named on the leaderboard and in the monthly sales email" },
  ],
} as const;

export interface LeaderboardRow { id: string; name: string; rank: SalesRank; revenue90: number }

/** Highest 90-day revenue first; ties share a place. Each row gets its place and the best reward it has earned. */
export function leaderboard(rows: LeaderboardRow[]): (LeaderboardRow & { place: number; reward: string | null })[] {
  const sorted = [...rows].filter((r) => r.revenue90 > 0).sort((a, b) => b.revenue90 - a.revenue90 || a.name.localeCompare(b.name));
  let place = 0, last = Number.NaN;
  return sorted.map((r, i) => {
    if (r.revenue90 !== last) { place = i + 1; last = r.revenue90; }
    const reward = LEADERBOARD.rewards.find((x) => place <= x.top)?.reward ?? null;
    return { ...r, place, reward };
  });
}

// ─── Live pay (web lib/sales-force.ts) ───────────────────────────────────────

/** The seller's commission rate: their rank's share, never below the Field Sales ladder rate they already earned. */
export function sellerRate(rank: SalesRank, ladderRate = 0): number {
  return Math.max(SALES_RANKS[rank].sellerShare, Math.min(ladderRate, 0.45));
}

export interface TeamLeader { id: string; rank: SalesRank; selling: boolean }

/**
 * One job's team pay on top of the seller's own commission: each leader above the seller (nearest first) earns their
 * rank's team share of our profit, once per rank, only while they're still selling. Everything together (seller +
 * leaders) stays within SALES_POOL.firstYearMax of the profit; the farthest leaders are dropped first. Cents, down.
 */
export function teamOverrides(o: { take: number; sellerRate: number; sellerRank: SalesRank; leaders: TeamLeader[] }): { id: string; rank: SalesRank; share: number; amount: number }[] {
  const cents = Math.max(0, Math.round(o.take * 100));
  const out: { id: string; rank: SalesRank; share: number; amount: number }[] = [];
  const seen = new Set<SalesRank>(LEADER_RANKS.includes(o.sellerRank) ? [o.sellerRank] : []);
  let used = o.sellerRate;
  for (const l of o.leaders) {
    if (!LEADER_RANKS.includes(l.rank) || seen.has(l.rank) || !l.selling) continue;
    seen.add(l.rank);
    const share = SALES_RANKS[l.rank].override;
    if (used + share > SALES_POOL.firstYearMax + 1e-9) break;
    used += share;
    const amount = Math.floor(cents * share) / 100;
    if (amount > 0) out.push({ id: l.id, rank: l.rank, share, amount });
  }
  return out;
}

/**
 * Promotions from cumulative totals: the highest rank reachable from `n.rank` without an owner's approval, one step at
 * a time (the leader path is taken when its numbers are met). Never lower than today. Also says whether the next
 * step is waiting on an owner (VP).
 */
export function autoPromote(n: RepNumbers): { rank: SalesRank; steps: SalesRank[]; awaitingApproval: SalesRank | null } {
  let cur = n.rank;
  const steps: SalesRank[] = [];
  let awaiting: SalesRank | null = null;
  for (let guard = 0; guard < RANK_ORDER.length; guard++) {
    const options = nextRanks(cur).sort((a, b) => (SALES_RANKS[b].path === "leader" ? 1 : 0) - (SALES_RANKS[a].path === "leader" ? 1 : 0));
    const ready = options.find((r) => promotionGaps({ ...n, rank: cur }, r).every((g) => g === "Owner approval"));
    if (!ready) break;
    if (SALES_RANKS[ready].requires.approval) { awaiting = ready; break; }
    cur = ready; steps.push(ready);
  }
  return { rank: cur, steps, awaitingApproval: awaiting };
}
