/*
 * FILE    : apps/mobile/app/pro/offer/[id].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_2047 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Uber-style incoming job: big payout, countdown, the work order (area only until
 *           accepted), job terms, "I agree" and one-tap Accept / Pass. First to accept wins.
 */
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { money, type WorkOrder } from "@handled/core";
import { api } from "../../../lib/supabase";
import { Button, C, Card, s } from "../../../components/ui";
import { useI18n } from "../../../lib/i18n";

type OfferResp = { offer: { id: string; status: string; payout: number; expires_at: string; job_id: string }; workOrder: WorkOrder; error?: string };

export default function OfferScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<OfferResp | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { api<OfferResp>(`/api/pro/offers/${id}`).then((r) => r.ok ? setData(r.data) : Alert.alert(t("Offer unavailable"), r.data.error ?? "")); }, [id]);
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

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.pad, { paddingBottom: 220 }]}>
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
          </>
        ) : (
          <Text style={[s.b, { textAlign: "center" }]}>{offer.status === "accepted" ? `✓ ${t("You accepted this job")}` : t("This offer expired or another pro took it.")}</Text>
        )}
      </View>
    </View>
  );
}
