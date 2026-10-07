/*
 * FILE    : apps/web/components/ProposalForm.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0841 UTC
 * PURPOSE : For Business → Request a proposal, in 3 short steps with a progress bar:
 *             1. Your company   — who you are, industry, how to reach you
 *             2. Scope of work  — sites and size, services with how often + specifics, when crews can work, current vendor
 *             3. Timing & next steps — start, term, budget, who decides (bid due date), walkthrough times
 *           then a review screen and "What happens next" (RFP_NEXT_STEPS). Each step checks only what it needs, so
 *           buyers can't get lost; the scope arrives structured (rfp_scope) for the follow-up call.
 *           Replaces the one-long-form BusinessForm.
 */
"use client";

import { useState, type ReactNode } from "react";
import {
  BUSINESS_GROUPS, INDUSTRIES, RFP_CONTACT, RFP_DECISION, RFP_FREQUENCIES, RFP_HOURS, RFP_NEXT_STEPS, RFP_TERMS, RFP_VENDOR, RFP_WALKTHROUGH,
  SERVICE_BY_SLUG, SQFT_RANGES, URGENCY, rfpSummary, type RfpScope,
} from "@handled/core";

type Svc = RfpScope["services"][number];
const STEPS = ["Your company", "Scope of work", "Timing & next steps"] as const;
const recurringDefault = (slug: string): Svc["frequency"] => (["house-cleaning", "lawn-care", "snow-removal", "courier"].includes(slug) ? "weekly" : "one_time");

function Pills<T extends string>({ options, value, onChange, multi }: { options: readonly { id: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; multi?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button type="button" key={o.id} aria-pressed={on} onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.id) : [...value, o.id]) : [o.id])}
            className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{o.label}</button>
        );
      })}
    </div>
  );
}

const Q = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <div><div className="label">{label}</div>{hint && <p className="-mt-1 mb-2 text-xs text-ink-soft">{hint}</p>}{children}</div>
);

export function ProposalForm({ industry: startIndustry = "", lead = null }: { industry?: string; lead?: string | null }) {
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  // step 1
  const [c, setC] = useState({ company: "", contact_name: "", email: "", phone: "" });
  const [industry, setIndustry] = useState(startIndustry);
  const [contact, setContact] = useState<RfpScope["contact"]>("call");
  // step 2
  const [locations, setLocations] = useState(1);
  const [site, setSite] = useState("");
  const [sqft, setSqft] = useState<RfpScope["sqft"] | "">("");
  const [services, setServices] = useState<Svc[]>((INDUSTRIES.find((i) => i.id === startIndustry)?.slugs ?? []).filter((x) => SERVICE_BY_SLUG[x]).map((slug) => ({ slug, frequency: recurringDefault(slug) })));
  const [openGroup, setOpenGroup] = useState<string | null>("janitorial");
  const [hours, setHours] = useState<RfpScope["hours"]>([]);
  const [vendor, setVendor] = useState<RfpScope["vendor"] | "">("");
  const [pain, setPain] = useState("");
  // step 3
  const [startBy, setStartBy] = useState("two_weeks");
  const [term, setTerm] = useState<RfpScope["term"]>("not_sure");
  const [budget, setBudget] = useState("");
  const [decision, setDecision] = useState<RfpScope["decision"]>("me");
  const [bidDue, setBidDue] = useState("");
  const [walk, setWalk] = useState<RfpScope["walkthrough"]>([]);
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false);

  const pickIndustry = (id: string) => {
    setIndustry(id);
    const preset = (INDUSTRIES.find((i) => i.id === id)?.slugs ?? []).filter((x) => SERVICE_BY_SLUG[x] && !services.some((s) => s.slug === x));
    setServices([...services, ...preset.map((slug) => ({ slug, frequency: recurringDefault(slug) }))]);
  };
  const toggle = (slug: string) => setServices(services.some((s) => s.slug === slug) ? services.filter((s) => s.slug !== slug) : [...services, { slug, frequency: recurringDefault(slug) }]);
  const patch = (slug: string, p: Partial<Svc>) => setServices(services.map((s) => (s.slug === slug ? { ...s, ...p } : s)));

  const scope = (): RfpScope => ({ sqft: (sqft || "not_sure") as RfpScope["sqft"], site, services, hours, vendor: (vendor || "none") as RfpScope["vendor"], pain: pain || undefined, term, decision, bidDue: decision === "formal_bid" ? bidDue || null : null, walkthrough: walk, contact });
  const check = (i: number): string => {
    if (i === 0) {
      if (c.company.trim().length < 2) return "Add your company name.";
      if (c.contact_name.trim().length < 2) return "Add your name.";
      if (!/^\S+@\S+\.\S+$/.test(c.email)) return "Add a work email we can reply to.";
      if (contact !== "email" && c.phone.replace(/\D/g, "").length < 10) return "Add a phone number, or pick Email as the best way to reach you.";
    }
    if (i === 1) {
      if (!services.length) return "Pick at least one service.";
      if (!site.trim()) return "Add the site address, or at least the city or ZIP.";
      if (!sqft) return "Pick the approximate size (or “Not sure”).";
      if (!vendor) return "Tell us if you have a current vendor.";
    }
    if (i === 2 && decision === "formal_bid" && !bidDue) return "Add the bid due date so we don’t miss it.";
    return "";
  };
  const next = () => { const e = check(step); setErr(e); if (e) return; if (step < 2) setStep(step + 1); else setReview(true); window.scrollTo({ top: (document.getElementById("quote")?.offsetTop ?? 0) - 70, behavior: "smooth" }); };
  const send = async () => {
    setState("busy"); setErr("");
    const res = await fetch("/api/business", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...c, locations, services_needed: services.map((s) => s.slug), monthly_budget: budget ? Number(budget) : null, start_by: startBy, notes: notes || undefined, lead, industry: industry || null, scope: scope() }),
    });
    if (res.ok) return setState("done");
    setErr((await res.json().catch(() => ({}))).error ?? "Something went wrong — please try again.");
    setState("idle");
  };

  if (state === "done") {
    return (
      <div className="card">
        <div className="text-3xl">🤝</div>
        <h2 className="mt-2 text-xl font-bold">Got it — here’s what happens next</h2>
        <ol className="mt-4 space-y-3">{RFP_NEXT_STEPS.map((s, i) => <li key={s.t} className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span><div><div className="font-semibold">{s.t}</div><p className="text-sm text-ink-soft">{s.b}</p></div></li>)}</ol>
        <p className="mt-4 text-sm text-ink-soft">We’ll reach you by {RFP_CONTACT.find((x) => x.id === contact)?.label.toLowerCase()} at {contact === "email" ? c.email : c.phone || c.email}. Signing in with {c.email} opens your business account.</p>
      </div>
    );
  }

  const industryName = INDUSTRIES.find((i) => i.id === industry)?.name ?? null;
  return (
    <div className="card space-y-5">
      <div>
        <h2 className="text-xl font-bold">Request a proposal</h2>
        <p className="mt-1 text-sm text-ink-soft">3 short steps, about 3 minutes. Not sure about something? Skip it — we’ll cover it on a quick follow-up call.</p>
        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" disabled={i > step && !review} onClick={() => { if (i < step || review) { setReview(false); setStep(i); setErr(""); } }} className="w-full text-left">
                <div className={`h-1.5 rounded-full ${i <= step || review ? "bg-brand" : "bg-line"}`} />
                <div className={`mt-1.5 text-xs font-semibold ${i === step && !review ? "text-brand" : "text-ink-soft"}`}>{i + 1}. {s}</div>
              </button>
            </li>
          ))}
        </ol>
      </div>

      {review ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-paper p-4 text-sm">
            <div className="font-semibold">{c.company} · {c.contact_name}</div>
            <div className="text-ink-soft">{c.email}{c.phone ? ` · ${c.phone}` : ""} · prefers {RFP_CONTACT.find((x) => x.id === contact)?.label.toLowerCase()}</div>
            <ul className="mt-3 space-y-1">{rfpSummary(scope(), { locations, industry: industryName, startBy: URGENCY.find((u) => u.id === startBy)?.label ?? startBy, budget: budget ? Number(budget) : null }).map((l) => <li key={l}>{l}</li>)}</ul>
            {notes && <p className="mt-2 text-ink-soft">“{notes}”</p>}
          </div>
          <div className="rounded-xl border border-line p-4">
            <div className="text-sm font-semibold">What happens after you send it</div>
            <ol className="mt-2 space-y-1.5 text-sm">{RFP_NEXT_STEPS.map((s, i) => <li key={s.t}><b>{i + 1}. {s.t}.</b> <span className="text-ink-soft">{s.b}</span></li>)}</ol>
          </div>
          {err && <p className="text-sm text-rose-700">{err}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-ghost" onClick={() => { setReview(false); setStep(1); }}>Edit scope</button>
            <button type="button" className="btn-primary flex-1 sm:flex-none" disabled={state === "busy"} onClick={send}>{state === "busy" ? "Sending…" : "Send my request"}</button>
          </div>
        </div>
      ) : (
        <>
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label" htmlFor="rfp-co">Company</label><input id="rfp-co" className="input" autoComplete="organization" value={c.company} onChange={(e) => setC({ ...c, company: e.target.value })} /></div>
                <div><label className="label" htmlFor="rfp-name">Your name</label><input id="rfp-name" className="input" autoComplete="name" value={c.contact_name} onChange={(e) => setC({ ...c, contact_name: e.target.value })} /></div>
                <div><label className="label" htmlFor="rfp-email">Work email</label><input id="rfp-email" type="email" className="input" autoComplete="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></div>
                <div><label className="label" htmlFor="rfp-phone">Phone</label><input id="rfp-phone" type="tel" className="input" autoComplete="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></div>
              </div>
              <div>
                <label className="label" htmlFor="rfp-ind">Your industry</label>
                <select id="rfp-ind" className="input" value={industry} onChange={(e) => pickIndustry(e.target.value)}>
                  <option value="">Choose one (we’ll suggest services)</option>
                  {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.icon} {i.name}</option>)}
                </select>
              </div>
              <Q label="Best way to reach you"><Pills options={RFP_CONTACT} value={[contact]} onChange={(v) => setContact(v[0])} /></Q>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <div><label className="label" htmlFor="rfp-site">Site address (or city / ZIP)</label><input id="rfp-site" className="input" autoComplete="street-address" placeholder="e.g. 123 Main St, Suite 200, City, ST 12345" value={site} onChange={(e) => setSite(e.target.value)} /></div>
                <div><label className="label" htmlFor="rfp-loc">Locations</label><input id="rfp-loc" type="number" min={1} className="input" value={locations} onChange={(e) => setLocations(Math.max(1, Number(e.target.value) || 1))} /></div>
              </div>
              <Q label="Approximate size" hint={locations > 1 ? "Your largest site — we’ll get the rest on the call." : undefined}><Pills options={SQFT_RANGES} value={sqft ? [sqft] : []} onChange={(v) => setSqft(v[0])} /></Q>

              <Q label={`Services${services.length ? ` · ${services.length} picked` : ""}`} hint="Tap a group, then the services you need.">
                <div className="divide-y divide-line rounded-xl border border-line bg-white">
                  {BUSINESS_GROUPS.map((g) => {
                    const slugs = g.slugs.filter((x) => SERVICE_BY_SLUG[x]);
                    const picked = slugs.filter((x) => services.some((s) => s.slug === x)).length;
                    const open = openGroup === g.id;
                    return (
                      <div key={g.id} className="px-3">
                        <button type="button" aria-expanded={open} onClick={() => setOpenGroup(open ? null : g.id)} className="flex w-full items-center justify-between py-2.5 text-left text-sm font-semibold">
                          <span>{g.icon} {g.title}{picked > 0 && <span className="ml-1 text-brand">· {picked}</span>}</span><span aria-hidden className={`text-xs transition ${open ? "rotate-180" : ""}`}>▾</span>
                        </button>
                        {open && <div className="pb-3"><Pills multi options={slugs.map((x) => ({ id: x, label: SERVICE_BY_SLUG[x].name }))} value={services.map((s) => s.slug).filter((x) => slugs.includes(x))} onChange={(v) => { const add = v.find((x) => !services.some((s) => s.slug === x)); const rm = slugs.find((x) => services.some((s) => s.slug === x) && !v.includes(x)); if (add) toggle(add); else if (rm) toggle(rm); }} /></div>}
                      </div>
                    );
                  })}
                </div>
              </Q>

              {services.length > 0 && (
                <Q label="For each service: how often, and what’s included" hint="Specifics help us price it right — e.g. “3 floors, 6 restrooms, we supply paper goods”.">
                  <div className="space-y-2">
                    {services.map((s) => (
                      <div key={s.slug} className="rounded-xl border border-line bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{SERVICE_BY_SLUG[s.slug]?.icon} {SERVICE_BY_SLUG[s.slug]?.name}</span>
                          <span className="flex items-center gap-2">
                            <select aria-label={`How often — ${SERVICE_BY_SLUG[s.slug]?.name}`} className="input w-auto py-1.5 text-sm" value={s.frequency} onChange={(e) => patch(s.slug, { frequency: e.target.value as Svc["frequency"] })}>
                              {RFP_FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                            <button type="button" aria-label={`Remove ${SERVICE_BY_SLUG[s.slug]?.name}`} className="text-ink-soft hover:text-rose-700" onClick={() => toggle(s.slug)}>✕</button>
                          </span>
                        </div>
                        <input className="input mt-2 py-2 text-sm" placeholder="What’s included (optional)" maxLength={300} value={s.note ?? ""} onChange={(e) => patch(s.slug, { note: e.target.value })} />
                      </div>
                    ))}
                  </div>
                </Q>
              )}

              <Q label="When can crews work?" hint="Pick all that apply."><Pills multi options={RFP_HOURS} value={hours} onChange={setHours} /></Q>
              <Q label="Do you have a current vendor?"><Pills options={RFP_VENDOR} value={vendor ? [vendor] : []} onChange={(v) => setVendor(v[0])} /></Q>
              {vendor && vendor !== "none" && <div><label className="label" htmlFor="rfp-pain">What isn’t working today? (optional)</label><textarea id="rfp-pain" className="input min-h-20" maxLength={1000} placeholder="Missed visits, quality, communication, price…" value={pain} onChange={(e) => setPain(e.target.value)} /></div>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label" htmlFor="rfp-start">When do you want to start?</label><select id="rfp-start" className="input" value={startBy} onChange={(e) => setStartBy(e.target.value)}>{URGENCY.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></div>
                <div><label className="label" htmlFor="rfp-budget">Monthly budget ($, optional)</label><input id="rfp-budget" type="number" min={0} step={50} className="input" placeholder="e.g. 2500" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
              </div>
              <Q label="Contract length you prefer"><Pills options={RFP_TERMS} value={[term]} onChange={(v) => setTerm(v[0])} /></Q>
              <Q label="Who decides?"><Pills options={RFP_DECISION} value={[decision]} onChange={(v) => setDecision(v[0])} /></Q>
              {decision === "formal_bid" && <div><label className="label" htmlFor="rfp-due">Bid due date</label><input id="rfp-due" type="date" className="input w-auto" value={bidDue} onChange={(e) => setBidDue(e.target.value)} /><p className="mt-1 text-xs text-ink-soft">Send the bid documents to us after this — your account manager will ask for them.</p></div>}
              <Q label="Good times for a free walkthrough" hint="Pick any that work; we’ll confirm a time."><Pills multi options={RFP_WALKTHROUGH} value={walk} onChange={setWalk} /></Q>
              <div><label className="label" htmlFor="rfp-notes">Anything else? (optional)</label><textarea id="rfp-notes" className="input min-h-20" maxLength={2000} placeholder="Access, security, insurance requirements, special equipment…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            </div>
          )}

          {err && <p className="text-sm text-rose-700" role="alert">{err}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {step > 0 && <button type="button" className="btn-ghost" onClick={() => { setStep(step - 1); setErr(""); }}>Back</button>}
            <button type="button" className="btn-primary flex-1 sm:flex-none" onClick={next}>{step < 2 ? `Next: ${STEPS[step + 1]}` : "Review my request"}</button>
          </div>
        </>
      )}
    </div>
  );
}
