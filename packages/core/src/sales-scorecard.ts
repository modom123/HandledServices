/*
 * FILE    : packages/core/src/sales-scorecard.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0215 UTC
 * PURPOSE : The sales scorecard: Handled's own AI sales & marketing team against the outside sales force, on the same
 *           numbers. Every paid job belongs to exactly one team (teamOf):
 *             ai_outbound — AI sales team: business customers from the AI sales emails (handledsvc.net outreach, AI reply
 *                           drafts, the deal hunter) — the job carries the sales-email lead (attribution.biz_lead)
 *             ai_inbound  — AI marketing & inbound: website, search, ads, social and email campaigns, answered by the AI
 *                           concierge and speed-to-lead responder (anything not credited to a partner or a sales email)
 *             sales_force — outside Sales Force reps: direct sales on a sales ticket (jobs.partner_sale)
 *             referrals   — referral partners (credited to a partner, not a direct sale; a partner's own first project
 *                           counts as inbound)
 *           scorecard() turns jobs + sales costs into, per team: new clients, jobs, revenue, Handled's profit, sales
 *           cost (AI usage for the AI teams; commissions and Sales Force pay for partners), profit after sales cost,
 *           cost per new client, average job, return on sales cost. AI_COST_KINDS says which AI agents count as whose cost.
 */

export type SalesTeam = "ai_outbound" | "ai_inbound" | "sales_force" | "referrals";

export const SALES_TEAMS: Record<SalesTeam, { label: string; short: string; group: "ai" | "outside"; who: string }> = {
  ai_outbound: { label: "AI sales team (outbound)", short: "AI sales", group: "ai", who: "AI-written sales emails from handledsvc.net, AI reply drafts and the deal hunter" },
  ai_inbound: { label: "AI marketing & inbound", short: "AI marketing", group: "ai", who: "Website, search, ads, social and email campaigns, answered by the AI concierge and speed-to-lead" },
  sales_force: { label: "Sales Force (outside reps)", short: "Sales Force", group: "outside", who: "Independent reps closing direct sales on a sales ticket" },
  referrals: { label: "Referral partners", short: "Referrals", group: "outside", who: "Partners who send us customers; we close the sale" },
};
export const TEAM_ORDER: SalesTeam[] = ["ai_outbound", "ai_inbound", "sales_force", "referrals"];

/** Which AI agents' usage (ai_runs.kind) is a sales or marketing cost, and for which AI team. */
export const AI_COST_KINDS: Record<string, SalesTeam> = {
  outreach_writer: "ai_outbound", sales_reply: "ai_outbound", deal_hunter: "ai_outbound",
  campaign_writer: "ai_inbound", social_writer: "ai_inbound", speed_to_lead: "ai_inbound", concierge: "ai_inbound",
};

/** Claude list price per million tokens (input / output) — the same figure the Hub's economics page uses. */
export const AI_TOKEN_PRICE = { input: 4, output: 20 } as const;
export const aiRunCost = (r: { input_tokens?: number | null; output_tokens?: number | null }) =>
  ((r.input_tokens ?? 0) * AI_TOKEN_PRICE.input + (r.output_tokens ?? 0) * AI_TOKEN_PRICE.output) / 1e6;

export interface ScoreJob {
  contact_email: string; price: number; payout: number; refunded: number; completed: boolean;
  partner_id?: string | null; partner_sale?: boolean | null; partner_self?: boolean | null; biz_lead?: string | null;
  /** first paid job this customer ever had (a new client) */
  first: boolean;
}

/** Which team a paid job belongs to. A partner's direct sale wins, then a partner referral, then a sales email. */
export function teamOf(j: Pick<ScoreJob, "partner_id" | "partner_sale" | "partner_self" | "biz_lead">): SalesTeam {
  if (j.partner_id && j.partner_sale) return "sales_force";
  if (j.partner_id && !j.partner_self) return "referrals";
  if (j.biz_lead) return "ai_outbound";
  return "ai_inbound";
}

export interface TeamScore {
  team: SalesTeam; newClients: number; jobs: number; revenue: number; profit: number; cost: number;
  profitAfterCost: number; costPerClient: number | null; avgJob: number | null; roi: number | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Per-team results. `costs` = sales cost per team in the same window (AI usage, commissions, Sales Force pay). */
export function scorecard(jobs: ScoreJob[], costs: Partial<Record<SalesTeam, number>>): TeamScore[] {
  const acc = new Map<SalesTeam, { newClients: number; jobs: number; revenue: number; profit: number }>();
  for (const t of TEAM_ORDER) acc.set(t, { newClients: 0, jobs: 0, revenue: 0, profit: 0 });
  for (const j of jobs) {
    const a = acc.get(teamOf(j))!;
    const revenue = Math.max(0, j.price - j.refunded);
    a.jobs++;
    if (j.first) a.newClients++;
    a.revenue += revenue;
    if (j.completed) a.profit += Math.max(0, revenue - j.payout);
  }
  return TEAM_ORDER.map((team) => {
    const a = acc.get(team)!;
    const cost = r2(costs[team] ?? 0);
    const profitAfterCost = r2(a.profit - cost);
    return {
      team, newClients: a.newClients, jobs: a.jobs, revenue: r2(a.revenue), profit: r2(a.profit), cost, profitAfterCost,
      costPerClient: a.newClients ? r2(cost / a.newClients) : null,
      avgJob: a.jobs ? r2(a.revenue / a.jobs) : null,
      roi: cost > 0 ? r2(profitAfterCost / cost) : null,
    };
  });
}

/** AI team vs outside sales force, added up. */
export function groupTotals(rows: TeamScore[]) {
  const sum = (g: "ai" | "outside") => {
    const xs = rows.filter((r) => SALES_TEAMS[r.team].group === g);
    const t = xs.reduce((o, r) => ({ newClients: o.newClients + r.newClients, jobs: o.jobs + r.jobs, revenue: o.revenue + r.revenue, profit: o.profit + r.profit, cost: o.cost + r.cost }), { newClients: 0, jobs: 0, revenue: 0, profit: 0, cost: 0 });
    const profitAfterCost = r2(t.profit - t.cost);
    return { ...t, revenue: r2(t.revenue), profit: r2(t.profit), cost: r2(t.cost), profitAfterCost, costPerClient: t.newClients ? r2(t.cost / t.newClients) : null, roi: t.cost > 0 ? r2(profitAfterCost / t.cost) : null };
  };
  return { ai: sum("ai"), outside: sum("outside") };
}
