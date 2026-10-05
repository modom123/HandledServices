/*
 * FILE    : apps/mobile/app/pro/rewards.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : Pro mode → Rewards (Handled Pro Rewards): available / pending points, tier, how points are earned,
 *           milestones, the catalog with redeem (shipping address), orders and the point history. EN / ES.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { REDEMPTION_LABEL, REWARD_RULES_EN, REWARD_RULES_ES, type RedemptionStatus, type RewardSettings } from "@handled/core";
import { api } from "../../lib/supabase";
import { Button, C, Card, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";

type Item = { id: string; name: string; name_es: string | null; category: string; points: number; description: string | null; description_es: string | null; stock: number | null };
type Data = {
  settings: RewardSettings; balance: { available: number; pending: number; lifetime: number }; monthsActive: number;
  tier: { en: string; es: string; multiplier: number; next: { months: number; multiplier: number } | null };
  milestones: { key: string; en: string; es: string; points: number; done: boolean }[]; catalog: Item[];
  orders: { id: string; item_name: string; points: number; status: RedemptionStatus; tracking: string | null; created_at: string }[];
  ledger: { id: string; kind: string; points: number; status: string; available_at: string | null; note: string | null }[];
};
const n = (x: number) => x.toLocaleString("en-US");

export default function Rewards() {
  const { locale } = useI18n();
  const es = locale === "es";
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [pick, setPick] = useState<Item | null>(null);
  const [addr, setAddr] = useState({ name: "", line1: "", line2: "", city: "", state: "MI", zip: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setLoading(true); const r = await api<Data>("/api/pro/rewards"); if (r.ok) setD(r.data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <ScrollView style={s.screen} contentContainerStyle={s.pad}><Text style={s.p}>…</Text></ScrollView>;
  async function redeem() {
    if (!pick) return;
    setBusy(true);
    const r = await api<{ ok: boolean; error?: string }>("/api/pro/rewards", { method: "POST", body: JSON.stringify({ item_id: pick.id, ship_to: { ...addr, state: addr.state.toUpperCase() } }) });
    setBusy(false);
    if (!r.ok || !r.data.ok) return Alert.alert(es ? "No se pudo canjear" : "Couldn't redeem", r.data.error ?? "");
    Alert.alert(es ? "¡Pedido recibido!" : "Order received!", es ? "Le avisaremos cuando se envíe." : "We'll let you know when it ships.");
    setPick(null); load();
  }
  const field = (k: keyof typeof addr, label: string) => <TextInput style={[s.input, { marginBottom: 6, fontSize: 15 }]} placeholder={label} value={addr[k]} onChangeText={(v) => setAddr({ ...addr, [k]: v })} />;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={s.h1}>🎁 {es ? "Recompensas" : "Rewards"}</Text>
      <Card style={{ backgroundColor: C.tint, borderColor: C.brand }}>
        <Text style={{ fontSize: 34, fontWeight: "800", color: C.deep }}>{n(d.balance.available)} <Text style={{ fontSize: 16 }}>{es ? "puntos" : "points"}</Text></Text>
        <Text style={s.p}>≈ ${n(Math.round(d.balance.available * d.settings.pointValue))} {es ? "en premios" : "in rewards"} · {n(d.balance.pending)} {es ? "pendientes" : "pending"}</Text>
        <Text style={[s.p, { marginTop: 4 }]}>{es ? "Nivel" : "Tier"}: <Text style={s.b}>{es ? d.tier.es : d.tier.en} ×{d.tier.multiplier}</Text>{d.tier.next ? (es ? ` · ×${d.tier.next.multiplier} a los ${d.tier.next.months} meses` : ` · ×${d.tier.next.multiplier} at ${d.tier.next.months} months`) : ""}</Text>
      </Card>
      <Card>
        <Text style={s.b}>{es ? "Cómo funciona" : "How it works"}</Text>
        {(es ? REWARD_RULES_ES(d.settings) : REWARD_RULES_EN(d.settings)).map((x) => <Text key={x} style={[s.p, { fontSize: 14 }]}>• {x}</Text>)}
      </Card>
      <Text style={s.h2}>{es ? "Metas" : "Milestones"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{d.milestones.map((m) => <Text key={m.key} style={{ fontSize: 13, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: "hidden", backgroundColor: m.done ? C.brand : C.white, color: m.done ? C.white : C.soft, borderWidth: 1, borderColor: m.done ? C.brand : C.line }}>{m.done ? "🏆 " : ""}{es ? m.es : m.en} +{n(m.points)}</Text>)}</View>
      <Text style={s.h2}>{es ? "Catálogo" : "Catalog"}</Text>
      {d.catalog.map((i) => (
        <Card key={i.id}>
          <Text style={s.b}>{es ? i.name_es || i.name : i.name}</Text>
          {i.description ? <Text style={[s.p, { fontSize: 14 }]}>{es ? i.description_es || i.description : i.description}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <Text style={[s.b, { color: C.brand }]}>{n(i.points)} pts</Text>
            {i.stock === 0 ? <Text style={s.p}>{es ? "Agotado" : "Out of stock"}</Text>
              : <Button title={d.balance.available >= i.points ? (es ? "Canjear" : "Redeem") : (es ? `Faltan ${n(i.points - d.balance.available)}` : `${n(i.points - d.balance.available)} more`)} kind={d.balance.available >= i.points ? "primary" : "ghost"} disabled={d.balance.available < i.points} onPress={() => setPick(i)} />}
          </View>
          {pick?.id === i.id ? (
            <View style={{ marginTop: 10 }}>
              <Text style={[s.p, { fontSize: 14 }]}>{es ? "Dirección de envío" : "Ship to"}</Text>
              {field("name", es ? "Nombre" : "Name")}{field("line1", es ? "Dirección" : "Street address")}{field("line2", es ? "Depto. (opcional)" : "Apt (optional)")}
              <View style={{ flexDirection: "row", gap: 6 }}><View style={{ flex: 2 }}>{field("city", es ? "Ciudad" : "City")}</View><View style={{ flex: 1 }}>{field("state", "MI")}</View><View style={{ flex: 1.3 }}>{field("zip", "ZIP")}</View></View>
              {field("phone", es ? "Teléfono" : "Phone")}
              <Text style={[s.p, { fontSize: 12 }]}>{es ? "Los premios cuentan como ingreso y aparecen en su 1099." : "Rewards count as income and appear on your 1099."}</Text>
              <Button title={es ? `Canjear ${n(i.points)} pts` : `Redeem ${n(i.points)} pts`} busy={busy} onPress={redeem} style={{ marginTop: 6 }} />
              <Button title={es ? "Cancelar" : "Cancel"} kind="ghost" onPress={() => setPick(null)} style={{ marginTop: 6 }} />
            </View>
          ) : null}
        </Card>
      ))}
      {d.orders.length ? <Text style={s.h2}>{es ? "Mis pedidos" : "My orders"}</Text> : null}
      {d.orders.map((o) => <Text key={o.id} style={s.p}>{o.item_name} · {es ? REDEMPTION_LABEL[o.status].es : REDEMPTION_LABEL[o.status].en}{o.tracking ? ` · ${o.tracking}` : ""}</Text>)}
      <Text style={s.h2}>{es ? "Historial" : "History"}</Text>
      {!d.ledger.length ? <Text style={s.p}>{es ? "Sus puntos aparecen aquí cuando termine su primer trabajo." : "Your points show up here when you finish your first job."}</Text> : null}
      {d.ledger.map((e) => <Text key={e.id} style={[s.p, { fontSize: 14 }]}>{e.points > 0 ? "+" : ""}{n(e.points)} · {e.note ?? e.kind}{e.status === "pending" ? (es ? ` (pendiente hasta ${e.available_at?.slice(0, 10)})` : ` (pending until ${e.available_at?.slice(0, 10)})`) : ""}</Text>)}
    </ScrollView>
  );
}
