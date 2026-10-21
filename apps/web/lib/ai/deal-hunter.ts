/*
 * FILE    : apps/web/lib/ai/deal-hunter.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-19_2330 UTC
 * PURPOSE : The Deal hunter — runs every morning (cron/daily-brief) and goes after business, not just reports on it:
 *             1. primes → partner leads: the best federal primes to subcontract under (gov_awards, subFit 60+) go on
 *                the Business leads call list as teaming partners, with phone, address and the pitch (5 a day)
 *             2. warm clicks → call list: anyone who clicked our email 3+ days ago and hasn't replied gets a call
 *             3. today's deal plan: Claude reads the whole pipeline (replies and the AI's read of them, clicks, the
 *                call list, today's government bids, bids due soon, prime targets) and writes the 10 actions most
 *                likely to close business today, each with a ready-to-use call script or message, plus new kinds of
 *                Detroit businesses to go after. Saved as an ops alert (kind 'deal_plan') and on each lead's history.
 *           It never sends email or texts on its own: people call and send; the sales engine and Instantly do the
 *           cold email within their own limits and opt-outs.
 */
import "server-only";
import { z } from "zod";
import { BRAND, BIZ_SEGMENTS, primeTargets, subPitch, type GovAward } from "@handled/core";
import { structured } from "./client";
import { adminClient } from "../supabase/server";

const db = () => adminClient();
const AGENT = "Deal hunter";
const DAY = 86400000;

async function event(leadId: string, kind: string, note: string | null) {
  await db().from("biz_lead_events").insert({ lead_id: leadId, kind, note, actor: AGENT });
}

/** The best primes to subcontract under go on the call list as teaming partners (never emailed automatically). */
async function promotePrimes(max = 5): Promise<number> {
  const { data } = await db().from("gov_awards").select("*").neq("status", "ignored").gte("sub_score", 60).order("sub_score", { ascending: false }).limit(300);
  const targets = primeTargets((data ?? []) as (GovAward & { sub_score: number })[]).filter((t) => t.best_score >= 60);
  let added = 0;
  for (const t of targets) {
    if (added >= max) break;
    const ext = t.uei ? `uei:${t.uei}` : `prime:${t.awardee.toLowerCase().slice(0, 80)}`;
    const [{ data: byId }, { data: byName }] = await Promise.all([
      db().from("biz_leads").select("id").eq("external_id", ext).limit(1).maybeSingle(),
      db().from("biz_leads").select("id").ilike("business_name", t.awardee.replace(/[\\%_]/g, "\\$&").slice(0, 160)).limit(1).maybeSingle(),
    ]);
    if (byId || byName) continue;
    const { data: row } = await db().from("biz_leads").insert({
      source: "manual", external_id: ext, business_name: t.awardee.slice(0, 160), phone: t.phone, city: t.places[0]?.split(",")[0] ?? null,
      segment: "partner", status: "call", score: t.best_score,
      notes: `Federal prime (${t.size === "O" ? "large business" : t.size === "S" ? "small business" : "size not listed"}${t.sub_plan ? ", has a subcontracting plan" : ""}): ${t.contracts} active contract(s) in ${t.naics.join(", ")} for ${t.agencies.slice(0, 2).join(", ")}. Ask for the small-business liaison.`,
    }).select("id").single();
    if (!row) continue;
    await event(row.id, "found", `Subcontract target from SAM.gov awards (score ${t.best_score}). Address: ${t.address ?? "—"}.\n\nPitch:\n${subPitch(t, { company: BRAND.name, city: "Detroit" })}`);
    added++;
  }
  return added;
}

/** Clicked the email 3+ days ago and never replied: that's a warm lead — call them. */
async function warmClicksToCalls(): Promise<number> {
  const cutoff = new Date(Date.now() - 3 * DAY).toISOString();
  const { data } = await db().from("biz_leads").select("id, phone").eq("status", "clicked").lt("last_contact_at", cutoff).limit(50);
  let n = 0;
  for (const l of data ?? []) {
    await db().from("biz_leads").update({ status: "call" }).eq("id", l.id);
    await event(l.id, "status:call", `Clicked our email but didn't reply in 3 days — call them${l.phone ? ` (${l.phone})` : " (find a phone number on their website)"}.`);
    n++;
  }
  return n;
}

const Plan = z.object({
  headline: z.string().describe("One line: where the deals are today"),
  actions: z.array(z.object({
    lead_id: z.string().nullable().describe("The lead's id from the data, or null for a bid or a new target"),
    who: z.string(),
    channel: z.enum(["call", "email", "linkedin", "visit", "bid"]),
    why: z.string().describe("Why this one, today — from the data"),
    script: z.string().describe("What to say or send: a short call opener or message, ready to use. No invented prices, discounts or claims."),
  })).max(10),
  new_targets: z.array(z.object({ type: z.string(), where: z.string(), why: z.string() })).max(5).describe("Kinds of Detroit-area businesses to add to the sales engine next"),
  owner_asks: z.array(z.string()).max(3).describe("Decisions or setup only the owner can do (e.g. turn on the sales engine, answer a hot reply)"),
});

/** The morning run: act on the pipeline, then write today's deal plan. */
export async function runDealHunter() {
  const primes = await promotePrimes().catch(() => 0);
  const calls = await warmClicksToCalls().catch(() => 0);
  const since14 = new Date(Date.now() - 14 * DAY).toISOString();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const soon = new Date(Date.now() + 14 * DAY).toISOString();
  const [{ data: all }, { data: hot }, { data: callList }, { data: aiReads }, { data: picks }, { data: bids }, { data: settings }] = await Promise.all([
    db().from("biz_leads").select("status").limit(20000),
    db().from("biz_leads").select("id, business_name, contact_name, email, phone, segment, city, status, last_contact_at").in("status", ["replied", "clicked"]).order("last_contact_at", { ascending: false }).limit(25),
    db().from("biz_leads").select("id, business_name, contact_name, phone, segment, city, score, notes").eq("status", "call").order("score", { ascending: false }).limit(15),
    db().from("biz_lead_events").select("lead_id, kind, note, created_at").like("kind", "ai:reply:%").gte("created_at", since14).order("created_at", { ascending: false }).limit(25),
    db().from("gov_opportunities").select("notice_id, title, response_deadline, fit_score, ai_summary").gte("picked_at", dayStart.toISOString()).neq("status", "passed").limit(10),
    db().from("bids").select("id, title, agency, due_at, status").in("status", ["draft", "pricing", "review"]).lte("due_at", soon).order("due_at", { ascending: true }).limit(10),
    db().from("biz_lead_settings").select("enabled, emails_per_day, discover_per_day, segments").eq("id", 1).maybeSingle(),
  ]);
  const byStatus = (all ?? []).reduce<Record<string, number>>((t, r) => ({ ...t, [r.status]: (t[r.status] ?? 0) + 1 }), {});
  const ids = new Set([...(hot ?? []), ...(callList ?? [])].map((l) => l.id as string));
  const plan = await structured({
    kind: "deal_hunter",
    schema: Plan,
    system:
      `You are ${BRAND.name}'s Deal hunter. Your job is to bring in business: pick the 10 actions most likely to turn into booked work or a signed contract today, best first. ` +
      "Hot replies first (use the AI's read of each reply), then warm clicks and the call list (teaming partners are federal primes: ask for the small-business liaison and offer to subcontract), then today's government bids and bids due soon. " +
      "Every action needs a concrete, short script a person can use as-is. Never invent prices, discounts, results, client names or deadlines — offer a free walkthrough or quote. " +
      "Only use lead ids that appear in the data. If the pipeline is thin, say so and use owner_asks to unblock it (e.g. turn on the sales engine in Hub → Business leads, set up the Instantly campaign, switch on the SAM.gov search).",
    content: JSON.stringify({
      today: new Date().toISOString().slice(0, 10),
      pipeline_by_status: byStatus,
      sales_engine: settings ?? "not set up",
      segments_available: Object.entries(BIZ_SEGMENTS).map(([k, v]) => `${k}: ${v.label}`),
      hot_leads: hot ?? [],
      ai_reads_of_replies: aiReads ?? [],
      call_list: callList ?? [],
      todays_government_bids: (picks ?? []).map((p) => ({ title: p.title, due: p.response_deadline, fit: p.fit_score, ai: (p.ai_summary as { recommendation?: string; summary?: string } | null) ?? null })),
      bids_due_in_14_days: bids ?? [],
      done_this_morning: { primes_added_to_call_list: primes, clicked_leads_moved_to_calls: calls },
    }),
    effort: "medium",
    maxTokens: 6000,
  });
  if (!plan) return { primes, calls, plan: null };
  for (const a of plan.actions) if (a.lead_id && ids.has(a.lead_id)) await event(a.lead_id, "ai:deal_plan", `${a.channel.toUpperCase()} today — ${a.why}\n\n${a.script}`).catch(() => null);
  const body = [
    plan.headline,
    `Done this morning: ${primes} federal prime(s) added to the call list as teaming partners; ${calls} lead(s) who clicked but didn't reply moved to the call list.`,
    `Today's actions:\n${plan.actions.map((a, i) => `${i + 1}. [${a.channel}] ${a.who} — ${a.why}\n   ${a.script.replace(/\n/g, "\n   ")}`).join("\n") || "- none"}`,
    plan.new_targets.length ? `Go after next:\n${plan.new_targets.map((t) => `- ${t.type} (${t.where}): ${t.why}`).join("\n")}` : "",
    plan.owner_asks.length ? `For the owner:\n${plan.owner_asks.map((x) => `- ${x}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  await db().from("ops_alerts").insert({ kind: "deal_plan", severity: "info", title: `Deal plan: ${plan.headline.slice(0, 120)}`, body });
  return { primes, calls, plan, body };
}
