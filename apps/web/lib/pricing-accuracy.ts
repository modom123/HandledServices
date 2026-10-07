/*
 * FILE    : apps/web/lib/pricing-accuracy.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1255 UTC
 * PURPOSE : Loads what really happened on finished jobs (time on site, final price, work added,
 *           materials, refunds, ratings), offer outcomes and saved quotes for a period, and scores
 *           every service with core pricingAccuracy(). Feeds Hub → Pricing accuracy and the daily brief.
 */
import "server-only";
import { SERVICES, estimate, pricingAccuracy, type AccuracyInput, type AccuracyJob, type AccuracyRow } from "@handled/core";
import { adminClient } from "./supabase/server";
import { listPriceOf } from "./market";

type JobRow = {
  id: string; service_slug: string; answers: Record<string, unknown> | null; suggested_price: number | null; price_final: number | null;
  discount: number | null; member_benefit: number | null; scope_extra: number | null; amount_paid: number | null; amount_refunded: number | null;
  started_at: string | null; completed_at: string | null; frequency: string | null;
};

const estHours = (j: JobRow) => {
  try { return estimate({ slug: j.service_slug, answers: (j.answers ?? {}) as never }).hours || null; } catch { return null; }
};

export async function loadPricingAccuracy(days = 90): Promise<{ rows: AccuracyRow[]; since: string; days: number }> {
  const db = adminClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data: jobs }, { data: exp }, { data: rev }, { data: sig }, { data: quotes }, { data: factors }] = await Promise.all([
    db.from("jobs").select("id, service_slug, answers, suggested_price, price_final, discount, member_benefit, scope_extra, amount_paid, amount_refunded, started_at, completed_at, frequency")
      .eq("status", "completed").is("parent_job_id", null).gte("completed_at", since).limit(20000),
    db.from("job_expenses").select("job_id, amount").in("status", ["approved", "billed", "paid"]).gte("created_at", since).limit(20000),
    db.from("reviews").select("job_id, rating").gte("created_at", since).limit(20000),
    db.from("price_signals").select("service_slug, price, outcome, counter").gte("created_at", since).limit(50000),
    db.from("saved_quotes").select("service_slug, booked_job_id").gte("created_at", since).limit(50000),
    db.from("market_factors").select("service_slug, factor, manual_factor").eq("area", "all"),
  ]);
  const expBy = new Map<string, number>();
  for (const e of (exp ?? []) as { job_id: string; amount: number }[]) expBy.set(e.job_id, (expBy.get(e.job_id) ?? 0) + Number(e.amount));
  const rateBy = new Map(((rev ?? []) as { job_id: string; rating: number }[]).map((r) => [r.job_id, Number(r.rating)]));
  const fBy = new Map(((factors ?? []) as { service_slug: string; factor: number; manual_factor: number | null }[]).map((f) => [f.service_slug, Number(f.manual_factor ?? f.factor) || 1]));

  const inputs = new Map<string, AccuracyInput>(SERVICES.filter((s) => !s.siteVisit).map((s) => [s.slug, {
    slug: s.slug, factor: fBy.get(s.slug) ?? 1, jobs: [], quotes: { saved: 0, booked: 0 },
    signals: { accepted: 0, declined: 0, countered: 0, expired: 0, counterRatios: [] },
  }]));
  for (const j of (jobs ?? []) as JobRow[]) {
    const inp = inputs.get(j.service_slug);
    if (!inp) continue;
    const final = listPriceOf(j as never);
    if (!(final > 0)) continue;
    const hours = j.started_at && j.completed_at ? (Date.parse(j.completed_at) - Date.parse(j.started_at)) / 3600000 : null;
    const row: AccuracyJob = {
      suggested: Number(j.suggested_price ?? 0) || final, final, scopeExtra: Number(j.scope_extra ?? 0),
      refunded: Number(j.amount_refunded ?? 0), paid: Number(j.amount_paid ?? 0), estHours: estHours(j), actualHours: hours,
      expenses: expBy.get(j.id) ?? 0, rating: rateBy.get(j.id) ?? null,
    };
    inp.jobs.push(row);
  }
  for (const s of (sig ?? []) as { service_slug: string; price: number; outcome: "accepted" | "declined" | "countered" | "expired"; counter: number | null }[]) {
    const inp = inputs.get(s.service_slug);
    if (!inp) continue;
    inp.signals[s.outcome]++;
    if (s.outcome === "countered" && s.counter && Number(s.price) > 0) inp.signals.counterRatios.push(Number(s.counter) / Number(s.price));
  }
  for (const q of (quotes ?? []) as { service_slug: string; booked_job_id: string | null }[]) {
    const inp = inputs.get(q.service_slug);
    if (!inp) continue;
    inp.quotes.saved++;
    if (q.booked_job_id) inp.quotes.booked++;
  }
  return { rows: pricingAccuracy([...inputs.values()]), since, days };
}
