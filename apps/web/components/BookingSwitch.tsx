/*
 * FILE    : apps/web/components/BookingSwitch.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-12_0032 UTC
 * PURPOSE : Hub → Dispatch switch (client): "Take bookings where no pro covers the area yet". Admins flip it
 *           (POST /api/hub/site { action: "booking_without_pro", on }); dispatchers see the current setting.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BookingSwitch({ on: initial, canChange, waiting }: { on: boolean; canChange: boolean; waiting: number }) {
  const router = useRouter();
  const [on, setOn] = useState(initial), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const flip = async () => {
    const next = !on;
    if (!next && !confirm("Turn off? Customers in areas with no pro will only be able to join the waitlist.")) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/hub/site", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "booking_without_pro", on: next }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Failed");
    setOn(next); router.refresh();
  };
  return (
    <div className={`card flex flex-wrap items-center justify-between gap-3 ${on ? "" : "border-amber-300 bg-amber-50"}`}>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">Take bookings where no pro covers the area yet</div>
        <p className="text-xs text-ink-soft">{on
          ? "On: customers book and pay anywhere we serve; you get an alert to recruit or line up a pro, and can cancel with a full refund if nobody can go."
          : "Off: customers where no pro covers their ZIP can only join the waitlist."}
          {waiting > 0 && <> · <b>{waiting} open job{waiting === 1 ? "" : "s"} in areas with no pro alert</b></>}</p>
        {msg && <p className="text-xs text-rose-700">{msg}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label="Take bookings where no pro covers the area yet" disabled={!canChange || busy} onClick={flip}
        title={canChange ? undefined : "Admins change this"}
        className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-60 ${on ? "bg-brand" : "bg-slate-300"}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
      </button>
      {!canChange && <span className="w-full text-xs text-ink-soft">Only admins can change this.</span>}
    </div>
  );
}
