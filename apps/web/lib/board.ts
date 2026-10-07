/*
 * FILE    : apps/web/lib/board.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-04_2204 UTC
 * PURPOSE : Open job board — "Jobs near you" (rules in packages/core/src/board.ts).
 *             boardFor(pro)        — paid jobs still untaken after the first targeted round (and after any
 *                                    first look: recurring pro, redo, business team, customer favorite) that
 *                                    this pro qualifies for: trade, license, insurance, coverage, distance,
 *                                    days and hours, daily limit — the same check dispatch uses. City and ZIP
 *                                    only; the street address shows after they accept.
 *             claimFromBoard(pro)  — re-checks, then opens a "board" offer held for 15 minutes so the pro reads
 *                                    the full work order and accepts on the usual offer page (first to accept
 *                                    gets it; acceptOffer is race-safe).
 *           Pros are never required to take board jobs; passing has no effect on their standing.
 */
import "server-only";
import { BOARD, buildWorkOrder, getService, money, onBoard, proDistance, proTier, rankContractors, serviceText, tierPayout, type BoardOffer, type Contractor, type Job } from "@handled/core";
import { adminClient } from "./supabase/server";

const db = () => adminClient();

export interface BoardCard {
  job_id: string;
  ref: string;
  service: string;
  icon: string;
  city: string;
  zip: string;
  when: string;
  pay: number;
  payLabel: string;
  miles: number | null;
  scope: string[];
  priority: boolean;
  /** This pro already has an open offer on it (targeted or a claim): go straight to it. */
  offerId: string | null;
}

type OfferRow = BoardOffer & { id: string; job_id: string; contractor_id: string };

async function boardContext(contractorId: string) {
  const { data: pro } = await db().from("contractors").select("*").eq("id", contractorId).maybeSingle();
  if (!pro || (pro as Contractor).status !== "approved") return null;
  const { data: mine } = await db().from("jobs").select("scheduled_date").eq("contractor_id", contractorId).not("scheduled_date", "is", null);
  const perDay: Record<string, number> = {};
  for (const r of (mine ?? []) as { scheduled_date: string }[]) perDay[r.scheduled_date] = (perDay[r.scheduled_date] ?? 0) + 1;
  return { pro: pro as Contractor, perDay };
}

/** Can this pro take this job (same rules as dispatch)? */
const qualifies = (pro: Contractor, perDay: Record<string, number>, job: Job) =>
  rankContractors([pro], job, job.scheduled_date ? { [pro.id]: perDay[job.scheduled_date] ?? 0 } : {}).length > 0;

const payFor = (pro: Contractor, job: Job) => tierPayout(job.price_final, job.contractor_payout ?? 0, proTier(pro));

export async function boardFor(contractorId: string, locale: "en" | "es" = "en"): Promise<BoardCard[]> {
  const ctx = await boardContext(contractorId);
  if (!ctx) return [];
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + BOARD.horizonDays * 86400000).toISOString().slice(0, 10);
  const { data: jobs } = await db().from("jobs").select("*").eq("status", "dispatched").is("contractor_id", null)
    .or(`scheduled_date.is.null,and(scheduled_date.gte.${today},scheduled_date.lte.${until})`)
    .order("scheduled_date", { ascending: true, nullsFirst: false }).limit(300);
  const list = (jobs ?? []) as Job[];
  if (!list.length) return [];
  const { data: offers } = await db().from("job_offers").select("id, job_id, contractor_id, kind, status, offered_at").in("job_id", list.map((j) => j.id));
  const byJob: Record<string, OfferRow[]> = {};
  for (const o of (offers ?? []) as OfferRow[]) (byJob[o.job_id] ??= []).push(o);
  const cards: BoardCard[] = [];
  for (const job of list) {
    const os = byJob[job.id] ?? [];
    const mineOpen = os.find((o) => o.contractor_id === contractorId && o.status === "offered");
    if (os.some((o) => o.contractor_id === contractorId && o.status === "declined")) continue; // they passed on it
    if (!mineOpen && !onBoard(job, os)) continue;
    if (!qualifies(ctx.pro, ctx.perDay, job)) continue;
    const svc = getService(job.service_slug);
    if (!svc) continue;
    const pay = payFor(ctx.pro, job);
    const wo = buildWorkOrder(job, { reveal: false, payout: pay, locale });
    const miles = proDistance(ctx.pro, job);
    cards.push({
      job_id: job.id, ref: job.ref, service: locale === "es" ? serviceText("es", svc.slug, svc).name : svc.name, icon: svc.icon,
      city: job.city, zip: job.zip, when: wo.when, pay, payLabel: money(pay), miles: miles == null ? null : Math.round(miles),
      scope: wo.scope.slice(0, 3).map((s) => `${s.label}: ${s.value}`), priority: job.priority !== "normal", offerId: mineOpen?.id ?? null,
    });
  }
  return cards.slice(0, 50);
}

/** Claim a board job: a 15-minute hold, accepted on the usual offer page. */
export async function claimFromBoard(contractorId: string, jobId: string): Promise<{ ok: true; offerId: string } | { ok: false; error: string }> {
  const ctx = await boardContext(contractorId);
  if (!ctx) return { ok: false, error: "Your pro account isn't approved yet." };
  const { data: job } = await db().from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job || job.contractor_id || job.status !== "dispatched") return { ok: false, error: "Another pro already took this job." };
  const { data: offers } = await db().from("job_offers").select("id, contractor_id, kind, status, offered_at").eq("job_id", jobId);
  const os = (offers ?? []) as OfferRow[];
  const open = os.find((o) => o.contractor_id === contractorId && o.status === "offered");
  if (open) return { ok: true, offerId: open.id };
  if (!onBoard(job as Job, os)) return { ok: false, error: "This job isn't open to everyone yet." };
  if (!qualifies(ctx.pro, ctx.perDay, job as Job)) return { ok: false, error: "This job doesn't fit your trades, area, schedule or daily limit." };
  const { data, error } = await db().from("job_offers").upsert({
    job_id: jobId, contractor_id: contractorId, kind: "board", payout: payFor(ctx.pro, job as Job), ai_score: null, ai_reason: "Claimed from Jobs near you",
    status: "offered", offered_at: new Date().toISOString(), expires_at: new Date(Date.now() + BOARD.claimMinutes * 60000).toISOString(), terms_accepted_at: null, work_order_version: null,
  }, { onConflict: "job_id,contractor_id" }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't hold the job" };
  await db().from("job_events").insert({ job_id: jobId, kind: "dispatch", message: `${ctx.pro.business_name} claimed it from the job board (${BOARD.claimMinutes} min hold)`, actor: "pro", visible_to_customer: false });
  return { ok: true, offerId: data.id };
}
