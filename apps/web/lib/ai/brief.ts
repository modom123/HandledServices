/*
 * FILE    : apps/web/lib/ai/brief.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Daily AI operations brief (Vercel cron, 12:00 UTC). Summarizes yesterday,
 *           today's schedule, risks and the top actions for the team. Saved as an
 *           ops alert and emailed to OPS_EMAIL.
 */
import "server-only";
import { z } from "zod";
import { BRAND } from "@handled/core";
import { structured } from "./client";
import { adminClient } from "../supabase/server";

const BriefSchema = z.object({
  headline: z.string(),
  yesterday: z.array(z.string()),
  today: z.array(z.string()),
  risks: z.array(z.string()),
  actions: z.array(z.string()).describe("Top 3-5 things the team should do today, most important first"),
});
export type Brief = z.infer<typeof BriefSchema>;

export async function buildDailyBrief(): Promise<Brief | null> {
  const db = adminClient();
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const [created, todayJobs, open, alerts, apps, reviews] = await Promise.all([
    db.from("jobs").select("ref, service_slug, status, price_final, estimate_low, source").gte("created_at", y).lt("created_at", today),
    db.from("jobs").select("ref, service_slug, status, time_window, contractor_id, zip").eq("scheduled_date", today),
    db.from("jobs").select("ref, service_slug, status, scheduled_date, created_at").in("status", ["requested", "site_visit", "quoted", "scheduled", "dispatched", "qa_review"]),
    db.from("ops_alerts").select("severity, title").eq("resolved", false).limit(30),
    db.from("contractor_applications").select("business_name, trades, status").eq("status", "new"),
    db.from("reviews").select("rating, comment").gte("created_at", y),
  ]);
  return structured({
    kind: "daily_brief",
    schema: BriefSchema,
    system: `You write the morning operations brief for ${BRAND.name}'s owner and dispatch team. Be specific (job refs, counts, dollars). No fluff.`,
    content: JSON.stringify({
      date: today,
      bookings_yesterday: created.data, schedule_today: todayJobs.data, open_pipeline: open.data,
      unresolved_alerts: alerts.data, new_pro_applications: apps.data, reviews_yesterday: reviews.data,
    }),
    effort: "medium",
  });
}
