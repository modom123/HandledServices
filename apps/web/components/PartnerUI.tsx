/*
 * FILE    : apps/web/components/PartnerUI.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0125 UTC
 * PURPOSE : Referral Partner Program controls: public sign-up form (/partners), copy-link, "send us a customer" and
 *           Stripe payout setup (/partner), and the staff controls in Hub → Partners.
 * UPDATED : 2026-10-28_0122 UTC — "send us a customer" is now the standard referral ticket; Hub ticket status buttons.
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

type Opt = [string, string][];

/**
 * The standard referral ticket (/partner). Every referral has the same questions, in the same order, so ops can act on
 * it without calling the partner back. Shows what the partner earns for the job type they pick.
 */
export function ReferralTicket({ services, jobTypes, timings, contacts, relationships }: { services: Opt; jobTypes: [string, string, string][]; timings: Opt; contacts: Opt; relationships: Opt }) {
  const router = useRouter();
  const blank = { name: "", email: "", phone: "", company: "", contact_pref: "call", best_time: "", address: "", city: "", zip: "", service_slug: "", job_type: "one_time", timing: "week", preferred_date: "", details: "", relationship: "client", note: "", consent: false };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const earns = jobTypes.find(([k]) => k === f.job_type)?.[2];
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const r = await post("/api/partner", { action: "ticket", ...f, service_slug: f.service_slug || null, preferred_date: f.timing === "date" ? f.preferred_date : null });
      setBusy(false);
      setMsg(r.ok ? { ok: true, text: `Ticket ${String(r.data.ticket_no ?? "")} sent. We emailed ${f.name.split(" ")[0]} a booking link from you and we'll reach out too — they're your customer for 12 months.` } : { ok: false, text: r.error });
      if (r.ok) { setF(blank); router.refresh(); }
    }}>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">1 · Customer</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Full name<input className="input mt-1" required value={f.name} onChange={set("name")} /></label>
          <label className="text-sm">Company (if a business)<input className="input mt-1" value={f.company} onChange={set("company")} /></label>
          <label className="text-sm">Email<input className="input mt-1" type="email" required value={f.email} onChange={set("email")} /></label>
          <label className="text-sm">Phone{f.contact_pref === "email" ? " (optional)" : ""}<input className="input mt-1" type="tel" required={f.contact_pref !== "email"} value={f.phone} onChange={set("phone")} /></label>
          <label className="text-sm">Best way to reach them<select className="input mt-1" value={f.contact_pref} onChange={set("contact_pref")}>{contacts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-sm">Best time (optional)<input className="input mt-1" value={f.best_time} onChange={set("best_time")} placeholder="e.g. weekdays after 5pm" /></label>
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">2 · Where</legend>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm">Street address (optional)<input className="input mt-1" value={f.address} onChange={set("address")} /></label>
          <label className="text-sm">City<input className="input mt-1" value={f.city} onChange={set("city")} /></label>
          <label className="text-sm">ZIP<input className="input mt-1" required inputMode="numeric" pattern="\d{5}" maxLength={5} value={f.zip} onChange={set("zip")} /></label>
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">3 · The job</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Service<select className="input mt-1" value={f.service_slug} onChange={set("service_slug")}><option value="">Not sure / several things</option>{services.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select></label>
          <label className="text-sm">Type of job<select className="input mt-1" value={f.job_type} onChange={set("job_type")}>{jobTypes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-sm">When they need it<select className="input mt-1" value={f.timing} onChange={set("timing")}>{timings.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {f.timing === "date" && <label className="text-sm">Date<input className="input mt-1" type="date" required value={f.preferred_date} onChange={set("preferred_date")} /></label>}
        </div>
        <label className="block text-sm">What needs doing (optional)<textarea className="input mt-1" rows={3} value={f.details} onChange={set("details")} placeholder="Size of the home or property, number of units, anything the pro should know" /></label>
        {earns && <p className="rounded-lg bg-brand-tint p-2 text-sm"><b>You earn:</b> {earns}.</p>}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">4 · You and them</legend>
        <label className="block text-sm">How you know them<select className="input mt-1" value={f.relationship} onChange={set("relationship")}>{relationships.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="block text-sm">Note for them (optional — goes in our email from you)<textarea className="input mt-1" rows={2} value={f.note} onChange={set("note")} placeholder="e.g. Closing on the 15th — they need a move-out clean the day before" /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />They agreed that I can share their details and that Handled may contact them about this job.</label>
      </fieldset>
      <button className="btn-primary" disabled={busy || !f.consent}>{busy ? "Sending…" : "Submit referral ticket"}</button>
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

/** Hub → Partners: move a referral ticket along (we reached out / closed / reopen). */
export function TicketStatusButtons({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const go = async (to: string) => {
    const note = to === "closed" ? prompt("Why is this ticket closed? (e.g. not interested, out of area)") : null;
    if (to === "closed" && !note) return;
    setBusy(true); const r = await post("/api/hub/partners", { action: "ticket", id, status: to, note }); setBusy(false);
    if (!r.ok) alert(r.error); router.refresh();
  };
  return (
    <span className="flex flex-wrap gap-1">
      {status === "submitted" && <button className="btn-ghost px-2 py-0.5 text-xs" disabled={busy} onClick={() => go("contacted")}>We reached out</button>}
      {status !== "closed" && <button className="btn-ghost px-2 py-0.5 text-xs" disabled={busy} onClick={() => go("closed")}>Close</button>}
      {status === "closed" && <button className="btn-ghost px-2 py-0.5 text-xs" disabled={busy} onClick={() => go("submitted")}>Reopen</button>}
    </span>
  );
}

/** Hub → Partners: cancel an unpaid commission. */
export function VoidCommission({ id }: { id: string }) {
  const router = useRouter();
  return <button className="text-xs text-rose-700 underline" onClick={async () => {
    const note = prompt("Why are you cancelling this commission? (the pro's half of the fee is handed back to them)");
    if (!note) return;
    const r = await post("/api/hub/partners", { action: "void", commission_id: id, note });
    if (!r.ok) alert(r.error); router.refresh();
  }}>Void</button>;
}
