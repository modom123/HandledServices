/*
 * FILE    : apps/web/app/api/cron/daily-brief/route.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-03_0027 UTC — also sends seasonal reminders to past customers (once a day).
 * UPDATED : 2026-10-03_0123 UTC — pro standing sweep (written warnings, reviews, yearly background re-checks).
 * UPDATED : 2026-10-03_0149 UTC — market pricing: suggested prices learn from offer outcomes daily.
 * UPDATED : 2026-10-03_1255 UTC — Mondays: pricing-accuracy alert for services that are clearly mispriced.
 * PURPOSE : Vercel cron 12:00 UTC — AI morning brief to the ops dashboard + email.
 */
import { buildDailyBrief } from "@/lib/ai/brief";
import { sendDayBeforeReminders } from "@/lib/jobs";
import { sendSeasonalReminders } from "@/lib/reminders";
import { standingSweep } from "@/lib/standing";
import { refreshMarketFactors } from "@/lib/market";
import { loadPricingAccuracy } from "@/lib/pricing-accuracy";
import { adminClient } from "@/lib/supabase/server";
import { opsEmail, sendEmail } from "@/lib/notify";
import { BRAND } from "@handled/core";

export const maxDuration = 120;

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("Unauthorized", { status: 401 });
  const reminders = await sendDayBeforeReminders().catch((e) => { console.error("[reminders]", e); return 0; });
  const seasonal = await sendSeasonalReminders().catch((e) => { console.error("[seasonal]", e); return 0; }); // once a day
  const standing = await standingSweep().catch((e) => { console.error("[standing]", e); return null; }); // warnings, reviews, yearly re-checks
  const market = await refreshMarketFactors().catch((e) => { console.error("[market]", e); return null; }); // learn suggested prices from offers
  const pricing = new Date().getUTCDay() === 1 ? await pricingAlert().catch((e) => { console.error("[pricing-accuracy]", e); return null; }) : null; // weekly
  const brief = await buildDailyBrief();
  if (!brief) return Response.json({ ok: false, reason: "AI unavailable", reminders, seasonal, standing, market, pricing });
  const body = [`Yesterday:\n- ${brief.yesterday.join("\n- ")}`, `Today:\n- ${brief.today.join("\n- ")}`, `Risks:\n- ${brief.risks.join("\n- ")}`, `Actions:\n1. ${brief.actions.join("\n1. ")}`].join("\n\n");
  await adminClient().from("ops_alerts").insert({ kind: "daily_brief", severity: "info", title: brief.headline, body });
  if (opsEmail()) await sendEmail(opsEmail(), `${BRAND.name} brief: ${brief.headline}`, body);
  return Response.json({ ok: true, brief, reminders, seasonal, standing, market, pricing });
}

/** Weekly: services the pricing-accuracy report says are off, with at least medium confidence. */
async function pricingAlert() {
  const { rows } = await loadPricingAccuracy(90);
  const off = rows.filter((r) => (r.verdict === "underpriced" || r.verdict === "overpriced") && r.confidence !== "low");
  if (!off.length) return 0;
  const body = off.map((r) => `- ${r.name}: ${r.verdict}, ${r.change! > 1 ? "raise" : "lower"} ~${Math.round(Math.abs(r.change! - 1) * 100)}% (${r.metrics.jobs} jobs, ${r.confidence} confidence). ${r.evidence[0]?.reason ?? ""}`).join("\n");
  await adminClient().from("ops_alerts").insert({ kind: "pricing_accuracy", severity: "warn", title: `${off.length} service${off.length === 1 ? "" : "s"} look mispriced`, body: `${body}\n\nReview and apply in Hub → Pricing accuracy.` });
  return off.length;
}
