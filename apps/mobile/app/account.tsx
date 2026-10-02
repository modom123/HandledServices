/*
 * FILE    : apps/mobile/app/account.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Account — Handled Plus, give $25 / get $25 referral (share sheet), sign out, and
 *           delete my account (required by the App Store and Google Play).
 */
import { useEffect, useState } from "react";
import { Alert, Linking, Share, Text, View, ScrollView } from "react-native";
import { router } from "expo-router";
import { HANDLED_PLUS, REFERRAL, money } from "@handled/core";
import { API_URL, api, supabase } from "../lib/supabase";
import { unregisterPush } from "../lib/push";
import { Button, C, Card, s } from "../components/ui";

type Me = { email: string; member: boolean; referralCode: string | null; referralLink: string | null };

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<Me>("/api/account/me").then((r) => r.ok && setMe(r.data)); }, []);

  async function signOut() {
    await unregisterPush();
    await supabase.auth.signOut();
    router.replace("/");
  }

  function confirmDelete() {
    Alert.alert("Delete your account?", "This removes your login, profile, phone, devices and photos, and cancels any membership. Invoices and payment records (name and email only) are kept for tax law. This can't be undone.", [
      { text: "Keep my account", style: "cancel" },
      { text: "Delete permanently", style: "destructive", onPress: async () => {
        setBusy(true);
        const r = await api<{ error?: string }>("/api/account/delete", { method: "POST", body: JSON.stringify({ confirm: "DELETE" }) });
        setBusy(false);
        if (!r.ok) return Alert.alert("Couldn't delete yet", r.data.error ?? "Please contact support.");
        await supabase.auth.signOut().catch(() => {});
        Alert.alert("Account deleted", "Your account and personal details have been deleted.");
        router.replace("/");
      } },
    ]);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h2}>Account</Text>
      <Text style={s.p}>{me?.email ?? ""}</Text>
      <Card style={{ marginTop: 12, borderColor: me?.member ? C.brand : undefined }}>
        <Text style={s.b}>⭐ {HANDLED_PLUS.name}{me?.member ? " — you're a member" : ` — ${money(HANDLED_PLUS.monthly)}/month`}</Text>
        {HANDLED_PLUS.perks.map((p) => <Text key={p} style={s.p}>✓ {p}</Text>)}
        <Button title={me?.member ? "Manage or cancel" : "Join Plus"} kind={me?.member ? "ghost" : "primary"} onPress={() => Linking.openURL(`${API_URL}/account`)} style={{ marginTop: 10 }} />
      </Card>
      {me?.referralCode && (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.b}>🎁 Give {money(REFERRAL.friendOff)}, get {money(REFERRAL.reward)}</Text>
          <Text style={s.p}>Friends get {money(REFERRAL.friendOff)} off their first job with code {me.referralCode}. You get {money(REFERRAL.reward)} when their job is done.</Text>
          <Button title="Share my code" onPress={() => Share.share({ message: `Try Handled — ${money(REFERRAL.friendOff)} off your first job with my code ${me.referralCode}: ${me.referralLink}` })} style={{ marginTop: 10 }} />
        </Card>
      )}
      <View style={{ marginTop: 24, gap: 10 }}>
        <Button title="Sign out" kind="ghost" onPress={signOut} />
        <Button title={busy ? "Deleting…" : "Delete my account"} kind="ghost" onPress={confirmDelete} busy={busy} />
      </View>
    </ScrollView>
  );
}
