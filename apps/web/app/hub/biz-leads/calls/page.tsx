/*
 * FILE    : apps/web/app/hub/biz-leads/calls/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0015 UTC
 * PURPOSE : Hub → Business leads → Call desk: today's calls in order (callbacks due, replies, clicks, teaming partners /
 *           federal primes, then cold calls with no email), each with tap-to-call, a script and one-tap outcomes; the
 *           day's dial goal and progress. Live calls by a person only (no autodialer, no recorded or AI voice, no texts).
 */
import Link from "next/link";
import { BIZ_PARTNER_LABEL, BIZ_PARTNER_SEGMENT, BIZ_SEGMENTS, CALL_OUTCOMES, DEFAULT_CALL_GOAL, callQueue, callScript, type BizSegment, type CallOutcome } from "@handled/core";
import { adminClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";
import { CallDesk, CallGoal, type CallCard } from "@/components/CallDesk";

export const dynamic = "force-dynamic";

type Lead = { id: string; business_name: string; contact_name: string | null; segment: string; status: string; phone: string | null; city: string | null; score: number; notes: string | null; next_call_at: string | null; call_attempts: number | null; last_call_outcome: string | null; last_called_at: string | null };

export default async function CallDeskPage() {
  const db = adminClient();
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  const [{ data }, { data: settings }, { data: todayCalls }] = await Promise.all([
    db.from("biz_leads").select("id, business_name, contact_name, segment, status, phone, city, score, notes, next_call_at, call_attempts, last_call_outcome, last_called_at").not("phone", "is", null).limit(5000),
    db.from("biz_lead_settings").select("call_goal").eq("id", 1).maybeSingle(),
    db.from("biz_lead_events").select("kind").like("kind", "call:%").gte("created_at", dayStart.toISOString()).limit(2000),
  ]);
  const queue = callQueue((data ?? []) as Lead[], new Date(), 60);
  // the Deal hunter's script for today, where it wrote one
  const { data: plans } = queue.length ? await db.from("biz_lead_events").select("lead_id, note").eq("kind", "ai:deal_plan").in("lead_id", queue.map((q) => q.id)).gte("created_at", new Date(Date.now() - 2 * 86400000).toISOString()).order("created_at", { ascending: false }) : { data: [] };
  const aiBy = new Map<string, string>();
  for (const p of plans ?? []) if (!aiBy.has(p.lead_id) && p.note) aiBy.set(p.lead_id, p.note);
  const goal = settings?.call_goal ?? DEFAULT_CALL_GOAL;
  const outcomes = (todayCalls ?? []).map((e) => e.kind.slice(5) as CallOutcome);
  const reached = outcomes.filter((o) => CALL_OUTCOMES[o]?.reached).length;
  const cards: CallCard[] = queue.map((l) => ({
    id: l.id, business_name: l.business_name, contact_name: l.contact_name, phone: l.phone!, city: l.city,
    segment_label: l.segment === BIZ_PARTNER_SEGMENT ? BIZ_PARTNER_LABEL : BIZ_SEGMENTS[l.segment as BizSegment]?.label ?? l.segment,
    reason: l.reason, attempts: l.call_attempts ?? 0, last_outcome: l.last_call_outcome, notes: l.notes, script: callScript(l), ai_script: aiBy.get(l.id) ?? null,
  }));
  return (
    <div className="space-y-6">
      <div>
        <Link href="/hub/biz-leads" className="text-sm text-brand hover:underline">← Business leads</Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Call desk</h1>
          <CallGoal goal={goal} />
        </div>
        <p className="max-w-3xl text-sm text-ink-soft">Today’s calls, best first: callbacks due, businesses that replied or clicked our email, federal primes to subcontract under, then cold calls to businesses with no email. Tap the number to call, use the script, and log the outcome with one tap. The next call is scheduled for you (skipping weekends), and nobody is called more than 6 times without an answer. Calls are made by a person — no autodialers, recorded or AI voices, or texts.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Dials today" value={`${outcomes.length} / ${goal}`} hint={goal ? `${Math.min(100, Math.round((outcomes.length / goal) * 100))}% of goal` : undefined} />
        <Stat label="Reached" value={reached} />
        <Stat label="Interested" value={outcomes.filter((o) => o === "interested").length} />
        <Stat label="In today’s queue" value={queue.length} />
      </div>
      <CallDesk cards={cards} />
    </div>
  );
}
