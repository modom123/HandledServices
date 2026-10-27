/*
 * FILE    : apps/mobile/app/pro/team.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2300 UTC
 * PURPOSE : Pro → Office team (app twin of /pro/team, owners only). Give an office manager their own login: they accept
 *           offers, run the calendar, pick crew and message customers for the company. Money, tax, contracts, documents,
 *           prices and this team stay with the owner. English / Spanish.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { api } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { Button, C, Card, Chip, Field, s } from "../../components/ui";

type Member = { id: string; email: string; full_name: string; phone: string | null; accepted_at: string | null; last_seen_at: string | null };
type Data = { me: "owner" | "office" | null; limit: number; team: Member[] };

export default function Team() {
  const { t, locale } = useI18n();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = { full_name: "", email: "", phone: "", locale: locale as "en" | "es" };
  const [f, setF] = useState(blank);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Data>("/api/pro/team");
    if (r.ok) setD(r.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const r = await api<{ ok?: boolean; error?: string }>("/api/pro/team", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok || r.data.ok === false) { Alert.alert(t("Couldn't update"), t(r.data.error ?? "Try again")); return false; }
    await load();
    return true;
  }
  const remove = (m: Member) => Alert.alert(m.full_name, t("Remove their access? They're signed out of your company right away."), [
    { text: t("Cancel"), style: "cancel" },
    { text: t("Remove"), style: "destructive", onPress: () => post({ action: "remove", id: m.id }) },
  ]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{t("Office team")}</Text>
      <Text style={[s.p, { marginTop: 6 }]}>{t("Give your office manager their own login with their email. They can accept offers, run the calendar, pick who on your crew goes and message customers for your company. Money, tax, contracts, documents, prices and this team stay with you.")}</Text>
      {d && d.me !== "owner" && <Card style={{ marginTop: 14 }}><Text style={s.p}>{t("Only the company owner manages the office team.")}</Text></Card>}
      {d?.me === "owner" && (
        <>
          <Text style={s.h2}>{t("Who has access")} ({d.team.length}/{d.limit})</Text>
          {!d.team.length && <Text style={s.p}>{t("No one yet.")}</Text>}
          {d.team.map((m) => (
            <Card key={m.id}>
              <Text style={s.b}>{m.full_name}</Text>
              <Text style={s.p}>{m.email}{m.phone ? ` · ${m.phone}` : ""}</Text>
              <Text style={[s.p, { fontSize: 14, color: m.accepted_at ? C.brand : C.soft }]}>{m.accepted_at ? `${t("Last in")} ${(m.last_seen_at ?? m.accepted_at).slice(0, 10)}` : t("Invite sent")}</Text>
              <Button title={t("Remove")} kind="ghost" onPress={() => remove(m)} style={{ marginTop: 8 }} />
            </Card>
          ))}
          {d.team.length < d.limit && (
            <>
              <Text style={s.h2}>{t("Add someone")}</Text>
              <Card>
                <Field label={t("Full name")} value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} autoCapitalize="words" />
                <Field label={t("Email (they sign in with it)")} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoCapitalize="none" />
                <Field label={t("Phone (optional)")} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
                <Text style={s.label}>{t("Their language")}</Text>
                <View style={[s.row, { marginBottom: 10 }]}>{(["en", "es"] as const).map((x) => <Chip key={x} label={x === "en" ? "English" : "Español"} on={f.locale === x} onPress={() => setF({ ...f, locale: x })} />)}</View>
                <Button title={t("Give access and send link")} busy={busy} disabled={f.full_name.trim().length < 2 || !f.email.includes("@")}
                  onPress={async () => { if (await post({ action: "invite", full_name: f.full_name.trim(), email: f.email.trim(), phone: f.phone.trim() || null, locale: f.locale })) setF(blank); }} />
              </Card>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
