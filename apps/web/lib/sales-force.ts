/*
 * FILE    : apps/web/lib/sales-force.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-18_0105 UTC
 * PURPOSE : The Handled Sales Force, live (rules in core sales-force.ts). Independent contractors (1099).
 *             salesRankOf / isSalesForce — a partner's rank (null = not in the Sales Force)
 *             repTotals        — cumulative totals since they started: profit made for Handled, deals, clients won,
 *                                refund rate, last-90-day profit (still selling?) and revenue (leaderboard); team totals
 *                                from everyone on their team (sales_leader_id, all levels down)
 *             refreshRanks     — daily: automatic promotions from those totals (ranks never drop), promotion bonus,
 *                                an email to the rep, a Hub alert; VP waits for an owner
 *             accrueTeamPay    — at completion of a rep's direct sale: each leader's team share (only while they still
 *                                sell, within the 60% pool) and the rep's $100 first-sale bonus, paid after the hold
 *             walkthroughHeld  — staff marked a walkthrough done: $25 to the rep whose link it came from (weekly cap)
 *             dueSalesPay / claimSalesPay / releaseSalesPay / stampSalesPay — the Monday payout run pays these lines
 *                                with the commissions; job lines follow refunds down first
 *             leaderboardNow   — last-90-days revenue ranking (recognition and perks, never rank)
 *             setRank / setLeader / joinSalesForce — Hub
 */
import "server-only";
import {
  BRAND, FAST_MONEY, LEADER_RANKS, PARTNER_PROGRAM, RANK_ORDER, SALES_POOL, SALES_RANKS, autoPromote, leaderboard, money, nextRanks, partnerTake, promotionGaps,
  teamOverrides, type Job, type RepNumbers, type SalesRank,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";

const db = () => adminClient();
const DAY = 86400000;

export type SalesMember = { id: string; name: string; email: string; code: string; status: string; sales_rank: SalesRank; sales_leader_id: string | null; sales_rank_at: string | null; created_at: string };

let ready: boolean | null = null;
/** The Sales Force SQL has been run (supabase/setup/ADD_SALES_FORCE_2026-11-18_0105.sql). */
export async function salesForceReady(): Promise<boolean> {
  if (ready) return true;
  const { error } = await db().from("sales_pay").select("id").limit(1);
  ready = !error;
  return ready;
}

export async function salesRankOf(partnerId: string): Promise<SalesRank | null> {
  if (!(await salesForceReady())) return null;
  const { data } = await db().from("referral_partners").select("sales_rank").eq("id", partnerId).maybeSingle();
  return (data?.sales_rank as SalesRank | null) ?? null;
}
export const isSalesForce = async (partnerId: string) => Boolean(await salesRankOf(partnerId));

async function members(): Promise<SalesMember[]> {
  const { data } = await db().from("referral_partners").select("id, name, email, code, status, sales_rank, sales_leader_id, sales_rank_at, created_at").not("sales_rank", "is", null).limit(10000);
  return (data ?? []) as SalesMember[];
}

type Comm = { partner_id: string; take: number; status: string; created_at: string; tier: string; jobs: { contact_email: string; service_slug: string; price_final: number; amount_refunded: number } | null };

export interface RepTotals extends RepNumbers { revenue90: number; profit90: number; selling: boolean; team: string[] }

/** Cumulative totals for every Sales Force member (one pass over their direct-sale commissions). */
export async function repTotals(): Promise<{ all: SalesMember[]; totals: Map<string, RepTotals> }> {
  const all = await members();
  const ids = all.map((m) => m.id);
  const own = new Map<string, { profit: number; deals: Set<string>; clients: Set<string>; voided: number; count: number; revenue90: number; profit90: number }>();
  for (const id of ids) own.set(id, { profit: 0, deals: new Set(), clients: new Set(), voided: 0, count: 0, revenue90: 0, profit90: 0 });
  const since90 = Date.now() - 90 * DAY;
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db().from("partner_commissions").select("partner_id, take, status, created_at, tier, jobs(contact_email, service_slug, price_final, amount_refunded)").in("partner_id", ids.slice(i, i + 200)).in("tier", ["direct", "sale", "book"]).limit(100000);
    for (const c of (data ?? []) as unknown as Comm[]) {
      const o = own.get(c.partner_id)!;
      o.count++;
      if (c.status === "void") { o.voided++; continue; }
      o.profit += Number(c.take);
      const email = c.jobs?.contact_email?.toLowerCase() ?? "";
      if (email) { o.clients.add(email); o.deals.add(`${email}|${c.jobs?.service_slug ?? ""}`); }
      if (new Date(c.created_at).getTime() >= since90) {
        o.profit90 += Number(c.take);
        o.revenue90 += Math.max(0, Number(c.jobs?.price_final ?? 0) - Number(c.jobs?.amount_refunded ?? 0));
      }
    }
  }
  const kids = new Map<string, string[]>();
  for (const m of all) if (m.sales_leader_id) kids.set(m.sales_leader_id, [...(kids.get(m.sales_leader_id) ?? []), m.id]);
  const rankOf = new Map(all.map((m) => [m.id, m.sales_rank]));
  const below = (id: string): string[] => { const out: string[] = []; const seen = new Set([id]); const q = [...(kids.get(id) ?? [])]; while (q.length) { const x = q.shift()!; if (seen.has(x)) continue; seen.add(x); out.push(x); q.push(...(kids.get(x) ?? [])); } return out; };
  const totals = new Map<string, RepTotals>();
  for (const m of all) {
    const o = own.get(m.id)!;
    const team = below(m.id);
    const level = (r: SalesRank) => RANK_ORDER.indexOf(r);
    totals.set(m.id, {
      rank: m.sales_rank,
      profit: Math.round(o.profit * 100) / 100, deals: o.deals.size, clients: o.clients.size,
      refundRate: o.count ? o.voided / o.count : 0, academyDone: [],
      reps: team.filter((x) => (own.get(x)?.deals.size ?? 0) > 0).length,
      // leaders reporting to them: direct team members at their own leader rank or higher (Team Leads for a Team Lead → Manager, …)
      leaders: LEADER_RANKS.includes(m.sales_rank) ? (kids.get(m.id) ?? []).filter((x) => level(rankOf.get(x)!) >= level(m.sales_rank)).length : 0,
      teamProfit: Math.round([m.id, ...team].reduce((t, x) => t + (own.get(x)?.profit ?? 0), 0) * 100) / 100,
      teamDeals: [m.id, ...team].reduce((t, x) => t + (own.get(x)?.deals.size ?? 0), 0),
      revenue90: Math.round(o.revenue90 * 100) / 100, profit90: Math.round(o.profit90 * 100) / 100,
      selling: o.profit90 >= SALES_POOL.leaderMinPersonalProfit, team,
    });
  }
  return { all, totals };
}

/** Daily: promotions from cumulative totals (never down), promotion bonuses, emails and alerts. */
export async function refreshRanks(): Promise<{ promoted: number; awaiting: number }> {
  if (!(await salesForceReady())) return { promoted: 0, awaiting: 0 };
  const { all, totals } = await repTotals();
  let promoted = 0, awaiting = 0;
  for (const m of all) {
    if (m.status !== "active") continue;
    const n = totals.get(m.id)!;
    const r = autoPromote(n);
    if (r.awaitingApproval) {
      awaiting++;
      const title = `Sales Force: ${m.name} qualifies for ${SALES_RANKS[r.awaitingApproval].title}`;
      const { count } = await db().from("ops_alerts").select("id", { count: "exact", head: true }).eq("title", title);
      if (!count) await raiseAlert("partners", "warn", title, `Their team has made Handled ${money(n.teamProfit)}. Approve it in Hub → Sales Force.`);
    }
    if (!r.steps.length) continue;
    await setRank(m.id, r.rank, "automatic", `from ${SALES_RANKS[m.sales_rank].short}: ${money(n.profit)} profit, ${n.deals} deals, ${n.clients} clients, team ${money(n.teamProfit)}`, r.steps);
    promoted++;
  }
  return { promoted, awaiting };
}

/** Move a rep to a rank (automatic or an admin). Each rank reached for the first time pays its promotion bonus once. */
export async function setRank(partnerId: string, rank: SalesRank, by: string, note: string | null, steps: SalesRank[] = [rank]) {
  const { data: p } = await db().from("referral_partners").select("name, email, sales_rank").eq("id", partnerId).maybeSingle();
  if (!p) return { ok: false, error: "Partner not found" };
  await db().from("referral_partners").update({ sales_rank: rank, sales_rank_at: new Date().toISOString() }).eq("id", partnerId);
  await db().from("sales_rank_history").insert({ partner_id: partnerId, from_rank: p.sales_rank ?? null, to_rank: rank, by_whom: by, note });
  const up = RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf((p.sales_rank as SalesRank) ?? "associate");
  if (up) {
    for (const s of steps) {
      const bonus = SALES_RANKS[s].promotionBonus;
      if (bonus > 0) await db().from("sales_pay").insert({ partner_id: partnerId, kind: "promotion", rank: s, amount: bonus, note: `Promotion to ${SALES_RANKS[s].title}` }).then(() => null, () => null); // unique per rank: never twice
    }
    const r = SALES_RANKS[rank];
    await sendEmail(p.email, `You're now ${r.title} at ${BRAND.name}`, `Hi ${String(p.name).split(" ")[0]},\n\nCongratulations: you're now ${r.title}. Your commission on what you sell is ${Math.round(r.sellerShare * 100)}% of our profit${r.override ? `, plus ${Math.round(r.override * 100)}% on your team's sales` : ""}.${r.promotionBonus ? ` Your ${money(r.promotionBonus)} promotion bonus goes out with Monday's payout.` : ""}\n\nYour next step and the leaderboard: ${siteUrl()}/partner#sales-force\n\n— ${BRAND.name}`).catch(() => false);
    await raiseAlert("partners", "info", `Sales Force promotion: ${p.name} → ${r.title}`, note);
  }
  return { ok: true };
}

/** The leaders above a rep, nearest first, with whether each is still selling (no loops, at most 12 levels). */
async function leaderChain(partnerId: string): Promise<{ id: string; rank: SalesRank; selling: boolean }[]> {
  const out: { id: string; rank: SalesRank; selling: boolean }[] = [];
  const seen = new Set([partnerId]);
  let { data: cur } = await db().from("referral_partners").select("sales_leader_id").eq("id", partnerId).maybeSingle();
  for (let i = 0; i < 12 && cur?.sales_leader_id && !seen.has(cur.sales_leader_id); i++) {
    const id = cur.sales_leader_id as string;
    seen.add(id);
    const { data: l } = await db().from("referral_partners").select("id, status, sales_rank, sales_leader_id").eq("id", id).maybeSingle();
    if (!l) break;
    if (l.status === "active" && l.sales_rank) {
      const { data: c } = await db().from("partner_commissions").select("take").eq("partner_id", id).in("tier", ["direct", "sale", "book"]).neq("status", "void").gte("created_at", new Date(Date.now() - 90 * DAY).toISOString()).limit(5000);
      const p90 = (c ?? []).reduce((t, r: { take: number }) => t + Number(r.take), 0);
      out.push({ id, rank: l.sales_rank as SalesRank, selling: p90 >= SALES_POOL.leaderMinPersonalProfit });
    }
    cur = l;
  }
  return out;
}

/** At completion of a rep's direct sale: their leaders' team shares and the rep's first-sale bonus. */
export async function accrueTeamPay(job: Job, sp: { tier: string; rate: number; take: number; amount: number } | null) {
  if (!job.partner_id || !sp || !["direct", "sale"].includes(sp.tier) || sp.amount <= 0) return; // a direct sale (v7 tier "sale")
  const rank = await salesRankOf(job.partner_id);
  if (!rank) return;
  const done = job.completed_at ? new Date(job.completed_at) : new Date();
  const eligible = new Date(done.getTime() + PARTNER_PROGRAM.holdDays * DAY).toISOString();
  const lines = teamOverrides({ take: sp.take, sellerRate: sp.rate, sellerRank: rank, leaders: await leaderChain(job.partner_id) });
  for (const l of lines) {
    await db().from("sales_pay").insert({ partner_id: l.id, kind: "override", job_id: job.id, from_partner_id: job.partner_id, rank: l.rank, share: l.share, take: sp.take, amount: l.amount, eligible_at: eligible, note: `Team share on ${job.ref}` }).then(() => null, () => null); // unique per leader and job
  }
  await db().from("sales_pay").insert({ partner_id: job.partner_id, kind: "first_sale", job_id: job.id, amount: FAST_MONEY.firstSale, eligible_at: eligible, note: `First sale: ${job.ref}` }).then(() => null, () => null); // once per rep
}

/** Staff marked a walkthrough done: $25 to the rep whose link the business came from (up to the weekly cap). */
export async function walkthroughHeld(walkthroughId: string) {
  if (!(await salesForceReady())) return;
  const { data: w } = await db().from("walkthroughs").select("id, partner_id, company").eq("id", walkthroughId).maybeSingle();
  if (!w?.partner_id) return;
  const { data: p } = await db().from("referral_partners").select("status, sales_rank").eq("id", w.partner_id).maybeSingle();
  if (!p?.sales_rank || p.status !== "active") return;
  const week = new Date(Date.now() - 7 * DAY).toISOString();
  const { count } = await db().from("sales_pay").select("id", { count: "exact", head: true }).eq("partner_id", w.partner_id).eq("kind", "walkthrough").gte("created_at", week);
  if ((count ?? 0) >= FAST_MONEY.weeklyWalkthroughCap) return;
  await db().from("sales_pay").insert({ partner_id: w.partner_id, kind: "walkthrough", walkthrough_id: w.id, amount: FAST_MONEY.walkthroughHeld, note: `Walkthrough held: ${w.company}` }).then(() => null, () => null);
}

type PayRow = { id: string; partner_id: string; kind: string; amount: number; share: number | null; jobs: { price_final: number; contractor_payout: number; amount_refunded: number; remedy: string | null; status: string } | null };

/** Monday: pending lines that are due, by partner. Team shares follow refunds down (never up) first. */
export async function dueSalesPay(now = new Date()): Promise<Map<string, { id: string; amount: number }[]>> {
  const by = new Map<string, { id: string; amount: number }[]>();
  if (!(await salesForceReady())) return by;
  const { data } = await db().from("sales_pay").select("id, partner_id, kind, amount, share, jobs(price_final, contractor_payout, amount_refunded, remedy, status)").eq("status", "pending").lte("eligible_at", now.toISOString()).limit(5000);
  for (const r of (data ?? []) as unknown as PayRow[]) {
    let amount = Number(r.amount);
    if (r.kind === "override") {
      const j = r.jobs;
      const live = Boolean(j && j.status === "completed" && !j.remedy);
      const nowAmt = live ? Math.min(amount, Math.floor(partnerTake({ price: Number(j!.price_final), payout: Number(j!.contractor_payout), refunded: Number(j!.amount_refunded) }) * Number(r.share ?? 0) * 100) / 100) : 0;
      if (nowAmt <= 0) { await db().from("sales_pay").update({ status: "void", amount: 0, note: "job refunded or cancelled" }).eq("id", r.id); continue; }
      if (nowAmt !== amount) { await db().from("sales_pay").update({ amount: nowAmt, note: "reduced by a refund" }).eq("id", r.id); amount = nowAmt; }
    }
    if (r.kind === "first_sale" && r.jobs && (r.jobs.status !== "completed" || r.jobs.remedy || Number(r.jobs.amount_refunded) >= Number(r.jobs.price_final))) {
      await db().from("sales_pay").update({ status: "void", amount: 0, note: "first sale was refunded" }).eq("id", r.id); continue;
    }
    by.set(r.partner_id, [...(by.get(r.partner_id) ?? []), { id: r.id, amount }]);
  }
  return by;
}
export async function claimSalesPay(ids: string[], week: string, stamp: string): Promise<number> {
  if (!ids.length) return 0;
  const { data } = await db().from("sales_pay").update({ status: "paid", paid_at: stamp, week_of: week }).in("id", ids).eq("status", "pending").select("id");
  return (data ?? []).length;
}
export async function releaseSalesPay(ids: string[]) { if (ids.length) await db().from("sales_pay").update({ status: "pending", paid_at: null, week_of: null }).in("id", ids).eq("status", "paid").is("stripe_transfer_id", null); }
export async function stampSalesPay(ids: string[], transferId: string) { if (ids.length) await db().from("sales_pay").update({ stripe_transfer_id: transferId }).in("id", ids); }

/** Last-90-days revenue leaderboard (recognition and perks). */
export async function leaderboardNow() {
  const { all, totals } = await repTotals();
  return leaderboard(all.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name, rank: m.sales_rank, revenue90: totals.get(m.id)!.revenue90 })));
}

/** What a rep sees on their partner page. */
export async function salesForceView(partnerId: string) {
  if (!(await salesForceReady())) return null;
  const { all, totals } = await repTotals();
  const me = all.find((m) => m.id === partnerId);
  if (!me) return null;
  const n = totals.get(partnerId)!;
  const board = leaderboard(all.filter((m) => m.status === "active").map((m) => ({ id: m.id, name: m.name, rank: m.sales_rank, revenue90: totals.get(m.id)!.revenue90 })));
  const { data: pay } = await db().from("sales_pay").select("kind, amount, status, note, created_at").eq("partner_id", partnerId).neq("status", "void").order("created_at", { ascending: false }).limit(30);
  const leader = me.sales_leader_id ? all.find((m) => m.id === me.sales_leader_id) ?? null : null;
  return {
    rank: me.sales_rank, numbers: n,
    next: nextRanks(me.sales_rank).map((r) => ({ rank: r, gaps: promotionGaps(n, r) })),
    board: board.slice(0, 10), place: board.find((b) => b.id === partnerId) ?? null,
    pay: (pay ?? []) as { kind: string; amount: number; status: string; note: string | null; created_at: string }[],
    leader: leader ? { name: leader.name, rank: leader.sales_rank } : null,
    teamSize: n.team.length,
    recruitLink: `${siteUrl()}/careers/sales?leader=${me.code}`,
  };
}

/** Hub / sign-up: put a partner in the Sales Force (as an Associate unless they already have a rank). */
export async function joinSalesForce(partnerId: string, leaderCode: string | null, by: string) {
  if (!(await salesForceReady())) return { ok: false, error: "Run supabase/setup/ADD_SALES_FORCE_2026-11-18_0105.sql first" };
  const { data: p } = await db().from("referral_partners").select("id, sales_rank").eq("id", partnerId).maybeSingle();
  if (!p) return { ok: false, error: "Partner not found" };
  const leader = leaderCode ? (await db().from("referral_partners").select("id, sales_rank").eq("code", leaderCode.toUpperCase()).maybeSingle()).data : null;
  if (!p.sales_rank) {
    await db().from("referral_partners").update({ sales_rank: "associate", sales_rank_at: new Date().toISOString(), ...(leader?.sales_rank && leader.id !== partnerId ? { sales_leader_id: leader.id } : {}) }).eq("id", partnerId);
    await db().from("sales_rank_history").insert({ partner_id: partnerId, from_rank: null, to_rank: "associate", by_whom: by, note: leader?.sales_rank ? "joined a team" : "joined" });
  }
  return { ok: true };
}

/** Hub: who a rep's leader is (no loops). */
export async function setLeader(partnerId: string, leaderId: string | null) {
  if (leaderId === partnerId) return { ok: false, error: "Someone can't lead themselves" };
  if (leaderId) {
    const { all } = await repTotals();
    const kids = new Map<string, string[]>();
    for (const m of all) if (m.sales_leader_id) kids.set(m.sales_leader_id, [...(kids.get(m.sales_leader_id) ?? []), m.id]);
    const q = [...(kids.get(partnerId) ?? [])]; const seen = new Set<string>();
    while (q.length) { const x = q.shift()!; if (x === leaderId) return { ok: false, error: "That leader is on this rep's own team" }; if (seen.has(x)) continue; seen.add(x); q.push(...(kids.get(x) ?? [])); }
    if (!all.some((m) => m.id === leaderId)) return { ok: false, error: "The leader isn't in the Sales Force" };
  }
  await db().from("referral_partners").update({ sales_leader_id: leaderId }).eq("id", partnerId);
  return { ok: true };
}
