/*
 * FILE    : apps/web/components/BusinessPortal.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-04_1934 UTC
 * PURPOSE : Business account portal controls: add a property, edit access notes, invite colleagues,
 *           choose dedicated pros, set the billing email and ask for invoicing on terms.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/account/business", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return r.ok && j.ok !== false ? null : String(j.error ?? "Try again");
}

function useAct() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (body: Record<string, unknown>, after?: () => void) => { setBusy(true); setMsg(""); const e = await post(body); setBusy(false); if (e) setMsg(e); else { after?.(); router.refresh(); } };
  return { msg, busy, run };
}

export function AddProperty({ accountId }: { accountId: string }) {
  const blank = { name: "", address: "", city: "", state: "MI", zip: "", units: "", access_notes: "" };
  const [f, setF] = useState(blank);
  const { msg, busy, run } = useAct();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-6">
        <input className="input sm:col-span-2" placeholder="Name (e.g. Maple Court, Unit 4B)" value={f.name} onChange={set("name")} />
        <input className="input sm:col-span-2" placeholder="Street address" value={f.address} onChange={set("address")} />
        <input className="input" placeholder="City" value={f.city} onChange={set("city")} />
        <div className="flex gap-2"><input className="input w-14" value={f.state} maxLength={2} onChange={set("state")} aria-label="State" /><input className="input" placeholder="ZIP" inputMode="numeric" value={f.zip} onChange={set("zip")} /></div>
        <input className="input" placeholder="Units" inputMode="numeric" value={f.units} onChange={set("units")} />
        <input className="input sm:col-span-5" placeholder="Access notes (lockbox, gate code, parking, who to call)" value={f.access_notes} onChange={set("access_notes")} />
      </div>
      <button className="btn-primary" disabled={busy || f.name.length < 2 || f.address.length < 3 || !/^\d{5}$/.test(f.zip)} onClick={() => run({ action: "add_property", account_id: accountId, ...f, state: f.state.toUpperCase(), units: f.units ? Number(f.units) : null, access_notes: f.access_notes || null }, () => setF(blank))}>Add property</button>
      {msg && <span className="ml-2 text-sm text-rose-700">{msg}</span>}
    </div>
  );
}

export function PropertyActive({ accountId, id, active }: { accountId: string; id: string; active: boolean }) {
  const { busy, run } = useAct();
  return <button className="text-xs text-ink-soft underline" disabled={busy} onClick={() => run({ action: "update_property", account_id: accountId, id, active: !active })}>{active ? "Archive" : "Restore"}</button>;
}

export function InviteMember({ accountId }: { accountId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("booker");
  const { msg, busy, run } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input max-w-xs" type="email" placeholder="colleague@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <select className="input w-32" value={role} onChange={(e) => setRole(e.target.value)}><option value="booker">Can book</option><option value="admin">Admin</option></select>
      <button className="btn-ghost" disabled={busy || !email.includes("@")} onClick={() => run({ action: "add_member", account_id: accountId, email, role }, () => setEmail(""))}>Invite</button>
      {msg && <span className="text-sm text-rose-700">{msg}</span>}
      <span className="text-xs text-ink-soft">They sign in with that email to see this account.</span>
    </div>
  );
}

export function RemoveMember({ accountId, id }: { accountId: string; id: string }) {
  const { msg, busy, run } = useAct();
  return <span><button className="text-xs text-ink-soft underline" disabled={busy} onClick={() => run({ action: "remove_member", account_id: accountId, id })}>Remove</button>{msg && <span className="ml-1 text-xs text-rose-700">{msg}</span>}</span>;
}

export function DedicatedToggle({ accountId, contractorId, on }: { accountId: string; contractorId: string; on: boolean }) {
  const { msg, busy, run } = useAct();
  return <span><button className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? "bg-brand text-white" : "bg-paper text-ink"}`} disabled={busy} onClick={() => run({ action: "dedicated_pro", account_id: accountId, contractor_id: contractorId, on: !on })}>{on ? "★ Dedicated" : "☆ Make dedicated"}</button>{msg && <span className="ml-1 text-xs text-rose-700">{msg}</span>}</span>;
}

export function BillingEmail({ accountId, current }: { accountId: string; current: string }) {
  const [email, setEmail] = useState(current);
  const { msg, busy, run } = useAct();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className="input max-w-xs" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Billing email" />
      <button className="btn-ghost" disabled={busy || email === current || !email.includes("@")} onClick={() => run({ action: "billing_email", account_id: accountId, email })}>Save</button>
      {msg && <span className="text-sm text-rose-700">{msg}</span>}
    </div>
  );
}

export function RequestTerms({ accountId, requested }: { accountId: string; requested: boolean }) {
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(requested);
  const { msg, busy, run } = useAct();
  if (sent) return <p className="text-sm text-ink-soft">Invoicing requested. We review each account and will get back to you within 2 business days.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-soft">Book often? Ask for monthly invoicing (Net 15, 30 or 45). We approve it case by case, based on your history with us, with a credit limit.</p>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-md" placeholder="Optional: expected monthly volume, terms you need" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn-ghost" disabled={busy} onClick={() => run({ action: "request_terms", account_id: accountId, note: note || null }, () => setSent(true))}>Ask for invoicing</button>
      </div>
      {msg && <p className="text-sm text-rose-700">{msg}</p>}
    </div>
  );
}
