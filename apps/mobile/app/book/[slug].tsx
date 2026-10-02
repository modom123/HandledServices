/*
 * FILE    : apps/mobile/app/book/[slug].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Native booking flow — same questions & pricing engine as the website.
 */
import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { BRAND, RUSH_SURCHARGE, depositPolicy, photoProblem, photoRule, sizeNeedsSiteVisit, TIME_WINDOW_LABEL, type DaySlots, defaultAnswers, estimate, getService, isRush, money, moneyRange, type Answers, type Frequency, type TimeWindow } from "@handled/core";
import { API_URL, api } from "../../lib/supabase";
import { Button, C, Card, Chip, Field, s } from "../../components/ui";

const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

export default function Book() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const svc = getService(slug)!;
  const [answers, setAnswers] = useState<Answers>(defaultAnswers(svc));
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [date, setDate] = useState(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  const [win, setWin] = useState<TimeWindow>("morning");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [f, setF] = useState({ contact_name: "", contact_email: "", contact_phone: "", address: "", city: "", state: "MI", zip: "" });
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [plan, setPlan] = useState<"full" | "deposit">("full");
  const est = useMemo(() => estimate({ slug: svc.slug, answers, frequency, rush: isRush(date) }), [svc, answers, frequency, date]);
  const dp = depositPolicy(svc.slug, est.point, date);
  const useDeposit = plan === "deposit" && dp.allowed && !svc.siteVisit && !sizeNeedsSiteVisit(svc.slug, answers);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const rule = photoRule(svc.slug);
  const photosMissing = photoProblem(svc.slug, photos.length);
  const bigJob = sizeNeedsSiteVisit(svc.slug, answers);
  const siteVisit = svc.siteVisit || Boolean(bigJob);

  function addPhotos() {
    Alert.alert("Add photos", rule.tips.length ? `Helpful shots: ${rule.tips.join(", ")}` : undefined, [
      { text: "Take a photo", onPress: () => pickPhotos(true) },
      { text: "Choose from library", onPress: () => pickPhotos(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  }
  async function pickPhotos(camera: boolean) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : { granted: true };
    const r = camera && perm.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.6, selectionLimit: 8 - photos.length });
    if (r.canceled) return;
    const fd = new FormData();
    r.assets.forEach((a, i) => fd.append("photos", { uri: a.uri, name: `photo-${i}.jpg`, type: a.mimeType ?? "image/jpeg" } as never));
    const up = await api<{ paths: string[]; error?: string }>("/api/uploads", { method: "POST", body: fd });
    if (!up.ok) return Alert.alert("Upload failed", up.data.error ?? "");
    setPhotos([...photos, ...up.data.paths]);
  }

  /** Before paying: required photos, then the AI price check (books at exactly the price shown). */
  async function checkAndBook() {
    if (photosMissing) return Alert.alert("Photos needed", photosMissing);
    if (siteVisit || (!notes.trim() && !photos.length)) return book(null);
    setBusy(true);
    const q = await api<{ ai: { final_price: number; action?: string; action_reason?: string; customer_summary?: string; changes?: { label: string; from: string; to: string }[] } | null; quote_token: string | null }>("/api/quote", {
      method: "POST",
      body: JSON.stringify({ service_slug: svc.slug, answers, frequency, scheduled_date: date, notes, photos, ai: true }),
    });
    setBusy(false);
    const ai = q.data.ai;
    const token = q.data.quote_token ?? null;
    if (!ai || (ai.action !== "site_visit" && ai.final_price === est.point && !ai.changes?.length)) return book(token);
    const changes = (ai.changes ?? []).map((c) => `• ${c.label}: ${c.from} → ${c.to}`).join("\n");
    if (ai.action === "site_visit") {
      return Alert.alert("Free site visit", `${ai.action_reason ?? ""} Nothing is charged until you approve the firm quote.`, [{ text: "Cancel", style: "cancel" }, { text: "Book free visit", onPress: () => book(token) }]);
    }
    Alert.alert(`Checked from your photos: ${money(ai.final_price)}`, `${ai.customer_summary ?? ""}${changes ? `\n\n${changes}` : ""}`, [
      { text: "Edit details", style: "cancel" },
      { text: `Continue at ${money(ai.final_price)}`, onPress: () => book(token) },
    ]);
  }

  async function book(quoteToken: string | null) {
    setBusy(true);
    const r = await api<{ ref: string; status: string; checkout: string | null; price: number | null; error?: string }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ ...f, service_slug: svc.slug, answers, frequency, scheduled_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : tomorrow(), time_window: win, notes: notes || null, photos, source: "mobile", accept_terms: agreed, payment_plan: useDeposit ? "deposit" : "full", quote_token: quoteToken }),
    });
    setBusy(false);
    if (!r.ok) return Alert.alert("Couldn't book", r.data.error ?? "Please check the form");
    if (r.data.checkout) {
      await Linking.openURL(r.data.checkout); // pay upfront in Stripe Checkout; the pro is dispatched once paid
      return router.replace("/jobs");
    }
    Alert.alert(`Booked — ${r.data.ref}`, r.data.status === "site_visit" ? "A pro will visit to confirm your firm price." : "A coordinator will contact you to take payment — your pro is confirmed once it's paid.", [{ text: "OK", onPress: () => router.replace("/") }]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{svc.icon} {svc.name}</Text>
      <Card style={{ marginTop: 12, backgroundColor: C.tint, borderColor: C.brand }}>
        <Text style={s.label}>{siteVisit ? "Estimated range" : frequency === "once" ? "Your price" : "Per visit"}</Text>
        <Text style={{ fontSize: 28, fontWeight: "800", color: C.ink }}>{siteVisit ? moneyRange(est.low, est.high) : money(est.point)}</Text>
        <Text style={s.p}>{siteVisit ? "Free site visit confirms the firm price." : BRAND.promise}</Text>
      </Card>
      {svc.questions.map((q) => (
        <View key={q.id} style={{ marginTop: 14 }}>
          <Text style={s.label}>{q.label}</Text>
          {q.help ? <Text style={[s.p, { marginBottom: 6, fontSize: 12 }]}>{q.help}</Text> : null}
          {q.type === "number" && q.max >= 200 && (
            <NumberBox value={Number(answers[q.id])} min={q.min} max={q.max} unit={q.unit} onChange={(v) => setAnswers((cur) => ({ ...cur, [q.id]: v }))} />
          )}
          {q.type === "number" && q.max < 200 && (
            <View style={[s.row, { alignItems: "center" }]}>
              <Chip label="−" on={false} onPress={() => setAnswers({ ...answers, [q.id]: Math.max(q.min, Number(answers[q.id]) - 1) })} />
              <Text style={[s.b, { minWidth: 70, textAlign: "center", marginBottom: 8 }]}>{String(answers[q.id])} {q.unit ?? ""}</Text>
              <Chip label="+" on={false} onPress={() => setAnswers({ ...answers, [q.id]: Math.min(q.max, Number(answers[q.id]) + 1) })} />
            </View>
          )}
          {q.type === "select" && <View style={s.row}>{q.options.map((o) => <Chip key={o.value} label={o.label} on={answers[q.id] === o.value} onPress={() => setAnswers({ ...answers, [q.id]: o.value })} />)}</View>}
          {q.type === "toggle" && <View style={s.row}><Chip label={answers[q.id] ? "Yes" : "No"} on={Boolean(answers[q.id])} onPress={() => setAnswers({ ...answers, [q.id]: !answers[q.id] })} /></View>}
        </View>
      ))}
      {svc.frequencies.length > 1 && (
        <View style={{ marginTop: 14 }}><Text style={s.label}>How often</Text><View style={s.row}>{svc.frequencies.map((x) => <Chip key={x} label={x} on={frequency === x} onPress={() => setFrequency(x)} />)}</View></View>
      )}
      <Text style={s.h2}>Details</Text>
      <Field label="Notes for the pro" value={notes} onChangeText={setNotes} multiline placeholder={svc.notesHint ?? "Gate code, pets, what needs hauling…"} />
      <Text style={s.label}>{rule.need === "required" ? `Photos — required (at least ${rule.min})` : rule.need === "recommended" ? "Photos — recommended" : "Photos (optional)"}</Text>
      {rule.tips.length ? <Text style={s.p}>{rule.tips.map((t) => `📷 ${t}`).join("   ")}</Text> : null}
      <Button title={`📷 Add photos (${photos.length})`} kind="ghost" onPress={addPhotos} style={{ marginTop: 6 }} />
      {photos.length > 0 || rule.need !== "none" ? <Text style={[s.p, { marginTop: 4 }]}>Our AI checks your photos so the price fits the job — no surprises on the day.</Text> : null}
      <Text style={s.h2}>When & where</Text>
      <Field label="Service ZIP code" value={f.zip} onChangeText={set("zip")} keyboardType="number-pad" maxLength={5} />
      {svc.leadDays ? (
        <>
          <Field label={`Event date (YYYY-MM-DD) — at least ${svc.leadDays} days out`} value={date} onChangeText={(t) => { setDate(t); setWin("flexible"); }} placeholder="2026-12-12" />
          <Field label={svc.category === "transport" ? "Pickup time (e.g. 5:30 am)" : "Start time (e.g. 6:00 pm)"} value={String(answers.start_time ?? "")} onChangeText={(t) => setAnswers((cur) => ({ ...cur, start_time: t }))} />
        </>
      ) : (
        <Calendar service={svc.slug} zip={f.zip} date={date} win={win} onChange={(d, w) => { setDate(d); setWin(w); }} />
      )}
      <Field label="Street address" value={f.address} onChangeText={set("address")} />
      <Field label="City" value={f.city} onChangeText={set("city")} />
      <View style={{ width: 80 }}><Field label="State" value={f.state} onChangeText={set("state")} maxLength={2} autoCapitalize="characters" /></View>
      <Text style={s.h2}>Contact</Text>
      <Field label="Full name" value={f.contact_name} onChangeText={set("contact_name")} />
      <Field label="Email" value={f.contact_email} onChangeText={set("contact_email")} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Mobile" value={f.contact_phone} onChangeText={set("contact_phone")} keyboardType="phone-pad" />
      {dp.allowed && !siteVisit ? (
        <>
          <Text style={s.h2}>How would you like to pay?</Text>
          <View style={s.row}>
            <Chip label={`Pay in full · ${money(est.point)}`} on={!useDeposit} onPress={() => setPlan("full")} />
            <Chip label={`Deposit · ${money(dp.amount)}`} on={useDeposit} onPress={() => setPlan("deposit")} />
          </View>
          {useDeposit ? <Text style={s.p}>{`Locks in your date and pro. Balance of ${money(dp.balance)} is charged to the same card${dp.balanceDue ? ` on ${dp.balanceDue}` : " before your date"}.`}</Text> : null}
        </>
      ) : null}
      <View style={[s.row, { marginTop: 8, alignItems: "center" }]}>
        <Chip label={agreed ? "✓ I agree" : "I agree"} on={agreed} onPress={() => setAgreed(!agreed)} />
        <Text style={[s.p, { flex: 1 }]} onPress={() => Linking.openURL(`${API_URL}/terms/service-agreement`)}>to the <Text style={{ color: C.brand, fontWeight: "700" }}>Service Agreement</Text>: pay upfront, free redo or refund if it's not right.</Text>
      </View>
      <Button disabled={!agreed || Boolean(photosMissing)} title={photosMissing ? `Add ${rule.min - photos.length} more photo(s) to book` : busy ? "Checking your price…" : siteVisit ? "Book free site visit" : useDeposit ? `Pay ${money(dp.amount)} deposit & book` : `Pay ${money(est.point)} & book`} busy={busy} onPress={checkAndBook} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

/** Typed number entry for large ranges (square feet, linear feet): clamps when you finish typing. */
function NumberBox({ value, min, max, unit, onChange }: { value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <TextInput style={[s.input, { flex: 1 }]} keyboardType="number-pad" value={text}
        onChangeText={(t) => { const raw = t.replace(/[^0-9]/g, ""); setText(raw); const n = Number(raw); if (raw && n >= min && n <= max) onChange(n); }}
        onEndEditing={() => { const n = Math.min(max, Math.max(min, Number(text) || value)); setText(String(n)); onChange(n); }} />
      {unit ? <Text style={s.p}>{unit}</Text> : null}
    </View>
  );
}

/** Booking calendar: days with real availability for this ZIP, then an arrival window. */
function Calendar({ service, zip, date, win, onChange }: { service: string; zip: string; date: string; win: TimeWindow; onChange: (d: string, w: TimeWindow) => void }) {
  const [data, setData] = useState<{ mode: string; days: DaySlots[] } | null>(null);
  useEffect(() => {
    if (!/^\d{5}$/.test(zip)) return setData(null);
    api<{ mode: string; days: DaySlots[] }>(`/api/availability?service=${service}&zip=${zip}`).then((r) => {
      if (!r.ok) return;
      setData(r.data);
      const ok = (d?: DaySlots) => d && !d.closed && d.level !== "full";
      if (!ok(r.data.days.find((d) => d.date === date))) {
        const first = r.data.days.find((d) => ok(d) && !d.rush) ?? r.data.days.find(ok);
        if (first) onChange(first.date, win);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, zip]);
  if (!data) return <Text style={[s.p, { marginBottom: 12 }]}>Enter your ZIP to see open dates.</Text>;
  const day = data.days.find((d) => d.date === date);
  return (
    <View style={{ marginBottom: 12 }}>
      {data.mode === "request" && <Text style={[s.p, { marginBottom: 8 }]}>We're adding pros in your area — pick a time and we'll confirm within one business day.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {data.days.map((d) => {
          const dt = new Date(`${d.date}T12:00:00`);
          const off = d.closed || d.level === "full";
          const sel = d.date === date;
          return (
            <Pressable key={d.date} disabled={off} onPress={() => onChange(d.date, win)}
              style={{ width: 62, marginRight: 6, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: sel ? C.brand : C.line, backgroundColor: sel ? C.brand : off ? C.paper : C.white, opacity: off ? 0.45 : 1 }}>
              <Text style={{ fontSize: 11, color: sel ? C.white : C.soft }}>{dt.toLocaleDateString("en-US", { weekday: "short" })}</Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: sel ? C.white : C.ink }}>{dt.getDate()}</Text>
              <Text style={{ fontSize: 10, color: sel ? C.white : d.level === "limited" ? "#b45309" : C.soft }}>{d.closed ? "closed" : d.level === "full" ? "full" : d.rush ? `+${RUSH_SURCHARGE * 100}%` : d.level === "limited" ? "few left" : dt.toLocaleDateString("en-US", { month: "short" })}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {day && !day.closed && (
        <View style={s.row}>
          {(["morning", "midday", "afternoon", "flexible"] as TimeWindow[]).map((w) => {
            const left = w === "flexible" ? 99 : day.windows[w as "morning"];
            const off = data.mode === "live" && left === 0;
            return <Chip key={w} label={`${TIME_WINDOW_LABEL[w]}${off ? " · full" : w !== "flexible" && data.mode === "live" && left <= 2 ? ` · ${left} left` : ""}`} on={win === w} onPress={() => !off && onChange(day.date, w)} />;
          })}
        </View>
      )}
    </View>
  );
}
