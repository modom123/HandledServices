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
 *             boardPreview(pro)    — Roadie-style: a pro still in setup sees open jobs in their trades and area (no
 *                                    claiming) so they know the work is there while the background check runs.
 *           Pros are never required to take board jobs; passing has no effect on their standing.
 * UPDATED : 2026-10-28_2131 UTC — boardPreview for pros in setup.
 * UPDATED : 2026-11-06_1800 UTC — cards show the pro's net pay (any referral fee already out).
 * UPDATED : 2026-11-10_0310 UTC — open offers (low name-your-price jobs) show for 30 days with a note to confirm the day.
 * UPDATED : 2026-11-12_2000 UTC — name-your-price posts on the board: marked "Posted job" with the customer's price and how
 *           long it's up, the day picked with the customer; "Top pay" (10%+ above our price), business jobs marked, and
 *           the board ordered by top pay, priority, then pay (core boardOrder). publicBoard() — the website's /job-board:
 *           open jobs with city, ZIP, pay and scope only (no address, name, notes or photos), to recruit pros.
 * UPDATED : 2026-11-12_2100 UTC — alerts to every pro the job fits (trades, licenses, insurance, area, schedule):
 *             alertBoardJob(job) — instant text + push when a name-your-price post or top-pay job is listed (pros who
 *                                  already have an offer on it are skipped)
 *             boardDigest()      — daily (sweep cron): "N new jobs near you", the jobs that joined their board in the last day
 *           Each pro chooses all / daily summary only / off (contractors.board_alerts; "all" until that SQL is run).
 * UPDATED : 2026-11-12_2200 UTC — texts go only to pros in the job's area (core inProArea: within their radius from their
 *           home base, or a listed ZIP); a pro whose area can't be confirmed gets the app notification only.
 * UPDATED : 2026-11-13_0700 UTC — publicBoard({ internal }) for admins: each job's customer price, pro pay and what Handled keeps.
 */
import "server-only";
import { AGREEMENT_VERSION, BOARD, boardOrder, inProArea, buildWorkOrder, getService, money, onBoard, topPay, proDistance, proTier, rankContractors, serviceText, tierPayout, type BoardOffer, type Contractor, type Job, proNetPay } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";
import { localeOf, notify } from "./push";
import { siteUrl } from "./notify";

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
  /** A name-your-price post: open until this date (YYYY-MM-DD); the pro picks the day with the customer. */
  postUntil?: string | null;
  /** The customer offered 10%+ above our suggested price. */
  topPay?: boolean;
  /** A company's job (commercial customer). */
  business?: boolean;
  /** When the job was booked (the daily summary lists the new ones). */
  createdAt?: string;
  /** Strictly in this pro's area (radius or ZIP list) — only these are ever texted. */
  inArea?: boolean;
}

/** One line for when the work happens: a post's day is set with the customer. */
const whenFor = (job: Job, fallback: string, locale: "en" | "es") => job.open_offer_until
  ? (locale === "es" ? `Día a elegir con el cliente (hasta el ${job.open_offer_until.slice(0, 10)})` : `Pick the day with the customer (by ${job.open_offer_until.slice(0, 10)})`)
  : fallback;
const isBusiness = (job: Job) => job.customer_type === "commercial" || Boolean(job.business_account_id);

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
  // open offers (low name-your-price jobs) show for their whole 30 days, whatever date was picked
  const q = (withOpen: boolean) => db().from("jobs").select("*").eq("status", "dispatched").is("contractor_id", null)
    .or(`scheduled_date.is.null,and(scheduled_date.gte.${today},scheduled_date.lte.${until})${withOpen ? `,open_offer_until.gt.${new Date().toISOString()}` : ""}`)
    .order("scheduled_date", { ascending: true, nullsFirst: false }).limit(300);
  let { data: jobs, error } = await q(true);
  if (error) ({ data: jobs } = await q(false)); // before the open-offer SQL is run
  // an open offer's day is flexible (the pro confirms it with the customer), so it isn't held to that day's schedule
  const list = ((jobs ?? []) as Job[]).map((j) => (j.open_offer_until ? { ...j, scheduled_date: null } : j));
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
    // the pro sees their net pay only (any referral fee already out)
    const pay = proNetPay(job, payFor(ctx.pro, job), ctx.pro.agreement_version);
    const wo = buildWorkOrder(job, { reveal: false, payout: payFor(ctx.pro, job), locale, agreementVersion: ctx.pro.agreement_version });
    const miles = proDistance(ctx.pro, job);
    cards.push({
      job_id: job.id, ref: job.ref, service: locale === "es" ? serviceText("es", svc.slug, svc).name : svc.name, icon: svc.icon,
      city: job.city, zip: job.zip, when: whenFor(job, wo.when, locale), pay, payLabel: money(pay), miles: miles == null ? null : Math.round(miles),
      scope: wo.scope.slice(0, 4).map((s) => `${s.label}: ${s.value}`), priority: job.priority !== "normal", offerId: mineOpen?.id ?? null,
      postUntil: job.open_offer_until?.slice(0, 10) ?? null, topPay: topPay(job), business: isBusiness(job), createdAt: job.created_at, inArea: inProArea(ctx.pro, job),
    });
  }
  return boardOrder(cards).slice(0, 50);
}

/**
 * Open jobs a pro in setup would see once cleared: their trades, within their radius (or ZIP list), city and ZIP only,
 * base pay. Read-only: claiming still needs an approved account.
 */
export async function boardPreview(contractorId: string, locale: "en" | "es" = "en"): Promise<BoardCard[]> {
  const { data } = await db().from("contractors").select("*").eq("id", contractorId).maybeSingle();
  const pro = data as Contractor | null;
  if (!pro || pro.status === "approved" || !pro.trades?.length) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data: jobs } = await db().from("jobs").select("*").eq("status", "dispatched").is("contractor_id", null)
    .or(`scheduled_date.is.null,scheduled_date.gte.${today},open_offer_until.gt.${new Date().toISOString()}`).order("scheduled_date", { ascending: true, nullsFirst: false }).limit(200);
  const cards: BoardCard[] = [];
  for (const job of (jobs ?? []) as Job[]) {
    const svc = getService(job.service_slug);
    if (!svc || !svc.trades.some((t) => pro.trades.includes(t))) continue;
    const miles = proDistance(pro, job);
    const inZips = pro.service_zips?.includes(job.zip);
    if (pro.zips_only ? !inZips : miles != null ? miles > (pro.service_radius_mi ?? 25) : pro.service_zips?.length ? !inZips : false) continue;
    const pay = proNetPay(job, job.contractor_payout ?? 0, pro.agreement_version);
    const wo = buildWorkOrder(job, { reveal: false, payout: job.contractor_payout ?? 0, locale, agreementVersion: pro.agreement_version });
    cards.push({
      job_id: job.id, ref: job.ref, service: locale === "es" ? serviceText("es", svc.slug, svc).name : svc.name, icon: svc.icon,
      city: job.city, zip: job.zip, when: whenFor(job, wo.when, locale), pay, payLabel: money(pay), miles: miles == null ? null : Math.round(miles),
      scope: wo.scope.slice(0, 3).map((x) => `${x.label}: ${x.value}`), priority: job.priority !== "normal", offerId: null,
      postUntil: job.open_offer_until?.slice(0, 10) ?? null, topPay: topPay(job), business: isBusiness(job),
    });
    if (cards.length >= 10) break;
  }
  return boardOrder(cards);
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
  // an open offer's day is flexible, so it's checked without that day's schedule
  if (!qualifies(ctx.pro, ctx.perDay, (job.open_offer_until ? { ...job, scheduled_date: null } : job) as Job)) return { ok: false, error: "This job doesn't fit your trades, area, schedule or daily limit." };
  const { data, error } = await db().from("job_offers").upsert({
    job_id: jobId, contractor_id: contractorId, kind: "board", payout: payFor(ctx.pro, job as Job), ai_score: null, ai_reason: "Claimed from Jobs near you",
    status: "offered", offered_at: new Date().toISOString(), expires_at: new Date(Date.now() + BOARD.claimMinutes * 60000).toISOString(), terms_accepted_at: null, work_order_version: null,
  }, { onConflict: "job_id,contractor_id" }).select("id").single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't hold the job" };
  await db().from("job_events").insert({ job_id: jobId, kind: "dispatch", message: `${ctx.pro.business_name} claimed it from the job board (${BOARD.claimMinutes} min hold)`, actor: "pro", visible_to_customer: false });
  return { ok: true, offerId: data.id };
}

/** A job on the public board (/job-board): enough for a pro to want it, nothing that identifies the customer or home. */
export interface PublicBoardCard {
  ref: string; service: string; slug: string; icon: string; category: string;
  city: string; state: string; zip: string; when: string; pay: number; payLabel: string; scope: string[];
  priority: boolean; topPay: boolean; postUntil: string | null; business: boolean; postedAt: string;
  /** Admins only (need-to-know): the customer's price and the expected split. Never sent to anyone else. */
  internal?: { ref: string; price: number; pro: number; keep: number; takePct: number | null; paid: number; posted: boolean };
}

/**
 * The website's job board: paid (or posted) jobs nobody has taken yet that are open to every qualified pro right now,
 * top pay first. City, ZIP, a pro's base pay and the scope answers only — the address, the customer, their notes and
 * photos are shown only to the pro who takes the job. Fails soft (an empty board) if the database isn't reachable.
 */
export async function publicBoard(locale: "en" | "es" = "en", o: { internal?: boolean } = {}): Promise<PublicBoardCard[]> {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  try {
    const now = new Date(), today = now.toISOString().slice(0, 10);
    const until = new Date(now.getTime() + BOARD.horizonDays * 86400000).toISOString().slice(0, 10);
    const q = (withOpen: boolean) => db().from("jobs").select("*").eq("status", "dispatched").is("contractor_id", null)
      .or(`scheduled_date.is.null,and(scheduled_date.gte.${today},scheduled_date.lte.${until})${withOpen ? `,open_offer_until.gt.${now.toISOString()}` : ""}`)
      .order("created_at", { ascending: false }).limit(300);
    let { data: jobs, error } = await q(true);
    if (error) ({ data: jobs } = await q(false));
    const list = (jobs ?? []) as Job[];
    if (!list.length) return [];
    const { data: offers } = await db().from("job_offers").select("id, job_id, contractor_id, kind, status, offered_at").in("job_id", list.map((j) => j.id));
    const byJob: Record<string, OfferRow[]> = {};
    for (const o of (offers ?? []) as OfferRow[]) (byJob[o.job_id] ??= []).push(o);
    const cards: PublicBoardCard[] = [];
    for (const job of list) {
      if (!onBoard(job, byJob[job.id] ?? [], now)) continue;
      const svc = getService(job.service_slug);
      if (!svc || svc.remote) continue;
      const view = job.open_offer_until ? { ...job, scheduled_date: null } : job;
      const wo = buildWorkOrder(view, { reveal: false, payout: job.contractor_payout ?? 0, locale, agreementVersion: AGREEMENT_VERSION });
      const pay = proNetPay(job, job.contractor_payout ?? 0, AGREEMENT_VERSION);
      if (!(pay > 0)) continue;
      cards.push({
        ref: job.ref, service: locale === "es" ? serviceText("es", svc.slug, svc).name : svc.name, slug: svc.slug, icon: svc.icon, category: svc.category,
        city: job.city, state: job.state, zip: job.zip, when: whenFor(job, wo.when, locale), pay, payLabel: money(pay), scope: wo.scope.slice(0, 4).map((x) => `${x.label}: ${x.value}`),
        priority: job.priority !== "normal", topPay: topPay(job), postUntil: job.open_offer_until?.slice(0, 10) ?? null, business: isBusiness(job), postedAt: job.created_at,
        // admins: what the customer pays, what the pro gets (before any referral fee), what Handled keeps
        ...(o.internal ? (() => {
          const price = Number(job.price_final ?? 0), pro = Number(job.contractor_payout ?? 0), keep = Math.round((price - pro) * 100) / 100;
          return { internal: { ref: job.ref, price, pro, keep, takePct: price > 0 ? keep / price : null, paid: Number(job.amount_paid ?? 0), posted: Boolean(job.open_offer_until) } };
        })() : {}),
      });
    }
    return boardOrder(cards).slice(0, 100);
  } catch (e) {
    console.error("[public board]", e);
    return [];
  }
}

const alertsPref = (pro: Contractor) => pro.board_alerts ?? "all";

/** Run `fn` over `items` a few at a time (texts and pushes go out in parallel without flooding the providers). */
async function inBatches<T>(items: T[], size: number, fn: (x: T) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map((x) => fn(x).catch((e) => console.error("[board alert]", e))));
}

/**
 * Instant alert: a name-your-price post or a top-pay job just went on the board — tell every approved pro it fits
 * (same checks as dispatch; a post's day is flexible) who wants instant alerts, except pros who already have an
 * offer on it or passed on it. Returns how many were alerted.
 */
export async function alertBoardJob(jobId: string): Promise<number> {
  const { data: j } = await db().from("jobs").select("*").eq("id", jobId).maybeSingle();
  const job = j as Job | null;
  if (!job || job.contractor_id || job.status !== "dispatched") return 0;
  const svc = getService(job.service_slug);
  if (!svc) return 0;
  const view = (job.open_offer_until ? { ...job, scheduled_date: null } : job) as Job;
  const [{ data: pros }, { data: offers }, { data: sameDay }] = await Promise.all([
    db().from("contractors").select("*").eq("status", "approved").limit(3000),
    db().from("job_offers").select("contractor_id").eq("job_id", jobId),
    view.scheduled_date ? db().from("jobs").select("contractor_id").eq("scheduled_date", view.scheduled_date).not("contractor_id", "is", null) : Promise.resolve({ data: [] as { contractor_id: string }[] }),
  ]);
  const had = new Set(((offers ?? []) as { contractor_id: string }[]).map((o) => o.contractor_id));
  const load: Record<string, number> = {};
  for (const r of (sameDay ?? []) as { contractor_id: string }[]) load[r.contractor_id] = (load[r.contractor_id] ?? 0) + 1;
  const fits = ((pros ?? []) as Contractor[]).filter((p) => alertsPref(p) === "all" && !had.has(p.id) && rankContractors([p], view, view.scheduled_date ? { [p.id]: load[p.id] ?? 0 } : {}).length > 0).slice(0, 300);
  const top = topPay(job), post = Boolean(job.open_offer_until);
  const when = whenFor(job, buildWorkOrder(view, { reveal: false }).when, "en");
  await inBatches(fits, 10, async (pro) => {
    const pay = money(proNetPay(job, payFor(pro, job), pro.agreement_version));
    const tag = top ? "Top pay" : post ? "Customer named the price" : "New job";
    const tagEs = top ? "Pago alto" : post ? "El cliente fijó el precio" : "Trabajo nuevo";
    const nameEs = serviceText("es", svc.slug, svc).name;
    await notify(pro.profile_id, {
      title: `${tag} near you · ${pay}`,
      body: `${svc.icon} ${svc.name} · ${job.city} ${job.zip} · ${when}. First to take it gets it.`,
      data: { type: "board", jobId }, channel: "offers",
      // a text only when the job is in the pro's area; otherwise the app notification alone
      sms: inProArea(pro, job) ? { to: pro.phone, body: `Handled: ${tag.toLowerCase()} near you — ${svc.name}, ${job.city} ${job.zip}, you earn ${pay}. ${post ? "Set the day with the customer. " : ""}First to take it gets it: ${siteUrl()}/pro` } : null,
      es: { title: `${tagEs} cerca de usted · ${pay}`, body: `${svc.icon} ${nameEs} · ${job.city} ${job.zip}. El primero en tomarlo se lo lleva.`,
        sms: `Handled: ${tagEs.toLowerCase()} cerca de usted — ${nameEs}, ${job.city} ${job.zip}, usted gana ${pay}. ${post ? "Acuerde el día con el cliente. " : ""}El primero en tomarlo se lo lleva: ${siteUrl()}/pro` },
    });
  });
  if (fits.length) await db().from("job_events").insert({ job_id: jobId, kind: "dispatch", message: `Job board alert sent to ${fits.length} pro${fits.length === 1 ? "" : "s"} it fits`, actor: "system", visible_to_customer: false });
  return fits.length;
}

/**
 * Daily summary: each pro who wants board alerts gets one message listing the jobs that joined their board in the last
 * day (pros on instant alerts already heard about posts and top pay, so those are left out for them). Nothing to list,
 * nothing sent.
 */
export async function boardDigest(now = new Date()): Promise<{ sent: number }> {
  const since = new Date(now.getTime() - 26 * 3600000).toISOString();
  const { data: fresh } = await db().from("jobs").select("id", { count: "exact", head: false }).eq("status", "dispatched").is("contractor_id", null).gte("created_at", since).limit(1);
  if (!fresh?.length) return { sent: 0 };
  const { data: pros } = await db().from("contractors").select("*").eq("status", "approved").limit(3000);
  let sent = 0;
  await inBatches(((pros ?? []) as Contractor[]).filter((p) => alertsPref(p) !== "off"), 5, async (pro) => {
    const instant = alertsPref(pro) === "all";
    const cards = (await boardFor(pro.id, (await localeOf(pro.profile_id, null)) === "es" ? "es" : "en")).filter((c) => (c.createdAt ?? "") >= since && !(instant && (c.postUntil || c.topPay)));
    if (!cards.length) return;
    const local = cards.filter((c) => c.inArea);
    const lines = cards.slice(0, 5).map((c) => `• ${c.service} — ${c.city} ${c.zip} — ${c.payLabel}`).join("\n");
    const more = cards.length > 5 ? `\n…and ${cards.length - 5} more` : "";
    const ok = await notify(pro.profile_id, {
      title: `${cards.length} new job${cards.length === 1 ? "" : "s"} near you`,
      body: cards.slice(0, 3).map((c) => `${c.service} ${c.payLabel}`).join(" · "),
      data: { type: "board" }, channel: "offers",
      // the text counts only jobs in the pro's area (none → no text; the email and app still list everything)
      sms: local.length ? { to: pro.phone, body: `Handled: ${local.length} new job${local.length === 1 ? "" : "s"} in your area. Top: ${local[0].service}, ${local[0].city}, ${local[0].payLabel}. See them: ${siteUrl()}/pro` } : null,
      email: { to: pro.email, subject: `${cards.length} new job${cards.length === 1 ? "" : "s"} near you on Handled`, text: `New on your job board:\n\n${lines}${more}\n\nFirst to take it gets it: ${siteUrl()}/pro\n\nChange these alerts on your pro home page (Jobs near you → Job alerts).` },
      es: { title: `${cards.length} trabajo${cards.length === 1 ? "" : "s"} nuevo${cards.length === 1 ? "" : "s"} cerca de usted`,
        ...(local.length ? { sms: `Handled: ${local.length} trabajo${local.length === 1 ? "" : "s"} nuevo${local.length === 1 ? "" : "s"} en su zona. Véalos: ${siteUrl()}/pro` } : {}),
        subject: `${cards.length} trabajo${cards.length === 1 ? "" : "s"} nuevo${cards.length === 1 ? "" : "s"} cerca de usted en Handled`,
        text: `Nuevo en su tablero de trabajos:\n\n${lines}${more}\n\nEl primero en tomarlo se lo lleva: ${siteUrl()}/pro\n\nCambie estos avisos en su página de profesional (Trabajos cerca de usted → Avisos).` },
    }).then(() => true).catch(() => false);
    if (ok) sent++;
  });
  return { sent };
}

/** The pro's own choice: all alerts, the daily summary only, or none. */
export async function setBoardAlerts(contractorId: string, pref: "all" | "digest" | "off"): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db().from("contractors").update({ board_alerts: pref }).eq("id", contractorId);
  if (error) return { ok: false, error: /board_alerts/.test(error.message) ? "Job alert settings are being set up — try again later." : error.message };
  return { ok: true };
}
