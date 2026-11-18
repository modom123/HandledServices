/*
 * FILE    : apps/web/components/PayoutStatus.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_1700 UTC
 * PURPOSE : Admin payout controls. PayNowButton — Hub → Pros → (pro): send this pro's approved balance now (same checks as
 *           Monday; shows the exact reason if it can't). PayEveryoneButton — Hub → Money: run the payout for everyone
 *           now (finishes a run that was cut short, or pays before Monday). Both call /api/hub/payouts/run.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function run(body: object) {
  const r = await fetch("/api/hub/payouts/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, j: await r.json().catch(() => ({})) as Record<string, unknown> };
}

export function PayNowButton({ contractorId, owed }: { contractorId: string; owed: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-primary" disabled={busy || owed <= 0} onClick={async () => {
        if (!confirm(`Send ${money(owed)} to this pro's Stripe account now?`)) return;
        setBusy(true); setMsg("");
        const { j } = await run({ action: "pay_pro", contractorId });
        setBusy(false);
        setMsg(j.kind === "paid" ? `✓ Sent ${money(Number(j.amount))} (transfer ${j.transfer})` : j.kind === "nothing" ? "Nothing approved to pay." : `Not sent: ${String(j.why ?? j.error ?? "error")}`);
        router.refresh();
      }}>{busy ? "Paying…" : owed > 0 ? `Pay now · ${money(owed)}` : "Nothing to pay"}</button>
      {msg && <span className="text-sm" role="status">{msg}</span>}
    </div>
  );
}

export function PayEveryoneButton({ owed, pros }: { owed: number; pros: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-primary" disabled={busy || owed <= 0} onClick={async () => {
        if (!confirm(`Pay every pro with an approved balance now (${pros} pro(s), about ${money(owed)})?`)) return;
        setBusy(true); setMsg("");
        const { ok, j } = await run({ action: "pay_all" });
        setBusy(false);
        setMsg(ok ? `✓ Paid ${j.paid} pro(s), ${money(Number(j.total ?? 0))}${Number(j.waiting) ? ` · ${j.waiting} waiting on Stripe setup` : ""}${Number(j.failed) ? ` · ${j.failed} not sent (see Alerts)` : ""}${Number(j.notReached) ? ` · ${j.notReached} not reached — click again` : ""}` : String(j.error ?? "Couldn't run payouts"));
        router.refresh();
      }}>{busy ? "Paying everyone…" : "Pay everyone now"}</button>
      {msg && <span className="text-sm" role="status">{msg}</span>}
    </div>
  );
}
