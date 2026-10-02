/*
 * FILE    : apps/web/components/AccountExtras.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Account page client pieces: copy-my-referral-link, manage Handled Plus (Stripe
 *           portal), add a tip, and delete my account (type DELETE to confirm).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TIP_PRESETS, money } from "@handled/core";

async function post(url: string, body: unknown = {}) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return <button className="btn-primary" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setDone(true); }}>{done ? "Copied ✓" : "Copy my link"}</button>;
}

export function PlusButton({ member }: { member: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div>
      <button className={member ? "btn-ghost" : "btn-primary"} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await post(member ? "/api/plus/portal" : "/api/plus");
        setBusy(false);
        if (r.data.url) window.location.href = r.data.url; else setErr(r.data.error ?? "Try again");
      }}>{busy ? "One moment…" : member ? "Manage or cancel" : "Join Plus"}</button>
      {err && <p className="mt-1 text-sm text-rose-700">{err}</p>}
    </div>
  );
}

export function TipBox({ jobId, tipped }: { jobId: string; tipped: number }) {
  const router = useRouter();
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function tip(amount: number) {
    setBusy(true); setMsg("");
    const r = await post(`/api/account/jobs/${jobId}/tip`, { amount });
    setBusy(false);
    if (r.data.url) { window.location.href = r.data.url; return; }
    if (!r.ok) return setMsg(r.data.error ?? "Try again");
    setMsg(`Thank you! ${money(amount)} is on its way to your pro.`);
    router.refresh();
  }
  return (
    <div className="card">
      <div className="font-semibold">💚 Tip your pro</div>
      <p className="text-sm text-ink-soft">100% goes to your pro.{tipped ? ` You've tipped ${money(tipped)} so far.` : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {TIP_PRESETS.map((t) => <button key={t} className="btn-ghost" disabled={busy} onClick={() => tip(t)}>{money(t)}</button>)}
        <input className="input w-28" inputMode="decimal" placeholder="Other $" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^\d.]/g, ""))} />
        <button className="btn-primary" disabled={busy || !(Number(custom) >= 1)} onClick={() => tip(Number(custom))}>Tip</button>
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </div>
  );
}

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open) return <button className="text-sm text-rose-700 underline" onClick={() => setOpen(true)}>Delete my account</button>;
  return (
    <div className="card border-rose-200 bg-rose-50">
      <div className="font-semibold">Delete your account?</div>
      <p className="mt-1 text-sm text-ink-soft">This removes your login, profile, phone, saved devices and photos, and cancels any membership. We keep invoices and payment records (name and email only) because tax law requires it. This can’t be undone.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input className="input w-40" placeholder="Type DELETE" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn bg-rose-700 text-white hover:bg-rose-800" disabled={busy || text !== "DELETE"} onClick={async () => {
          setBusy(true); setErr("");
          const r = await post("/api/account/delete", { confirm: "DELETE" });
          setBusy(false);
          if (!r.ok) return setErr(r.data.error ?? "Couldn't delete — contact support");
          window.location.href = "/home?deleted=1";
        }}>{busy ? "Deleting…" : "Delete permanently"}</button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Keep my account</button>
      </div>
      {err && <p className="mt-2 text-sm text-rose-700">{err}</p>}
    </div>
  );
}
