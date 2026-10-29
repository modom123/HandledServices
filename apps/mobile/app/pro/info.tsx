/*
 * FILE    : apps/mobile/app/pro/info.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-29_0715 UTC
 * PURPOSE : Pro mode → My info: status and what's left before approval, profile, documents and expiry dates
 *           (/api/pro/info). Steps open the web setup checklist; orientation opens Welcome to Handled. EN / ES.
 */
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { API_URL, api } from "../../lib/supabase";
import { Button, C, Card, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";

type Step = { key: string; label: string; done: boolean; optional: boolean; expiring: boolean; detail: string };
type Info = {
  profile: { business_name: string; contact_name: string; email: string; phone: string | null; pro_no: string | null; trades: string[]; base_city: string | null; base_zip: string | null; radius: number; insured_until: string | null; license_number: string | null; license_expires: string | null; id_verified_at: string | null; background_checked: boolean; payout_method: string | null };
  approved: boolean; complete: boolean; steps: Step[]; orientation: { done: number; total: number; complete: boolean };
  documents: { id: string; kind: string; status: string; expires_on: string | null; created_at: string }[];
};

export default function MyInfo() {
  const { locale, t } = useI18n();
  const es = locale === "es";
  const [d, setD] = useState<Info | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => { setLoading(true); const r = await api<Info>("/api/pro/info"); if (r.ok) setD(r.data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <ScrollView style={s.screen} contentContainerStyle={s.pad}><Text style={s.p}>…</Text></ScrollView>;
  const p = d.profile;
  const left = d.steps.filter((x) => !x.done);
  const row = (k: string, v: string | null | undefined) => <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line }}><Text style={[s.p, { fontSize: 14 }]}>{k}</Text><Text style={[s.b, { fontSize: 14, flexShrink: 1, textAlign: "right" }]}>{v || "—"}</Text></View>;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={s.h1}>🪪 {es ? "Mi información" : "My info"}</Text>
      <Card style={{ borderColor: d.approved ? C.brand : C.amber }}>
        <Text style={s.b}>{d.approved ? (es ? "✅ Aprobado: recibe ofertas" : "✅ Approved: getting offers") : d.complete ? (es ? "Todo listo: esperando la aprobación de Handled" : "All set: waiting for Handled's approval") : (es ? `En configuración: faltan ${left.length} paso(s)` : `In setup: ${left.length} step(s) left`)}</Text>
        {!d.approved && <Text style={[s.p, { fontSize: 13 }]}>{es ? "Antes de trabajos pagados: currículum, identificación verificada, orientación y los demás pasos, y luego la aprobación de Handled." : "Before paid work: resume, verified ID, the orientation and the other steps, then Handled's approval."}</Text>}
        {left.map((x) => (
          <Pressable key={x.key} onPress={() => (x.key === "orientation" ? router.push("/pro/welcome") : Linking.openURL(`${API_URL}/pro/onboarding#step-${x.key}`))}>
            <Text style={{ color: C.brand, marginTop: 6 }}>⬜ {t(x.label)} →</Text>
          </Pressable>
        ))}
      </Card>
      <Card>
        <Text style={s.b}>{es ? "Perfil" : "Profile"}</Text>
        {row(es ? "Negocio" : "Business", p.business_name)}
        {row(es ? "Nombre" : "Name", p.contact_name)}
        {row(es ? "Correo" : "Email", p.email)}
        {row(es ? "Celular" : "Mobile", p.phone)}
        {p.pro_no ? row(es ? "ID de profesional" : "Pro ID", p.pro_no) : null}
        {row(es ? "Oficios" : "Trades", p.trades.join(", "))}
        {row(es ? "Zona" : "Area", p.base_zip ? `${p.base_city ?? ""} ${p.base_zip} · ${p.radius} mi` : null)}
      </Card>
      <Card>
        <Text style={s.b}>{es ? "Documentos y vencimientos" : "Documents and expiry dates"}</Text>
        {row(es ? "Seguro" : "Insurance", p.insured_until ? `${es ? "hasta" : "until"} ${p.insured_until}` : null)}
        {p.license_number ? row(es ? "Licencia" : "License", `#${p.license_number}${p.license_expires ? ` · ${p.license_expires}` : ""}`) : null}
        {row(es ? "Identificación" : "Photo ID", p.id_verified_at ? `${es ? "verificada" : "verified"} ${p.id_verified_at.slice(0, 10)}` : null)}
        {row(es ? "Antecedentes" : "Background", p.background_checked ? (es ? "aprobado" : "cleared") : null)}
        {row(es ? "Pago" : "Payout", p.payout_method ? p.payout_method.toUpperCase() : null)}
        {d.documents.map((x) => row(`${x.kind} · ${x.created_at.slice(0, 10)}${x.expires_on ? ` → ${x.expires_on}` : ""}`, x.status))}
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={`👋 ${d.orientation.done}/${d.orientation.total}`} kind="ghost" onPress={() => router.push("/pro/welcome")} style={{ flex: 1 }} />
        <Button title={es ? "📄 Configuración" : "📄 Setup"} kind="ghost" onPress={() => Linking.openURL(`${API_URL}/pro/onboarding`)} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}
