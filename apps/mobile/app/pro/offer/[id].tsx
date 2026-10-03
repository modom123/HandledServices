/*
 * FILE    : apps/mobile/app/pro/offer/[id].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_2047 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * UPDATED : 2026-10-03_0152 UTC — market pricing ("Not enough? Name your pay" counter offer; "countered" status).
 * PURPOSE : Uber-style incoming job: big payout, countdown, the work order (area only until
 *           accepted), job terms, "I agree" and one-tap Accept / Pass. First to accept wins.
 */
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { money, type WorkOrder } from "@handled/core";
import { api } from "../../../lib/supabase";
import { Button, C, Card, s } from "../../../components/ui";
import { useI18n } from "../../../lib/i18n";

type OfferResp = { offer: { id: string; status: string; payout: number; expires_at: string; job_id: string }; workOrder: WorkOrder; error?: string };

export default function OfferScreen() {
  const { t, locale } = useI18n();
  const es = locale === "es";
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<OfferResp | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  // counter offer ("I'll do it for $X" — the customer decides)
  const [countering, setCountering] = useState(false);
  const [want, setWant] = useState("");
  const [why, setWhy] = useState("");
  const [countered, setCountered] = useState<number | null>(null);
  useEffect(() => { api<OfferResp>(`/api/pro/offers/${id}`).then((r) => { if (!r.ok) return Alert.alert(t("Offer unavailable"), r.data.error ?? ""); setData(r.data); setWant(String(Math.round(Number(r.data.offer.payout) * 1.15) || "")); }); }, [id]);
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  if (!data) return <View style={[s.screen, s.pad]}><Text style={s.p}>{t("Loading offer…")}</Text></View>;
  const { offer, workOrder: w } = data;
  const secs = Math.max(0, Math.floor((new Date(offer.expires_at).getTime() - now) / 1000));
  const live = offer.status === "offered" && secs > 0;

  async function act(action: "accept" | "decline") {
    setBusy(true);
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/offers/${id}`, { method: "POST", body: JSON.stringify(action === "accept" ? { action, accept_terms: true } : { action }) });
    setBusy(false);
    if (!r.ok) return Alert.alert(t("Not available"), r.data.error ?? t("Another pro may have taken it."));
    if (action === "accept") { router.replace({ pathname: "/pro/[id]", params: { id: offer.job_id } }); Alert.alert(`${t("It's yours")} ✓`, t("The full address and customer details are now unlocked.")); }
    else router.back();
  }

  async function sendCounter() {
    const payout = Math.round(Number(want) || 0);
    setBusy(true);
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/offers/${id}`, { method: "POST", body: JSON.stringify({ action: "counter", payout, note: why.trim() }) });
    setBusy(false);
    if (!r.ok || !r.data.ok) return Alert.alert(t("Not available"), t(r.data.error ?? "Try again"));
    setCountered(payout);
    setCountering(false);
    setData((d) => (d ? { ...d, offer: { ...d.offer, status: "countered" } } : d));
  }

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: countering ? 480 : 260 }]}>
        <Text style={{ fontSize: 42 }}>{w.icon}</Text>
        <Text style={s.h1}>{w.title}</Text>
        <Text style={s.p}>{w.when}</Text>
        <Card style={{ marginTop: 12 }}>
          <Text style={s.label}>{t("Where")}</Text><Text style={s.b}>{w.where}</Text>
        </Card>
        <Card>
          <Text style={s.label}>{t("Scope")}</Text>
          {w.scope.map((x) => <Text key={x.label} style={s.p}>{t(x.label)}: <Text style={s.b}>{t(String(x.value))}</Text></Text>)}
          <Text style={[s.p, { marginTop: 6 }]}>{t("Included:")} {w.includes.map((x) => t(x)).join(" · ")}</Text>
          {w.customerNotes ? <Text style={[s.p, { marginTop: 6 }]}>{t("Customer:")} “{w.customerNotes}”</Text> : null}
          {w.instructions ? <Text style={[s.p, { marginTop: 6, color: C.brand }]}>{t("Customer requirements & access:")} {w.instructions}</Text> : null}
          <Text style={[s.p, { marginTop: 6 }]}>📷 {w.photos}</Text>
        </Card>
        <Card>
          <Text style={s.label}>{t("Job terms")} (v{w.version})</Text>
          {w.terms.map((x) => <Text key={x} style={[s.p, { marginBottom: 4 }]}>• {t(x)}</Text>)}
        </Card>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.line, padding: 16, paddingBottom: 32 }}>
        {live ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
              <View><Text style={s.label}>{t("Your payout")}</Text><Text style={{ fontSize: 36, fontWeight: "800", color: C.deep }}>{offer.payout ? money(offer.payout) : t("Site visit")}</Text></View>
              <View style={{ alignItems: "flex-end" }}><Text style={s.p}>{t("Expires in")}</Text><Text style={{ fontSize: 26, fontWeight: "800", color: secs < 300 ? C.red : C.ink }}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</Text></View>
            </View>
            <Pressable onPress={() => setAgree(!agree)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 12 }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.brand, backgroundColor: agree ? C.brand : C.white, alignItems: "center", justifyContent: "center" }}>{agree ? <Text style={{ color: C.white, fontWeight: "800" }}>✓</Text> : null}</View>
              <Text style={[s.p, { flex: 1, color: C.ink }]}>{t("I agree to this work order and its job terms")}</Text>
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button title={t("Pass")} kind="ghost" onPress={() => act("decline")} disabled={busy} style={{ flex: 1 }} />
              <Button title={t("Accept job")} onPress={() => act("accept")} busy={busy} disabled={!agree} style={{ flex: 2 }} />
            </View>
            {Number(offer.payout) > 0 && (!countering ? (
              <Pressable onPress={() => setCountering(true)} style={{ marginTop: 10, alignSelf: "center" }}><Text style={{ color: C.brand, fontWeight: "700" }}>{t("Not enough? Name your pay")}</Text></Pressable>
            ) : (
              <View style={{ marginTop: 10, backgroundColor: C.paper, borderRadius: 12, padding: 12 }}>
                <Text style={s.b}>{t("What would you do it for?")}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <Text style={s.p}>$</Text>
                  <TextInput value={want} onChangeText={(v) => setWant(v.replace(/[^\d]/g, ""))} keyboardType="number-pad" style={[s.input, { flex: 1, paddingVertical: 8 }]} />
                </View>
                <TextInput value={why} onChangeText={setWhy} maxLength={500} placeholder={t("Why (optional) — e.g. the yard is bigger than listed")} placeholderTextColor={C.soft} style={[s.input, { marginTop: 6, paddingVertical: 8, fontSize: 15 }]} />
                <Button title={t("Send counter to the customer")} kind="ghost" busy={busy} disabled={!(Number(want) > Number(offer.payout))} onPress={sendCounter} style={{ marginTop: 8, paddingVertical: 10 }} />
                <Text style={[s.p, { fontSize: 13, marginTop: 6 }]}>{t("The customer sees the price it makes and decides. Other pros can still accept the original offer meanwhile.")}</Text>
              </View>
            ))}
          </>
        ) : offer.status === "countered" ? (
          <Text style={[s.b, { textAlign: "center" }]}>{es ? `Envió una contraoferta${countered ? ` de ${money(countered)}` : ""} — si el cliente la acepta, el trabajo es suyo y le avisaremos.` : `You countered${countered ? ` at ${money(countered)}` : ""} — if the customer accepts, the job is yours and we'll let you know.`}</Text>
        ) : (
          <Text style={[s.b, { textAlign: "center" }]}>{offer.status === "accepted" ? `✓ ${t("You accepted this job")}` : t("This offer expired or another pro took it.")}</Text>
        )}
      </View>
    </View>
  );
}
