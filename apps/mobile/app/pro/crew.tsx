/*
 * FILE    : apps/mobile/app/pro/crew.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-03_1337 UTC
 * PURPOSE : Pro → My crew (app twin of the portal page). Sign the Crew Addendum, add crew (their
 *           background check link is emailed right away), see each check's status, remove people who
 *           leave, and see whether the crew can be sent yet (workers' comp on file). English / Spanish.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, RefreshControl, ScrollView, Text, View } from "react-native";
import { CREW_ROLES, TRADES, type CrewMember, type CrewRole } from "@handled/core";
import { API_URL, api } from "../../lib/supabase";
import { useI18n } from "../../lib/i18n";
import { Button, C, Card, Chip, Field, s } from "../../components/ui";

type Data = { attested: boolean; ready: string | null; trades: string[]; crew: CrewMember[] };

export const BG_LABEL: Record<CrewMember["background_status"], string> = {
  not_started: "Not started", invited: "Link sent: waiting on them", pending: "In progress", clear: "Clear: can go to jobs",
  consider: "Under review", suspended: "On hold", canceled: "Canceled",
};

export default function Crew() {
  const { t, locale } = useI18n();
  const [d, setD] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signer, setSigner] = useState("");
  const [agree, setAgree] = useState(false);
  const blank = { full_name: "", email: "", phone: "", locale: locale as "en" | "es", role: "lead" as CrewRole, trades: [] as string[], years: "", license: "" };
  const [f, setF] = useState(blank);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Data>("/api/pro/crew");
    if (r.ok) { setD(r.data); setF((x) => (x.trades.length ? x : { ...x, trades: r.data.trades.slice(0, 1) })); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const r = await api<{ ok?: boolean; error?: string }>("/api/pro/crew", { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok || r.data.ok === false) { Alert.alert(t("Couldn't update"), r.data.error ?? t("Try again")); return false; }
    await load();
    return true;
  }
  const remove = (m: CrewMember) => Alert.alert(m.full_name, t("Remove them from your crew? Do this the day they stop working with you."), [
    { text: t("Cancel"), style: "cancel" },
    { text: t("Remove"), style: "destructive", onPress: () => post({ action: "remove", id: m.id }) },
  ]);
  const roleHelp = CREW_ROLES.find((r) => r.id === f.role)!.help;
  const tradeLabel = (id: string) => t(TRADES.find((x) => x.id === id)?.label ?? id);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{t("My crew")}</Text>
      <Text style={[s.p, { marginTop: 6 }]}>{t("Have people who work with you? List them here to send them on your company’s jobs. Each person passes the same background check you did before entering a customer’s home. Your crew works for your company: you decide who goes, and your payout covers the whole job.")}</Text>

      {d && !d.attested && (
        <Card style={{ marginTop: 14 }}>
          <Text style={s.b}>{t("Step 1: sign the Crew Addendum")}</Text>
          {["Your crew works for your company: you direct and pay them.", "Everyone is legally allowed to work in the U.S.; your company keeps their I-9.", "Workers’ comp for your crew before any job.", "Everyone listed and background-checked.", "Licensed work only to license holders; helpers never go alone."].map((x) => <Text key={x} style={[s.p, { marginTop: 4 }]}>• {t(x)}</Text>)}
          <Button title={t("Read the Crew Addendum")} kind="ghost" onPress={() => Linking.openURL(`${API_URL}/terms/pro-crew-addendum${locale === "es" ? "?lang=es" : ""}`)} style={{ marginTop: 10 }} />
          <View style={[s.row, { marginTop: 10 }]}><Chip label={`${agree ? "☑" : "☐"} ${t("I agree. Everyone I list is legally allowed to work in the U.S., and my company handles their I-9, payroll and workers’ comp.")}`} on={agree} onPress={() => setAgree(!agree)} /></View>
          <Field label={t("Your full name (signature)")} value={signer} onChangeText={setSigner} autoCapitalize="words" />
          <Button title={t("Sign")} disabled={!agree || signer.trim().length < 2} busy={busy} onPress={() => post({ action: "sign", signer_name: signer.trim(), agree: true })} />
        </Card>
      )}

      {d?.attested && (
        <>
          {d.ready && (
            <Card style={{ marginTop: 14, borderColor: "#f59e0b", backgroundColor: "#fffbeb" }}>
              <Text style={s.p}>{t("You can add your crew and start their checks now. To send them on jobs:")} <Text style={s.b}>{d.ready.includes("workers") ? t("upload a current workers’ comp policy (the no-employees statement doesn’t cover a crew)") : t(d.ready)}</Text></Text>
              <Button title={t("Setup & documents")} kind="ghost" onPress={() => Linking.openURL(`${API_URL}/pro/onboarding`)} style={{ marginTop: 8 }} />
            </Card>
          )}
          <Text style={s.h2}>{t("Your crew")} ({d.crew.length})</Text>
          {!d.crew.length && <Text style={s.p}>{t("No one yet. Add your first person below.")}</Text>}
          {d.crew.map((m) => (
            <Card key={m.id}>
              <Text style={s.b}>{m.full_name}</Text>
              <Text style={s.p}>{t(CREW_ROLES.find((r) => r.id === m.role)!.label)}{m.license_number ? ` · ${t("license")} ${m.license_number}` : ""}{m.years_experience ? ` · ${m.years_experience} ${t("yrs")}` : ""}</Text>
              {m.trades.length > 0 && <Text style={[s.p, { fontSize: 14 }]}>{m.trades.map(tradeLabel).join(", ")}</Text>}
              <Text style={[s.p, { marginTop: 4, color: m.background_status === "clear" ? C.brand : ["consider", "suspended"].includes(m.background_status) ? C.red : C.soft, fontWeight: "700" }]}>{t(BG_LABEL[m.background_status])}</Text>
              <Button title={t("Remove")} kind="ghost" onPress={() => remove(m)} style={{ marginTop: 8 }} />
            </Card>
          ))}

          <Text style={s.h2}>{t("Add someone")}</Text>
          <Card>
            <Text style={[s.p, { marginBottom: 10, fontSize: 14 }]}>{t("We email them a secure link from our screening provider (Checkr) to consent. It usually takes 1–3 business days.")}</Text>
            <Field label={t("Full name")} value={f.full_name} onChangeText={(v) => setF({ ...f, full_name: v })} autoCapitalize="words" />
            <Field label={t("Email (gets the background check link)")} value={f.email} onChangeText={(v) => setF({ ...f, email: v })} keyboardType="email-address" autoCapitalize="none" />
            <Field label={t("Phone")} value={f.phone} onChangeText={(v) => setF({ ...f, phone: v })} keyboardType="phone-pad" />
            <Text style={s.label}>{t("Their language")}</Text>
            <View style={s.row}>{(["en", "es"] as const).map((x) => <Chip key={x} label={x === "en" ? "English" : "Español"} on={f.locale === x} onPress={() => setF({ ...f, locale: x })} />)}</View>
            <Text style={[s.label, { marginTop: 6 }]}>{t("Role")}</Text>
            <View style={s.row}>{CREW_ROLES.map((r) => <Chip key={r.id} label={t(r.label)} on={f.role === r.id} onPress={() => setF({ ...f, role: r.id })} />)}</View>
            <Text style={[s.p, { fontSize: 14, marginBottom: 10 }]}>{t(roleHelp)}</Text>
            {(d.trades.length > 1) && <><Text style={s.label}>{t("Trades")}</Text><View style={s.row}>{d.trades.map((x) => <Chip key={x} label={tradeLabel(x)} on={f.trades.includes(x)} onPress={() => setF({ ...f, trades: f.trades.includes(x) ? f.trades.filter((y) => y !== x) : [...f.trades, x] })} />)}</View></>}
            <Field label={t("Years of experience")} value={f.years} onChangeText={(v) => setF({ ...f, years: v.replace(/\D/g, "") })} keyboardType="number-pad" />
            {f.role === "licensed" && <Field label={t("Michigan license number")} value={f.license} onChangeText={(v) => setF({ ...f, license: v })} autoCapitalize="characters" />}
            <Button title={t("Add and send background check")} disabled={f.full_name.trim().length < 2 || !f.email.includes("@")} busy={busy}
              onPress={async () => {
                const ok = await post({ action: "add", full_name: f.full_name.trim(), email: f.email.trim(), phone: f.phone.trim() || null, locale: f.locale, role: f.role, trades: f.trades,
                  years_experience: f.years ? Number(f.years) : null, license_number: f.license.trim() || null });
                if (ok) setF({ ...blank, trades: d.trades.slice(0, 1) });
              }} />
          </Card>
        </>
      )}
    </ScrollView>
  );
}
