/*
 * FILE    : apps/mobile/app/account.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish and the language switch.
 * UPDATED : 2026-10-03_0042 UTC — My contracts (opens the signed copies on the website).
 * PURPOSE : Account — Handled Plus, give $25 / get $25 referral (share sheet), sign out, and
 *           delete my account (required by the App Store and Google Play).
 * UPDATED : 2026-10-06_0645 UTC — now a tab: signed out it offers Sign in (and the language), signed in it loads with a
 *           spinner and a Try again if the connection drops; sign-out refreshes the shared session.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Share, Text, View, ScrollView } from "react-native";
import { router } from "expo-router";
import { HANDLED_PLUS, REFERRAL, money } from "@handled/core";
import { API_URL, api, supabase } from "../../lib/supabase";
import { unregisterPush } from "../../lib/push";
import { clearProfile } from "../../lib/profile";
import { Button, C, Card, Chip, Empty, ErrorState, Loading, s } from "../../components/ui";
import { useSession } from "../../lib/session";
import { useI18n } from "../../lib/i18n";

type Me = { email: string; member: boolean; referralCode: string | null; referralLink: string | null };

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const { t, locale, setLocale } = useI18n();
  const es = locale === "es";
  const session = useSession();
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    const r = await api<Me>("/api/account/me");
    if (r.ok) setMe(r.data); else setErr(r.data.error ?? "Couldn't load your account.");
  }, []);
  useEffect(() => { if (session.me) load(); else setMe(null); }, [session.me, load]);

  async function signOut() {
    await unregisterPush();
    await clearProfile();
    await supabase.auth.signOut().catch(() => {});
    await session.refresh();
    router.replace("/");
  }

  function confirmDelete() {
    Alert.alert(t("Delete your account?"), t("This removes your login, profile, phone, devices and photos, and cancels any membership. Invoices and payment records (name and email only) are kept for tax law. This can't be undone."), [
      { text: t("Keep my account"), style: "cancel" },
      { text: t("Delete permanently"), style: "destructive", onPress: async () => {
        setBusy(true);
        const r = await api<{ error?: string }>("/api/account/delete", { method: "POST", body: JSON.stringify({ confirm: "DELETE" }) });
        setBusy(false);
        if (!r.ok) return Alert.alert(t("Couldn't delete yet"), r.data.error ?? t("Please contact support."));
        await clearProfile();
        await supabase.auth.signOut().catch(() => {});
        await session.refresh();
        Alert.alert(t("Account deleted"), t("Your account and personal details have been deleted."));
        router.replace("/");
      } },
    ]);
  }

  const language = (
    <>
      <Text style={[s.label, { marginTop: 12 }]}>{t("Language")}</Text>
      <View style={s.row}><Chip label="English" on={locale === "en"} onPress={() => setLocale("en")} /><Chip label="Español" on={es} onPress={() => setLocale("es")} /></View>
    </>
  );
  if (!session.ready) return <Loading />;
  if (!session.me) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.pad}>
        <Empty icon="👤" title={t("Sign in to see your account")} body={t("Track bookings, pay, rate your pro and get $25 for every friend you refer.")} action={<Button title={t("Sign in")} onPress={() => router.push("/login")} />} />
        {language}
        <Button title={`💼 ${t("Become a pro — get prepaid jobs")}`} kind="ghost" onPress={() => Linking.openURL(`${API_URL}/pros?src=app`)} style={{ marginTop: 20 }} />
      </ScrollView>
    );
  }
  if (err && !me) return <ScrollView style={s.screen} contentContainerStyle={s.pad}><ErrorState message={err} onRetry={load} /></ScrollView>;
  if (!me) return <Loading />;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h2}>{t("Account")}</Text>
      <Text style={s.p}>{me?.email ?? ""}</Text>
      {language}
      <Card style={{ marginTop: 12, borderColor: me?.member ? C.brand : undefined }}>
        <Text style={s.b}>⭐ {HANDLED_PLUS.name}{me?.member ? ` — ${t("you're a member")}` : ` — ${money(HANDLED_PLUS.monthly)}/${t("month")}`}</Text>
        {HANDLED_PLUS.perks.map((p) => <Text key={p} style={s.p}>✓ {t(p)}</Text>)}
        <Button title={me?.member ? t("Manage or cancel") : t("Join Plus")} kind={me?.member ? "ghost" : "primary"} onPress={() => Linking.openURL(`${API_URL}/account`)} style={{ marginTop: 10 }} />
      </Card>
      {me?.referralCode && (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.b}>🎁 {es ? `Regale ${money(REFERRAL.friendOff)}, reciba ${money(REFERRAL.reward)}` : `Give ${money(REFERRAL.friendOff)}, get ${money(REFERRAL.reward)}`}</Text>
          <Text style={s.p}>{es ? `Sus amigos reciben ${money(REFERRAL.friendOff)} de descuento en su primer trabajo con el código ${me.referralCode}. Usted recibe ${money(REFERRAL.reward)} cuando terminen su trabajo.` : `Friends get ${money(REFERRAL.friendOff)} off their first job with code ${me.referralCode}. You get ${money(REFERRAL.reward)} when their job is done.`}</Text>
          <Button title={t("Share my code")} onPress={() => Share.share({ message: es ? `Pruebe Handled — ${money(REFERRAL.friendOff)} de descuento en su primer trabajo con mi código ${me.referralCode}: ${me.referralLink}` : `Try Handled — ${money(REFERRAL.friendOff)} off your first job with my code ${me.referralCode}: ${me.referralLink}` })} style={{ marginTop: 10 }} />
        </Card>
      )}
      <View style={{ marginTop: 24, gap: 10 }}>
        <Button title={t("My contracts")} kind="ghost" onPress={() => Linking.openURL(`${API_URL}/account/contracts`)} />
        <Button title={t("Sign out")} kind="ghost" onPress={signOut} />
        <Button title={busy ? t("Deleting…") : t("Delete my account")} kind="ghost" onPress={confirmDelete} busy={busy} />
      </View>
    </ScrollView>
  );
}
