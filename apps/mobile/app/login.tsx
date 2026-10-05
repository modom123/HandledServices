/*
 * FILE    : apps/mobile/app/login.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Passwordless sign-in with a 6-digit email code.
 * UPDATED : 2026-10-05_0434 UTC — "Who are you?" (booking services or a pro): pros land in Pro mode; a pro choice without an
 *           approved pro account points to the application. Business and team accounts use the website.
 */
import { useState } from "react";
import { Alert, Linking, View, Text } from "react-native";
import { router } from "expo-router";
import { API_URL, api, supabase } from "../lib/supabase";
import { Button, C, Chip, Field, s } from "../components/ui";
import { useI18n } from "../lib/i18n";

export default function Login() {
  const [email, setEmail] = useState("");
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [who, setWho] = useState<"customer" | "pro">("customer");
  async function after() {
    const r = await api<{ user: { contractorId: string | null } | null }>("/api/me");
    const pro = Boolean(r.ok && r.data.user?.contractorId);
    if (who === "pro" && !pro) {
      Alert.alert(t("No pro account for this email"), t("Apply first — your pro account opens once you're approved. Use the email from your application."), [
        { text: t("Apply"), onPress: () => Linking.openURL(`${API_URL}/pros?src=app#apply`) }, { text: "OK" }]);
      return router.replace("/");
    }
    router.replace(who === "pro" && pro ? "/pro" : "/");
  }
  return (
    <View style={[s.screen, s.pad]}>
      <Text style={s.h1}>{t("Sign in")}</Text>
      <Text style={[s.p, { marginBottom: 12 }]}>{t("Sign in or create your account — we'll email you a code.")}</Text>
      <Text style={s.label}>{t("Who are you?")}</Text>
      <View style={[s.row, { marginBottom: 6 }]}>
        <Chip label={`🏠 ${t("I book services")}`} on={who === "customer"} onPress={() => setWho("customer")} />
        <Chip label={`🧰 ${t("I'm a pro")}`} on={who === "pro"} onPress={() => setWho("pro")} />
      </View>
      {who === "pro" ? <Text style={[s.p, { fontSize: 13, marginBottom: 8 }]}>{t("Not a pro yet?")} <Text style={{ color: C.brand, fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/pros?src=app#apply`)}>{t("Apply")}</Text></Text> : null}
      <Text style={[s.p, { fontSize: 13, marginBottom: 12 }]}>{t("Business accounts and the Handled team sign in on the website.")}</Text>
      <Field label={t("Email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {!sent ? (
        <Button title={t("Send code")} onPress={async () => { const { error } = await supabase.auth.signInWithOtp({ email }); if (error) Alert.alert(error.message); else setSent(true); }} />
      ) : (
        <>
          <Field label={t("6-digit code")} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Button title={t("Verify")} onPress={async () => { const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" }); if (error) Alert.alert(error.message); else after(); }} />
        </>
      )}
      <Text style={[s.p, { marginTop: 24, textAlign: "center" }]}>
        {t("By continuing you agree to our")} <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/terms/service-agreement`)}>{t("Service Agreement")}</Text> {t("and")} <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>{t("Privacy Policy")}</Text>.
      </Text>
    </View>
  );
}
