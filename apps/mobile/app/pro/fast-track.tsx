/*
 * FILE    : apps/mobile/app/pro/fast-track.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_1337 UTC
 * PURPOSE : Pro → Fast track to Pro+ (app twin of the portal page). A pro who is already a master of
 *           their trade sends photos of past work and their experience; we review, their next finished
 *           job is a paid trial we check by hand, and on approval they start at Pro+. Shows where the
 *           application stands. English / Spanish.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { FAST_TRACK, PRO_TIERS, TRADES } from "@handled/core";
import { api } from "../../lib/supabase";
import { pickAndUpload, type Shot } from "../../lib/photos";
import { useI18n } from "../../lib/i18n";
import { Button, C, Card, Chip, Field, s } from "../../components/ui";

type Data = { status: "none" | "applied" | "trial" | "approved" | "declined"; note: string | null; trades: string[]; tier: string };

export default function FastTrack() {
  const { t, locale } = useI18n();
  const es = locale === "es";
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [years, setYears] = useState("");
  const [summary, setSummary] = useState("");
  const [refs, setRefs] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Data>("/api/pro/fast-track");
    if (r.ok) { setD(r.data); setPicked((p) => (p.length ? p : r.data.trades.slice(0, 1))); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const plus = PRO_TIERS.find((x) => x.id === FAST_TRACK.tier)!;
  const boost = `+${Math.round(plus.payoutBoost * 100)}%`;
  const steps = es
    ? [`Envíe de ${FAST_TRACK.minPhotos} a ${FAST_TRACK.maxPhotos} fotos de su trabajo y cuéntenos su experiencia (${FAST_TRACK.minYears}+ años en el oficio).`, "Revisamos su portafolio, normalmente en 2 días hábiles.", `Su siguiente trabajo es su prueba: se paga normal, y nosotros revisamos las fotos y llamamos al cliente (${FAST_TRACK.trialMinRating}★ o más).`, `Si pasa, empieza en Pro+: ${boost} del precio del trabajo en cada pago, ofertas antes que el nivel Pro, y sin el límite de tamaño del período de prueba.`]
    : [`Send ${FAST_TRACK.minPhotos}–${FAST_TRACK.maxPhotos} photos of your work and tell us about your experience (${FAST_TRACK.minYears}+ years in the trade).`, "We review your portfolio, usually within 2 business days.", `Your next job is your trial: paid as usual, and we review the photos and call the customer (${FAST_TRACK.trialMinRating}★ or better).`, `Pass, and you start at Pro+: ${boost} of the job price on every payout, offers before Pro-tier pros, and no probation job-size limit.`];

  async function add(camera: boolean) {
    setBusy(true);
    const got = await pickAndUpload(camera, FAST_TRACK.maxPhotos - shots.length);
    setBusy(false);
    setShots([...shots, ...got]);
  }
  async function send() {
    setBusy(true);
    const r = await api<{ ok?: boolean; error?: string }>("/api/pro/fast-track", { method: "POST", body: JSON.stringify({ years: Number(years) || 0, summary, references: refs, trades: picked, photos: shots.map((x) => x.path) }) });
    setBusy(false);
    if (!r.ok || r.data.ok === false) return Alert.alert(t("Couldn't update"), r.data.error ?? t("Try again"));
    load();
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{t("Fast track to Pro+")}</Text>
      <Text style={[s.p, { marginTop: 6 }]}>{es
        ? `¿Lleva años dominando su oficio? No tiene que empezar desde cero. Normalmente Pro+ se gana con ${plus.min.jobs} trabajos; con la vía rápida, su experiencia lo demuestra desde el principio.`
        : `Been mastering your trade for years? You don’t have to start from zero. Pro+ normally takes ${plus.min.jobs} jobs; the fast track lets your experience prove it up front.`}</Text>
      <Card style={{ marginTop: 12 }}>{steps.map((x, i) => <Text key={x} style={[s.p, { marginBottom: 6 }]}>{i + 1}. {x}</Text>)}</Card>

      {d && (d.tier !== "pro" || d.status === "approved") ? (
        <Card style={{ backgroundColor: C.tint, borderColor: C.brand }}><Text style={s.b}>{es ? "Ya es " : "You’re already "}{PRO_TIERS.find((x) => x.id === d.tier)?.name ?? "Pro+"} ★</Text><Button title={t("Back to jobs")} kind="ghost" onPress={() => router.back()} style={{ marginTop: 8 }} /></Card>
      ) : d?.status === "applied" ? (
        <Card><Text style={s.p}>{t("We have your application. We’re reviewing your portfolio and will let you know by email and in the app.")}</Text></Card>
      ) : d?.status === "trial" ? (
        <Card><Text style={s.p}>{t("Your portfolio passed! The next job you finish is your trial job. Do it like you always do and take good photos at the end.")}</Text>{d.note ? <Text style={[s.p, { marginTop: 6 }]}>{d.note}</Text> : null}</Card>
      ) : d?.status === "declined" ? (
        <Card><Text style={s.p}>{t("We didn’t approve the fast track this time:")} <Text style={s.b}>{d.note}</Text> {t("You keep getting offers and reach Pro+ the normal way.")}</Text></Card>
      ) : d ? (
        <Card>
          <Field label={t("Years in the trade")} value={years} onChangeText={(v) => setYears(v.replace(/\D/g, ""))} keyboardType="number-pad" />
          {d.trades.length > 1 && <><Text style={s.label}>{t("Trades")}</Text><View style={s.row}>{d.trades.map((x) => <Chip key={x} label={t(TRADES.find((y) => y.id === x)?.label ?? x)} on={picked.includes(x)} onPress={() => setPicked(picked.includes(x) ? picked.filter((y) => y !== x) : [...picked, x])} />)}</View></>}
          <Text style={s.label}>{t("Your experience")}</Text>
          <TextInput style={[s.input, { minHeight: 110, textAlignVertical: "top" }]} multiline placeholderTextColor={C.soft} value={summary} onChangeText={setSummary}
            placeholder={t("Tell us about your experience: the work you do, where you learned, jobs you’re proud of.")} />
          <View style={{ height: 12 }} />
          <Field label={t("References (optional)")} value={refs} onChangeText={setRefs} placeholder={t("Customers or contractors, with phone")} />
          <Text style={s.label}>{t("Photos of your work")} ({shots.length}/{FAST_TRACK.maxPhotos})</Text>
          <Text style={[s.p, { fontSize: 14, marginBottom: 8 }]}>{t("Before-and-after works best. The work only: no people, documents or addresses.")}</Text>
          {shots.length > 0 && <View style={[s.row, { gap: 6, marginBottom: 8 }]}>{shots.map((x) => <Image key={x.path} source={{ uri: x.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />)}</View>}
          {shots.length < FAST_TRACK.maxPhotos && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={`📷 ${t("Take photo")}`} kind="ghost" busy={busy} onPress={() => add(true)} style={{ flex: 1 }} />
              <Button title={`🖼️ ${t("From library")}`} kind="ghost" busy={busy} onPress={() => add(false)} style={{ flex: 1 }} />
            </View>
          )}
          <Button title={t("Send application")} busy={busy} disabled={shots.length < FAST_TRACK.minPhotos || !years || summary.trim().length < 40} onPress={send} style={{ marginTop: 12 }} />
          {summary.trim().length > 0 && summary.trim().length < 40 && <Text style={[s.p, { fontSize: 13, marginTop: 6 }]}>{t("A few more words about your experience, please.")}</Text>}
        </Card>
      ) : null}
    </ScrollView>
  );
}
