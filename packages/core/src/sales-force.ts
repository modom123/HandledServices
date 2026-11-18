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
 *             BASE_PAY        — Directors and the VP move to a salary (W-2) once their region's profit supports it
 *             PROFIT_SHARE    — Directors share in their region's profit, the VP in the company's
 *             new markets     — each new city opens a Director and Manager seat; current leaders get first claim
 *           Promotions are measured from real numbers (rolling 90 days): profit generated, active accounts, people
 *           developed, team profit, refund rate. Ranks are protected: a rank is lost only after two quarters in a row
 *           under half its keep-up level.
 *           salesPay() splits one job's profit across the seller and their leaders, never more than the pool.
 *           All numbers are a plan to review with an attorney (1099 vs W-2, overrides, clawbacks) before launch.
 */

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
  /** what it takes to get here (rolling 90 days unless noted) */
  requires: RankRequirement;
  /** what this rank is about, in one line */
  role: string;
  perks: string[];
}

export interface RankRequirement {
  from: SalesRank[];
  /** profit generated for Handled on their own sales */
  personalProfit?: number;
  /** active recurring customers / accounts they sold */
  activeAccounts?: number;
  /** people on their team with a paid sale in the window */
  activeReps?: number;
  /** leaders reporting to them (Team Leads for a Manager, Managers for a Director) */
  leaders?: number;
  /** profit on their whole org's sales, including their own */
  teamProfit?: number;
  /** most refunds allowed, as a share of their sales */
  maxRefundRate?: number;
  /** finished the Sales Academy for this rank */
  academy?: boolean;
  /** owners approve (VP) */
  approval?: boolean;
  /** first 90 days only (Associate → AE) */
  paidSales?: number;
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
    role: "Learn the product, book walkthroughs and close your first customers with a coach.",
    perks: ["Sales Academy and a coach from day one", "$25 for every walkthrough held, $100 for your first sale", "Paid every Monday"],
  },
  ae: {
    title: "Account Executive", short: "AE", path: "seller", level: 2,
    sellerShare: 0.20, bookShare: 0.05, override: 0, promotionBonus: 250,
    requires: { from: ["associate"], paidSales: 5, personalProfit: 2_500, academy: true },
    role: "Own your territory's homes and small businesses; build a book of repeat customers.",
    perks: ["Your own book: 5% of the profit on your customers after year one", "Business cards and an @handledsvc.net email"],
  },
  senior_ae: {
    title: "Senior Account Executive", short: "Senior AE", path: "seller", level: 3,
    sellerShare: 0.25, bookShare: 0.08, override: 0, promotionBonus: 500,
    requires: { from: ["ae"], personalProfit: 15_000, activeAccounts: 3, maxRefundRate: 0.05, academy: true },
    role: "Commercial accounts: offices, property managers, facilities. Mentor new Associates.",
    perks: ["First pick of warm leads from the AI outreach engine", "Protected accounts: nobody else sells to your customers"],
  },
  principal_ae: {
    title: "Principal Account Executive", short: "Principal AE", path: "seller", level: 4,
    sellerShare: 0.35, bookShare: 0.10, override: 0, promotionBonus: 1_500,
    requires: { from: ["senior_ae"], personalProfit: 45_000, activeAccounts: 10, maxRefundRate: 0.05 },
    role: "Our biggest accounts and multi-site contracts. Top of the seller path.",
    perks: ["Exclusive named accounts", "President's Club eligibility", "Seat on the sales council"],
  },
  team_lead: {
    title: "Team Lead", short: "Team Lead", path: "leader", level: 4,
    sellerShare: 0.30, bookShare: 0.08, override: 0.08, promotionBonus: 1_000,
    requires: { from: ["senior_ae", "principal_ae"], activeReps: 3, teamProfit: 25_000, maxRefundRate: 0.05, academy: true },
    role: "Recruit, train and ride along with up to 8 reps; you earn when they earn.",
    perks: ["8% of the profit on your team's sales", "Leadership track in the Sales Academy"],
  },
  manager: {
    title: "Sales Manager", short: "Manager", path: "leader", level: 5,
    sellerShare: 0.35, bookShare: 0.08, override: 0.05, promotionBonus: 2_500,
    requires: { from: ["team_lead"], leaders: 2, activeReps: 10, teamProfit: 75_000, maxRefundRate: 0.05 },
    role: "Run a city's sales team through your Team Leads; own the forecast.",
    perks: ["5% of the profit on everyone under you", "Quarterly team bonus pool"],
  },
  director: {
    title: "Director of Sales", short: "Director", path: "leader", level: 6,
    sellerShare: 0.40, bookShare: 0.10, override: 0.04, promotionBonus: 5_000,
    requires: { from: ["manager"], leaders: 3, teamProfit: 250_000, maxRefundRate: 0.04 },
    role: "Own a region: open new cities, hire Managers, set targets with the owners.",
    perks: ["Salary once your region supports it", "Share of your region's profit", "First claim to run new markets"],
  },
  vp: {
    title: "VP of Sales", short: "VP", path: "leader", level: 7,
    sellerShare: 0.45, bookShare: 0.10, override: 0.03, promotionBonus: 10_000,
    requires: { from: ["director"], leaders: 2, teamProfit: 1_000_000, approval: true },
    role: "Lead the whole sales force with the owners; build the next layer of Directors.",
    perks: ["Executive salary", "Share of company profit", "Seat at the leadership table"],
  },
};

export const RANK_ORDER: SalesRank[] = ["associate", "ae", "senior_ae", "principal_ae", "team_lead", "manager", "director", "vp"];
export const LEADER_RANKS: SalesRank[] = ["team_lead", "manager", "director", "vp"];

/** Directors and the VP move to a salary (W-2) when the profit they lead can carry it. */
export const BASE_PAY: Partial<Record<SalesRank, { salary: number; whenQuarterlyTeamProfit: number }>> = {
  director: { salary: 75_000, whenQuarterlyTeamProfit: 250_000 },
  vp: { salary: 120_000, whenQuarterlyTeamProfit: 1_000_000 },
};

/** Growing with the company: a share of the profit they help build, paid quarterly, on top of everything else. */
export const PROFIT_SHARE: Partial<Record<SalesRank, { share: number; of: string }>> = {
  director: { share: 0.02, of: "their region's net profit" },
  vp: { share: 0.01, of: "Handled's company-wide net profit" },
};

/** Ranks are protected: lost only after this many quarters in a row under KEEP_UP of the rank's numbers. */
export const RANK_PROTECTION = { quarters: 2, keepUp: 0.5 } as const;

export interface RepNumbers {
  rank: SalesRank;
  personalProfit: number; activeAccounts: number; activeReps: number; leaders: number; teamProfit: number;
  refundRate: number; paidSales: number; academyDone: SalesRank[];
}

/** What's still missing for one rank (empty = ready to promote; VP also needs owner approval). */
export function promotionGaps(n: RepNumbers, to: SalesRank): string[] {
  const r = SALES_RANKS[to].requires;
  const out: string[] = [];
  const money = (x: number) => `$${Math.round(x).toLocaleString("en-US")}`;
  if (!r.from.includes(n.rank)) out.push(`Reach ${r.from.map((x) => SALES_RANKS[x].short).join(" or ")} first`);
  if (r.paidSales && n.paidSales < r.paidSales) out.push(`${r.paidSales - n.paidSales} more paid sale${r.paidSales - n.paidSales === 1 ? "" : "s"}`);
  if (r.personalProfit && n.personalProfit < r.personalProfit) out.push(`${money(r.personalProfit - n.personalProfit)} more profit from your own sales (90 days)`);
  if (r.activeAccounts && n.activeAccounts < r.activeAccounts) out.push(`${r.activeAccounts - n.activeAccounts} more active recurring account${r.activeAccounts - n.activeAccounts === 1 ? "" : "s"}`);
  if (r.activeReps && n.activeReps < r.activeReps) out.push(`${r.activeReps - n.activeReps} more rep${r.activeReps - n.activeReps === 1 ? "" : "s"} on your team with a paid sale`);
  if (r.leaders && n.leaders < r.leaders) out.push(`${r.leaders - n.leaders} more leader${r.leaders - n.leaders === 1 ? "" : "s"} reporting to you`);
  if (r.teamProfit && n.teamProfit < r.teamProfit) out.push(`${money(r.teamProfit - n.teamProfit)} more team profit (90 days)`);
  if (r.maxRefundRate != null && n.refundRate > r.maxRefundRate) out.push(`Refunds under ${Math.round(r.maxRefundRate * 100)}% of your sales`);
  if (r.academy && !n.academyDone.includes(to)) out.push(`Finish the ${SALES_RANKS[to].short} Sales Academy`);
  if (r.approval) out.push("Owner approval");
  return out;
}

/** The ranks someone can move up to next (one seller step and/or one leader step). */
export function nextRanks(rank: SalesRank): SalesRank[] {
  return RANK_ORDER.filter((r) => SALES_RANKS[r].requires.from.includes(rank));
}

/** Rank protection: lose a rank only after RANK_PROTECTION.quarters quarters in a row under half its numbers. */
export function keepsRank(quartersBelowHalf: number): boolean {
  return quartersBelowHalf < RANK_PROTECTION.quarters;
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
