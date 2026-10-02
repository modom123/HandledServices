/*
 * FILE    : apps/mobile/app/login.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Passwordless sign-in with a 6-digit email code.
 */
import { useState } from "react";
import { Alert, Linking, View, Text } from "react-native";
import { router } from "expo-router";
import { API_URL, supabase } from "../lib/supabase";
import { Button, Field, s } from "../components/ui";
import { useI18n } from "../lib/i18n";

export default function Login() {
  const [email, setEmail] = useState("");
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <View style={[s.screen, s.pad]}>
      <Text style={s.h1}>{t("Sign in")}</Text>
      <Text style={[s.p, { marginBottom: 16 }]}>{t("Customers and pros — we'll email you a code.")}</Text>
      <Field label={t("Email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {!sent ? (
        <Button title={t("Send code")} onPress={async () => { const { error } = await supabase.auth.signInWithOtp({ email }); if (error) Alert.alert(error.message); else setSent(true); }} />
      ) : (
        <>
          <Field label={t("6-digit code")} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Button title={t("Verify")} onPress={async () => { const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" }); if (error) Alert.alert(error.message); else router.replace("/"); }} />
        </>
      )}
      <Text style={[s.p, { marginTop: 24, textAlign: "center" }]}>
        {t("By continuing you agree to our")} <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/terms/service-agreement`)}>{t("Service Agreement")}</Text> {t("and")} <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>{t("Privacy Policy")}</Text>.
      </Text>
    </View>
  );
}
