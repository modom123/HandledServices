/*
 * FILE    : apps/mobile/app/book/[slug].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_0302 UTC — "When do you need it done?" (ASAP incl. same day … flexible) and optional budget.
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish (questions, answers, tips, steps).
 * UPDATED : 2026-10-03_0152 UTC — market pricing (local market factor from /api/market, "Name your price" → customer_offer).
 * PURPOSE : Native booking flow — same questions & pricing engine as the website.
 */
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BRAND, RUSH_SURCHARGE, URGENCY, budgetFit, budgetMessage, neededBy, type Urgency, depositPolicy, photoProblem, photoRule, sizeNeedsSiteVisit, TIME_WINDOW_LABEL, type DaySlots, BOOKING_FEE, offerCheck, splitJob, defaultAnswers, estimate, getService, isRush, questionVisible, money, moneyRange, type Answers, type Frequency, type TimeWindow } from "@handled/core";
import { API_URL, api } from "../../lib/supabase";
import { Button, C, Card, Chip, Field, s } from "../../components/ui";
import { Calendar, NumberBox } from "../../components/BookingPickers";
import { useI18n } from "../../lib/i18n";
import { PhotoStrip } from "../../components/PhotoStrip";
import type { Shot } from "../../lib/photos";

const FREQ_TEXT: Record<Frequency, string> = { once: "One time", weekly: "Weekly", biweekly: "Every 2 weeks", monthly: "Monthly", quarterly: "Quarterly" };

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function Book() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const svc = getService(slug)!;
  const [answers, setAnswers] = useState<Answers>(defaultAnswers(svc));
  const { t, locale, svc: svcText } = useI18n();
  const es = locale === "es";
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [urgency, setUrgency] = useState<Urgency | null>(null);
  const [budget, setBudget] = useState("");
  const [promo, setPromo] = useState("");
  const [date, setDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [win, setWin] = useState<TimeWindow>("morning");
  const [notes, setNotes] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const photos = shots.map((x) => x.path);
  const [f, setF] = useState({ contact_name: "", contact_email: "", contact_phone: "", address: "", city: "", state: "MI", zip: "" });
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
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

  async function book(quoteToken: string | null) {
    setBusy(true);
    const r = await api<{ ref: string; status: string; checkout: string | null; price: number | null; error?: string }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ ...f, service_slug: svc.slug, answers, frequency, scheduled_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : tomorrow(), time_window: win, notes: notes || null, photos, source: "mobile", accept_terms: agreed, payment_plan: useDeposit ? "deposit" : "full", quote_token: quoteToken, promo_code: promo || null, locale, urgency: svc.leadDays ? null : urgency, customer_budget: Number(budget) > 0 ? Number(budget) : null, customer_offer: named && !siteVisit ? offerNum : null }),
    });
    setBusy(false);
    if (!r.ok) return Alert.alert(t("Couldn't book"), r.data.error ?? t("Please check the form"));
    if (r.data.checkout) {
      await Linking.openURL(r.data.checkout); // pay upfront in Stripe Checkout; the pro is dispatched once paid
      return router.replace("/jobs");
    }
    Alert.alert(`${t("Booked")} — ${r.data.ref}`, r.data.status === "site_visit" ? t("A pro will visit to confirm your firm price.") : t("A coordinator will contact you to take payment — your pro is confirmed once it's paid."), [{ text: "OK", onPress: () => router.replace("/") }]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{svc.icon} {svcText(svc).name}</Text>
      <Card style={{ marginTop: 12, backgroundColor: C.tint, borderColor: C.brand }}>
        <Text style={s.label}>{t(siteVisit ? "Estimated range" : frequency === "once" ? "Your price" : "Per visit")}</Text>
        <Text style={{ fontSize: 30, fontWeight: "800", color: C.ink }}>{siteVisit ? moneyRange(est.low, est.high) : money(listTotal)}</Text>
        <Text style={s.p}>{siteVisit ? t("Free site visit confirms the firm price.") : t(BRAND.promise)}</Text>
        {!siteVisit && svc.slug !== "event-package" && (
          <View style={{ marginTop: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 12, backgroundColor: C.white }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={s.b}>{t("Name your price")}</Text>
              {named ? <Pressable onPress={() => setOffer("")}><Text style={{ color: C.brand, fontWeight: "700" }}>{t("Use suggested")} {money(suggested)}</Text></Pressable> : null}
            </View>
            <Text style={[s.p, { fontSize: 14 }]}>{es ? `Sugerido: ${money(suggested)} — lo que los profesionales de su zona aceptan con más frecuencia. Ofrezca menos o más; los profesionales deciden.` : `Suggested: ${money(suggested)} — what pros near you accept most often. Offer less or more; pros decide.`}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
              <Button title="−5%" kind="ghost" style={{ paddingHorizontal: 12, paddingVertical: 8 }} onPress={() => setOffer(String(Math.max(offerCheck(1, suggested).min, Math.round(listTotal * 0.95))))} />
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={s.p}>$</Text>
                <TextInput value={offer || String(suggested)} onChangeText={(v) => setOffer(v.replace(/[^\d]/g, ""))} keyboardType="number-pad" accessibilityLabel={t("Your price")} style={[s.input, { flex: 1, paddingVertical: 8, textAlign: "right" }]} />
              </View>
              <Button title="+5%" kind="ghost" style={{ paddingHorizontal: 12, paddingVertical: 8 }} onPress={() => setOffer(String(Math.round(listTotal * 1.05)))} />
            </View>
            {offerChk && !offerChk.ok ? <Text style={[s.p, { fontSize: 14, color: C.red }]}>{offerChk.level === "too_low" ? (es ? `Las ofertas empiezan en ${money(offerChk.min)} para este trabajo.` : `Offers start at ${money(offerChk.min)} for this job.`) : (es ? `Hasta ${money(offerChk.max)} — llámenos para trabajos más grandes.` : `Up to ${money(offerChk.max)} — call us for bigger jobs.`)}</Text> : null}
            {offerChk?.ok && offerChk.level === "low" ? <Text style={[s.p, { fontSize: 14, color: "#b45309" }]}>{t("Lower offers can take longer to get a pro — we'll let you know if no one takes it.")}</Text> : null}
            {offerChk?.ok && offerNum > suggested ? <Text style={[s.p, { fontSize: 14, color: C.brand }]}>✓ {t("A higher offer usually gets a pro faster.")}</Text> : null}
            <Text style={[s.p, { fontSize: 14, marginTop: 6 }]}>{es ? `Su profesional gana ${money(splitJob(listTotal).payout)} · incluye un cargo por reserva de ${money(BOOKING_FEE)}` : `Your pro earns ${money(splitJob(listTotal).payout)} · includes a ${money(BOOKING_FEE)} booking fee`}</Text>
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
      <Field label={t("Service ZIP code")} value={f.zip} onChangeText={set("zip")} keyboardType="number-pad" maxLength={5} />
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
      <Field label={t("Street address")} value={f.address} onChangeText={set("address")} />
      <Field label={t("City")} value={f.city} onChangeText={set("city")} />
      <View style={{ width: 80 }}><Field label={t("State")} value={f.state} onChangeText={set("state")} maxLength={2} autoCapitalize="characters" /></View>
      <Field label={t("Promo, gift card or referral code (optional)")} value={promo} onChangeText={(v) => setPromo(v.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} autoCapitalize="characters" />
      <Text style={[s.p, { fontSize: 14, marginTop: -6, marginBottom: 6 }]}>{t("Savings and Plus member pricing are applied at checkout.")}</Text>
      <Text style={s.h2}>{t("Contact")}</Text>
      <Field label={t("Full name")} value={f.contact_name} onChangeText={set("contact_name")} />
      <Field label={t("Email")} value={f.contact_email} onChangeText={set("contact_email")} keyboardType="email-address" autoCapitalize="none" />
      <Field label={t("Mobile")} value={f.contact_phone} onChangeText={set("contact_phone")} keyboardType="phone-pad" />
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
      <Button disabled={!agreed || Boolean(photosMissing) || Boolean(!siteVisit && offerChk && !offerChk.ok) || (!svc.leadDays && !urgency)} title={!svc.leadDays && !urgency ? t("Choose when you need it done") : photosMissing ? (es ? `Agregue ${rule.min - photos.length} foto(s) más para reservar` : `Add ${rule.min - photos.length} more photo(s) to book`) : busy ? t("Checking your price…") : siteVisit ? t("Book free site visit") : useDeposit ? (es ? `Pagar depósito de ${money(dp.amount)} y reservar` : `Pay ${money(dp.amount)} deposit & book`) : (es ? `Pagar ${money(listTotal)} y reservar` : `Pay ${money(listTotal)} & book`)} busy={busy} onPress={checkAndBook} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}
