/*
 * FILE    : apps/web/components/DispatchActions.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-11_2242 UTC
 * PURPOSE : One-click dispatch actions for a row on Hub → Dispatch (and Hub → Payments): send offers, call the next backup,
 *           offer to every nearby pro, line up backups, assign a pro, reschedule, send a payment link or charge the saved
 *           card for a balance. Each calls the existing staff API (dispatch, coverage, jobs/[id]), so the same rules apply
 *           (no pro on unpaid work, staff only).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Pro = { id: string; name: string };
type Row = { id: string; contractorId: string | null; status: string; date: string | null; window: string | null; standby: number; payment: string; siteVisit: boolean };

async function call(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j: j as { error?: string; offers?: number; url?: string; called?: string | null; asked?: number } };
}

export function DispatchActions({ job, pros, payOnly = false }: { job: Row; pros: Pro[]; payOnly?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState<"assign" | "reschedule" | null>(null);
  const [pro, setPro] = useState("");
  const [date, setDate] = useState(job.date ?? "");
  const [win, setWin] = useState(job.window ?? "morning");
  const run = async (label: string, fn: () => ReturnType<typeof call>, done: (j: Awaited<ReturnType<typeof call>>["j"]) => string) => {
    if (busy) return;
    setBusy(true); setMsg(`${label}…`);
    const r = await fn().catch(() => ({ ok: false, j: { error: "Network error" } }));
    setBusy(false); setMsg(r.ok ? done(r.j) : r.j.error ?? "Failed");
    if (r.ok) { setOpen(null); router.refresh(); }
  };
  const noPro = !job.contractorId && !["completed", "cancelled", "qa_review", "requested"].includes(job.status);
  const btn = "rounded-lg border border-line px-2 py-1 text-xs font-semibold hover:border-brand disabled:opacity-50";

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {!payOnly && noPro && <button className={btn} disabled={busy} onClick={() => run("Sending offers", () => call("/api/hub/dispatch", "POST", { jobId: job.id, siteVisit: job.siteVisit }), (j) => `Offers sent: ${j.offers ?? 0}`)}>Send offers</button>}
        {!payOnly && noPro && job.standby > 0 && <button className={btn} disabled={busy} onClick={() => run("Calling backup", () => call("/api/hub/coverage", "POST", { action: "call_backup", job_id: job.id }), () => "Backup called")}>Call backup</button>}
        {!payOnly && noPro && <button className={btn} disabled={busy} onClick={() => run("Offering to everyone", () => call("/api/hub/coverage", "POST", { action: "offer_all", job_id: job.id }), (j) => `Offered to ${j.offers ?? 0} pros`)}>Offer to all</button>}
        {!payOnly && job.contractorId && job.standby < 3 && !["completed", "cancelled"].includes(job.status) && <button className={btn} disabled={busy} onClick={() => run("Asking backups", () => call("/api/hub/coverage", "POST", { action: "line_up", job_id: job.id }), (j) => `Asked ${j.asked ?? 0} pros to stand by`)}>Line up backups</button>}
        {!payOnly && !["completed", "cancelled"].includes(job.status) && <button className={btn} disabled={busy} onClick={() => setOpen(open === "assign" ? null : "assign")}>Assign…</button>}
        {!payOnly && !["completed", "cancelled"].includes(job.status) && <button className={btn} disabled={busy} onClick={() => setOpen(open === "reschedule" ? null : "reschedule")}>Reschedule…</button>}
        {["unpaid", "balance"].includes(job.payment) && <button className={btn} disabled={busy} onClick={() => run("Sending payment link", () => call(`/api/hub/jobs/${job.id}`, "PATCH", { send_payment_link: true }), () => "Payment link sent")}>Send payment link</button>}
        {job.payment === "balance" && <button className={btn} disabled={busy} onClick={() => run("Charging saved card", () => call(`/api/hub/jobs/${job.id}`, "PATCH", { charge_balance: true }), () => "Balance charged")}>Charge saved card</button>}
      </div>
      {open === "assign" && (
        <div className="flex flex-wrap items-center gap-1">
          <select className="input h-8 w-auto py-0 text-xs" value={pro} onChange={(e) => setPro(e.target.value)}>
            <option value="">{pros.length ? "Choose a pro…" : "No approved pro with this trade"}</option>
            {pros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className={btn} disabled={busy || !pro} onClick={() => run("Assigning", () => call(`/api/hub/jobs/${job.id}`, "PATCH", { contractor_id: pro }), () => "Assigned")}>Assign</button>
        </div>
      )}
      {open === "reschedule" && (
        <div className="flex flex-wrap items-center gap-1">
          <input type="date" className="input h-8 w-auto py-0 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
          <select className="input h-8 w-auto py-0 text-xs" value={win} onChange={(e) => setWin(e.target.value)}>
            {["morning", "midday", "afternoon", "flexible"].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button className={btn} disabled={busy || !/^\d{4}-\d{2}-\d{2}$/.test(date)} onClick={() => run("Saving", () => call(`/api/hub/jobs/${job.id}`, "PATCH", { scheduled_date: date, time_window: win, note: `Rescheduled to ${date} (${win}) from Dispatch` }), () => "Rescheduled — tell the customer and pro in Messages")}>Save</button>
        </div>
      )}
      {msg && <p className="text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
