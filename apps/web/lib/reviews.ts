/*
 * FILE    : apps/web/lib/reviews.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Public customer reviews — every rating counts toward the average (no hiding bad
 *           ones); comments are shown with first name + last initial and city only, and anything
 *           that looks like a phone number or email is masked.
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { supabaseConfigured } from "./supabase/env";

export type PublicReview = { id: string; rating: number; comment: string | null; name: string; city: string | null; service: string; date: string };

const mask = (s: string) => s.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]");

export async function publicReviews(o: { slug?: string; limit?: number } = {}): Promise<{ count: number; average: number | null; list: PublicReview[] }> {
  if (!supabaseConfigured || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { count: 0, average: null, list: [] };
  const db = adminClient();
  let q = db.from("reviews").select("id, rating, comment, created_at, jobs!inner(service_slug, city, contact_name)").order("created_at", { ascending: false }).limit(500);
  if (o.slug) q = q.eq("jobs.service_slug", o.slug);
  const { data } = await q;
  type Row = { id: string; rating: number; comment: string | null; created_at: string; jobs: { service_slug: string; city: string | null; contact_name: string | null } };
  const rows = (data ?? []) as unknown as Row[];
  const count = rows.length;
  const average = count ? Math.round((rows.reduce((t, r) => t + r.rating, 0) / count) * 10) / 10 : null;
  const list = rows.filter((r) => r.comment?.trim()).slice(0, o.limit ?? 30).map((r) => {
    const parts = (r.jobs.contact_name ?? "Customer").trim().split(/\s+/);
    return { id: r.id, rating: r.rating, comment: mask(r.comment!.trim()).slice(0, 600), name: `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ""}`, city: r.jobs.city, service: r.jobs.service_slug, date: r.created_at.slice(0, 10) };
  });
  return { count, average, list };
}
