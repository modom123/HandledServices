/*
 * FILE    : apps/web/components/PartnerUI.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_0125 UTC
 * PURPOSE : Referral Partner Program controls: public sign-up form (/partners), copy-link, "send us a customer" and
 *           Stripe payout setup (/partner), and the staff controls in Hub → Partners.
 * UPDATED : 2026-10-28_0122 UTC — "send us a customer" is now the standard referral ticket; Hub ticket status buttons.
 * UPDATED : 2026-11-04_2345 UTC — photos are resized in the browser and sent one at a time (lib/upload-photos.ts): phone
 *           photos sent together went over Vercel's 4.5 MB request limit and were never saved.
 * UPDATED : 2026-11-06_1730 UTC — SalesTicketForm: close-ready direct-sales tickets (any service; 3–4 photos for on-site
 *           work), live price, and a pay link the partner can open on the spot.
 */
"use client";

import { useEffect, useState } from "react";
import { URGENCY, defaultAnswers, getService, money, questionVisible, ticketCloseCheck, type Answers, type Frequency } from "@handled/core";
import { PhotoPicker } from "./PhotoPicker";
import { useRouter } from "next/navigation";
import { uploadPhotos } from "@/lib/upload-photos";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, data: j as Record<string, unknown>, error: String(j.error ?? "Something went wrong — try again") };
}

export function PartnerSignUp({ kinds, defaultKind = "realtor" }: { kinds: [string, string][]; defaultKind?: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", kind: defaultKind, how: "", agree: false });
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
export function ReferralTicket({ services, jobTypes, timings, contacts, relationships, photosFirst = false }: { services: Opt; jobTypes: [string, string, string][]; timings: Opt; contacts: Opt; relationships: Opt; /** pro portal: photos are step 1 */ photosFirst?: boolean }) {
  const router = useRouter();
  const blank = { name: "", email: "", phone: "", company: "", contact_pref: "call", best_time: "", address: "", city: "", zip: "", service_slug: "", job_type: "one_time", timing: "week", preferred_date: "", details: "", relationship: "client", note: "", consent: false };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setMsg(null);
    const list = [...files].slice(0, 8 - photos.length);
    const r = await uploadPhotos(list);
    setUploading(false);
    setPhotos([...photos, ...r.paths].slice(0, 8));
    if (r.error) setMsg({ ok: false, text: `${list.length - r.paths.length} photo(s) didn't upload: ${r.error}` });
  };
  const photoField = (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{photosFirst ? "1 · Photos of the job" : "Photos of the job (optional)"}</legend>
      <p className="text-sm text-ink-soft">The yard, the gutters, the room, the junk pile: up to 8 photos. Photos help us price the job and book it faster.</p>
      <input type="file" accept="image/*" capture="environment" multiple disabled={uploading || photos.length >= 8} onChange={(e) => { upload(e.target.files); e.target.value = ""; }} className="text-sm" />
      {uploading && <p className="text-sm text-ink-soft">Uploading…</p>}
      {photos.length > 0 && <p className="text-sm">📷 {photos.length} photo{photos.length > 1 ? "s" : ""} added <button type="button" className="ml-2 text-xs text-ink-soft underline" onClick={() => setPhotos([])}>remove all</button></p>}
    </fieldset>
  );
  const n = (i: number) => (photosFirst ? i + 1 : i);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const earns = jobTypes.find(([k]) => k === f.job_type)?.[2];
  return (
    <form className="space-y-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const r = await post("/api/partner", { action: "ticket", ...f, photos, service_slug: f.service_slug || null, preferred_date: f.timing === "date" ? f.preferred_date : null });
      setBusy(false);
      setMsg(r.ok ? { ok: true, text: `Ticket ${String(r.data.ticket_no ?? "")} sent. We emailed ${f.name.split(" ")[0]} a booking link from you and we'll reach out too — they're your customer for 12 months.` } : { ok: false, text: r.error });
      if (r.ok) { setF(blank); setPhotos([]); router.refresh(); }
    }}>
      {photosFirst && photoField}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{n(1)} · Customer</legend>
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
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{n(2)} · Where</legend>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="text-sm">Street address (optional)<input className="input mt-1" value={f.address} onChange={set("address")} /></label>
          <label className="text-sm">City<input className="input mt-1" value={f.city} onChange={set("city")} /></label>
          <label className="text-sm">ZIP<input className="input mt-1" required inputMode="numeric" pattern="\d{5}" maxLength={5} value={f.zip} onChange={set("zip")} /></label>
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{n(3)} · The job</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Service<select className="input mt-1" value={f.service_slug} onChange={set("service_slug")}><option value="">Not sure / several things</option>{services.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select></label>
          <label className="text-sm">Type of job<select className="input mt-1" value={f.job_type} onChange={set("job_type")}>{jobTypes.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="text-sm">When they need it<select className="input mt-1" value={f.timing} onChange={set("timing")}>{timings.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {f.timing === "date" && <label className="text-sm">Date<input className="input mt-1" type="date" required value={f.preferred_date} onChange={set("preferred_date")} /></label>}
        </div>
        <label className="block text-sm">What needs doing (optional)<textarea className="input mt-1" rows={3} value={f.details} onChange={set("details")} placeholder="Size of the home or property, number of units, anything the pro should know" /></label>
        {earns && <p className="rounded-lg bg-brand-tint p-2 text-sm"><b>You earn:</b> {earns}.</p>}
      </fieldset>
      {!photosFirst && photoField}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{n(4)} · You and them</legend>
        <label className="block text-sm">How you know them<select className="input mt-1" value={f.relationship} onChange={set("relationship")}>{relationships.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="block text-sm">Note for them (optional — goes in our email from you)<textarea className="input mt-1" rows={2} value={f.note} onChange={set("note")} placeholder="e.g. Closing on the 15th — they need a move-out clean the day before" /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />They agreed that I can share their details and that Handled may contact them about this job.</label>
      </fieldset>
      <button className="btn-primary" disabled={busy || uploading || !f.consent}>{busy ? "Sending…" : "Submit referral ticket"}</button>
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

/**
 * Field Sales ticket (/partner), added 2026-11-06_1638 UTC. A rep can sell any service. The ticket holds everything it
 * takes to close the sale, so the customer pays without being asked anything again:
 *   photos (3–4 for on-site work; none for remote services) → the service and its measurements → how often and when →
 *   the customer, address, budget and access → "I spoke with the person who decides and pays" → the live upfront price.
 * On submit the customer is texted and emailed the pay link; the rep gets the same link to close right there
 * ("Pay now on this phone"). Customers can also pay on their own by typing the rep's partner code at checkout.
 */
export function SalesTicketForm({ services, minPhotos, maxPhotos, repCode }: { services: [string, string][]; minPhotos: number; maxPhotos: number; repCode: string }) {
  const router = useRouter();
  const blank = {
    service_slug: "", notes: "", frequency: "once" as Frequency, urgency: "" as string, preferred_date: "", time_window: "flexible",
    customer_type: "residential", company_name: "", budget: "", access_notes: "", close_notes: "", decision_maker: false,
    customer_name: "", customer_email: "", customer_phone: "", address: "", city: "", state: "MI", zip: "", consent: false,
  };
  const [f, setF] = useState(blank);
  const [answers, setAnswers] = useState<Answers>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [price, setPrice] = useState<{ point: number; low: number; high: number; siteVisit: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState<{ link: string; price: number | null; name: string } | null>(null);
  const svc = f.service_slug ? getService(f.service_slug) : undefined;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const pickService = (slug: string) => {
    const s = getService(slug);
    setF((x) => ({ ...x, service_slug: slug, frequency: s?.frequencies.includes(x.frequency) ? x.frequency : "once" }));
    setAnswers(s ? defaultAnswers(s) : {});
  };

  // live upfront price, from the same engine the booking uses
  useEffect(() => {
    if (!svc) { setPrice(null); return; }
    const id = setTimeout(async () => {
      const r = await post("/api/quote", { service_slug: svc.slug, answers, frequency: f.frequency, ...(/^\d{5}$/.test(f.zip) ? { zip: f.zip } : {}) });
      const b = r.ok ? (r.data.baseline as { point: number; low: number; high: number; siteVisit: boolean } | undefined) : undefined;
      setPrice(b ? { point: b.point, low: b.low, high: b.high, siteVisit: Boolean(b.siteVisit || r.data.site_visit) } : null);
    }, 400);
    return () => clearTimeout(id);
  }, [svc, answers, f.frequency, f.zip]);

  const onPhotos = async (p: string[]) => {
    setPhotos(p);
    if (p.length < minPhotos || f.service_slug) return;
    setHint("Looking at your photos…");
    const r = await post("/api/snap", { photos: p, note: f.notes || null, locale: "en" });
    const slug = r.ok ? (r.data.service_slug as string | null) : null;
    if (slug && services.some(([s]) => s === slug)) {
      pickService(slug);
      const a = (r.data.answers ?? {}) as Answers;
      if (Object.keys(a).length) setAnswers((cur) => ({ ...cur, ...a }));
      if (!f.notes && r.data.summary) setF((x) => ({ ...x, notes: String(r.data.summary) }));
      setHint(`Looks like ${services.find(([s]) => s === slug)![1]} — change it if not, and check the sizes below.`);
    } else setHint(null);
  };

  const missing = ticketCloseCheck({ ...f, service_slug: f.service_slug || null, answers, photos: photos.length, urgency: f.urgency || null });
  if (sent) return (
    <div className="space-y-3 rounded-xl border border-brand bg-brand-tint p-4">
      <h3 className="text-lg font-bold">Ticket sent ✓</h3>
      <p className="text-sm">We texted and emailed {sent.name.split(" ")[0]} their pay link{sent.price ? <> — <b>{money(sent.price)}</b></> : null}. Close it now: hand them your phone, or they can pay later from the text.</p>
      <div className="flex flex-wrap gap-2">
        <a className="btn-primary" href={sent.link} target="_blank" rel="noopener">Pay now on this phone</a>
        <CopyButton text={sent.link} label="Copy pay link" />
        <button type="button" className="btn-ghost mt-2" onClick={() => { setSent(null); setMsg(null); }}>Write another ticket</button>
      </div>
      <p className="text-xs text-ink-soft">The customer pays {"Handled"} directly. Once paid, the job goes to the job board; you&apos;re paid when it&apos;s completed. They can also book anytime at handledsvc.com with your code <b className="font-mono">{repCode}</b>.</p>
    </div>
  );
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const r = await post("/api/partner", { action: "sale", ...f, answers, photos, service_slug: f.service_slug || null, urgency: f.urgency || null, budget: f.budget ? Number(f.budget) : null });
      setBusy(false);
      if (r.ok) { setSent({ link: String(r.data.link), price: (r.data.price as number | null) ?? null, name: f.customer_name }); setF(blank); setAnswers({}); setPhotos([]); setHint(null); setPrice(null); router.refresh(); }
      else setMsg({ ok: false, text: r.error });
    }}>
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">1. What you&apos;re selling</legend>
        <select className="input" value={f.service_slug} onChange={(e) => pickService(e.target.value)}><option value="">Pick a service (or add photos and we&apos;ll suggest one)</option>{services.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select>
        {svc && svc.questions.filter((q) => questionVisible(q, answers, svc.questions)).map((q) => (
          <label key={q.id} className="block text-sm">{q.label}{q.type === "number" && q.required && <span className="text-rose-700"> *</span>}
            {q.type === "number" && <span className="mt-1 flex items-center gap-2"><input className="input" type="number" min={q.min} max={q.max} value={String(answers[q.id] ?? q.default)} onChange={(e) => setAnswers({ ...answers, [q.id]: Number(e.target.value) })} />{q.unit && <span className="text-xs text-ink-soft">{q.unit}</span>}</span>}
            {q.type === "select" && <select className="input mt-1" value={String(answers[q.id] ?? q.default)} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}>{q.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>}
            {q.type === "toggle" && <span className="mt-1 flex items-center gap-2"><input type="checkbox" checked={Boolean(answers[q.id] ?? q.default)} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.checked })} /> Yes</span>}
          </label>
        ))}
        {svc && svc.frequencies.length > 1 && <label className="block text-sm">How often<select className="input mt-1" value={f.frequency} onChange={set("frequency")}>{svc.frequencies.map((x) => <option key={x} value={x}>{FREQ[x]}</option>)}</select></label>}
        <label className="block text-sm">Notes for the customer and the pro<textarea className="input mt-1" rows={2} value={f.notes} onChange={set("notes")} placeholder="e.g. Back fence, 6 sections leaning, gate won't latch." /></label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">2. Photos {svc?.remote ? "(optional for this service)" : `(${minPhotos}–${maxPhotos})`}</legend>
        {!svc?.remote && <p className="text-xs text-ink-soft">Wide shot, close-ups of the problem, and something for size. Only with the owner&apos;s OK.</p>}
        <PhotoPicker value={photos} onChange={onPhotos} max={maxPhotos} onError={(m) => setMsg({ ok: false, text: m })} />
        {hint && <p className="text-xs text-brand-dark">✨ {hint}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">3. The customer</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Name<input className="input mt-1" required value={f.customer_name} onChange={set("customer_name")} /></label>
          <label className="text-sm">Email<input className="input mt-1" type="email" required value={f.customer_email} onChange={set("customer_email")} /></label>
          <label className="text-sm">Mobile (we text the pay link)<input className="input mt-1" type="tel" required value={f.customer_phone} onChange={set("customer_phone")} /></label>
          <label className="text-sm">Home or business<select className="input mt-1" value={f.customer_type} onChange={set("customer_type")}><option value="residential">Home</option><option value="commercial">Business</option></select></label>
          {f.customer_type === "commercial" && <label className="text-sm sm:col-span-2">Company<input className="input mt-1" value={f.company_name} onChange={set("company_name")} /></label>}
          <label className="text-sm sm:col-span-2">Service address{svc?.remote ? " (optional)" : ""}<input className="input mt-1" value={f.address} onChange={set("address")} /></label>
          <label className="text-sm">City<input className="input mt-1" value={f.city} onChange={set("city")} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">State<input className="input mt-1" maxLength={2} value={f.state} onChange={set("state")} /></label>
            <label className="text-sm">ZIP<input className="input mt-1" inputMode="numeric" maxLength={5} value={f.zip} onChange={set("zip")} /></label>
          </div>
          <label className="text-sm sm:col-span-2">Gate code, pets, parking (only the assigned pro sees it)<input className="input mt-1" value={f.access_notes} onChange={set("access_notes")} /></label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">4. Closing the sale</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {!svc?.leadDays && <label className="text-sm">When do they need it?<select className="input mt-1" value={f.urgency} onChange={set("urgency")}><option value="">Pick one</option>{URGENCY.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></label>}
          <label className="text-sm">Preferred day (optional)<input className="input mt-1" type="date" value={f.preferred_date} onChange={set("preferred_date")} /></label>
          <label className="text-sm">Arrival window<select className="input mt-1" value={f.time_window} onChange={set("time_window")}><option value="flexible">Flexible</option><option value="morning">Morning</option><option value="midday">Midday</option><option value="afternoon">Afternoon</option></select></label>
          <label className="text-sm">Their budget (optional)<input className="input mt-1" inputMode="decimal" value={f.budget} onChange={set("budget")} placeholder="$" /></label>
        </div>
        <label className="block text-sm">Anything holding them back? (optional — we follow up)<input className="input mt-1" value={f.close_notes} onChange={set("close_notes")} placeholder="e.g. Wants to check with spouse; asked about financing" /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.decision_maker} onChange={(e) => setF({ ...f, decision_maker: e.target.checked })} />I spoke with the person who decides and pays.</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} />They asked Handled to text and email them. I didn&apos;t take any payment.</label>
      </fieldset>

      {price && <div className="rounded-xl bg-paper p-3 text-sm">{price.siteVisit ? <>This job needs a free site visit for a firm price (estimate {money(price.low)}–{money(price.high)}).</> : <>Upfront price to show the customer: <b className="text-lg">{money(price.point)}</b>{f.frequency !== "once" ? " per visit" : ""} <span className="text-xs text-ink-soft">(our AI checks the photos at checkout and may adjust it)</span></>}</div>}
      {missing.length > 0 && <p className="text-xs text-amber-800">Still needed to close: {missing.join("; ")}.</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={busy || missing.length > 0 || !f.consent}>{busy ? "Sending…" : "Send ticket & get pay link"}</button>
      {msg && <p className={`text-sm ${msg.ok ? "text-brand-dark" : "text-rose-700"}`}>{msg.text}</p>}
    </form>
  );
}

const FREQ: Record<Frequency, string> = { once: "One time", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Quarterly" };
