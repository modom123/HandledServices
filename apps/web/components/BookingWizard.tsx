/*
 * FILE    : apps/web/components/BookingWizard.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1329 UTC — promo / gift / referral code with live savings, attribution, Spanish.
 * UPDATED : 2026-10-02_0302 UTC — "When do you need it done?" (ASAP incl. same day … flexible) limits the
 *           calendar to their deadline; optional budget shows whether the price fits.
 * UPDATED : 2026-10-03_0027 UTC — "Email me this price" (SaveQuote) and ?frequency= from email links.
 * UPDATED : 2026-10-03_0150 UTC — name your price (around our suggestion, which learns the local market);
 *           shows what the pro earns and the booking fee.
 * UPDATED : 2026-10-04_2204 UTC — "Book again with …": the requested pro (and crew member) rides along with the booking.
 * PURPOSE : 4-step booking flow: service → details & photos → when/where → review.
 *           Price updates live from the shared pricing engine; the optional AI check
 *           reads notes + photos and tightens the price before booking.
 * UPDATED : 2026-10-04_1934 UTC — business account bookings (?property=): address and company from the property; billed-on-account confirmation.
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 * UPDATED : 2026-10-05_0447 UTC — photos and notes carried in from Snap & post a job.
 * UPDATED : 2026-10-05_1433 UTC — event bookings with 50+ guests suggest licensed guards (Add event security); Plan My Event passes alcohol.
 * UPDATED : 2026-10-07_1900 UTC — quick choices Today / Next week / In 2 weeks / Within a month / Flexible, then "Pick the day and arrival time" on the calendar.
 * UPDATED : 2026-10-07_1640 UTC — text-message consent wording under the mobile number (TCPA / A2P 10DLC).
 * UPDATED : 2026-10-07_1830 UTC — area price level from /api/market (region), so the price shown matches what the server charges.
 * UPDATED : 2026-10-11_0608 UTC — remote services (websites, AI, formation, consulting) say "free consultation" instead of "site visit".
 * UPDATED : 2026-10-15_0300 UTC — pay choice: 25% now and the rest when the job is done (default), or in full now with 5% off;
 *           events and site-visit work keep the deposit. The Pay button shows what is charged today.
 * UPDATED : 2026-10-12_0005 UTC — saved homes: pick one of My homes (address + entry details), "save this home", and an entry
 *           details box (lockbox, key, gate) that only the assigned pro sees.
 * UPDATED : 2026-10-20_0200 UTC — marketplace: "Choose your price" (pros' own upfront prices next to Handled's) and booking a request-a-quote at its locked price.
 * UPDATED : 2026-10-23_1100 UTC — Business & Technology (consultOnly): no price, range, line amounts or budget check; the panel says
 *           "Free consultation" and lists what was picked. Scope and price are set on the call.
 * UPDATED : 2026-10-27_2100 UTC — customers no longer see what the pro earns (internal; it lives in the Hub's job money view).
 * UPDATED : 2026-10-28_1730 UTC — step 1 (pick a service): search + one category at a time instead of all 101 services in one list.
 * UPDATED : 2026-10-28_1700 UTC — no consultation-only mode: Business & Technology shows its price and is ordered with a deposit
 *           like every service (and the AI check never turns remote work into a visit).
 */
"use client";

import { SmsConsent } from "./SmsConsent";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingCalendar } from "./BookingCalendar";
import { SaveQuote } from "./SaveQuote";
import { PhotoPicker } from "./PhotoPicker";
import {
  BRAND, CATEGORIES, URGENCY, budgetMessage, lineText, serviceText, categoryText, t as tr, type Locale, budgetFit, neededBy, type Urgency, photoProblem, photoRule, sizeNeedsSiteVisit, SERVICES, depositPolicy, bookNowPolicy, payInFullSaving, resolvePlan, type PaymentPlan, planEventBudget, securityAdvice, defaultAnswers, estimate, getService, isRush, money, moneyRange,
  type Answers, type Frequency, type TimeWindow,
  questionVisible, offerCheck, BOOKING_FEE, priceHint, missingMeasurements, rankProOffers, type ProRateRow,
} from "@handled/core";

const FREQ_LABEL: Record<Frequency, string> = { once: "One time", weekly: "Weekly (save 20%)", biweekly: "Every 2 weeks (save 15%)", monthly: "Monthly (save 10%)", quarterly: "Quarterly (save 5%)" };
const addDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const START_TIMES = Array.from({ length: 30 }, (_, i) => {
  const mins = 8 * 60 + i * 30; // 8:00am → 10:30pm
  const h = Math.floor(mins / 60), m = mins % 60;
  return { v: `${String(h).padStart(2, "0")}:${m ? "30" : "00"}`, l: `${((h + 11) % 12) + 1}:${m ? "30" : "00"} ${h < 12 ? "am" : "pm"}` };
});
/** Rides run around the clock (early airport runs, late pickups). */
const PICKUP_TIMES = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 ? "30" : "00";
  return { v: `${String(h).padStart(2, "0")}:${m}`, l: `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "am" : "pm"}` };
});
// default 3 days out so the within-48h priority surcharge is opt-in, not a surprise
const defaultDate = () => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

type Perks = { member: boolean; memberBenefit: number; promoCode: string | null; promoAmount: number; promoMessage: string | null; promoOk: boolean | null; gift: number; isGift: boolean; price: number; dueNow: number };

/** First-touch marketing source saved by <Attribution /> (utm_*, referrer, landing page). */
function readAttribution(): Record<string, string> | null {
  try { const raw = localStorage.getItem("handled_attr"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

type AiResult = { final_price: number; low: number; high: number; customer_summary: string; needs_site_visit: boolean; action?: "price" | "site_visit"; action_reason?: string; changes?: { label: string; from: string; to: string; reason: string }[] } | null;

/** Booking for a business account's property: address and company come from the property. */
export interface BusinessBooking { propertyId: string; propertyName: string; company: string; address: string; city: string; state: string; zip: string; billing: string; contact: { name: string; email: string; phone: string } }

/** "Book again with …" (?pro=&crew=): checked server-side against the customer's favorites and past pros. */
export interface PreferredPro { proId: string; crewId: string | null; label: string; crewName: string | null }

/** Booking a request-a-quote: the request's token, the chosen quote and its locked, all-in price. */
export interface BookedQuote { request: string; bid: string; price: number; pro: string }

/** One of the signed-in customer's saved homes (My homes). Entry details stay on the server. */
export interface HomeChoice { id: string; label: string; address: string; city: string; state: string; zip: string; hasAccess: boolean }

export function BookingWizard({ initialService, prefill = {}, initialUrgency, initialBudget, initialPromo, initialFrequency, locale = "en", business, preferred, initialPhotos = [], initialNotes = "", homes = [], initialHome, signedIn = false, quote = null }: { quote?: BookedQuote | null; initialService?: string; prefill?: Answers; initialUrgency?: string; initialBudget?: string; initialPromo?: string; initialFrequency?: string; locale?: Locale; business?: BusinessBooking; preferred?: PreferredPro; initialPhotos?: string[]; initialNotes?: string; homes?: HomeChoice[]; initialHome?: string; signedIn?: boolean }) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const router = useRouter();
  const [ask, setAsk] = useState(preferred ?? null);
  const [slug, setSlug] = useState(getService(initialService ?? "") ? initialService! : "");
  const [step, setStep] = useState(slug ? 1 : 0);
  const [pickCat, setPickCat] = useState<string>(CATEGORIES[0].id);
  const [find, setFind] = useState("");
  const svc = getService(slug);
  const [answers, setAnswers] = useState<Answers>(() => {
    if (!svc) return {};
    const known = new Set(svc.questions.map((q) => q.id));
    return { ...defaultAnswers(svc), ...Object.fromEntries(Object.entries(prefill).filter(([k]) => known.has(k))) };
  });
  const [frequency, setFrequency] = useState<Frequency>(() => (svc?.frequencies.includes(initialFrequency as Frequency) ? (initialFrequency as Frequency) : "once"));
  const [notes, setNotes] = useState(initialNotes);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [date, setDate] = useState(defaultDate());
  const [win, setWin] = useState<TimeWindow>("morning");
  const startHome = !business ? homes.find((h) => h.id === initialHome) ?? null : null;
  const [homeId, setHomeId] = useState<string | null>(startHome?.id ?? null);
  const [saveHome, setSaveHome] = useState(false);
  const [access, setAccess] = useState("");
  const [form, setForm] = useState(business
    ? { contact_name: business.contact.name, contact_email: business.contact.email, contact_phone: business.contact.phone, address: business.address, city: business.city, state: business.state, zip: business.zip, customer_type: "commercial", company_name: business.company }
    : { contact_name: "", contact_email: "", contact_phone: "", address: startHome?.address ?? "", city: startHome?.city ?? "", state: startHome?.state ?? "MI", zip: startHome?.zip ?? "", customer_type: "residential", company_name: "" });
  const pickHome = (h: HomeChoice | null) => {
    setHomeId(h?.id ?? null);
    if (h) { setSaveHome(false); setForm((f) => ({ ...f, address: h.address, city: h.city, state: h.state, zip: h.zip, customer_type: "residential" })); }
  };
  const [ai, setAi] = useState<AiResult>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [quoteToken, setQuoteToken] = useState<string | null>(null);
  const [aiTried, setAiTried] = useState(false);
  const resetAi = () => { setAi(null); setQuoteToken(null); setAiTried(false); };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [plan, setPlan] = useState<PaymentPlan>("after");
  const [urgency, setUrgency] = useState<Urgency | null>(URGENCY.some((u) => u.id === initialUrgency) ? (initialUrgency as Urgency) : null);
  const [promo, setPromo] = useState((initialPromo ?? "").toUpperCase());
  const [perks, setPerks] = useState<Perks | null>(null);
  const [budget, setBudget] = useState((initialBudget ?? "").replace(/[^\d.]/g, ""));

  // what pros in this area actually accept (learned) — the same factor the server prices with
  const [market, setMarket] = useState(1);
  const [region, setRegion] = useState(1); // the service area's price level (Seattle area +25%, rest of WA +20%)
  useEffect(() => {
    if (!slug) return;
    const zip = /^\d{5}$/.test(form.zip) ? form.zip : "";
    fetch(`/api/market?service=${slug}${zip ? `&zip=${zip}` : ""}`).then((r) => r.json()).then((j) => { setMarket(Number(j.factor) || 1); setRegion(Number(j.region) || 1); }).catch(() => {});
  }, [slug, form.zip]);
  const est = useMemo(() => (svc ? estimate({ slug: svc.slug, answers, frequency, rush: isRush(date), market, region }) : null), [svc, answers, frequency, date, market, region]);
  // Name your price ("" = our suggestion)
  const [offer, setOffer] = useState("");
  // pros' own prices for this job (their % of our suggestion; core proPrice turns it into the all-in price)
  const [proRows, setProRows] = useState<ProRateRow[]>([]);
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => {
    if (!slug || quote || !/^\d{5}$/.test(form.zip)) { setProRows([]); return; }
    fetch(`/api/pro-prices?service=${slug}&zip=${form.zip}${date ? `&date=${date}` : ""}&window=${win}`).then((r) => r.json()).then((j) => setProRows(Array.isArray(j.pros) ? j.pros : [])).catch(() => setProRows([]));
  }, [slug, form.zip, date, win, quote]);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (homeId && ["address", "city", "state", "zip"].includes(k)) setHomeId(null); // a different address isn't the saved home any more
    setForm({ ...form, [k]: e.target.value });
  };

  function pick(s: string) {
    const next = getService(s)!;
    setSlug(s);
    setAnswers(defaultAnswers(next));
    setFrequency("once");
    resetAi();
    setStep(1);
  }

  async function runAi() {
    setAiTried(true);
    setAiBusy(true);
    const res = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ service_slug: slug, answers, frequency, scheduled_date: date, notes, photos, ai: true, locale, ...(/^\d{5}$/.test(form.zip) ? { zip: form.zip } : {}) }) });
    const json = await res.json().catch(() => ({}));
    setAiBusy(false);
    setAi(json.ai ?? null);
    setQuoteToken(json.quote_token ?? null);
  }
  // the AI price check runs automatically before payment whenever there are photos or notes
  const needsCheck = Boolean(!quote && svc && !svc.siteVisit && !(svc && sizeNeedsSiteVisit(svc.slug, answers)) && (notes.trim() || photos.length));
  useEffect(() => {
    if (step === 3 && needsCheck && !aiTried && !aiBusy) runAi();
  }, [step, needsCheck, aiTried, aiBusy]); // eslint-disable-line react-hooks/exhaustive-deps
  const bigJob = svc ? sizeNeedsSiteVisit(svc.slug, answers) : null;
  // remote work (websites, AI…) is never a visit: it is priced from the answers and ordered with a deposit
  const siteVisit = !quote && Boolean(svc?.siteVisit || bigJob || (ai?.action === "site_visit" && !svc?.remote));
  const rule = svc ? photoRule(svc.slug) : null;
  const photosMissing = svc ? photoProblem(svc.slug, photos.length, locale) : null;
  // required measurements (yard sq ft, weight, height…) must be filled in before the price step
  const measuresMissing = svc ? missingMeasurements(svc.questions, answers) : [];

  async function book() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, company_name: form.company_name || null, service_slug: slug, answers, frequency, scheduled_date: date, time_window: win, notes: notes || null, photos, source: "web", accept_terms: agreed, payment_plan: plan, quote_token: quoteToken, promo_code: promo || null, attribution: readAttribution(), locale, urgency: svc?.leadDays ? null : urgency, customer_budget: Number(budget) > 0 ? Number(budget) : null, customer_offer: named ? offerNum : null, pro_choice: picked ? { pro_id: picked.pro_id, price: picked.price } : null, quote_bid: quote ? { request: quote.request, bid: quote.bid } : null, business_property_id: business?.propertyId ?? null, preferred_pro_id: ask?.proId ?? null, requested_crew_member_id: ask?.crewId ?? null, home_id: business ? null : homeId, access_info: business ? null : access.trim() || null, save_home: Boolean(!business && !homeId && saveHome && signedIn) }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error ?? "Booking failed");
    if (json.checkout) window.location.href = json.checkout;
    else router.push(`/book/confirmed?ref=${json.ref}${json.billing?.onTerms ? "&billed=1" : ""}`);
  }

  const price = ai ? { low: ai.low, high: ai.high } : est ? { low: est.low, high: est.high } : null;
  const suggested = quote ? quote.price : ai?.final_price ?? est?.point ?? 0;
  const proOffers = !siteVisit && !quote && suggested ? rankProOffers(proRows, suggested, slug) : [];
  const picked = proOffers.find((o) => o.pro_id === choice) ?? null;
  const offerNum = Math.round(Number(offer) || 0);
  const offerChk = offerNum && suggested ? offerCheck(offerNum, suggested) : null;
  const named = Boolean(!quote && !picked && offerChk?.ok && offerNum !== suggested);
  const listTotal = picked ? picked.price : named ? offerNum : suggested;
  // Plus member saving + promo / gift card, from the server (same rules as at booking)
  async function checkPerks(code = promo) {
    if (!svc || siteVisit || !listTotal) return setPerks(null);
    const res = await fetch("/api/promo/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: svc.slug, price: listTotal, rush: isRush(date), email: form.contact_email || undefined, code: code || undefined }) });
    setPerks(res.ok ? await res.json() : null);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (step === 3 || perks) checkPerks(); }, [step, listTotal, date]);
  const total = perks ? perks.price : listTotal;
  const contactOk = form.contact_name.length > 1 && /\S+@\S+\.\S+/.test(form.contact_email) && form.contact_phone.length >= 7;
  const eventDateOk = !svc?.leadDays || (date >= addDays(svc.leadDays) && date <= addDays(365));
  const placeOk = eventDateOk && form.address.length > 2 && form.city.length > 1 && /^\d{5}$/.test(form.zip) && form.state.length === 2 && (Boolean(svc?.leadDays) || urgency !== null);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div>
        {ask && <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">
          <span>★ {es ? `Se le ofrece primero a ${ask.label} por unas horas; si no puede, otro profesional verificado lo toma.` : `${ask.label} gets the first look for a few hours; if they can't, another vetted pro takes it.`}{ask.crewName ? (es ? ` Pidió a ${ask.crewName}; el dueño de la empresa decide quién va.` : ` You asked for ${ask.crewName}; the company owner decides who goes.`) : ""}</span>
          <button type="button" className="text-xs underline" onClick={() => setAsk(null)}>{es ? "Cualquier profesional" : "Any pro is fine"}</button></div>}
        {business && <div className="mb-4 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark"><b>{business.company}</b> · {business.propertyName} ({business.address}, {business.city}) · {business.billing}</div>}
        <ol className="mb-6 flex gap-2 text-xs font-semibold">
          {["Service", "Details", "When & where", "Review"].map((lbl, i) => (
            <li key={lbl} className={`rounded-full px-3 py-1 ${i === step ? "bg-brand-deep text-white" : i < step ? "bg-brand-tint text-brand-dark" : "bg-white text-ink-soft border border-line"}`}>{i + 1}. {t(lbl)}</li>
          ))}
        </ol>

        {step === 0 && (() => {
          // one category at a time (or a search across all of them) instead of every service in one long list
          const q = find.trim().toLowerCase();
          const list = q
            ? SERVICES.filter((s) => `${serviceText(locale, s.slug, s).name} ${s.name} ${s.tagline}`.toLowerCase().includes(q))
            : SERVICES.filter((s) => s.category === pickCat);
          return (
            <div className="space-y-4">
              <input className="input" type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder={es ? "Buscar un servicio (p. ej., limpieza, jardín, sitio web)" : "Search a service (e.g. cleaning, lawn, website)"} aria-label={es ? "Buscar un servicio" : "Search a service"} />
              {!q && (
                <div className="-mx-1 flex flex-wrap gap-2" role="tablist" aria-label={es ? "Categorías" : "Categories"}>
                  {CATEGORIES.map((c) => (
                    <button key={c.id} type="button" role="tab" aria-selected={pickCat === c.id} onClick={() => setPickCat(c.id)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${pickCat === c.id ? "border-brand bg-brand-tint text-brand-dark" : "border-line bg-white text-ink hover:border-brand"}`}>{c.icon} {categoryText(locale, c.id, c).name}</button>
                  ))}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((s) => (
                  <button key={s.slug} onClick={() => pick(s.slug)} className="card flex items-center gap-3 text-left transition hover:border-brand">
                    <span className="text-2xl">{s.icon}</span>
                    <span><span className="block text-sm font-semibold">{serviceText(locale, s.slug, s).name}</span><span className="text-xs text-ink-soft">{priceHint(s.slug, locale)}</span></span>
                  </button>
                ))}
                {!list.length && <p className="text-sm text-ink-soft">{es ? "Nada coincide. Pruebe otra palabra o elija una categoría." : "Nothing matches. Try another word or pick a category."}</p>}
              </div>
            </div>
          );
        })()}

        {step === 1 && svc && (
          <div className="card space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{svc.icon} {serviceText(locale, svc.slug, svc).name}</h2>
              <button className="text-sm text-brand" onClick={() => setStep(0)}>{t("Change")}</button>
            </div>
            {svc.questions.filter((q) => questionVisible(q, answers, svc.questions)).map((q) => (
              <div key={q.id}>
                <label className="label">{t(q.label)}{q.type === "number" && q.required && <span className="text-rose-700"> *</span>}</label>
                {q.type === "number" && (
                  <NumberField min={q.min} max={q.max} unit={q.unit ? t(q.unit) : undefined} value={Number(answers[q.id] ?? q.default)}
                    onChange={(v) => { setAnswers((cur) => ({ ...cur, [q.id]: v })); resetAi(); }} />
                )}
                {q.type === "select" && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((o) => (
                      <button key={o.value} onClick={() => { setAnswers({ ...answers, [q.id]: o.value }); resetAi(); }} className={`rounded-full border px-3.5 py-1.5 text-sm ${answers[q.id] === o.value ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{t(o.label)}</button>
                    ))}
                  </div>
                )}
                {q.type === "toggle" && (
                  <button onClick={() => { setAnswers({ ...answers, [q.id]: !answers[q.id] }); resetAi(); }} className={`rounded-full border px-3.5 py-1.5 text-sm ${answers[q.id] ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{answers[q.id] ? t("Yes") : t("No")}</button>
                )}
                {q.help && <p className="mt-1 text-xs text-ink-soft">{t(q.help)}</p>}
                {q.type === "number" && q.required && !(Number(answers[q.id] ?? 0) > 0) && <p className="mt-1 text-xs font-semibold text-rose-700">{es ? "Escriba la medida para ver su precio." : "Enter the measurement to see your price."}</p>}
              </div>
            ))}
            {svc.frequencies.length > 1 && (
              <div>
                <label className="label">{t("How often")}</label>
                <div className="flex flex-wrap gap-2">
                  {svc.frequencies.map((f) => (
                    <button key={f} onClick={() => setFrequency(f)} className={`rounded-full border px-3.5 py-1.5 text-sm ${frequency === f ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{t(FREQ_LABEL[f])}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="label">{t("Anything we should know?")}</label>
              <textarea className="input min-h-24" placeholder={svc?.notesHint ? t(svc.notesHint) : t("Gate code, pets, parking, what's in the garage, the tree is leaning toward the house…")} value={notes} onChange={(e) => { setNotes(e.target.value); resetAi(); }} />
            </div>
            <div>
              <label className="label">
                {rule?.need === "required" ? (es ? `Fotos — obligatorias (al menos ${rule.min})` : `Photos — required (at least ${rule.min})`) : t(rule?.need === "recommended" ? "Photos — recommended" : "Photos (optional)")}
              </label>
              {rule && rule.tips.length > 0 && (
                <ul className="mb-2 grid gap-1 text-sm text-ink-soft sm:grid-cols-2">{rule.tips.map((tip) => <li key={tip}>📷 {t(tip)}</li>)}</ul>
              )}
              <PhotoPicker value={photos} onChange={(p) => { setPhotos(p); resetAi(); }} onError={setError} locale={locale} />
              <p className="mt-1 text-xs text-ink-soft">{t("Our AI checks your photos so the price fits the job — no surprises on the day.")}</p>
              {photosMissing && photos.length > 0 && <p className="mt-1 text-xs text-amber-800">{photosMissing}</p>}
            </div>
            <button className="btn-primary" disabled={Boolean(photosMissing) || measuresMissing.length > 0} onClick={() => setStep(2)}>{measuresMissing.length ? (es ? `Falta: ${measuresMissing.map((q) => t(q.label)).join(", ")}` : `Enter: ${measuresMissing.map((q) => t(q.label)).join(", ")}`) : photosMissing ? (es ? `Agregue ${rule!.min - photos.length} foto(s) más para continuar` : `Add ${rule!.min - photos.length} more photo${rule!.min - photos.length > 1 ? "s" : ""} to continue`) : t("Continue")}</button>
          </div>
        )}

        {step === 2 && (
          <div className="card space-y-5">
            <h2 className="text-xl font-bold">{t("When & where")}</h2>
            {!business && homes.length > 0 && (
              <div>
                <label className="label">{es ? "¿En cuál de sus casas?" : "Which of your homes?"}</label>
                <div className="flex flex-wrap gap-2">
                  {homes.map((h) => <button key={h.id} type="button" onClick={() => pickHome(h)} className={`rounded-full border px-3.5 py-1.5 text-sm ${homeId === h.id ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>🏠 {h.label}</button>)}
                  <button type="button" onClick={() => { pickHome(null); setForm((f) => ({ ...f, address: "", city: "", zip: "" })); }} className={`rounded-full border px-3.5 py-1.5 text-sm ${!homeId ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{es ? "Otra dirección" : "Another address"}</button>
                </div>
                {homeId && homes.find((h) => h.id === homeId)?.hasAccess && <p className="mt-1 text-xs text-ink-soft">🔒 {es ? "Sus detalles de entrada guardados van solo al profesional asignado." : "Your saved entry details go only to the pro assigned to this job."}</p>}
              </div>
            )}
            <div className="max-w-[10rem]"><label className="label">{t("Service ZIP code")}</label><input className="input" inputMode="numeric" maxLength={5} value={form.zip} onChange={set("zip")} placeholder="48226" /></div>
            {svc?.leadDays ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="label">{svc.category === "transport" ? "Pickup date" : "Event date"}</label>
                  <input type="date" className="input" min={addDays(svc.leadDays)} max={addDays(365)} value={date < addDays(svc.leadDays) ? "" : date}
                    onChange={(e) => { setDate(e.target.value); setWin("flexible"); }} />
                  <p className="mt-1 text-xs text-ink-soft">Book at least {svc.leadDays} days ahead — up to a year out.</p></div>
                <div><label className="label">{svc.category === "transport" ? "Pickup time" : "Start time"}</label>
                  <select className="input" value={String(answers.start_time ?? "18:00")} onChange={(e) => setAnswers((cur) => ({ ...cur, start_time: e.target.value }))}>
                    {(svc.category === "transport" ? PICKUP_TIMES : START_TIMES).map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select></div>
              </div>
            ) : (
              <>
                <div>
                  <label className="label">{t("When do you need it done?")}</label>
                  <div className="flex flex-wrap gap-2">
                    {URGENCY.map((u) => (
                      <button key={u.id} type="button" title={u.hint} onClick={() => setUrgency(u.id)} className={`rounded-full border px-3.5 py-1.5 text-sm ${urgency === u.id ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{u.id === "asap" ? "⚡ " : ""}{t(u.label)}</button>
                    ))}
                  </div>
                  {urgency && <p className="mt-1 text-xs text-ink-soft">{t(URGENCY.find((u) => u.id === urgency)?.hint ?? "")}{urgency !== "flexible" ? ` · ${locale === "es" ? "antes del" : "by"} ${new Date(`${neededBy(urgency)}T12:00:00`).toLocaleDateString(locale === "es" ? "es-US" : "en-US", { weekday: "short", month: "short", day: "numeric" })}` : ""}</p>}
                </div>
                {urgency && <p className="text-sm font-semibold">{es ? "Elija el día y la hora de llegada que prefiere" : "Pick the day and arrival time you'd like"}</p>}
                {urgency && <BookingCalendar key={urgency} service={slug} zip={form.zip} date={date} window={win} today={urgency === "asap"} until={neededBy(urgency)} earliest={urgency === "asap"} locale={locale} onChange={(d, w) => { setDate(d); setWin(w); }} />}
              </>
            )}
            <div className="flex gap-2">
              {(["residential", "commercial"] as const).map((ct) => (
                <button key={ct} onClick={() => setForm({ ...form, customer_type: ct })} className={`rounded-full border px-3.5 py-1.5 text-sm capitalize ${form.customer_type === ct ? "border-brand bg-brand-tint font-semibold text-brand-dark" : "border-line bg-white"}`}>{t(ct === "residential" ? "Home" : "Business")}</button>
              ))}
            </div>
            {form.customer_type === "commercial" && <div><label className="label">{t("Company")}</label><input className="input" value={form.company_name} onChange={set("company_name")} /></div>}
            <div><label className="label">{t(svc?.leadDays ? "Event address (or your neighborhood if you need a venue)" : svc?.remote ? "Business address" : "Street address")}</label><input className="input" autoComplete="street-address" value={form.address} onChange={set("address")} /></div>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <div><label className="label">{t("City")}</label><input className="input" value={form.city} onChange={set("city")} /></div>
              <div><label className="label">{t("State")}</label><input className="input uppercase" maxLength={2} value={form.state} onChange={set("state")} /></div>
            </div>
            {!business && !svc?.remote && (
              <div>
                <label className="label">🔒 {homeId ? (es ? "¿Algo diferente para esta visita? (opcional)" : "Anything different for this visit? (optional)") : (es ? "Cómo entrar (opcional)" : "How to get in (optional)")}</label>
                <textarea className="input min-h-16" maxLength={1000} value={access} onChange={(e) => setAccess(e.target.value)} placeholder={es ? "Código de la caja de llaves, dónde está la llave, código del portón…" : "Lockbox code, where the key is, gate or alarm code…"} />
                <p className="mt-1 text-xs text-ink-soft">{es ? "Solo lo ve el profesional asignado a su trabajo, no los que deciden si lo toman." : "Only the pro assigned to your job sees this — not pros deciding whether to take it."}</p>
                {signedIn && !homeId && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={saveHome} onChange={(e) => setSaveHome(e.target.checked)} /> {es ? "Guardar esta casa en Mis casas" : "Save this home to My homes"}</label>}
              </div>
            )}
            <div className="flex gap-2"><button className="btn-ghost" onClick={() => setStep(1)}>{t("Back")}</button><button className="btn-primary" disabled={!placeOk} onClick={() => setStep(3)}>{t("Continue")}</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="card space-y-5">
            <h2 className="text-xl font-bold">{t("Your contact info")}</h2>
            <div><label className="label">{t("Full name")}</label><input className="input" autoComplete="name" value={form.contact_name} onChange={set("contact_name")} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">{t("Email")}</label><input className="input" type="email" autoComplete="email" value={form.contact_email} onChange={set("contact_email")} /></div>
              <div><label className="label">{t("Mobile")}</label><input className="input" type="tel" autoComplete="tel" value={form.contact_phone} onChange={set("contact_phone")} /></div>
            </div>
            <SmsConsent es={es} purpose="booking" />
            {svc && !siteVisit && est && (() => {
              // how they pay: 25% now and the rest when it's done (default), or in full now with 5% off; events and site-visit work offer a deposit
              const dp = depositPolicy(svc.slug, total, date);
              const bn = bookNowPolicy(svc.slug, total);
              const saving = payInFullSaving(total, Number.MAX_SAFE_INTEGER);
              const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(es ? "es-US" : "en-US", { month: "short", day: "numeric" }) : t("before the job"));
              const full = [
                "full",
                es ? `Pagar todo ahora · ${money(total - saving)}` : `Pay in full now · ${money(total - saving)}`,
                saving ? (es ? `5% de descuento: ahorra ${money(saving)}. No hay nada más que pagar.` : `5% off — you save ${money(saving)}. Nothing more to pay.`) : t("Nothing more to pay."),
              ] as const;
              const options = bn.allowed
                ? [["after", es ? `Pagar 25% ahora · ${money(bn.amount)}` : `Pay 25% now · ${money(bn.amount)}`, es ? `Asegura su fecha. El resto (${money(bn.balance)}) se cobra a la misma tarjeta cuando el trabajo esté terminado.` : `Locks your date. The rest (${money(bn.balance)}) is charged to the same card when the job is done.`] as const, full]
                : dp.allowed
                  ? [["deposit", `${t("Pay a deposit")} · ${money(dp.amount)}`, es ? `Asegura su fecha. ${money(dp.balance)} se cobra a la misma tarjeta el ${fmt(dp.balanceDue)}.` : `Locks your date. ${money(dp.balance)} is charged to the same card on ${fmt(dp.balanceDue)}.`] as const, full]
                  : null;
              if (!options) return null;
              const current = resolvePlan(plan, dp.allowed, bn.allowed);
              return (
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.map(([k, title, d]) => (
                    <button key={k} type="button" onClick={() => setPlan(k)} className={`rounded-xl border p-3 text-left text-sm ${current === k ? "border-brand bg-brand-tint" : "border-line bg-white"}`}>
                      <div className="font-semibold">{title}</div><div className="text-xs text-ink-soft">{d}</div>
                    </button>
                  ))}
                </div>
              );
            })()}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>{t("I agree to the")} <a href="/terms/service-agreement" target="_blank" className="font-semibold text-brand underline">{t("Service Agreement")}</a>: {siteVisit ? t(svc?.remote ? "the consultation is free; I pay once I approve the firm quote." : "the site visit is free; I pay upfront once I approve the firm quote.") : es ? "pago el 25% ahora y el resto a la misma tarjeta cuando el trabajo esté terminado (o todo ahora con 5% de descuento); ustedes le pagan al profesional cuando el trabajo esté hecho y revisado; lo rehacemos gratis o le devolvemos su dinero si no queda bien." : "I pay 25% now and the rest to the same card when the job is done (or everything now for 5% off); you pay the pro after the job is done and checked; free redo or refund if it’s not right."}</span>
            </label>
            {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost" onClick={() => setStep(2)}>{t("Back")}</button>
              <button className="btn-primary" disabled={!contactOk || !agreed || busy || aiBusy} onClick={book}>{aiBusy ? t("Checking your photos…") : busy ? t(siteVisit ? "Booking…" : "Finalizing your price…") : siteVisit ? t(svc?.remote ? "Book free consultation" : "Book free site visit") : (() => {
                // what's charged today under the plan this booking actually gets
                const dp = depositPolicy(svc!.slug, total, date), bn = bookNowPolicy(svc!.slug, total);
                const p = resolvePlan(plan, dp.allowed, bn.allowed);
                const now = p === "deposit" ? dp.amount : p === "after" ? bn.amount : Math.max(0, (perks ? perks.dueNow : total) - payInFullSaving(total, Number.MAX_SAFE_INTEGER));
                const what = p === "deposit" ? (es ? " de depósito" : " deposit") : p === "after" ? (es ? " (25%)" : " (25%)") : "";
                return `${t("Pay")} ${est ? money(now) : ""}${what} ${es ? "y reservar" : "& book"}`;
              })()}</button>
            </div>
          </div>
        )}
      </div>

      {svc && est && price && (
        <aside className="card h-fit lg:sticky lg:top-24">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t(svc.slug === "event-package" ? "Your budget — how we’d spend it" : siteVisit ? "Estimated range" : frequency === "once" ? "Your price" : "Per visit")}</div>
          <div className="mt-1 text-3xl font-bold">{siteVisit ? moneyRange(price.low, price.high) : money(listTotal)}</div>
          {siteVisit && !svc.remote && <a href={`/quote-request?service=${svc.slug}`} className="mt-1 block text-sm text-brand underline">{es ? "O reciba hasta 3 cotizaciones firmes en 24 horas" : "Or get up to 3 firm quotes in 24 hours"}</a>}
          {quote && <p className="mt-2 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">{es ? `Cotización firme de ${quote.pro}: ${money(quote.price)}, todo incluido. ${quote.pro} recibe el trabajo primero.` : `Firm quote from ${quote.pro}: ${money(quote.price)}, all-in. ${quote.pro} gets the job first.`}</p>}
          {proOffers.length > 0 && (
            <div className="mt-3 rounded-xl border border-line p-3 text-sm">
              <div className="font-semibold">{es ? "Elija su precio" : "Choose your price"}</div>
              <p className="mt-1 text-xs text-ink-soft">{es ? "Todos los precios son finales y por adelantado. Profesionales verificados fijan sus propios precios." : "Every price is final and upfront. Vetted pros set their own prices."}</p>
              <div className="mt-2 space-y-2">
                <button type="button" onClick={() => setChoice(null)} className={`w-full rounded-lg border p-2 text-left ${!picked ? "border-brand bg-brand-tint" : "border-line"}`}>
                  <div className="flex justify-between font-semibold"><span>{es ? "Precio de Handled" : "Handled's price"}</span><span>{money(named ? offerNum : suggested)}</span></div>
                  <div className="text-xs text-ink-soft">{es ? "Asignación más rápida: el primer profesional verificado disponible" : "Fastest match: the first available vetted pro"}</div>
                </button>
                {proOffers.map((o) => (
                  <button key={o.pro_id} type="button" onClick={() => setChoice(o.pro_id)} className={`w-full rounded-lg border p-2 text-left ${picked?.pro_id === o.pro_id ? "border-brand bg-brand-tint" : "border-line"}`}>
                    <div className="flex justify-between font-semibold"><span>{o.name}</span><span>{money(o.price)}</span></div>
                    <div className="text-xs text-ink-soft">★ {Number(o.rating).toFixed(1)} · {o.jobs_completed} {es ? "trabajos" : "jobs"}{o.badges.length ? ` · ${o.badges.map((b) => t(b)).join(" · ")}` : ""}</div>
                  </button>
                ))}
              </div>
              {picked && <p className="mt-2 text-xs text-ink-soft">{es ? `${picked.name} recibe el trabajo primero por unas horas; si no puede, otro profesional verificado lo hace al mismo precio.` : `${picked.name} gets the first look for a few hours; if they can't, another vetted pro does it at the same price.`}</p>}
            </div>
          )}
          {!siteVisit && !quote && !picked && svc.slug !== "event-package" && (
            <div className="mt-3 rounded-xl border border-line p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t("Name your price")}</span>
                {named && <button type="button" className="text-xs text-brand underline" onClick={() => setOffer("")}>{t("Use suggested")} {money(suggested)}</button>}
              </div>
              <p className="mt-1 text-xs text-ink-soft">{locale === "es" ? `Sugerido: ${money(suggested)} — lo que los profesionales de su zona aceptan con más frecuencia. Ofrezca menos o más; los profesionales deciden.` : `Suggested: ${money(suggested)} — what pros near you accept most often. Offer less or more; pros decide.`}</p>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" className="btn-ghost px-3 py-1" onClick={() => setOffer(String(Math.max(offerCheck(1, suggested).min, Math.round(listTotal * 0.95))))}>−5%</button>
                <div className="flex flex-1 items-center gap-1"><span className="text-ink-soft">$</span><input className="input text-right" inputMode="numeric" value={offer || String(suggested)} onChange={(e) => setOffer(e.target.value.replace(/[^\d]/g, ""))} aria-label={t("Your price")} /></div>
                <button type="button" className="btn-ghost px-3 py-1" onClick={() => setOffer(String(Math.round(listTotal * 1.05)))}>+5%</button>
              </div>
              {offerChk && !offerChk.ok && <p className="mt-1 text-xs text-rose-700">{offerChk.level === "too_low" ? (locale === "es" ? `Las ofertas empiezan en ${money(offerChk.min)} para este trabajo.` : `Offers start at ${money(offerChk.min)} for this job.`) : (locale === "es" ? `Hasta ${money(offerChk.max)} — llámenos para trabajos más grandes.` : `Up to ${money(offerChk.max)} — call us for bigger jobs.`)}</p>}
              {offerChk?.ok && offerChk.level === "low" && <p className="mt-1 text-xs text-amber-800">{t("Lower offers can take longer to get a pro — we'll let you know if no one takes it.")}</p>}
              {offerChk?.ok && offerNum > suggested && <p className="mt-1 text-xs text-brand-dark">✓ {t("A higher offer usually gets a pro faster.")}</p>}
              <p className="mt-2 text-xs text-ink-soft">{locale === "es" ? `Incluye un cargo por reserva de ${money(BOOKING_FEE)}` : `Includes a ${money(BOOKING_FEE)} booking fee`}</p>
            </div>
          )}
          {svc.slug !== "event-package" && (() => {
            const fit = budgetFit(Number(budget), siteVisit ? price.low : ai?.final_price ?? est.point);
            return (
              <div className="mt-3">
                <label className="label">{t("Your budget (optional)")}</label>
                <div className="flex items-center gap-2"><span className="text-ink-soft">$</span><input className="input" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} placeholder={t("What you’d like to spend")} /></div>
                {fit.status !== "none" && <p className={`mt-1 text-xs ${fit.status === "fits" ? "text-brand-dark" : fit.status === "close" ? "text-amber-800" : "text-rose-700"}`}>{fit.status === "fits" ? "✓ " : ""}{locale === "es" ? budgetMessage(locale, fit, Number(budget)) : fit.message}</p>}
              </div>
            );
          })()}
          {!siteVisit && svc.slug !== "event-package" && (
            <div className="mt-3">
              <label className="label">{t("Promo, gift card or referral code")}</label>
              <div className="flex gap-2"><input className="input uppercase" value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} placeholder={t("CODE")} /><button type="button" className="btn-ghost" onClick={() => checkPerks()}>{t("Apply")}</button></div>
              {perks?.promoMessage && <p className={`mt-1 text-xs ${perks.promoOk ? "text-brand-dark" : "text-rose-700"}`}>{perks.promoOk ? "✓ " : ""}{t(perks.promoMessage)}{perks.promoOk && perks.promoAmount === 0 && !perks.isGift ? ` ${t("(already at our lowest price for this job)")}` : ""}</p>}
            </div>
          )}
          {perks && (perks.memberBenefit > 0 || perks.promoAmount > 0 || perks.gift > 0) && (
            <div className="mt-3 space-y-1 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">
              {perks.memberBenefit > 0 && <div className="flex justify-between"><span>⭐ {t("Plus member saving")}</span><span>−{money(perks.memberBenefit)}</span></div>}
              {perks.promoAmount > 0 && <div className="flex justify-between"><span>{t("Code")} {perks.promoCode}</span><span>−{money(perks.promoAmount)}</span></div>}
              {perks.gift > 0 && <div className="flex justify-between"><span>{t("Gift card")}</span><span>−{money(perks.gift)}</span></div>}
              <div className="flex justify-between border-t border-brand/20 pt-1 font-semibold"><span>{t("Due today")}</span><span>{money(perks.dueNow)}</span></div>
            </div>
          )}
          {aiBusy && <p className="mt-2 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">✨ {t("Checking your photos and notes so the price fits the job…")}</p>}
          {ai && <p className="mt-2 rounded-xl bg-brand-tint p-3 text-sm text-brand-dark">✨ {ai.customer_summary}</p>}
          {ai?.changes && ai.changes.length > 0 && (
            <div className="mt-2 rounded-xl border border-line p-3 text-xs">
              <div className="font-semibold">{t("Updated from your photos")}</div>
              {ai.changes.map((c) => <div key={c.label} className="mt-1 text-ink-soft"><b>{c.label}:</b> {c.from} → {c.to} <span className="italic">({c.reason})</span></div>)}
              <p className="mt-1 text-ink-soft">{t("Not right? Change your answers above.")}</p>
            </div>
          )}
          {bigJob && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{bigJob}: {t("a pro visits free to give you a firm quote. Nothing is charged until you approve it.")}</p>}
          {ai?.action === "site_visit" && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{ai.action_reason} Nothing is charged until you approve the firm quote.</p>}
          {svc.slug === "event-package" && planEventBudget({ budget: Number(answers.budget), guests: Number(answers.guests), eventType: String(answers.event_type), haveVenue: answers.venue === "have", alcohol: answers.alcohol === true }).warnings.map((w) => (
            <p key={w} className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{w}</p>
          ))}
          {svc.category === "events" && svc.slug !== "event-package" && Number(answers.guests) >= 50 && (() => {
            const bar = answers.bar === true;
            const sec = securityAdvice({ guests: Number(answers.guests), alcohol: bar || Number(answers.guests) < 150 });
            return (
              <p className="mt-2 rounded-xl border border-line p-3 text-xs">
                🛡️ {bar || Number(answers.guests) >= 150
                  ? (es ? `Para ${answers.guests} invitados${bar ? " con alcohol" : ""} recomendamos ${sec.guards} guardia(s) con licencia.` : `For ${answers.guests} guests${bar ? " with alcohol" : ""} we recommend ${sec.guards} licensed guard${sec.guards > 1 ? "s" : ""}.`)
                  : (es ? `¿Habrá alcohol? Recomendamos ${sec.guards} guardia(s) con licencia.` : `Serving alcohol? We recommend ${sec.guards} licensed guard${sec.guards > 1 ? "s" : ""}.`)}{" "}
                <a href={`/book?service=event-security&guards=${sec.guards}&hours=${sec.hours}`} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">{es ? "Agregar seguridad" : "Add event security"}</a>
              </p>
            );
          })()}
          <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            {est.items.map((i) => (
              <li key={i.label} className="flex justify-between gap-3"><span className="text-ink-soft">{lineText(locale, i.label)}</span><span className={i.amount < 0 ? "text-brand" : ""}>{money(i.amount)}</span></li>
            ))}
          </ul>
          {!siteVisit && svc.slug !== "event-package" && step < 3 && <SaveQuote slug={svc.slug} answers={answers} frequency={frequency} locale={locale} />}
          {needsCheck && !ai && step < 3 && <p className="mt-4 text-xs text-ink-soft">✨ {t("Our AI checks your photos and notes before you pay.")}</p>}
          <p className="mt-4 text-xs text-ink-soft">
            {t(svc.slug === "event-package" ? "Free planning call first. Your planner sends a firm plan at or under this budget; you pay once you approve it." : siteVisit ? (svc.remote ? "Free video consultation — a specialist confirms the scope and firm price, then you pay to start the work." : "Free site visit — a pro confirms the firm price, then you pay to lock in the work.") : BRAND.promise)}
          </p>
        </aside>
      )}
    </div>
  );
}

/**
 * Number input + slider. Typing is free-form (no clamping per keystroke — that turned
 * "2500" into 10000); the value is applied live while in range and clamped on blur.
 * Big ranges (square feet) step by 50 on the slider.
 */
function NumberField({ value, min, max, unit, onChange }: { value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const step = max >= 2000 ? 50 : max >= 200 ? 5 : 1;
  const shown = editing ? text : value.toLocaleString("en-US");
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => { onChange(Number(e.target.value)); setText(e.target.value); }}
        className="flex-1 accent-[var(--color-brand)]" aria-label={unit ?? "amount"} />
      {unit === "$" && <span className="-mr-2 text-sm font-semibold text-ink-soft">$</span>}
      <input type="text" inputMode="numeric" className="input w-28 text-right" value={shown}
        onFocus={() => { setEditing(true); setText(String(value)); }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          setText(raw);
          const n = Number(raw);
          if (raw && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => { setEditing(false); const n = Number(text); onChange(Math.min(max, Math.max(min, Number.isFinite(n) && text ? n : value))); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      {unit && unit !== "$" && <span className="w-12 text-sm text-ink-soft">{unit}</span>}
    </div>
  );
}
