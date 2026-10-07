/*
 * FILE    : apps/web/lib/rewards.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Handled Pro Rewards engine (rules in packages/core/src/rewards.ts).
 *             creditJob        — when a job is completed: pending points (estimate) on Handled's take
 *             releaseRewards   — daily: pending points older than 90 days get their final multipliers (refund → void,
 *                                redo → no quality bonus, the customer's rating) and become available; milestones;
 *                                inactivity expiry
 *             rewardsFor       — a pro's balance, pending, history, tier, milestones (portal + app)
 *             redeem / setRedemptionStatus / adjustPoints / forfeitPoints — orders and staff actions
 *             rewardsLiability — points owed in dollars (Hub)
 *           Tenure counts from the pro's first completed job.
 */
import "server-only";
import { MILESTONES, mergeRewards, milestonesReached, monthsBetween, pointsForJob, takeOf, tenureTier, type Job, type RedemptionStatus, type RewardSettings } from "@handled/core";
import { adminClient } from "./supabase/server";
import { raiseAlert } from "./jobs";
import { notify } from "./push";

const db = () => adminClient();


export async function getRewardSettings(): Promise<RewardSettings> {
  const { data } = await db().from("reward_settings").select("settings").eq("id", 1).maybeSingle();
  return mergeRewards((data?.settings ?? {}) as Partial<RewardSettings>);
}

export async function saveRewardSettings(s: Partial<RewardSettings>, who: string) {
  const merged = mergeRewards({ ...(await getRewardSettings()), ...s });
  await db().from("reward_settings").upsert({ id: 1, settings: merged, updated_by: who, updated_at: new Date().toISOString() });
  return merged;
}

/** Months since the pro's first completed job (their time with Handled). */
async function monthsActive(contractorId: string, at = new Date()) {
  const { data } = await db().from("jobs").select("completed_at").eq("contractor_id", contractorId).eq("status", "completed").not("completed_at", "is", null).order("completed_at").limit(1);
  const first = (data?.[0] as { completed_at: string } | undefined)?.completed_at;
  return first ? monthsBetween(first, at) : 0;
}

/** Called when a job is completed: pending points, final at release. */
export async function creditJob(job: Job) {
  const s = await getRewardSettings();
  if (!s.enabled || !job.contractor_id) return null;
  const take = takeOf(job);
  if (take <= 0) return null;
  const months = await monthsActive(job.contractor_id);
  const qa = (job.ai_qa as { passed?: boolean } | null) ?? null;
  const est = pointsForJob({ take, monthsActive: months, qaPassedFirstTime: qa?.passed !== false, redo: job.remedy === "redo", refunded: Number(job.amount_refunded ?? 0) > 0 }, s);
  if (est.points <= 0) return null;
  const { error } = await db().from("reward_ledger").insert({
    contractor_id: job.contractor_id, kind: "earn", points: est.points, status: "pending", job_id: job.id,
    available_at: new Date(Date.now() + s.pendingDays * 86400000).toISOString(), detail: { take, ...est, months, estimate: true }, note: job.ref,
  });
  return error ? null : est.points;
}

/** Daily: release pending points (final multipliers), award milestones, expire inactive balances. */
export async function releaseRewards() {
  const s = await getRewardSettings();
  const out = { released: 0, voided: 0, milestones: 0, expired: 0 };
  if (!s.enabled) return out;
  const { data: due } = await db().from("reward_ledger").select("*").eq("status", "pending").lte("available_at", new Date().toISOString()).limit(1000);
  const touched = new Set<string>();
  for (const e of (due ?? []) as { id: string; contractor_id: string; job_id: string | null; detail: Record<string, number> | null }[]) {
    touched.add(e.contractor_id);
    const { data: job } = e.job_id ? await db().from("jobs").select("*").eq("id", e.job_id).maybeSingle() : { data: null };
    if (!job) { await db().from("reward_ledger").update({ status: "void", note: "job removed" }).eq("id", e.id); out.voided++; continue; }
    const j = job as Job;
    const [{ data: review }, { count: redos }] = await Promise.all([
      db().from("reviews").select("rating").eq("job_id", j.id).maybeSingle(),
      db().from("jobs").select("id", { count: "exact", head: true }).eq("parent_job_id", j.id).eq("remedy", "redo"),
    ]);
    const refunded = Number(j.amount_refunded ?? 0) > 0 || j.status === "cancelled";
    const fin = pointsForJob({ take: takeOf(j), monthsActive: Number(e.detail?.months ?? 0), qaPassedFirstTime: (j.ai_qa as { passed?: boolean } | null)?.passed !== false, redo: Boolean(redos), refunded, rating: review?.rating ?? null }, s);
    if (fin.points <= 0) { await db().from("reward_ledger").update({ status: "void", points: 0, detail: { ...e.detail, ...fin, estimate: false, refunded } }).eq("id", e.id); out.voided++; continue; }
    await db().from("reward_ledger").update({ status: "available", points: fin.points, detail: { ...e.detail, ...fin, estimate: false, rating: review?.rating ?? null, redo: Boolean(redos) } }).eq("id", e.id);
    out.released++;
  }
  // milestones for pros who completed a job recently or just had points released
  const since = new Date(Date.now() - 2 * 86400000).toISOString();
  const { data: recent } = await db().from("jobs").select("contractor_id").eq("status", "completed").gte("completed_at", since).not("contractor_id", "is", null);
  for (const r of (recent ?? []) as { contractor_id: string }[]) touched.add(r.contractor_id);
  for (const id of touched) out.milestones += await awardMilestones(id);
  out.expired = await expireInactive(s);
  return out;
}

export async function awardMilestones(contractorId: string) {
  const [{ data: c }, { data: had }, { count: fives }, months] = await Promise.all([
    db().from("contractors").select("jobs_completed, profile_id, status").eq("id", contractorId).single(),
    db().from("reward_ledger").select("milestone").eq("contractor_id", contractorId).eq("kind", "milestone"),
    db().from("reviews").select("id", { count: "exact", head: true }).eq("contractor_id", contractorId).eq("rating", 5),
    monthsActive(contractorId),
  ]);
  if (!c || c.status !== "approved") return 0;
  const got = milestonesReached({ jobsCompleted: Number(c.jobs_completed ?? 0), monthsActive: months, fiveStarReviews: fives ?? 0 }, ((had ?? []) as { milestone: string }[]).map((m) => m.milestone));
  for (const m of got) {
    const { error } = await db().from("reward_ledger").insert({ contractor_id: contractorId, kind: "milestone", milestone: m.key, points: m.points, status: "available", note: m.en });
    if (!error) await notify(c.profile_id, { title: `🏆 ${m.en}`, body: `+${m.points.toLocaleString("en-US")} reward points`, data: { type: "rewards" }, channel: "updates",
      es: { title: `🏆 ${m.es}`, body: `+${m.points.toLocaleString("en-US")} puntos de recompensa` } }).catch(() => {});
  }
  return got.length;
}

async function expireInactive(s: RewardSettings) {
  const cutoff = new Date(Date.now() - s.inactivityExpiryMonths * 30.44 * 86400000).toISOString();
  const { data: bal } = await db().from("reward_balances").select("contractor_id, available").gt("available", 0);
  let n = 0;
  for (const b of (bal ?? []) as { contractor_id: string; available: number }[]) {
    const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("contractor_id", b.contractor_id).eq("status", "completed").gte("completed_at", cutoff);
    const { count: recentEarn } = await db().from("reward_ledger").select("id", { count: "exact", head: true }).eq("contractor_id", b.contractor_id).gte("created_at", cutoff);
    if (count || recentEarn) continue;
    await db().from("reward_ledger").insert({ contractor_id: b.contractor_id, kind: "expire", points: -b.available, status: "available", note: `No completed job in ${s.inactivityExpiryMonths} months` });
    n++;
  }
  return n;
}

export async function balanceOf(contractorId: string) {
  const { data } = await db().from("reward_balances").select("*").eq("contractor_id", contractorId).maybeSingle();
  return { available: Number(data?.available ?? 0), pending: Number(data?.pending ?? 0), lifetime: Number(data?.lifetime ?? 0) };
}

export interface CatalogItem { id: string; slug: string | null; name: string; name_es: string | null; category: string; points: number; cost_usd: number; description: string | null; description_es: string | null; image_url: string | null; stock: number | null; active: boolean; sort: number }
export interface Redemption { id: string; contractor_id: string; item_id: string | null; item_name: string; points: number; fmv_usd: number; status: RedemptionStatus; ship_to: Record<string, string> | null; tracking: string | null; note: string | null; delivered_at: string | null; tax_year: number | null; created_at: string }

export async function catalog(all = false): Promise<CatalogItem[]> {
  let q = db().from("reward_catalog").select("*").order("points");
  if (!all) q = q.eq("active", true);
  return ((await q).data ?? []) as CatalogItem[];
}

/** Everything the pro's Rewards page needs. */
export async function rewardsFor(contractorId: string) {
  const [s, bal, { data: ledger }, { data: orders }, items, months, { data: had }] = await Promise.all([
    getRewardSettings(), balanceOf(contractorId),
    db().from("reward_ledger").select("id, kind, points, status, available_at, note, milestone, detail, created_at").eq("contractor_id", contractorId).neq("status", "void").order("created_at", { ascending: false }).limit(100),
    db().from("reward_redemptions").select("*").eq("contractor_id", contractorId).order("created_at", { ascending: false }),
    catalog(), monthsActive(contractorId),
    db().from("reward_ledger").select("milestone").eq("contractor_id", contractorId).eq("kind", "milestone"),
  ]);
  const done = new Set(((had ?? []) as { milestone: string }[]).map((m) => m.milestone));
  return { settings: s, balance: bal, ledger: (ledger ?? []) as { id: string; kind: string; points: number; status: string; available_at: string | null; note: string | null; milestone: string | null; detail: Record<string, unknown> | null; created_at: string }[],
    orders: (orders ?? []) as Redemption[], catalog: items, tier: tenureTier(months), monthsActive: months,
    milestones: MILESTONES.map((m) => ({ key: m.key, en: m.en, es: m.es, points: m.points, done: done.has(m.key) })) };
}

export async function redeem(contractorId: string, itemId: string, shipTo: Record<string, string>, actor: string): Promise<{ ok: boolean; error?: string; id?: string }> {
  const s = await getRewardSettings();
  if (!s.enabled) return { ok: false, error: "Rewards are paused right now" };
  const { data: item } = await db().from("reward_catalog").select("*").eq("id", itemId).eq("active", true).maybeSingle();
  if (!item) return { ok: false, error: "That reward isn't available" };
  if (item.stock !== null && item.stock <= 0) return { ok: false, error: "Out of stock" };
  const { data: c } = await db().from("contractors").select("status, business_name").eq("id", contractorId).single();
  if (c?.status !== "approved") return { ok: false, error: "Your account needs to be active to redeem" };
  if ((await balanceOf(contractorId)).available < item.points) return { ok: false, error: "Not enough available points yet" };
  const { data: r, error } = await db().from("reward_redemptions").insert({ contractor_id: contractorId, item_id: item.id, item_name: item.name, points: item.points, fmv_usd: item.cost_usd, ship_to: shipTo, status: "requested" }).select("id").single();
  if (error || !r) return { ok: false, error: error?.message ?? "Couldn't place the order" };
  await db().from("reward_ledger").insert({ contractor_id: contractorId, kind: "redeem", points: -item.points, status: "available", redemption_id: r.id, note: item.name, created_by: actor });
  // two orders at once can't overdraw: undo this one if the balance went negative
  if ((await balanceOf(contractorId)).available < 0) {
    await db().from("reward_ledger").delete().eq("redemption_id", r.id).eq("kind", "redeem");
    await db().from("reward_redemptions").delete().eq("id", r.id);
    return { ok: false, error: "Not enough available points" };
  }
  if (item.stock !== null) await db().from("reward_catalog").update({ stock: item.stock - 1 }).eq("id", item.id);
  await raiseAlert("rewards", "info", `Reward order: ${item.name} for ${c?.business_name ?? "a pro"}`, `${item.points.toLocaleString("en-US")} points (fair market value $${item.cost_usd}). Approve and order it in Hub → Rewards.`);
  return { ok: true, id: r.id };
}

/** Staff move an order along. Cancelling returns the points; delivery sets the tax year for the 1099. */
export async function setRedemptionStatus(id: string, status: RedemptionStatus, actor: string, extra: { tracking?: string | null; note?: string | null } = {}) {
  const { data: r } = await db().from("reward_redemptions").select("*").eq("id", id).maybeSingle();
  if (!r) return { ok: false, error: "Order not found" };
  if (r.status === "cancelled" || r.status === "delivered") return { ok: false, error: `Already ${r.status}` };
  const now = new Date();
  await db().from("reward_redemptions").update({ status, tracking: extra.tracking ?? r.tracking, note: extra.note ?? r.note, updated_at: now.toISOString(),
    ...(status === "delivered" ? { delivered_at: now.toISOString(), tax_year: now.getFullYear() } : {}) }).eq("id", id);
  if (status === "cancelled") {
    await db().from("reward_ledger").insert({ contractor_id: r.contractor_id, kind: "return", points: r.points, status: "available", redemption_id: id, note: `Returned: ${r.item_name}`, created_by: actor });
    if (r.item_id) { const { data: it } = await db().from("reward_catalog").select("stock").eq("id", r.item_id).single(); if (it?.stock != null) await db().from("reward_catalog").update({ stock: it.stock + 1 }).eq("id", r.item_id); }
  }
  const { data: c } = await db().from("contractors").select("profile_id").eq("id", r.contractor_id).single();
  if (c && ["shipped", "delivered", "cancelled"].includes(status)) await notify(c.profile_id, {
    title: status === "cancelled" ? "Reward order cancelled — points returned" : status === "shipped" ? `🎁 Your ${r.item_name} shipped` : `🎁 Your ${r.item_name} was delivered`,
    body: extra.tracking ? `Tracking: ${extra.tracking}` : "See Rewards for details.", data: { type: "rewards" },
    es: { title: status === "cancelled" ? "Pedido cancelado: puntos devueltos" : status === "shipped" ? `🎁 Su ${r.item_name} fue enviado` : `🎁 Su ${r.item_name} fue entregado`, body: extra.tracking ? `Rastreo: ${extra.tracking}` : "Vea Recompensas para más detalles." },
  }).catch(() => {});
  return { ok: true };
}

export async function adjustPoints(contractorId: string, points: number, note: string, actor: string) {
  if (!points || !note.trim()) return { ok: false, error: "Points and a reason are required" };
  if (points < 0 && (await balanceOf(contractorId)).available + points < 0) return { ok: false, error: "That would make the balance negative" };
  await db().from("reward_ledger").insert({ contractor_id: contractorId, kind: "adjust", points, status: "available", note: note.trim(), created_by: actor });
  return { ok: true };
}

/** Deactivated for cause (Deactivation Policy): available and pending points are forfeited. */
export async function forfeitPoints(contractorId: string, note: string, actor: string) {
  const b = await balanceOf(contractorId);
  await db().from("reward_ledger").update({ status: "void", note: `forfeited: ${note}` }).eq("contractor_id", contractorId).eq("status", "pending");
  if (b.available > 0) await db().from("reward_ledger").insert({ contractor_id: contractorId, kind: "forfeit", points: -b.available, status: "available", note, created_by: actor });
  return { ok: true, forfeited: b.available + b.pending };
}

/** Hub: points owed, what they'd cost, redemptions by year (1099). */
export async function rewardsLiability() {
  const s = await getRewardSettings();
  const [{ data: bal }, { data: reds }, { data: earned }] = await Promise.all([
    db().from("reward_balances").select("*"),
    db().from("reward_redemptions").select("fmv_usd, status, tax_year, created_at"),
    db().from("reward_ledger").select("points, kind, status, detail, created_at").in("kind", ["earn", "milestone"]).neq("status", "void").gte("created_at", new Date(new Date().getFullYear(), 0, 1).toISOString()),
  ]);
  const rows = (bal ?? []) as { available: number; pending: number }[];
  const available = rows.reduce((a, r) => a + Number(r.available), 0), pending = rows.reduce((a, r) => a + Number(r.pending), 0);
  const ytdPoints = ((earned ?? []) as { points: number }[]).reduce((a, r) => a + r.points, 0);
  const ytdTake = ((earned ?? []) as { kind: string; detail: { take?: number } | null }[]).reduce((a, r) => a + (r.kind === "earn" ? Number(r.detail?.take ?? 0) : 0), 0);
  const open = ((reds ?? []) as { status: string; fmv_usd: number }[]).filter((r) => !["delivered", "cancelled"].includes(r.status));
  return { settings: s, available, pending, owedUsd: Math.round(available * s.pointValue), pendingUsd: Math.round(pending * s.pointValue),
    ytdPoints, ytdCostUsd: Math.round(ytdPoints * s.pointValue), ytdTake: Math.round(ytdTake), costPctOfTake: ytdTake ? Math.round((ytdPoints * s.pointValue / ytdTake) * 1000) / 10 : null,
    openOrders: open.length, openOrdersUsd: Math.round(open.reduce((a, r) => a + Number(r.fmv_usd), 0)) };
}
