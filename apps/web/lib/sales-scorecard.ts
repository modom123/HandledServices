/*
 * FILE    : apps/web/lib/sales-scorecard.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0215 UTC
 * PURPOSE : Hub → Sales scorecard data (rules in core sales-scorecard.ts): Handled's AI sales & marketing team against the
 *           outside sales force over a window of days.
 *             jobs     — paid in the window; each to one team (a rep's direct sale, a referral, a sales email, or inbound);
 *                        "new client" = the customer's first paid job ever
 *             costs    — AI usage of the sales / marketing agents (ai_runs × token price) for the AI teams; partner
 *                        commissions on those jobs and Sales Force pay (team shares, walkthroughs, bonuses) for partners
 *             pipeline — AI sales emails sent and replies; walkthroughs booked and held by the AI team vs reps
 */
import "server-only";
import { AI_COST_KINDS, aiRunCost, groupTotals, scorecard, teamOf, type SalesTeam, type ScoreJob } from "@handled/core";
import { adminClient } from "./supabase/server";

const db = () => adminClient();
type J = { id: string; contact_email: string; price_final: number | null; contractor_payout: number | null; amount_refunded: number | null; status: string; paid_at: string; partner_id: string | null; partner_sale?: boolean | null; attribution: Record<string, string> | null };

export async function salesScorecard(days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: jobs } = await db().from("jobs").select("id, contact_email, price_final, contractor_payout, amount_refunded, status, paid_at, partner_id, partner_sale, attribution")
    .gte("paid_at", since).is("remedy", null).neq("status", "cancelled").order("paid_at").limit(20000);
  const rows = (jobs ?? []) as J[];
  const ids = rows.map((j) => j.id);
  const emails = [...new Set(rows.map((j) => j.contact_email.toLowerCase()))];

  // customers who paid before the window aren't new clients
  const before = new Set<string>();
  for (let i = 0; i < emails.length; i += 300) {
    const { data } = await db().from("jobs").select("contact_email").in("contact_email", emails.slice(i, i + 300)).lt("paid_at", since).not("paid_at", "is", null).limit(20000);
    for (const r of (data ?? []) as { contact_email: string }[]) before.add(r.contact_email.toLowerCase());
  }
  // commissions on these jobs (cost, and whether it was a partner's own first project)
  const comm = new Map<string, { tier: string | null; amount: number }>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db().from("partner_commissions").select("job_id, tier, amount, status").in("job_id", ids.slice(i, i + 300)).neq("status", "void").limit(20000);
    for (const c of (data ?? []) as { job_id: string; tier: string | null; amount: number }[]) comm.set(c.job_id, { tier: c.tier, amount: Number(c.amount) });
  }

  const seen = new Set<string>();
  const scoreJobs: ScoreJob[] = [];
  const costs: Partial<Record<SalesTeam, number>> = {};
  const add = (t: SalesTeam, n: number) => { costs[t] = (costs[t] ?? 0) + n; };
  for (const j of rows) {
    const email = j.contact_email.toLowerCase();
    const first = !before.has(email) && !seen.has(email);
    seen.add(email);
    const c = comm.get(j.id);
    const sj: ScoreJob = {
      contact_email: email, price: Number(j.price_final ?? 0), payout: Number(j.contractor_payout ?? 0), refunded: Number(j.amount_refunded ?? 0),
      completed: j.status === "completed", partner_id: j.partner_id, partner_sale: Boolean(j.partner_sale), partner_self: c?.tier === "self",
      biz_lead: j.attribution?.biz_lead ?? null, first,
    };
    scoreJobs.push(sj);
    if (c) add(teamOf(sj), c.amount); // a partner's own-project reward lands on inbound: a marketing cost
  }

  // Sales Force pay created in the window (team shares, walkthroughs held, bonuses)
  const { data: pay, error: payErr } = await db().from("sales_pay").select("amount").neq("status", "void").gte("created_at", since).limit(20000);
  if (!payErr) add("sales_force", (pay ?? []).reduce((t, p: { amount: number }) => t + Number(p.amount), 0));

  // AI usage of the sales and marketing agents
  const kinds = Object.keys(AI_COST_KINDS);
  const { data: runs } = await db().from("ai_runs").select("kind, input_tokens, output_tokens").in("kind", kinds).gte("created_at", since).limit(100000);
  const aiCalls: Record<string, number> = {};
  for (const r of (runs ?? []) as { kind: string; input_tokens: number | null; output_tokens: number | null }[]) {
    add(AI_COST_KINDS[r.kind], aiRunCost(r));
    aiCalls[r.kind] = (aiCalls[r.kind] ?? 0) + 1;
  }

  // pipeline
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [emailsSent, replies, wAiBooked, wAiHeld, wRepBooked, wRepHeld] = await Promise.all([
    count(db().from("biz_lead_events").select("id", { count: "exact", head: true }).in("kind", ["outreach:sent", "handed_to_instantly"]).gte("created_at", since)),
    count(db().from("biz_lead_events").select("id", { count: "exact", head: true }).in("kind", ["outreach:reply_received", "instantly:reply_received"]).gte("created_at", since)),
    count(db().from("walkthroughs").select("id", { count: "exact", head: true }).not("biz_lead_id", "is", null).is("partner_id", null).gte("created_at", since)).catch(() => 0),
    count(db().from("walkthroughs").select("id", { count: "exact", head: true }).not("biz_lead_id", "is", null).is("partner_id", null).eq("status", "done").gte("created_at", since)).catch(() => 0),
    count(db().from("walkthroughs").select("id", { count: "exact", head: true }).not("partner_id", "is", null).gte("created_at", since)).catch(() => 0),
    count(db().from("walkthroughs").select("id", { count: "exact", head: true }).not("partner_id", "is", null).eq("status", "done").gte("created_at", since)).catch(() => 0),
  ]);
  const { count: reps, error: repErr } = await db().from("referral_partners").select("id", { count: "exact", head: true }).not("sales_rank", "is", null).eq("status", "active");

  const teams = scorecard(scoreJobs, costs);
  return {
    days, teams, totals: groupTotals(teams), aiCalls,
    pipeline: { emailsSent, replies, ai: { booked: wAiBooked, held: wAiHeld }, reps: { booked: wRepBooked, held: wRepHeld } },
    activeReps: repErr ? null : reps ?? 0,
  };
}
