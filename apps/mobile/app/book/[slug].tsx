/*
 * FILE    : apps/mobile/app/book/[slug].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_0302 UTC — "When do you need it done?" (ASAP incl. same day … flexible) and optional budget.
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish (questions, answers, tips, steps).
 * UPDATED : 2026-10-03_0152 UTC — market pricing (local market factor from /api/market, "Name your price" → customer_offer).
 * UPDATED : 2026-10-04_2204 UTC — "Book again with …" (?pro=&crew=): the pro gets the first look (checked on the server).
 * PURPOSE : Native booking flow — same questions & pricing engine as the website.
 * UPDATED : 2026-10-05_0449 UTC — Snap & post a job: photos, job details, notes and timeframe arrive filled in.
 * UPDATED : 2026-10-05_1433 UTC — event bookings with 50+ guests suggest licensed guards (opens Event Security prefilled).
 * UPDATED : 2026-10-06_0645 UTC — built to finish on a phone: the price and the Pay & book button stay pinned at the bottom;
 *           the keyboard never covers a field; name, email, phone and address are remembered from the last booking
 *           (and the signed-in email fills in); the button names the next missing step and missing fields turn red;
 *           Stripe Checkout opens in an in-app sheet; a link to an unknown service shows a friendly message.
 * UPDATED : 2026-10-06_0708 UTC — Pay & book opens Apple Pay / Google Pay / card right in the app (Stripe PaymentSheet); closing it
 *           keeps the booking with Pay now / Later; Checkout is the fallback.
 */
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BRAND, RUSH_SURCHARGE, securityAdvice, URGENCY, budgetFit, budgetMessage, neededBy, type Urgency, depositPolicy, photoProblem, photoRule, sizeNeedsSiteVisit, TIME_WINDOW_LABEL, type DaySlots, BOOKING_FEE, offerCheck, splitJob, defaultAnswers, estimate, getService, isRush, questionVisible, money, moneyRange, type Answers, type Frequency, type TimeWindow } from "@handled/core";
import { API_URL, api } from "../../lib/supabase";
import { Button, C, Card, Chip, ErrorState, Field, Form, StickyBar, s } from "../../components/ui";
import { payForJob } from "../../lib/pay";
import { haptic } from "../../lib/haptics";
import { loadProfile, saveProfile } from "../../lib/profile";
import { useSession } from "../../lib/session";
import { Calendar, NumberBox } from "../../components/BookingPickers";
import { useI18n } from "../../lib/i18n";
import { PhotoStrip } from "../../components/PhotoStrip";
import type { Shot } from "../../lib/photos";

const FREQ_TEXT: Record<Frequency, string> = { once: "One time", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Quarterly" };

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function Book() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const known = getService(slug);
  if (!known) return <MissingService />;
  return <BookService slug={slug} />;
}

/** A link to a service that no longer exists. */
function MissingService() {
  const { t } = useI18n();
  return <View style={[s.screen, s.pad]}><ErrorState icon="🔍" message={t("This service isn't available anymore.")} /><Button title={t("See all services")} onPress={() => router.replace("/")} /></View>;
}

function BookService({ slug: _slug }: { slug: string }) {
  const { slug, pro, crew, shots: snapShots, notes: snapNotes, when: snapWhen, answers: snapAnswers } = useLocalSearchParams<{ slug: string; pro?: string; crew?: string; shots?: string; notes?: string; when?: string; answers?: string }>();
  const parse = <T,>(v: string | undefined, fb: T): T => { try { return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } };
  const [ask, setAsk] = useState(Boolean(pro));
  const svc = getService(slug)!;
  const [answers, setAnswers] = useState<Answers>({ ...defaultAnswers(svc), ...parse<Answers>(snapAnswers, {}) });
  const { t, locale, svc: svcText } = useI18n();
  const es = locale === "es";
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [urgency, setUrgency] = useState<Urgency | null>(URGENCY.some((u) => u.id === snapWhen) ? (snapWhen as Urgency) : null);
  const [budget, setBudget] = useState("");
  const [promo, setPromo] = useState("");
  const [date, setDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [win, setWin] = useState<TimeWindow>("morning");
  const [notes, setNotes] = useState(snapNotes ?? "");
  const [shots, setShots] = useState<Shot[]>(parse<Shot[]>(snapShots, []).filter((x) => typeof x?.path === "string" && x.path.startsWith("booking/")).slice(0, 8));
  const photos = shots.map((x) => x.path);
  const [f, setF] = useState({ contact_name: "", contact_email: "", contact_phone: "", address: "", city: "", state: "MI", zip: "" });
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [tried, setTried] = useState(false);
  const { me } = useSession();
  // remembered from the last booking on this phone; the signed-in email fills in when there's none
  useEffect(() => {
    let live = true;
    loadProfile().then((p) => {
      if (!live) return;
      setF((cur) => {
        const next = { ...cur };
        (Object.keys(next) as (keyof typeof next)[]).forEach((k) => { const v = p[k]; if (!next[k] && typeof v === "string" && v) next[k] = v; });
        if (!next.contact_email && me?.email) next.contact_email = me.email;
        if (!next.state) next.state = "MI";
        return next;
      });
    });
    return () => { live = false; };
  }, [me?.email]);
  const [plan, setPlan] = useState<"full" | "deposit">("full");
  // what pros in this area actually accept (learned) — the same factor the server prices with
  const [market, setMarket] = useState(1);
  const zipOk = /^\d{5}$/.test(f.zip);
  useEffect(() => {
    let live = true;
    api<{ factor?: number }>(`/api/market?service=${encodeURIComponent(svc.slug)}${zipOk ? `&zip=${f.zip}` : ""}`)
      .then((r) => { if (live && r.ok) setMarket(Number(r.data.factor) || 1); })
      .catch(() => {});
    return () => { live = false; };
  }, [svc.slug, zipOk, f.zip]);
  const est = useMemo(() => estimate({ slug: svc.slug, answers, frequency, rush: isRush(date), market }), [svc, answers, frequency, date, market]);
  // Name your price ("" = our suggestion)
  const [offer, setOffer] = useState("");
  const suggested = est.point;
  const offerNum = Math.round(Number(offer) || 0);
  const offerChk = offerNum && suggested ? offerCheck(offerNum, suggested) : null;
  const named = Boolean(offerChk?.ok && offerNum !== suggested);
  const listTotal = named ? offerNum : suggested;
  const dp = depositPolicy(svc.slug, listTotal, date);
  const useDeposit = plan === "deposit" && dp.allowed && !svc.siteVisit && !sizeNeedsSiteVisit(svc.slug, answers);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const rule = photoRule(svc.slug);
  const photosMissing = photoProblem(svc.slug, photos.length, locale);
  const bigJob = sizeNeedsSiteVisit(svc.slug, answers);
  const siteVisit = svc.siteVisit || Boolean(bigJob);

  /** Before paying: required photos, then the AI price check (books at exactly the price shown). */
  async function checkAndBook() {
    if (photosMissing) return Alert.alert(t("Photos needed"), photosMissing);
    if (siteVisit || (!notes.trim() && !photos.length)) return book(null);
    setBusy(true);
    const q = await api<{ ai: { final_price: number; action?: string; action_reason?: string; customer_summary?: string; changes?: { label: string; from: string; to: string }[] } | null; quote_token: string | null }>("/api/quote", {
      method: "POST",
      body: JSON.stringify({ service_slug: svc.slug, answers, frequency, scheduled_date: date, notes, photos, ai: true, locale, ...(zipOk ? { zip: f.zip } : {}) }),
    });
    setBusy(false);
    if (q.offline) return Alert.alert(t("No connection"), t(q.data.error ?? "Check your signal or Wi-Fi and try again."));
    const ai = q.data.ai;
    const token = q.data.quote_token ?? null;
    if (!ai || (ai.action !== "site_visit" && ai.final_price === est.point && !ai.changes?.length)) return book(token);
    // a named price stands as long as it is still a valid offer against the checked price (the server re-checks)
    if (named && ai.action !== "site_visit") {
      const chk = offerCheck(offerNum, ai.final_price);
      if (chk.ok) return book(token);
      return Alert.alert(`${t("Checked from your photos")}: ${money(ai.final_price)}`, chk.level === "too_low" ? (es ? `Las ofertas empiezan en ${money(chk.min)} para este trabajo.` : `Offers start at ${money(chk.min)} for this job.`) : (es ? `Hasta ${money(chk.max)} — llámenos para trabajos más grandes.` : `Up to ${money(chk.max)} — call us for bigger jobs.`));
    }
    const changes = (ai.changes ?? []).map((c) => `• ${c.label}: ${c.from} → ${c.to}`).join("\n");
    if (ai.action === "site_visit") {
      return Alert.alert(t("Free site visit"), `${ai.action_reason ?? ""} ${t("Nothing is charged until you approve the firm quote.")}`, [{ text: t("Cancel"), style: "cancel" }, { text: t("Book free visit"), onPress: () => book(token) }]);
    }
    Alert.alert(`${t("Checked from your photos")}: ${money(ai.final_price)}`, `${ai.customer_summary ?? ""}${changes ? `\n\n${changes}` : ""}`, [
      { text: t("Edit details"), style: "cancel" },
      { text: `${t("Continue at")} ${money(ai.final_price)}`, onPress: () => book(token) },
    ]);
  }

  /** Apple Pay / Google Pay / card in the app; closing the sheet keeps the booking (pay now or later). */
  async function payBooking(id: string, ref: string, checkout: string | null) {
    const done = () => router.replace(me ? { pathname: "/job/[id]", params: { id } } : "/");
    const res = await payForJob({ jobId: id, email: f.contact_email.trim(), locale, fallbackUrl: checkout });
    if (res.status === "paid") {
      haptic("success");
      return Alert.alert(`${t("Paid")} ✓ — ${ref}`, t("You're booked. We're matching your pro now and will notify you when they're confirmed."), [{ text: "OK", onPress: done }]);
    }
    if (res.status === "checkout") return router.replace(me ? "/jobs" : "/");
    Alert.alert(res.status === "canceled" ? t("Your booking is saved") : t("Payment didn't go through"), `${res.message ? `${t(res.message)}\n\n` : ""}${t("It's confirmed once it's paid. Pay now, or anytime from Bookings.")}`, [
      { text: t("Later"), style: "cancel", onPress: () => router.replace(me ? "/jobs" : "/") },
      { text: t("Pay now"), onPress: () => payBooking(id, ref, checkout) },
    ]);
  }

  async function book(quoteToken: string | null) {
    setBusy(true);
    const r = await api<{ id: string; ref: string; status: string; checkout: string | null; price: number | null; error?: string }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ ...f, service_slug: svc.slug, answers, frequency, scheduled_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : tomorrow(), time_window: win, notes: notes || null, photos, source: "mobile", accept_terms: agreed, payment_plan: useDeposit ? "deposit" : "full", quote_token: quoteToken, promo_code: promo || null, locale, urgency: svc.leadDays ? null : urgency, customer_budget: Number(budget) > 0 ? Number(budget) : null, customer_offer: named && !siteVisit ? offerNum : null, preferred_pro_id: ask && pro ? pro : null, requested_crew_member_id: ask && pro && crew ? crew : null }),
    });
    setBusy(false);
    if (!r.ok) { haptic("error"); return Alert.alert(t("Couldn't book"), t(r.data.error ?? "Please check the form")); }
    saveProfile({ contact_name: f.contact_name.trim(), contact_email: f.contact_email.trim(), contact_phone: f.contact_phone.trim(), address: f.address.trim(), city: f.city.trim(), state: f.state.trim() || "MI", zip: f.zip });
    if (r.data.checkout) return payBooking(r.data.id, r.data.ref, r.data.checkout); // paid upfront; the pro is dispatched once paid
    Alert.alert(`${t("Booked")} — ${r.data.ref}`, r.data.status === "site_visit" ? t("A pro will visit to confirm your firm price.") : t("A coordinator will contact you to take payment — your pro is confirmed once it's paid."), [{ text: "OK", onPress: () => router.replace("/") }]);
  }

  // what still stands between the customer and booking, in the order they'll meet it on the screen
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.contact_email.trim());
  const phoneOk = f.contact_phone.replace(/\D/g, "").length >= 10;
  const problems: { key: string; msg: string }[] = [];
  if (!svc.leadDays && !urgency) problems.push({ key: "when", msg: t("Choose when you need it done") });
  if (photosMissing) problems.push({ key: "photos", msg: es ? `Agregue ${rule.min - photos.length} foto(s) más` : `Add ${rule.min - photos.length} more photo(s)` });
  if (!zipOk) problems.push({ key: "zip", msg: t("Enter the 5-digit ZIP code") });
  if (f.address.trim().length < 4) problems.push({ key: "address", msg: t("Add the street address") });
  if (f.city.trim().length < 2) problems.push({ key: "city", msg: t("Add the city") });
  if (f.contact_name.trim().length < 2) problems.push({ key: "contact_name", msg: t("Add your name") });
  if (!emailOk) problems.push({ key: "contact_email", msg: t("Enter a valid email") });
  if (!phoneOk) problems.push({ key: "contact_phone", msg: t("Enter a 10-digit mobile number") });
  if (!siteVisit && offerChk && !offerChk.ok) problems.push({ key: "offer", msg: t("Adjust your price offer") });
  if (!agreed) problems.push({ key: "agree", msg: t("Agree to the Service Agreement") });
  const errFor = (k: string) => (tried ? problems.find((x) => x.key === k)?.msg ?? null : null);
  const payTitle = busy ? t("Checking your price…") : siteVisit ? t("Book free site visit") : useDeposit ? (es ? `Pagar depósito de ${money(dp.amount)} y reservar` : `Pay ${money(dp.amount)} deposit & book`) : (es ? `Pagar ${money(listTotal)} y reservar` : `Pay ${money(listTotal)} & book`);
  function submit() {
    if (problems.length) {
      haptic("warning");
      setTried(true);
      return Alert.alert(t("Almost there"), problems.map((x) => `• ${x.msg}`).join("\n"));
    }
    haptic("tap");
    checkAndBook();
  }

  return (
    <Form footer={
      <StickyBar>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ minWidth: 92 }}>
            <Text style={[s.label, { marginBottom: 0 }]}>{t(siteVisit ? "Estimated range" : frequency === "once" ? "Your price" : "Per visit")}</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink }} accessibilityLiveRegion="polite">{siteVisit ? moneyRange(est.low, est.high) : money(useDeposit ? dp.amount : listTotal)}</Text>
          </View>
          <Button title={problems.length ? problems[0].msg : payTitle} busy={busy} onPress={submit} kind={problems.length ? "dark" : "primary"} style={{ flex: 1 }} />
        </View>
      </StickyBar>
    }>
      <Text style={s.h1}>{svc.icon} {svcText(svc).name}</Text>
      {ask ? (
        <Pressable onPress={() => setAsk(false)} style={{ backgroundColor: C.tint, borderRadius: 12, padding: 10, marginBottom: 8 }}>
          <Text style={s.p}>★ {t("Your pro gets the first look for a few hours; if they can't, another vetted pro takes it.")} <Text style={{ textDecorationLine: "underline" }}>{t("Any pro is fine")}</Text></Text>
        </Pressable>
      ) : null}
      <Card style={{ marginTop: 12, backgroundColor: C.tint, borderColor: C.brand }}>
        <Text style={s.label}>{t(siteVisit ? "Estimated range" : frequency === "once" ? "Your price" : "Per visit")}</Text>
        <Text style={{ fontSize: 30, fontWeight: "800", color: C.ink }}>{siteVisit ? moneyRange(est.low, est.high) : money(listTotal)}</Text>
        <Text style={s.p}>{siteVisit ? t("Free site visit confirms the firm price.") : t(BRAND.promise)}</Text>
        {svc.category === "events" && svc.slug !== "event-package" && Number(answers.guests) >= 50 ? (() => {
          const g = Number(answers.guests), bar = answers.bar === true, sure = bar || g >= 150;
          const sec = securityAdvice({ guests: g, alcohol: bar || g < 150 });
          return (
            <Pressable onPress={() => router.push({ pathname: "/book/[slug]", params: { slug: "event-security", answers: JSON.stringify({ guards: sec.guards, hours: sec.hours }) } })} style={{ marginTop: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, backgroundColor: C.white }}>
              <Text style={[s.p, { fontSize: 14 }]}>🛡️ {sure ? (es ? `Para ${g} invitados${bar ? " con alcohol" : ""} recomendamos ${sec.guards} guardia(s) con licencia.` : `For ${g} guests${bar ? " with alcohol" : ""} we recommend ${sec.guards} licensed guard${sec.guards > 1 ? "s" : ""}.`) : (es ? `¿Habrá alcohol? Recomendamos ${sec.guards} guardia(s) con licencia.` : `Serving alcohol? We recommend ${sec.guards} licensed guard${sec.guards > 1 ? "s" : ""}.`)}</Text>
              <Text style={{ color: C.brand, fontWeight: "700", marginTop: 4 }}>{t("Add event security")} →</Text>
            </Pressable>
          );
        })() : null}
        {!siteVisit && svc.slug !== "event-package" && (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, backgroundColor: C.white }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={s.b}>{t("Name your price")}</Text>
              {named ? <Pressable onPress={() => setOffer("")}><Text style={{ color: C.brand, fontWeight: "700" }}>{t("Use suggested")} {money(suggested)}</Text></Pressable> : null}
            </View>
            <Text style={[s.p, { fontSize: 14 }]}>{es ? `Sugerido: ${money(suggested)} — lo que los profesionales de su zona aceptan con más frecuencia. Ofrezca menos o más; los profesionales deciden.` : `Suggested: ${money(suggested)} — what pros near you accept most often. Offer less or more; pros decide.`}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Button title="−5%" kind="ghost" style={{ paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, flexShrink: 0 }} onPress={() => setOffer(String(Math.max(offerCheck(1, suggested).min, Math.round(listTotal * 0.95))))} />
              <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={s.p}>$</Text>
                <TextInput value={offer || String(suggested)} onChangeText={(v) => setOffer(v.replace(/[^\d]/g, ""))} keyboardType="number-pad" accessibilityLabel={t("Your price")} style={[s.input, { flex: 1, minWidth: 0, width: "100%", paddingVertical: 8, textAlign: "right", fontWeight: "700" }]} />
              </View>
              <Button title="+5%" kind="ghost" style={{ paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, flexShrink: 0 }} onPress={() => setOffer(String(Math.round(listTotal * 1.05)))} />
            </View>
            {offerChk && !offerChk.ok ? <Text style={[s.p, { fontSize: 14, color: C.red }]}>{offerChk.level === "too_low" ? (es ? `Las ofertas empiezan en ${money(offerChk.min)} para este trabajo.` : `Offers start at ${money(offerChk.min)} for this job.`) : (es ? `Hasta ${money(offerChk.max)} — llámenos para trabajos más grandes.` : `Up to ${money(offerChk.max)} — call us for bigger jobs.`)}</Text> : null}
            {offerChk?.ok && offerChk.level === "low" ? <Text style={[s.p, { fontSize: 14, color: "#b45309" }]}>{t("Lower offers can take longer to get a pro — we'll let you know if no one takes it.")}</Text> : null}
            {offerChk?.ok && offerNum > suggested ? <Text style={[s.p, { fontSize: 14, color: C.brand }]}>✓ {t("A higher offer usually gets a pro faster.")}</Text> : null}
            <Text style={[s.p, { fontSize: 14, marginTop: 6 }]}>{es ? `Su profesional gana ${money(splitJob(listTotal, slug).payout)} · incluye un cargo por reserva de ${money(BOOKING_FEE)}` : `Your pro earns ${money(splitJob(listTotal, slug).payout)} · includes a ${money(BOOKING_FEE)} booking fee`}</Text>
          </View>
        )}
        {svc.slug !== "event-package" && (
          <>
            <Field label={t("Your budget (optional, $)")} value={budget} onChangeText={(v) => setBudget(v.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" placeholder={t("What you'd like to spend")} />
            {(() => { const fit = budgetFit(Number(budget), siteVisit ? est.low : listTotal); return fit.status === "none" ? null : <Text style={[s.p, { color: fit.status === "fits" ? C.brand : fit.status === "close" ? "#b45309" : "#be123c" }]}>{fit.status === "fits" ? "✓ " : ""}{es ? budgetMessage(locale, fit, Number(budget)) : fit.message}</Text>; })()}
          </>
        )}
      </Card>
      {svc.questions.filter((q) => questionVisible(q, answers, svc.questions)).map((q) => (
        <View key={q.id} style={{ marginTop: 14 }}>
          <Text style={s.label}>{t(q.label)}</Text>
          {q.help ? <Text style={[s.p, { marginBottom: 6, fontSize: 14 }]}>{t(q.help)}</Text> : null}
          {q.type === "number" && q.max >= 200 && (
            <NumberBox value={Number(answers[q.id])} min={q.min} max={q.max} unit={q.unit ? t(q.unit) : undefined} onChange={(v) => setAnswers((cur) => ({ ...cur, [q.id]: v }))} />
          )}
          {q.type === "number" && q.max < 200 && (
            <View style={[s.row, { alignItems: "center" }]}>
              <Chip label="−" on={false} onPress={() => setAnswers({ ...answers, [q.id]: Math.max(q.min, Number(answers[q.id]) - 1) })} />
              <Text style={[s.b, { minWidth: 70, textAlign: "center", marginBottom: 8 }]}>{String(answers[q.id])} {q.unit ? t(q.unit) : ""}</Text>
              <Chip label="+" on={false} onPress={() => setAnswers({ ...answers, [q.id]: Math.min(q.max, Number(answers[q.id]) + 1) })} />
            </View>
          )}
          {q.type === "select" && <View style={s.row}>{q.options.map((o) => <Chip key={o.value} label={t(o.label)} on={answers[q.id] === o.value} onPress={() => setAnswers({ ...answers, [q.id]: o.value })} />)}</View>}
          {q.type === "toggle" && <View style={s.row}><Chip label={answers[q.id] ? t("Yes") : t("No")} on={Boolean(answers[q.id])} onPress={() => setAnswers({ ...answers, [q.id]: !answers[q.id] })} /></View>}
        </View>
      ))}
      {svc.frequencies.length > 1 && (
        <View style={{ marginTop: 14 }}><Text style={s.label}>{t("How often")}</Text><View style={s.row}>{svc.frequencies.map((x) => <Chip key={x} label={t(FREQ_TEXT[x])} on={frequency === x} onPress={() => setFrequency(x)} />)}</View></View>
      )}
      <Text style={s.h2}>{t("Details")}</Text>
      <Field label={t("Notes for the pro")} value={notes} onChangeText={setNotes} multiline placeholder={svc.notesHint ? t(svc.notesHint) : t("Gate code, pets, what needs hauling…")} />
      <Text style={s.label}>{rule.need === "required" ? (es ? `Fotos — obligatorias (al menos ${rule.min})` : `Photos — required (at least ${rule.min})`) : t(rule.need === "recommended" ? "Photos — recommended" : "Photos (optional)")}</Text>
      {rule.tips.length ? <Text style={s.p}>{rule.tips.map((tip) => `📷 ${t(tip)}`).join("   ")}</Text> : null}
      <PhotoStrip shots={shots} onChange={setShots} />
      {photos.length > 0 || rule.need !== "none" ? <Text style={[s.p, { marginTop: 4 }]}>{t("Our AI checks your photos so the price fits the job — no surprises on the day.")}</Text> : null}
      <Text style={s.h2}>{t("When & where")}</Text>
      <Field label={t("Service ZIP code")} value={f.zip} onChangeText={(v) => set("zip")(v.replace(/\D/g, ""))} keyboardType="number-pad" maxLength={5} textContentType="postalCode" autoComplete="postal-code" error={errFor("zip")} />
      {svc.leadDays ? (
        <>
          <Field label={es ? `Fecha del evento (AAAA-MM-DD) — al menos ${svc.leadDays} días antes` : `Event date (YYYY-MM-DD) — at least ${svc.leadDays} days out`} value={date} onChangeText={(t) => { setDate(t); setWin("flexible"); }} placeholder="2026-12-12" />
          <Field label={t(svc.category === "transport" ? "Pickup time (e.g. 5:30 am)" : "Start time (e.g. 6:00 pm)")} value={String(answers.start_time ?? "")} onChangeText={(t) => setAnswers((cur) => ({ ...cur, start_time: t }))} />
        </>
      ) : (
        <>
          <Text style={s.label}>{t("When do you need it done?")}</Text>
          <View style={s.row}>{URGENCY.map((u) => <Chip key={u.id} label={`${u.id === "asap" ? "⚡ " : ""}${t(u.label)}`} on={urgency === u.id} onPress={() => setUrgency(u.id)} />)}</View>
          {urgency ? <Text style={[s.p, { marginBottom: 8 }]}>{t(URGENCY.find((u) => u.id === urgency)?.hint ?? "")}</Text> : null}
          {urgency && <Calendar key={urgency} service={svc.slug} zip={f.zip} date={date} win={win} today={urgency === "asap"} until={neededBy(urgency)} earliest={urgency === "asap"} onChange={(d, w) => { setDate(d); setWin(w); }} />}
        </>
      )}
      <Field label={t("Street address")} value={f.address} onChangeText={set("address")} textContentType="fullStreetAddress" autoComplete="street-address" error={errFor("address")} />
      <Field label={t("City")} value={f.city} onChangeText={set("city")} textContentType="addressCity" error={errFor("city")} />
      <View style={{ width: 80 }}><Field label={t("State")} value={f.state} onChangeText={set("state")} maxLength={2} autoCapitalize="characters" /></View>
      <Field label={t("Promo, gift card or referral code (optional)")} value={promo} onChangeText={(v) => setPromo(v.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} autoCapitalize="characters" />
      <Text style={[s.p, { fontSize: 14, marginTop: -6, marginBottom: 6 }]}>{t("Savings and Plus member pricing are applied at checkout.")}</Text>
      <Text style={s.h2}>{t("Contact")}</Text>
      <Field label={t("Full name")} value={f.contact_name} onChangeText={set("contact_name")} textContentType="name" autoComplete="name" error={errFor("contact_name")} />
      <Field label={t("Email")} value={f.contact_email} onChangeText={set("contact_email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" error={errFor("contact_email")} />
      <Field label={t("Mobile")} value={f.contact_phone} onChangeText={set("contact_phone")} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" error={errFor("contact_phone")} />
      {dp.allowed && !siteVisit ? (
        <>
          <Text style={s.h2}>{t("How would you like to pay?")}</Text>
          <View style={s.row}>
            <Chip label={`${t("Pay in full")} · ${money(listTotal)}`} on={!useDeposit} onPress={() => setPlan("full")} />
            <Chip label={`${t("Deposit")} · ${money(dp.amount)}`} on={useDeposit} onPress={() => setPlan("deposit")} />
          </View>
          {useDeposit ? <Text style={s.p}>{es ? `Asegura su fecha y profesional. El saldo de ${money(dp.balance)} se cobra a la misma tarjeta${dp.balanceDue ? ` el ${dp.balanceDue}` : " antes de su fecha"}.` : `Locks in your date and pro. Balance of ${money(dp.balance)} is charged to the same card${dp.balanceDue ? ` on ${dp.balanceDue}` : " before your date"}.`}</Text> : null}
        </>
      ) : null}
      <View style={[s.row, { marginTop: 8, alignItems: "center" }]}>
        <Chip label={agreed ? `✓ ${t("I agree")}` : t("I agree")} on={agreed} onPress={() => setAgreed(!agreed)} />
        <Text style={[s.p, { flex: 1 }]} onPress={() => Linking.openURL(`${API_URL}/terms/service-agreement`)}>{t("to the")} <Text style={{ color: C.brand, fontWeight: "700" }}>{t("Service Agreement")}</Text>{t(": pay upfront, free redo or refund if it's not right.")}</Text>
      </View>
    </Form>
  );
}
