/*
 * FILE    : apps/web/components/PartnerUI.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0125 UTC
 * PURPOSE : Referral Partner Program controls: public sign-up form (/partners), copy-link, "send us a customer" and
 *           Stripe payout setup (/partner), and the staff controls in Hub → Partners.
 * UPDATED : 2026-10-22_0400 UTC — referral ticket form (pros, clients, anyone), one-tap join for signed-in pros and clients,
 *           and Hub ticket controls (send the customer their link, cancel).
 * UPDATED : 2026-10-22_0500 UTC — photos on the referral ticket (camera / library / drag & drop, the service's photo tips).
 * UPDATED : 2026-10-22_0500 UTC — autofill: a ZIP fills city and state; a customer you've sent before fills their details.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { photoRule } from "@handled/core";
import { PhotoPicker } from "./PhotoPicker";

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

const FREQS: [string, string][] = [["once", "One time"], ["weekly", "Every week"], ["biweekly", "Every 2 weeks"], ["monthly", "Every month"], ["quarterly", "Every 3 months"]];
const WHEN: [string, string][] = [["", "Not sure"], ["asap", "As soon as possible"], ["this_week", "Within a week"], ["two_weeks", "Within 2 weeks"], ["month", "Within a month"], ["flexible", "Flexible"]];

/** /partner: a signed-in pro or client who isn't a partner yet joins in one tap. */
export function JoinPartner({ terms }: { terms: string[] }) {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-3 text-left">
      <ol className="list-decimal space-y-1 pl-5 text-xs text-ink-soft">{terms.map((t, i) => <li key={i}>{t}</li>)}</ol>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree to the partner terms above.</label>
      <button className="btn-primary w-full" disabled={!agree || busy} onClick={async () => {
        setBusy(true); setErr(null);
        const r = await post("/api/partner", { action: "join", agree: true });
        setBusy(false);
        if (r.ok) router.refresh(); else setErr(r.error);
      }}>{busy ? "Joining…" : "Join and start earning"}</button>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </div>
  );
}

/**
 * The referral ticket: everything about one job, so we can price it, book it and send a pro without calling anyone.
 * The AI files it (service, how often, sizes) and the customer gets a pre-filled booking link from you.
 */
export function ReferralTicket({ services, isPro, rates }: { services: [string, string][]; isPro: boolean; rates: { once: string; recurring: string; months: number } }) {
  const router = useRouter();
  const blank = { customer_name: "", customer_email: "", customer_phone: "", company_name: "", address: "", city: "", state: "MI", zip: "", service_slug: "", frequency: "once", urgency: "", budget: "", description: "", access_notes: "", customer_consent: false, i_will_do_it: false };
  const [f, setF] = useState(blank);
  const [photos, setPhotos] = useState<string[]>([]);
  const rule = f.service_slug ? photoRule(f.service_slug) : null;
  const [filled, setFilled] = useState<string | null>(null);
  // ZIP → city and state (only fills what's empty or what we filled last time)
  const zipFill = useRef<{ city: string; state: string } | null>(null);
  useEffect(() => {
    if (!/^\d{5}$/.test(f.zip)) return;
    let live = true;
    fetch(`/api/zip?zip=${f.zip}`).then((r) => r.json()).then((j: { city: string | null; state: string | null }) => {
      if (!live || !j.city || !j.state) return;
      setF((x) => {
        const prev = zipFill.current;
        const city = !x.city || x.city === prev?.city ? j.city! : x.city;
        const state = !x.state || x.state === "MI" || x.state === prev?.state ? j.state! : x.state;
        zipFill.current = { city: j.city!, state: j.state! };
        return { ...x, city, state };
      });
    }).catch(() => {});
    return () => { live = false; };
  }, [f.zip]);
  // a customer you've sent before → their name, phone and address from your earlier ticket (empty fields only)
  const lookup = async () => {
    if (!/\S+@\S+\.\S+/.test(f.customer_email)) return;
    const j = await fetch(`/api/partner?customer=${encodeURIComponent(f.customer_email)}`).then((r) => r.json()).catch(() => null) as { customer: Record<string, string | null> | null } | null;
    const c = j?.customer;
    if (!c) return;
    setF((x) => ({ ...x,
      customer_name: x.customer_name || c.customer_name || "", customer_phone: x.customer_phone || c.customer_phone || "", company_name: x.company_name || c.company_name || "",
      address: x.address || c.address || "", city: x.city || c.city || "", state: c.state && (!x.state || x.state === "MI") ? c.state : x.state, zip: x.zip || c.zip || "",
    }));
    setFilled("Filled in from your last referral for this customer — check it's still right.");
  };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; service: string | null; summary: string | null; missing: string[] } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  if (done) return (
    <div className="rounded-xl border border-brand bg-brand-tint p-4 text-sm">
      <h3 className="font-bold">Ticket received ✓</h3>
      {done.service && <p className="mt-1">Filed as <b>{done.service}</b>.</p>}
      {done.summary && <p className="mt-2">{done.summary}</p>}
      {done.missing.length > 0 && <p className="mt-2 text-ink-soft">We&apos;ll ask the customer: {done.missing.join(" ")}</p>}
      <p className="mt-2">{done.status === "open" ? "We emailed the customer a booking link with everything filled in. You'll hear from us when they book, when a pro is assigned and when it's done." : "Our team is reviewing it and will send the customer their booking link. You'll hear from us at every step."}</p>
      <button className="btn-ghost mt-3" onClick={() => { setDone(null); setF(blank); setPhotos([]); setFilled(null); zipFill.current = null; }}>Send another ticket</button>
    </div>
  );
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr(null);
      const r = await post("/api/partner", { action: "ticket", ...f, photos, service_slug: f.service_slug || null, urgency: f.urgency || null, budget: Number(f.budget) > 0 ? Number(f.budget) : null, company_name: f.company_name || null, i_will_do_it: isPro && f.i_will_do_it });
      setBusy(false);
      if (r.ok) { setDone(r.data as never); router.refresh(); } else setErr(r.error);
    }}>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">Who it&apos;s for</legend>
        <label className="text-sm">Customer&apos;s name<input className="input mt-1" required value={f.customer_name} onChange={set("customer_name")} /></label>
        <label className="text-sm">Their email<input className="input mt-1" type="email" required value={f.customer_email} onChange={set("customer_email")} onBlur={lookup} /></label>
        {filled && <p className="text-xs text-brand-dark sm:col-span-2">{filled}</p>}
        <label className="text-sm">Their phone<input className="input mt-1" type="tel" value={f.customer_phone} onChange={set("customer_phone")} /></label>
        <label className="text-sm">Company (if it&apos;s a business)<input className="input mt-1" value={f.company_name} onChange={set("company_name")} /></label>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-1 text-sm font-semibold">Where</legend>
        <label className="text-sm sm:col-span-2">Street address<input className="input mt-1" value={f.address} onChange={set("address")} /></label>
        <label className="text-sm">City<input className="input mt-1" value={f.city} onChange={set("city")} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">State<input className="input mt-1" maxLength={2} value={f.state} onChange={set("state")} /></label>
          <label className="text-sm">ZIP<input className="input mt-1" inputMode="numeric" maxLength={5} required pattern="\d{5}" value={f.zip} onChange={set("zip")} /></label>
        </div>
      </fieldset>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">The job</legend>
        <label className="text-sm">Service<select className="input mt-1" value={f.service_slug} onChange={set("service_slug")}><option value="">Not sure — let our AI pick</option>{services.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select></label>
        <label className="text-sm">How often<select className="input mt-1" value={f.frequency} onChange={set("frequency")}>{FREQS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm">When do they need it<select className="input mt-1" value={f.urgency} onChange={set("urgency")}>{WHEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm">Their budget (optional)<input className="input mt-1" inputMode="decimal" value={f.budget} onChange={set("budget")} placeholder="$" /></label>
        <label className="text-sm sm:col-span-2">Describe the job<textarea className="input mt-1" rows={4} required minLength={10} value={f.description} onChange={set("description")} placeholder="Size, rooms, square feet, condition, anything special. e.g. 3-bed, 2-bath house, deep clean before move-out on the 15th, two dogs, carpets on the stairs" /></label>
        <div className="text-sm sm:col-span-2">
          <div>Photos of the job (optional, up to 8) — they help us price it right and the customer won&apos;t have to take them again</div>
          {rule && rule.need !== "none" && <p className="mt-1 text-xs text-ink-soft">{rule.need === "required" ? `We need at least ${rule.min} for this service` : "Helpful"}: {rule.tips.join(" · ")}</p>}
          <div className="mt-2"><PhotoPicker value={photos} onChange={setPhotos} onError={setErr} /></div>
        </div>
        <label className="text-sm sm:col-span-2">Getting in (optional — only the assigned pro sees it)<input className="input mt-1" value={f.access_notes} onChange={set("access_notes")} placeholder="Gate code, lockbox, who'll be home" /></label>
      </fieldset>
      <p className="rounded-lg bg-paper p-3 text-xs text-ink-soft">You earn <b>{rates.once}%</b> of our fee on a one-time job, or <b>{rates.recurring}%</b> on every visit for {rates.months} months if they book it to repeat. Paid weekly once each job is past our make-it-right window. It never comes out of the pro&apos;s pay.</p>
      {isPro && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.i_will_do_it} onChange={(e) => setF({ ...f, i_will_do_it: e.target.checked })} />I&apos;d like to do this job myself — offer it to me first (if I&apos;m qualified and free, I get first look; otherwise it goes to other pros).</label>}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={f.customer_consent} onChange={(e) => setF({ ...f, customer_consent: e.target.checked })} />The customer asked me to send this job to Handled and knows they&apos;ll hear from us.</label>
      <button className="btn-primary" disabled={busy || !f.customer_consent}>{busy ? "Filing your ticket…" : "Submit referral ticket"}</button>
      {err && <p className="text-sm text-rose-700">{err}</p>}
    </form>
  );
}

/** Hub → Partners → Referral tickets: send (or re-send) the customer their link, or cancel the ticket. */
export function TicketActions({ id, status, service, services }: { id: string; status: string; service: string | null; services: [string, string][] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState(service ?? "");
  const run = async (body: Record<string, unknown>, ask?: string) => {
    if (ask && !confirm(ask)) return;
    setBusy(true); const r = await post("/api/hub/partners", { ...body, ticket_id: id }); setBusy(false);
    if (!r.ok) alert(r.error); router.refresh();
  };
  if (!["open", "needs_review"].includes(status)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {status === "needs_review" && <select className="input w-48 py-1 text-xs" value={slug} onChange={(e) => setSlug(e.target.value)}><option value="">Pick the service…</option>{services.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select>}
      <button className="btn-primary px-3 py-1 text-xs" disabled={busy || !slug} onClick={() => run({ action: "ticket_send", service_slug: slug })}>{status === "needs_review" ? "Approve & send link" : "Re-send link"}</button>
      <button className="text-xs text-rose-700 underline" disabled={busy} onClick={() => run({ action: "ticket_cancel" }, "Cancel this ticket? The customer's link stops working.")}>Cancel</button>
    </div>
  );
}
