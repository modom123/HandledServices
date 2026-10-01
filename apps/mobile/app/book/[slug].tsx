/*
 * FILE    : apps/mobile/app/book/[slug].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Native booking flow — same questions & pricing engine as the website.
 */
import { useMemo, useState } from "react";
import { Alert, Linking, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { BRAND, TIME_WINDOW_LABEL, defaultAnswers, estimate, getService, isRush, money, moneyRange, type Answers, type Frequency, type TimeWindow } from "@handled/core";
import { api } from "../../lib/supabase";
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
  const est = useMemo(() => estimate({ slug: svc.slug, answers, frequency, rush: isRush(date) }), [svc, answers, frequency, date]);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  async function addPhotos() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.6, selectionLimit: 8 });
    if (r.canceled) return;
    const fd = new FormData();
    r.assets.forEach((a, i) => fd.append("photos", { uri: a.uri, name: `photo-${i}.jpg`, type: a.mimeType ?? "image/jpeg" } as never));
    const up = await api<{ paths: string[]; error?: string }>("/api/uploads", { method: "POST", body: fd });
    if (!up.ok) return Alert.alert("Upload failed", up.data.error ?? "");
    setPhotos([...photos, ...up.data.paths]);
  }

  async function book() {
    setBusy(true);
    const r = await api<{ ref: string; status: string; checkout: string | null; price: number | null; error?: string }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify({ ...f, service_slug: svc.slug, answers, frequency, scheduled_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : tomorrow(), time_window: win, notes: notes || null, photos, source: "mobile" }),
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
        <Text style={s.label}>{svc.siteVisit ? "Estimated range" : frequency === "once" ? "Your price" : "Per visit"}</Text>
        <Text style={{ fontSize: 28, fontWeight: "800", color: C.ink }}>{moneyRange(est.low, est.high)}</Text>
        <Text style={s.p}>{svc.siteVisit ? "Free site visit confirms the firm price." : BRAND.promise}</Text>
      </Card>
      {svc.questions.map((q) => (
        <View key={q.id} style={{ marginTop: 14 }}>
          <Text style={s.label}>{q.label}</Text>
          {q.type === "number" && (
            <View style={[s.row, { alignItems: "center" }]}>
              <Chip label="−" on={false} onPress={() => setAnswers({ ...answers, [q.id]: Math.max(q.min, Number(answers[q.id]) - (q.max > 100 ? 50 : 1)) })} />
              <Text style={[s.b, { minWidth: 70, textAlign: "center", marginBottom: 8 }]}>{String(answers[q.id])} {q.unit ?? ""}</Text>
              <Chip label="+" on={false} onPress={() => setAnswers({ ...answers, [q.id]: Math.min(q.max, Number(answers[q.id]) + (q.max > 100 ? 50 : 1)) })} />
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
      <Field label="Notes for the pro" value={notes} onChangeText={setNotes} multiline placeholder="Gate code, pets, what needs hauling…" />
      <Button title={`📷 Add photos (${photos.length})`} kind="ghost" onPress={addPhotos} />
      <Text style={s.h2}>When & where</Text>
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <View style={s.row}>{(Object.keys(TIME_WINDOW_LABEL) as TimeWindow[]).map((w) => <Chip key={w} label={TIME_WINDOW_LABEL[w]} on={win === w} onPress={() => setWin(w)} />)}</View>
      <Field label="Street address" value={f.address} onChangeText={set("address")} />
      <Field label="City" value={f.city} onChangeText={set("city")} />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ width: 80 }}><Field label="State" value={f.state} onChangeText={set("state")} maxLength={2} autoCapitalize="characters" /></View>
        <View style={{ flex: 1 }}><Field label="ZIP" value={f.zip} onChangeText={set("zip")} keyboardType="number-pad" maxLength={5} /></View>
      </View>
      <Text style={s.h2}>Contact</Text>
      <Field label="Full name" value={f.contact_name} onChangeText={set("contact_name")} />
      <Field label="Email" value={f.contact_email} onChangeText={set("contact_email")} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Mobile" value={f.contact_phone} onChangeText={set("contact_phone")} keyboardType="phone-pad" />
      <Button title={busy ? "Finalizing…" : svc.siteVisit ? "Book free site visit" : `Pay ${money(est.point)} & book`} busy={busy} onPress={book} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}
