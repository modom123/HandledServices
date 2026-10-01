/*
 * FILE    : apps/mobile/app/login.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Passwordless sign-in with a 6-digit email code.
 */
import { useState } from "react";
import { Alert, Linking, View, Text } from "react-native";
import { router } from "expo-router";
import { API_URL, supabase } from "../lib/supabase";
import { Button, Field, s } from "../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <View style={[s.screen, s.pad]}>
      <Text style={s.h1}>Sign in</Text>
      <Text style={[s.p, { marginBottom: 16 }]}>Customers and pros — we'll email you a code.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {!sent ? (
        <Button title="Send code" onPress={async () => { const { error } = await supabase.auth.signInWithOtp({ email }); if (error) Alert.alert(error.message); else setSent(true); }} />
      ) : (
        <>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
          <Button title="Verify" onPress={async () => { const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" }); if (error) Alert.alert(error.message); else router.replace("/"); }} />
        </>
      )}
      <Text style={[s.p, { marginTop: 24, textAlign: "center" }]}>
        By continuing you agree to our <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/terms/service-agreement`)}>Service Agreement</Text> and <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>Privacy Policy</Text>.
      </Text>
    </View>
  );
}
