/*
 * FILE    : apps/web/components/PartnerUI.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0125 UTC
 * PURPOSE : Referral Partner Program controls: public sign-up form (/partners), copy-link, "send us a customer" and
 *           Stripe payout setup (/partner), and the staff controls in Hub → Partners.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, data: j as Record<string, unknown>, error: String(j.error ?? "Something went wrong — try again") };
}

export function PartnerSignUp({ kinds }: { kinds: [string, string][] }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", kind: "realtor", how: "", agree: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ code?: string; link?: string; existing?: boolean } | null>(null);
  if (done) return (
    <div className="card border-brand bg-brand-tint">
      <h3 className="text-lg font-bold">You&apos;re in 🎉</h3>
      {done.existing ? <p className="mt-2 text-sm">This email is already a partner. We just re-sent your code and partner page link — check your inbox.</p> : (
        <>
          <p className="mt-2 text-sm">Your partner code: <b className="font-mono text-base">{done.code}</b></p>
          <p className="mt-1 text-sm">Your link: <span className="select-all break-all font-mono">{done.link}</span></p>
          <CopyButton text={done.link ?? ""} />
          <p className="mt-3 text-sm">We emailed you a link to your partner page, where you can send customers directly, track earnings and set up payouts.</p>
        </>
      )}
    </div>
  );
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      const r = await post("/api/partners", f);
      setBusy(false);
      if (r.ok) setDone(r.data as never); else setErr(r.error);
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Your name<input className="input mt-1" required value={f.name} onChange={set("name")} /></label>
        <label className="text-sm">Email<input className="input mt-1" type="email" required value={f.email} onChange={set("email")} /></label>
        <label className="text-sm">Phone<input className="input mt-1" type="tel" value={f.phone} onChange={set("phone")} /></label>
        <label className="text-sm">Company (optional)<input className="input mt-1" value={f.company} onChange={set("company")} /></label>
      </div>
      <label className="block text-sm">I am a…<select className="input mt-1" value={f.kind} onChange={set("kind")}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="block text-sm">How will you refer people? (optional)<textarea className="input mt-1" rows={2} value={f.how} onChange={set("how")} placeholder="e.g. I list 40 homes a year and my sellers always need move-out cleans" /></label>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />I agree to the partner terms below.</label>
      <button className="btn-primary w-full" disabled={busy || !f.agree}>{busy ? "Signing you up…" : "Get my partner link"}</button>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </form>
  );
}

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn-ghost mt-2" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch { /* blocked */ } }}>{ok ? "Copied ✓" : label}</button>;
}

export function ReferCustomer({ services }: { services: [string, string][] }) {
  const router = useRouter();
  const blank = { name: "", email: "", phone: "", service_slug: "", note: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const r = await post("/api/partner", { action: "refer", ...f, service_slug: f.service_slug || null });
      setBusy(false);
      setMsg(r.ok ? { ok: true, text: `Sent. We emailed ${f.name.split(" ")[0]} a booking link — they're your customer for 12 months.` } : { ok: false, text: r.error });
      if (r.ok) { setF(blank); router.refresh(); }
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Customer&apos;s name<input className="input mt-1" required value={f.name} onChange={set("name")} /></label>
        <label className="text-sm">Their email<input className="input mt-1" type="email" required value={f.email} onChange={set("email")} /></label>
        <label className="text-sm">Their phone (optional)<input className="input mt-1" type="tel" value={f.phone} onChange={set("phone")} /></label>
        <label className="text-sm">What they need<select className="input mt-1" value={f.service_slug} onChange={set("service_slug")}><option value="">Not sure / several things</option>{services.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select></label>
      </div>
      <label className="block text-sm">Note for them (optional)<textarea className="input mt-1" rows={2} value={f.note} onChange={set("note")} placeholder="e.g. Closing on the 15th — they need a move-out clean the day before" /></label>
      <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send them to Handled"}</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-brand-dark" : "text-rose-700"}`}>{msg.text}</p>}
    </form>
  );
}

export function PartnerPayoutButton({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button className={ready ? "btn-ghost" : "btn-primary"} disabled={busy} onClick={async () => {
        setBusy(true); setErr(null);
        const r = await post("/api/partner", { action: "connect" });
        if (r.ok && r.data.url) window.location.href = String(r.data.url); else { setBusy(false); setErr(r.error); }
      }}>{busy ? "Opening Stripe…" : ready ? "Update payout details" : "Set up payouts (2 min)"}</button>
      {err && <p className="mt-1 text-sm text-rose-700">{err}</p>}
    </div>
  );
}

/** Hub → Partners: pause / reactivate a partner. */
export function PartnerStatusButton({ id, status }: { id: string; status: "active" | "suspended" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="btn-ghost px-3 py-1 text-xs" disabled={busy} onClick={async () => {
    if (status === "active" && !confirm("Pause this partner? They stop earning on new jobs until reactivated.")) return;
    setBusy(true); const r = await post("/api/hub/partners", { action: "status", id, status: status === "active" ? "suspended" : "active" }); setBusy(false);
    if (!r.ok) alert(r.error); router.refresh();
  }}>{status === "active" ? "Pause" : "Reactivate"}</button>;
}

/** Hub → Partners: credit a customer to a partner by hand, or remove a customer's partner. */
export function PartnerAssign({ partners }: { partners: [string, string][] }) {
  const router = useRouter();
  const [pid, setPid] = useState(partners[0]?.[0] ?? "");
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (body: unknown) => { const r = await post("/api/hub/partners", body); setMsg(r.ok ? "Saved." : r.error); if (r.ok) { setEmail(""); router.refresh(); } };
  return (
    <div className="flex flex-wrap items-end gap-2 text-sm">
      <label>Customer email<input className="input mt-1 w-64" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Partner<select className="input mt-1 w-56" value={pid} onChange={(e) => setPid(e.target.value)}>{partners.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
      <button className="btn-primary" disabled={!email || !pid} onClick={() => run({ action: "assign", partner_id: pid, email })}>Credit to partner</button>
      <button className="btn-ghost" disabled={!email} onClick={() => { if (confirm("Remove this customer's partner? Future jobs stop paying a commission.")) run({ action: "unassign", email }); }}>Remove partner</button>
      {msg && <span>{msg}</span>}
    </div>
  );
}

/** Hub → Partners: cancel an unpaid commission. */
export function VoidCommission({ id }: { id: string }) {
  const router = useRouter();
  return <button className="text-xs text-rose-700 underline" onClick={async () => {
    const note = prompt("Why are you cancelling this commission?");
    if (!note) return;
    const r = await post("/api/hub/partners", { action: "void", commission_id: id, note });
    if (!r.ok) alert(r.error); router.refresh();
  }}>Void</button>;
}
