/*
 * FILE    : apps/mobile/app/book/[slug].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_0302 UTC — "When do you need it done?" (ASAP incl. same day … flexible) and optional budget.
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish (questions, answers, tips, steps).
 * PURPOSE : Native booking flow — same questions & pricing engine as the website.
 */
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BRAND, RUSH_SURCHARGE, URGENCY, budgetFit, budgetMessage, neededBy, type Urgency, depositPolicy, photoProblem, photoRule, sizeNeedsSiteVisit, TIME_WINDOW_LABEL, type DaySlots, defaultAnswers, estimate, getService, isRush, questionVisible, money, moneyRange, type Answers, type Frequency, type TimeWindow } from "@handled/core";
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
  const est = useMemo(() => estimate({ slug: svc.slug, answers, frequency, rush: isRush(date) }), [svc, answers, frequency, date]);
  const dp = depositPolicy(svc.slug, est.point, date);
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
      body: JSON.stringify({ service_slug: svc.slug, answers, frequency, scheduled_date: date, notes, photos, ai: true, locale }),
    });
    setBusy(false);
    const ai = q.data.ai;
    const token = q.data.quote_token ?? null;
    if (!ai || (ai.action !== "site_visit" && ai.final_price === est.point && !ai.changes?.length)) return book(token);
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
      body: JSON.stringify({ ...f, service_slug: svc.slug, answers, frequency, scheduled_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : tomorrow(), time_window: win, notes: notes || null, photos, source: "mobile", accept_terms: agreed, payment_plan: useDeposit ? "deposit" : "full", quote_token: quoteToken, promo_code: promo || null, urgency: svc.leadDays ? null : urgency, customer_budget: Number(budget) > 0 ? Number(budget) : null }),
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
        <Text style={{ fontSize: 30, fontWeight: "800", color: C.ink }}>{siteVisit ? moneyRange(est.low, est.high) : money(est.point)}</Text>
        <Text style={s.p}>{siteVisit ? t("Free site visit confirms the firm price.") : t(BRAND.promise)}</Text>
        {svc.slug !== "event-package" && (
          <>
            <Field label={t("Your budget (optional, $)")} value={budget} onChangeText={(v) => setBudget(v.replace(/[^\d.]/g, ""))} keyboardType="decimal-pad" placeholder={t("What you'd like to spend")} />
            {(() => { const fit = budgetFit(Number(budget), siteVisit ? est.low : est.point); return fit.status === "none" ? null : <Text style={[s.p, { color: fit.status === "fits" ? C.brand : fit.status === "close" ? "#b45309" : "#be123c" }]}>{fit.status === "fits" ? "✓ " : ""}{es ? budgetMessage(locale, fit, Number(budget)) : fit.message}</Text>; })()}
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
            <Chip label={`${t("Pay in full")} · ${money(est.point)}`} on={!useDeposit} onPress={() => setPlan("full")} />
            <Chip label={`${t("Deposit")} · ${money(dp.amount)}`} on={useDeposit} onPress={() => setPlan("deposit")} />
          </View>
          {useDeposit ? <Text style={s.p}>{es ? `Asegura su fecha y profesional. El saldo de ${money(dp.balance)} se cobra a la misma tarjeta${dp.balanceDue ? ` el ${dp.balanceDue}` : " antes de su fecha"}.` : `Locks in your date and pro. Balance of ${money(dp.balance)} is charged to the same card${dp.balanceDue ? ` on ${dp.balanceDue}` : " before your date"}.`}</Text> : null}
        </>
      ) : null}
      <View style={[s.row, { marginTop: 8, alignItems: "center" }]}>
        <Chip label={agreed ? `✓ ${t("I agree")}` : t("I agree")} on={agreed} onPress={() => setAgreed(!agreed)} />
        <Text style={[s.p, { flex: 1 }]} onPress={() => Linking.openURL(`${API_URL}/terms/service-agreement`)}>{t("to the")} <Text style={{ color: C.brand, fontWeight: "700" }}>{t("Service Agreement")}</Text>{t(": pay upfront, free redo or refund if it's not right.")}</Text>
      </View>
      <Button disabled={!agreed || Boolean(photosMissing) || (!svc.leadDays && !urgency)} title={!svc.leadDays && !urgency ? t("Choose when you need it done") : photosMissing ? (es ? `Agregue ${rule.min - photos.length} foto(s) más para reservar` : `Add ${rule.min - photos.length} more photo(s) to book`) : busy ? t("Checking your price…") : siteVisit ? t("Book free site visit") : useDeposit ? (es ? `Pagar depósito de ${money(dp.amount)} y reservar` : `Pay ${money(dp.amount)} deposit & book`) : (es ? `Pagar ${money(est.point)} y reservar` : `Pay ${money(est.point)} & book`)} busy={busy} onPress={checkAndBook} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}
