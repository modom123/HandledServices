/*
 * FILE    : apps/web/lib/pro-prices.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Pros set their own prices (rules in core pro-rates.ts):
 *             myRates / saveRates — the pro's price card: every service their trades cover, their % (80–175) and minimum
 *                                   job, and the local market (how other pros price it) for each
 *             proRatesFor        — the pros a customer can pick for this job: priced the service, and would be offered
 *                                   it (dispatch's eligible(): approved, trade, license, insurance, background, area,
 *                                   day, probation size)
 *             chosenProPrice     — at booking: the chosen pro's price, recomputed from the server's suggested price
 */
import "server-only";
import { PRO_RATE_BAND, SERVICE_BY_SLUG, clampPct, eligible, proPrice, rateStats, type Contractor, type ProRateRow } from "@handled/core";
import { adminClient } from "./supabase/server";
import { zipCentroid } from "./geo";

const db = () => adminClient();

export interface MyRate { slug: string; name: string; pct: number | null; min_job: number | null; active: boolean; market: ReturnType<typeof rateStats> }

export async function myRates(contractorId: string): Promise<MyRate[]> {
  const { data: me } = await db().from("contractors").select("trades").eq("id", contractorId).single();
  const trades = (me?.trades ?? []) as string[];
  const services = Object.values(SERVICE_BY_SLUG).filter((s) => s.trades.some((t) => trades.includes(t)));
  if (!services.length) return [];
  const [{ data: mine }, { data: all }] = await Promise.all([
    db().from("pro_rates").select("service_slug, pct, min_job, active").eq("contractor_id", contractorId),
    db().from("pro_rates").select("service_slug, pct").eq("active", true).neq("contractor_id", contractorId).in("service_slug", services.map((s) => s.slug)),
  ]);
  const by = new Map((mine ?? []).map((r) => [r.service_slug as string, r]));
  return services.map((s) => {
    const r = by.get(s.slug);
    return { slug: s.slug, name: s.name, pct: r ? Number(r.pct) : null, min_job: r?.min_job != null ? Number(r.min_job) : null, active: r ? Boolean(r.active) : false, market: rateStats((all ?? []).filter((x) => x.service_slug === s.slug).map((x) => Number(x.pct))) };
  });
}

/** Save the pro's card. pct null = "use Handled's price" (the row is removed). Only services their trades cover. */
export async function saveRates(contractorId: string, items: { slug: string; pct: number | null; min_job: number | null; active: boolean }[]) {
  const allowed = new Set((await myRates(contractorId)).map((r) => r.slug));
  const keep = items.filter((i) => allowed.has(i.slug));
  const drop = keep.filter((i) => i.pct == null).map((i) => i.slug);
  if (drop.length) await db().from("pro_rates").delete().eq("contractor_id", contractorId).in("service_slug", drop);
  const rows = keep.filter((i) => i.pct != null).map((i) => ({ contractor_id: contractorId, service_slug: i.slug, pct: clampPct(i.pct!), min_job: i.min_job && i.min_job > 0 ? Math.round(i.min_job) : null, active: i.active, updated_at: new Date().toISOString() }));
  if (rows.length) { const { error } = await db().from("pro_rates").upsert(rows, { onConflict: "contractor_id,service_slug" }); if (error) throw new Error(error.message); }
  return { saved: rows.length, removed: drop.length };
}

/** Pros the customer can choose for this job (with their %), best rated first; up to `max`. */
export async function proRatesFor(o: { slug: string; zip: string; date?: string | null; window?: string | null; price?: number | null; customerType?: string | null }, max = 8): Promise<ProRateRow[]> {
  if (!SERVICE_BY_SLUG[o.slug] || !/^\d{5}$/.test(o.zip)) return [];
  const { data: rates } = await db().from("pro_rates").select("contractor_id, pct, min_job").eq("service_slug", o.slug).eq("active", true).limit(300);
  if (!rates?.length) return [];
  const [{ data: pros }, g] = await Promise.all([
    db().from("contractors").select("*").in("id", rates.map((r) => r.contractor_id)).eq("status", "approved"),
    zipCentroid(o.zip).catch(() => null),
  ]);
  const job = { service_slug: o.slug, zip: o.zip, scheduled_date: o.date ?? null, time_window: o.window ?? null, price_final: o.price ?? null, customer_type: o.customerType ?? null, lat: g?.lat ?? null, lng: g?.lng ?? null };
  const rateBy = new Map(rates.map((r) => [r.contractor_id as string, r]));
  return ((pros ?? []) as Contractor[])
    .filter((c) => eligible(c, job) === null)
    .map((c) => { const r = rateBy.get(c.id)!; return { pro_id: c.id, name: c.business_name, rating: Number(c.rating), jobs_completed: c.jobs_completed, on_time_rate: Number(c.on_time_rate), pct: Number(r.pct), min_job: r.min_job != null ? Number(r.min_job) : null }; })
    .sort((a, b) => b.rating - a.rating || b.jobs_completed - a.jobs_completed)
    .slice(0, max);
}

/** The chosen pro's price for this job, from the server's own suggested price. Null when they can't take it. */
export async function chosenProPrice(o: { slug: string; proId: string; suggested: number; zip: string; date?: string | null; window?: string | null; customerType?: string | null }) {
  const rows = await proRatesFor({ slug: o.slug, zip: o.zip, date: o.date, window: o.window, price: o.suggested, customerType: o.customerType }, 300);
  const r = rows.find((x) => x.pro_id === o.proId);
  if (!r) return null;
  return { ...proPrice(o.suggested, r.pct, o.slug, r.min_job), pct: r.pct, name: r.name, pro_id: r.pro_id };
}

export { PRO_RATE_BAND };
