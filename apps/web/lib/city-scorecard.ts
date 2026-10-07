/*
 * FILE    : apps/web/lib/city-scorecard.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1513 UTC
 * PURPOSE : Loads the numbers behind the city scorecard (core city-scorecard.ts). One pass over the last
 *           90 days of jobs, offers, reviews, plans and pros, bucketed into markets by ZIP prefix, then
 *           measured for the 90-day window and the last 30 days. Feeds Hub → City scorecard.
 */
import "server-only";
import { CARD_FEE, SERVICES, getService, planPace, scoreCity, type CityMetrics, type CityScore } from "@handled/core";
import { adminClient } from "./supabase/server";
import { HUMAN_KINDS } from "./metrics";

export interface Market { id: string; name: string; state: string; zip_prefixes: string[]; active: boolean; created_at: string; launch_services: string[] | null }
export interface CityCard { market: Market; m90: CityMetrics; m30: CityMetrics; score: CityScore }

type JobRow = {
  id: string; zip: string; status: string; service_slug: string; price_final: number | null; discount: number | null; member_benefit: number | null;
  contractor_payout: number | null; contractor_id: string | null; amount_paid: number | null; amount_refunded: number | null; customer_id: string | null;
  contact_email: string; plan_id: string | null; remedy: string | null; parent_job_id: string | null; paid_at: string | null; completed_at: string | null; cancel_reason: string | null;
};

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const inMarket = (m: Market, zip: string | null | undefined) => Boolean(zip) && m.zip_prefixes.some((p) => zip!.startsWith(p));
const who = (j: JobRow) => j.customer_id ?? j.contact_email.trim().toLowerCase();

async function chunked<T>(ids: string[], run: (part: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 400) out.push(...((await run(ids.slice(i, i + 400))).data ?? []));
  return out;
}

export async function loadCityScorecard() {
  const db = adminClient();
  const now = Date.now();
  const since90 = new Date(now - 90 * 86400000).toISOString();
  const since30 = new Date(now - 30 * 86400000).toISOString();
  const cols = "id, zip, status, service_slug, price_final, discount, member_benefit, contractor_payout, contractor_id, amount_paid, amount_refunded, customer_id, contact_email, plan_id, remedy, parent_job_id, paid_at, completed_at, cancel_reason";
  const [{ data: markets }, { data: done }, { data: paid }, { data: pros }, { data: plans }, { data: first }] = await Promise.all([
    db.from("markets").select("id, name, state, zip_prefixes, active, created_at, launch_services").order("created_at"),
    db.from("jobs").select(cols).eq("status", "completed").gte("completed_at", since90).limit(50000),
    db.from("jobs").select(cols).not("paid_at", "is", null).gte("paid_at", since90).is("remedy", null).limit(50000),
    db.from("contractors").select("id, base_zip, zip, trades").eq("status", "approved"),
    db.from("recurring_plans").select("customer_id, source_job_id, created_at, active"),
    db.from("jobs").select("completed_at").eq("status", "completed").order("completed_at").limit(1),
  ]);
  const completed = (done ?? []) as JobRow[];
  const paidJobs = (paid ?? []) as JobRow[];
  const doneIds = completed.map((j) => j.id);
  const paidIds = paidJobs.map((j) => j.id);
  const [reviews, offers, touches] = await Promise.all([
    chunked<{ job_id: string; rating: number }>(doneIds, (p) => db.from("reviews").select("job_id, rating").in("job_id", p)),
    chunked<{ job_id: string; status: string; offered_at: string; responded_at: string | null }>(paidIds, (p) => db.from("job_offers").select("job_id, status, offered_at, responded_at").in("job_id", p)),
    chunked<{ job_id: string; actor: string }>(doneIds, (p) => db.from("job_events").select("job_id, actor").in("job_id", p).in("kind", HUMAN_KINDS)),
  ]);
  const rating = new Map(reviews.map((r) => [r.job_id, Number(r.rating)]));
  const touched = new Set(touches.filter((e) => !String(e.actor).startsWith("IEBC")).map((e) => e.job_id));
  const offersBy = new Map<string, typeof offers>();
  for (const o of offers) offersBy.set(o.job_id, [...(offersBy.get(o.job_id) ?? []), o]);
  const planCustomers = new Set(((plans ?? []) as { customer_id: string | null; active: boolean }[]).filter((p) => p.active && p.customer_id).map((p) => p.customer_id!));
  const planSources = new Set(((plans ?? []) as { source_job_id: string | null }[]).map((p) => p.source_job_id).filter(Boolean) as string[]);

  function measure(m: Market, since: string, days: number): CityMetrics {
    const jobs = completed.filter((j) => inMarket(m, j.zip) && (j.completed_at ?? "") >= since);
    const mains = jobs.filter((j) => !j.remedy && !j.parent_job_id);
    // bookings = what customers were charged; our take comes after promo / Plus savings (those come out of our share)
    const bookings = mains.reduce((t, j) => t + Number(j.price_final ?? 0), 0);
    const take = mains.reduce((t, j) => t + Math.max(0, Number(j.price_final ?? 0) - Number(j.contractor_payout ?? 0)), 0);
    const refunded = jobs.reduce((t, j) => t + Number(j.amount_refunded ?? 0), 0);
    const cardFees = mains.reduce((t, j) => t + (Number(j.amount_paid ?? 0) > 0 ? Number(j.amount_paid) * CARD_FEE.pct + CARD_FEE.fixed : 0), 0);
    // fill: paid at least a day ago, needed a pro, not cancelled by the customer
    const dayAgo = new Date(now - 86400000).toISOString();
    const needed = paidJobs.filter((j) => inMarket(m, j.zip) && (j.paid_at ?? "") >= since && (j.paid_at ?? "") <= dayAgo && !(j.status === "cancelled" && j.cancel_reason === "customer"));
    const filled = needed.filter((j) => j.contractor_id);
    const hours = filled.flatMap((j) => {
      const os = offersBy.get(j.id) ?? [];
      const firstOffer = os.reduce((a, o) => (a && a < o.offered_at ? a : o.offered_at), "" as string);
      const won = os.find((o) => o.status === "accepted" && o.responded_at);
      return firstOffer && won ? [(Date.parse(won.responded_at!) - Date.parse(firstOffer)) / 3600000] : [];
    });
    const proList = ((pros ?? []) as { base_zip: string | null; zip: string | null; trades: string[] }[]).filter((p) => inMarket(m, p.base_zip ?? p.zip));
    const demand = new Map<string, number>();
    for (const j of [...mains, ...needed]) for (const t of getService(j.service_slug)?.trades ?? []) demand.set(t, (demand.get(t) ?? 0) + 1);
    const thinTrades = [...demand].filter(([t, n]) => n >= 5 && proList.filter((p) => p.trades.includes(t)).length < 2).map(([t]) => t);
    const byCustomer = new Map<string, JobRow[]>();
    for (const j of mains) byCustomer.set(who(j), [...(byCustomer.get(who(j)) ?? []), j]);
    const customers = [...byCustomer.values()];
    const repeat = customers.filter((js) => js.length >= 2 || js.some((j) => j.plan_id || (j.customer_id && planCustomers.has(j.customer_id))));
    const oneTime = customers.filter((js) => js.some((j) => !j.plan_id));
    const converted = oneTime.filter((js) => js.some((j) => planSources.has(j.id) || (j.customer_id && planCustomers.has(j.customer_id))));
    const rated = jobs.map((j) => rating.get(j.id)).filter((x): x is number => x !== undefined);
    return {
      days, completedJobs: mains.length, bookings, take, refunded, netTake: take - cardFees - refunded,
      fillRate: needed.length ? filled.length / needed.length : null, hoursToAssign: median(hours),
      activePros: proList.length, thinTrades,
      customers: customers.length, repeatRate: customers.length ? repeat.length / customers.length : null,
      planConversion: oneTime.length ? converted.length / oneTime.length : null,
      avgRating: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null, reviews: rated.length,
      redoRate: mains.length ? jobs.filter((j) => j.remedy).length / mains.length : null,
      aiDrivenRate: jobs.length ? jobs.filter((j) => !touched.has(j.id)).length / jobs.length : null,
    };
  }

  const cards: CityCard[] = ((markets ?? []) as Market[]).map((market) => {
    const m90 = measure(market, since90, 90), m30 = measure(market, since30, 30);
    return { market, m90, m30, score: scoreCity(m90, m30) };
  });
  const activeMarkets = cards.filter((c) => c.market.active);
  const bookings30 = activeMarkets.reduce((t, c) => t + c.m30.bookings, 0), take30 = activeMarkets.reduce((t, c) => t + c.m30.take, 0);
  // jobs outside every market's ZIPs (a sign a market's prefixes need updating, or demand for a new city)
  const outside = completed.filter((j) => (j.completed_at ?? "") >= since90 && !cards.some((c) => inMarket(c.market, j.zip)));
  const outsideByPrefix = new Map<string, number>();
  for (const j of outside) outsideByPrefix.set(j.zip.slice(0, 3), (outsideByPrefix.get(j.zip.slice(0, 3)) ?? 0) + 1);
  const launchedAt = (first?.[0] as { completed_at: string } | undefined)?.completed_at ?? ((markets ?? [])[0] as Market | undefined)?.created_at ?? null;
  return {
    cards,
    pace: planPace({ launchedAt, bookings30, take30, markets: activeMarkets.length }),
    launchedAt, outside: [...outsideByPrefix].sort((a, b) => b[1] - a[1]).slice(0, 8),
    services: SERVICES.length,
  };
}
