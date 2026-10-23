/*
 * FILE    : apps/web/lib/popular.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-23_0430 UTC
 * PURPOSE : The most popular services, for the home page's top buttons. Ranked by what we can deliver and what people
 *           order: approved pros whose trades cover the service (supply) and jobs booked in the last 90 days, cancelled
 *           ones left out (demand). A service with no approved pro and no orders never makes the list; empty slots are
 *           filled from MARKETING_FOCUS (also the full list when the database isn't connected). Cached 10 minutes.
 */
import "server-only";
import { MARKETING_FOCUS, SERVICES, getService, type Service } from "@handled/core";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

const DAYS = 90;
const ORDER_WEIGHT = 2; // an order counts for twice an approved pro: demand that's proven beats capacity

let cache: { at: number; n: number; list: Service[] } | null = null;

export async function popularServices(n = 4): Promise<Service[]> {
  if (cache && cache.n === n && Date.now() - cache.at < 10 * 60_000) return cache.list;
  const score = new Map<string, number>();
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const db = adminClient();
      const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
      const [{ data: pros }, { data: jobs }] = await Promise.all([
        db.from("contractors").select("trades").eq("status", "approved").limit(5000),
        db.from("jobs").select("service_slug").neq("status", "cancelled").gte("created_at", since).limit(20000),
      ]);
      for (const s of SERVICES) {
        const covered = (pros ?? []).filter((p) => ((p.trades ?? []) as string[]).some((tr) => s.trades.includes(tr))).length;
        if (covered) score.set(s.slug, covered);
      }
      for (const j of jobs ?? []) {
        const slug = j.service_slug as string;
        if (getService(slug)) score.set(slug, (score.get(slug) ?? 0) + ORDER_WEIGHT);
      }
    } catch { /* fall back to the marketing focus */ }
  }
  const focus = (slug: string) => { const i = MARKETING_FOCUS.services.indexOf(slug); return i < 0 ? 99 : i; }; // ties: focus first
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || focus(a[0]) - focus(b[0])).map(([slug]) => slug);
  const slugs = [...new Set([...ranked, ...MARKETING_FOCUS.services])].slice(0, n);
  const list = slugs.map((s) => getService(s)).filter((s): s is Service => Boolean(s));
  cache = { at: Date.now(), n, list };
  return list;
}
