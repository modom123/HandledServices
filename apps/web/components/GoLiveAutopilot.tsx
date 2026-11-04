/*
 * FILE    : apps/web/components/GoLiveAutopilot.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-04_1759 UTC
 * PURPOSE : Mastermind → Go-live setup: the autopilot card. Shows what it can fix right now (a preview worked out on
 *           the server), then "Run autopilot" makes the changes through the Vercel, Stripe, Twilio and Supabase APIs
 *           (lib/golive-autopilot.ts) and lists what happened.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = { id: string; title: string; status: "done" | "todo" | "skipped" | "failed" | "ok"; detail: string };
const ICON: Record<Step["status"], string> = { done: "✅", ok: "✓", todo: "🔧", skipped: "⏭️", failed: "❌" };

export function GoLiveAutopilot({ plan }: { plan: Step[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [err, setErr] = useState("");
  const shown = (steps ?? plan).filter((s) => s.status !== "ok");
  const todo = plan.filter((s) => s.status === "todo").length;
  async function run() {
    setBusy(true); setErr("");
    const r = await fetch("/api/hub/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "autopilot" }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(j.error ?? "Autopilot failed"); return; }
    setSteps(j.steps); router.refresh();
  }
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">🤖 Go-live autopilot</div>
          <p className="text-sm text-ink-soft">Fixes setup items through each provider’s API: generated secrets, site URL, Stripe webhook and billing portal, Twilio incoming texts, missing database migrations, the service catalog, then one redeploy.</p>
        </div>
        <button className="btn-primary" disabled={busy || (!todo && !steps)} onClick={run}>{busy ? "Working… (up to a few minutes)" : steps ? "Run again" : todo ? `Run autopilot (${todo} fix${todo === 1 ? "" : "es"})` : "Nothing to fix"}</button>
      </div>
      {err && <div className="text-sm text-red-700">{err}</div>}
      {shown.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {shown.map((s) => (
            <li key={s.id} className="flex flex-wrap justify-between gap-2 py-1.5"><span>{ICON[s.status]} {s.title}</span><span className="text-ink-soft">{s.detail}</span></li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-soft">Still by hand: API keys only you can copy from a provider (Stripe, Twilio, Anthropic…), and business &amp; legal items an API can’t prove. Agents and scripts can tick those with <code>POST /api/hub/checklist</code> and <code>Authorization: Bearer GOLIVE_API_KEY</code>.</p>
    </div>
  );
}
