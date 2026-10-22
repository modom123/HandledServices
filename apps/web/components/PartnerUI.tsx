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
 * UPDATED : 2026-10-22_0600 UTC — the Standard Referral Ticket (RT-1): six sections for every referral, the service's own size
 *           questions and photo rules, a live completeness meter and "still needed" list (the same check the server runs).
 * UPDATED : 2026-10-22_0800 UTC — SendTicketInvite asPartner: pros and partners send invites from their partner page.
 * UPDATED : 2026-10-22_0700 UTC — invite mode (/ticket/<token>, sent after a phone call): "About you" filled in from the call,
 *           partner terms, "just join" with no job; joining signs them up for the Handled network.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BEST_TIMES, CONTACT_PREFS, OCCUPANCY, PROPERTY_TYPES, TICKET_RELATIONSHIPS, TICKET_SECTIONS, TICKET_STANDARD_VERSION, getService, photoRule, questionVisible, ticketCheck, type Answers, type Question, type TicketDetails } from "@handled/core";
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

/** One question from the service catalog (the same size and detail questions the customer answers at booking). */
function ServiceQuestion({ q, value, onChange }: { q: Question; value: Answers[string]; onChange: (v: string | number | boolean | undefined) => void }) {
  if (q.type === "toggle") return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />{q.label}</label>;
  if (q.type === "select") return <label className="text-sm">{q.label}<select className="input mt-1" value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value || undefined)}><option value="">Choose…</option>{q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  return <label className="text-sm">{q.label}{q.unit ? ` (${q.unit})` : ""}{q.required ? " *" : ""}<input className="input mt-1" inputMode="decimal" value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Math.min(q.max, Math.max(q.min, Number(e.target.value) || 0)))} placeholder={q.help ?? ""} /></label>;
}

/**
 * The Standard Referral Ticket (RT-1, packages/core/src/referral-ticket.ts): the same six sections for every referral,
 * so each one arrives with what a pro needs. The service's own size questions and photo rules are built in; the meter
 * and the "still needs" list come from the same check the server runs. The AI files it and the customer gets a
 * pre-filled booking link from you.
 */
export type TicketInvite = { token: string; me: { name: string; email: string; phone: string; company: string; kind: string }; jobHint: string | null; kinds: [string, string][]; terms: string[] };

export function ReferralTicket({ services, isPro, rates, invite, afterDone }: { services: [string, string][]; isPro: boolean; rates: { once: string; recurring: string; months: number }; invite?: TicketInvite; afterDone?: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState(invite?.me ?? { name: "", email: "", phone: "", company: "", kind: "other" });
  const [agree, setAgree] = useState(false);
  const [joinedOnly, setJoinedOnly] = useState(false);
  const meOk = me.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(me.email) && agree;
  const blank = { customer_name: "", customer_email: "", customer_phone: "", company_name: "", address: "", city: "", state: "MI", zip: "", service_slug: "", frequency: "once", urgency: "", budget: "", description: invite?.jobHint ?? "", access_notes: "", customer_consent: false, customer_expects_contact: false, i_will_do_it: false };
  const blankD = { relationship: "", preferred_contact: "", best_time: "", property_type: "", occupancy: "", pets: "", parking: "", preferred_date: "", decision_maker: false };
  const [f, setF] = useState(blank);
  const [d, setD] = useState(blankD);
  const [answers, setAnswers] = useState<Answers>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ status: string; service: string | null; summary: string | null; missing: string[] } | null>(null);
  const [filled, setFilled] = useState<string | null>(null);
  const svc = f.service_slug ? getService(f.service_slug) : null;
  const rule = svc ? photoRule(svc.slug) : null;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const setDet = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  const details = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v === "" ? null : v])) as Partial<TicketDetails>;
  const check = ticketCheck({ ...f, budget: Number(f.budget) || null, service_slug: f.service_slug || null, answers, photos, details });
  // ZIP → city and state (only fills what's empty or what we filled last time)
  const zipFill = useRef<{ city: string; state: string } | null>(null);
  useEffect(() => {
    if (!/^\d{5}$/.test(f.zip)) return;
    let live = true;
    fetch(`/api/zip?zip=${f.zip}`).then((r) => r.json()).then((j: { city: string | null; state: string | null }) => {
      if (!live || !j.city || !j.state) return;
      setF((x) => {
        const prev = zipFill.current;
        zipFill.current = { city: j.city!, state: j.state! };
        return { ...x, city: !x.city || x.city === prev?.city ? j.city! : x.city, state: !x.state || x.state === "MI" || x.state === prev?.state ? j.state! : x.state };
      });
    }).catch(() => {});
    return () => { live = false; };
  }, [f.zip]);
  // a new service starts from its own questions
  useEffect(() => { setAnswers({}); }, [f.service_slug]);
  // a customer you've sent before → their name, phone and address from your earlier ticket (empty fields only)
  const lookup = async () => {
    if (invite || !/\S+@\S+\.\S+/.test(f.customer_email)) return;
    const j = await fetch(`/api/partner?customer=${encodeURIComponent(f.customer_email)}`).then((r) => r.json()).catch(() => null) as { customer: Record<string, string | null> | null } | null;
    const c = j?.customer;
    if (!c) return;
    setF((x) => ({ ...x,
      customer_name: x.customer_name || c.customer_name || "", customer_phone: x.customer_phone || c.customer_phone || "", company_name: x.company_name || c.company_name || "",
      address: x.address || c.address || "", city: x.city || c.city || "", state: c.state && (!x.state || x.state === "MI") ? c.state : x.state, zip: x.zip || c.zip || "",
    }));
    setFilled("Filled in from your last referral for this customer — check it's still right.");
  };
  const reset = () => { setDone(null); setF(blank); setD(blankD); setAnswers({}); setPhotos([]); setFilled(null); zipFill.current = null; };
  if (joinedOnly) return (
    <div className="rounded-xl border border-brand bg-brand-tint p-4 text-sm">
      <h3 className="font-bold">You&apos;re in the Handled network 🎉</h3>
      <p className="mt-2">We emailed {me.email} your partner link and a one-tap sign-in to your partner page. Send us a job any time from there — you earn {rates.once}% on a one-time job and {rates.recurring}% on every visit of a recurring one.</p>
      {afterDone}
    </div>
  );
  if (done) return (
    <div className="rounded-xl border border-brand bg-brand-tint p-4 text-sm">
      {invite && <p className="mb-2 font-semibold">You&apos;re in the Handled network 🎉 — we emailed {me.email} your partner link and a one-tap sign-in.</p>}
      <h3 className="font-bold">Ticket received ✓</h3>
      {done.service && <p className="mt-1">Filed as <b>{done.service}</b>.</p>}
      {done.summary && <p className="mt-2">{done.summary}</p>}
      {done.missing.length > 0 && <p className="mt-2 text-ink-soft">We&apos;ll ask the customer: {done.missing.join(" ")}</p>}
      <p className="mt-2">{done.status === "open" ? "We emailed the customer a booking link with everything filled in. You'll hear from us when they book, when a pro is assigned and when it's done." : "Our team is reviewing it and will send the customer their booking link. You'll hear from us at every step."}</p>
      {invite ? afterDone : <button className="btn-ghost mt-3" onClick={reset}>Send another ticket</button>}
    </div>
  );
  const sendInvite = async (withTicket: boolean) => {
    if (!meOk) return setErr("Fill in your name and email and agree to the partner terms.");
    if (withTicket && check.required.length) return setErr(`Still needed: ${check.required.join("; ")}.`);
    setBusy(true); setErr(null);
    const r = await post("/api/ticket-invite", { token: invite!.token, me: { ...me, phone: me.phone || null, company: me.company || null }, agree: true, ticket: withTicket ? ticketBody() : null });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    const d = r.data as { ticket: { status: string; service: string | null; summary: string | null; missing: string[] } | null; ticketError: string | null };
    if (!withTicket) return setJoinedOnly(true);
    if (d.ticket) setDone(d.ticket); else setErr(`You're signed up ✓ — but the ticket needs a fix: ${d.ticketError ?? "check the form"}`);
  };
  function ticketBody() {
    return { ...f, photos, answers: Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== undefined)), details, service_slug: f.service_slug || null, urgency: f.urgency || null, budget: Number(f.budget) > 0 ? Number(f.budget) : null, company_name: f.company_name || null, i_will_do_it: isPro && f.i_will_do_it };
  }
  const opts = (o: Record<string, string>) => Object.entries(o).map(([v, l]) => <option key={v} value={v}>{l}</option>);
  const head = (id: string) => { const s = TICKET_SECTIONS.find((x) => x.id === id)!; return <legend className="mb-1 text-sm font-semibold">{s.title} <span className="font-normal text-ink-soft">— {s.why}</span></legend>; };
  const visible = svc ? svc.questions.filter((q) => questionVisible(q, answers, svc.questions)) : [];
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault();
      if (invite) return sendInvite(true);
      if (check.required.length) return setErr(`Still needed: ${check.required.join("; ")}.`);
      setBusy(true); setErr(null);
      const r = await post("/api/partner", { action: "ticket", ...ticketBody() });
      setBusy(false);
      if (r.ok) { setDone(r.data as never); router.refresh(); } else setErr(r.error);
    }}>
      <div className="sticky top-16 z-10 rounded-lg border border-line bg-paper-deep/95 p-3 text-xs backdrop-blur">
        <div className="flex items-center justify-between gap-2"><b>Standard Referral Ticket {TICKET_STANDARD_VERSION}</b><span>{check.score}% complete</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded bg-line"><div className={`h-full ${check.required.length ? "bg-amber-500" : "bg-brand"}`} style={{ width: `${check.score}%` }} /></div>
        {check.required.length > 0 ? <p className="mt-1 text-amber-800">Still needed: {check.required.join(" · ")}</p> : check.recommended.length > 0 ? <p className="mt-1 text-ink-soft">Ready to send. Even better with: {check.recommended.slice(0, 4).join(" · ")}</p> : <p className="mt-1 text-brand-dark">Complete ✓</p>}
      </div>

      {invite && (
        <fieldset className="grid gap-3 rounded-xl border border-brand p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">About you <span className="font-normal text-ink-soft">— filled in from our call; this signs you up for the Handled network (free)</span></legend>
          <label className="text-sm">Your name *<input className="input mt-1" value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} /></label>
          <label className="text-sm">Your email *<input className="input mt-1" type="email" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} /></label>
          <label className="text-sm">Your mobile<input className="input mt-1" type="tel" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} /></label>
          <label className="text-sm">Company (optional)<input className="input mt-1" value={me.company} onChange={(e) => setMe({ ...me, company: e.target.value })} /></label>
          <label className="text-sm sm:col-span-2">I am a…<select className="input mt-1" value={me.kind} onChange={(e) => setMe({ ...me, kind: e.target.value })}>{invite.kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <details className="text-xs text-ink-soft sm:col-span-2"><summary className="cursor-pointer">Partner terms</summary><ol className="mt-1 list-decimal space-y-1 pl-5">{invite.terms.map((t, i) => <li key={i}>{t}</li>)}</ol></details>
          <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree to the partner terms. *</label>
          <div className="sm:col-span-2"><button type="button" className="btn-ghost text-sm" disabled={busy || !meOk} onClick={() => sendInvite(false)}>No job right now — just sign me up</button></div>
        </fieldset>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-2">{head("referrer")}
        <label className="text-sm">How you know the customer *<select className="input mt-1" required value={d.relationship} onChange={setDet("relationship")}><option value="">Choose…</option>{opts(TICKET_RELATIONSHIPS)}</select></label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">{head("customer")}
        <label className="text-sm">Full name *<input className="input mt-1" required value={f.customer_name} onChange={set("customer_name")} /></label>
        <label className="text-sm">Email *<input className="input mt-1" type="email" required value={f.customer_email} onChange={set("customer_email")} onBlur={lookup} /></label>
        {filled && <p className="text-xs text-brand-dark sm:col-span-2">{filled}</p>}
        <label className="text-sm">Mobile phone *<input className="input mt-1" type="tel" required value={f.customer_phone} onChange={set("customer_phone")} /></label>
        <label className="text-sm">Best way to reach them *<select className="input mt-1" required value={d.preferred_contact} onChange={setDet("preferred_contact")}><option value="">Choose…</option>{opts(CONTACT_PREFS)}</select></label>
        <label className="text-sm">Best time to reach them<select className="input mt-1" value={d.best_time} onChange={setDet("best_time")}><option value="">Not sure</option>{opts(BEST_TIMES)}</select></label>
        <label className="text-sm">Company (if it&apos;s a business)<input className="input mt-1" value={f.company_name} onChange={set("company_name")} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={d.decision_maker} onChange={(e) => setD({ ...d, decision_maker: e.target.checked })} />They can approve and pay for the work (owner, manager, or the person in charge)</label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-4">{head("location")}
        <label className="text-sm sm:col-span-2">Street address *<input className="input mt-1" required value={f.address} onChange={set("address")} /></label>
        <label className="text-sm">ZIP *<input className="input mt-1" inputMode="numeric" maxLength={5} required pattern="\d{5}" value={f.zip} onChange={set("zip")} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">City *<input className="input mt-1" required value={f.city} onChange={set("city")} /></label>
          <label className="text-sm">State *<input className="input mt-1" maxLength={2} required value={f.state} onChange={set("state")} /></label>
        </div>
        <label className="text-sm sm:col-span-2">Type of property *<select className="input mt-1" required value={d.property_type} onChange={setDet("property_type")}><option value="">Choose…</option>{opts(PROPERTY_TYPES)}</select></label>
        <label className="text-sm sm:col-span-2">Occupied or empty<select className="input mt-1" value={d.occupancy} onChange={setDet("occupancy")}><option value="">Not sure</option>{opts(OCCUPANCY)}</select></label>
        <label className="text-sm sm:col-span-2">Getting in (only the assigned pro sees it)<input className="input mt-1" value={f.access_notes} onChange={set("access_notes")} placeholder="Gate code, lockbox, who'll be home" /></label>
        <label className="text-sm">Parking<input className="input mt-1" value={d.parking} onChange={setDet("parking")} placeholder="Driveway, street…" /></label>
        <label className="text-sm">Pets<input className="input mt-1" value={d.pets} onChange={setDet("pets")} placeholder="None / two dogs…" /></label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">{head("job")}
        <label className="text-sm">Service *<select className="input mt-1" value={f.service_slug} onChange={set("service_slug")}><option value="">Not sure — let our AI pick</option>{services.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select></label>
        <label className="text-sm">How often *<select className="input mt-1" required value={f.frequency} onChange={set("frequency")}>{FREQS.filter(([v]) => !svc || svc.frequencies.includes(v as never)).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="text-sm sm:col-span-2">What needs doing * <span className="text-xs text-ink-soft">({f.description.trim().length}/30+ characters)</span><textarea className="input mt-1" rows={4} required minLength={30} value={f.description} onChange={set("description")} placeholder="Size, rooms, condition, anything special. e.g. 3-bed, 2-bath house, deep clean before move-out on the 15th, carpets on the stairs" /></label>
        {visible.length > 0 && (
          <div className="grid gap-3 rounded-lg border border-line p-3 sm:col-span-2 sm:grid-cols-2">
            <div className="text-xs font-semibold text-ink-soft sm:col-span-2">{svc!.name}: size and details (the same questions the customer answers — fill in what you know)</div>
            {visible.map((q) => <ServiceQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />)}
          </div>
        )}
        <label className="text-sm">When they need it *<select className="input mt-1" required value={f.urgency} onChange={set("urgency")}>{WHEN.map(([v, l]) => <option key={v} value={v}>{v ? l : "Choose…"}</option>)}</select></label>
        <label className="text-sm">A date they&apos;d like<input className="input mt-1" type="date" value={d.preferred_date} onChange={setDet("preferred_date")} /></label>
        <label className="text-sm">Their budget<input className="input mt-1" inputMode="decimal" value={f.budget} onChange={set("budget")} placeholder="$" /></label>
      </fieldset>

      <fieldset className="text-sm">{head("photos")}
        {rule && rule.need !== "none" && <p className="mb-2 text-xs text-ink-soft">{rule.need === "required" ? `Required for ${svc!.name}: at least ${rule.min}` : "Helpful"} — {rule.tips.join(" · ")}</p>}
        <PhotoPicker value={photos} onChange={setPhotos} onError={setErr} />
      </fieldset>

      <fieldset className="space-y-2">{head("confirm")}
        <p className="rounded-lg bg-paper p-3 text-xs text-ink-soft">You earn <b>{rates.once}%</b> of our fee on a one-time job, or <b>{rates.recurring}%</b> on every visit for {rates.months} months if they book it to repeat. Paid weekly once each job is past our make-it-right window. The bonus is shared: half from Handled, half from the pro who does the job.</p>
        {isPro && <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.i_will_do_it} onChange={(e) => setF({ ...f, i_will_do_it: e.target.checked })} />I&apos;d like to do this job myself — offer it to me first (if I&apos;m qualified and free, I get first look; otherwise it goes to other pros).</label>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={f.customer_consent} onChange={(e) => setF({ ...f, customer_consent: e.target.checked })} />The customer asked me to send this job to Handled. *</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={f.customer_expects_contact} onChange={(e) => setF({ ...f, customer_expects_contact: e.target.checked })} />They know Handled will email, text or call them about it. *</label>
      </fieldset>
      <button className="btn-primary" disabled={busy || check.required.length > 0 || Boolean(invite && !meOk)}>{busy ? "Filing your ticket…" : invite ? "Send the job and join" : "Submit referral ticket"}</button>
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

/**
 * Hub → Referrals & tickets and the Call desk: send the person on the phone their referral ticket link. Text only with
 * their OK on the call. Their name, email and phone fill the ticket; filling it out signs them up for the network.
 */
export function SendTicketInvite({ initial, kinds, bizLeadId, compact = false, asPartner = false }: { initial?: { name?: string | null; email?: string | null; phone?: string | null; company?: string | null; kind?: string | null }; kinds: [string, string][]; bizLeadId?: string; compact?: boolean; asPartner?: boolean }) {
  const router = useRouter();
  const blank = { name: initial?.name ?? "", email: initial?.email ?? "", phone: initial?.phone ?? "", company: initial?.company ?? "", kind: initial?.kind ?? "other", job_hint: "", via_email: Boolean(initial?.email), via_sms: false, sms_consent: false };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-2 text-sm" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const body = { action: "invite", ...f, email: f.email || null, phone: f.phone || null, company: f.company || null, job_hint: f.job_hint || null, via_sms: f.via_sms && f.sms_consent };
      const r = asPartner ? await post("/api/partner", body) : await post("/api/hub/partners", { ...body, biz_lead_id: bizLeadId ?? null });
      setBusy(false);
      if (r.ok) { const sent = (r.data.sent as string[]) ?? []; setMsg({ ok: true, text: sent.length ? `Sent by ${sent.join(" and ")} ✓` : "Link made, but delivery failed — read it to them or copy it:", link: String(r.data.link ?? "") }); setF(blank); router.refresh(); }
      else setMsg({ ok: false, text: r.error });
    }}>
      <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <label>Their name<input className="input mt-1" required value={f.name} onChange={set("name")} /></label>
        <label>Email<input className="input mt-1" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value, via_email: Boolean(e.target.value) })} /></label>
        <label>Mobile<input className="input mt-1" type="tel" value={f.phone} onChange={set("phone")} /></label>
        <label>Company<input className="input mt-1" value={f.company} onChange={set("company")} /></label>
        <label>They are a…<select className="input mt-1" value={f.kind} onChange={set("kind")}>{kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className={compact ? "sm:col-span-2" : ""}>Job they mentioned (starts the ticket)<input className="input mt-1" value={f.job_hint} onChange={set("job_hint")} placeholder="e.g. move-out clean for a client on the 15th" /></label>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.via_email} disabled={!f.email} onChange={(e) => setF({ ...f, via_email: e.target.checked })} />Email it</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.via_sms} disabled={!f.phone} onChange={(e) => setF({ ...f, via_sms: e.target.checked })} />Text it</label>
        {f.via_sms && <label className="flex items-center gap-2 text-amber-800"><input type="checkbox" checked={f.sms_consent} onChange={(e) => setF({ ...f, sms_consent: e.target.checked })} />{asPartner ? "They said it's OK for Handled to text them" : "They said OK to a text on this call"}</label>}
        <button className="btn-primary" disabled={busy || !f.name || (!f.via_email && !(f.via_sms && f.sms_consent))}>{busy ? "Sending…" : "🎫 Send referral ticket"}</button>
      </div>
      {msg && <p className={msg.ok ? "text-brand-dark" : "text-rose-700"}>{msg.text}{msg.link && <> <span className="select-all break-all font-mono text-xs">{msg.link}</span></>}</p>}
    </form>
  );
}
