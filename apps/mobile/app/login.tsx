/*
 * FILE    : apps/mobile/app/login.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Passwordless sign-in with a 6-digit email code.
 * UPDATED : 2026-10-05_0434 UTC — "Who are you?" (booking services or a pro): pros land in Pro mode; a pro choice without an
 *           approved pro account points to the application. Business and team accounts use the website.
 * UPDATED : 2026-10-06_0645 UTC — effortless sign-in: email checked before sending, spinners while it works, the code autofills
 *           (iOS one-time code / Android SMS-OTP hint) and signs in the moment 6 digits are entered, a resend timer,
 *           "Use a different email", the keyboard never covers the button, and pros land on the Pro tab.
 * UPDATED : 2026-10-06_0708 UTC — haptics on sign-in success / failure.
 * UPDATED : 2026-10-06_2310 UTC — the code email comes from Handled (POST /api/auth/email-code: always has the code, its link works
 *           on any device); Supabase's own email is only the fallback. Code length comes from the server (6–10 digits).
 * UPDATED : 2026-10-07_0255 UTC — 60s resend; a rate limit or a code sent moments ago opens the code box instead of an error.
 */
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { API_URL, api, supabase } from "../lib/supabase";
import { Button, C, Chip, Field, Form, s } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { useSession } from "../lib/session";
import { haptic } from "../lib/haptics";

const RESEND_SECONDS = 60; // Supabase allows one new code per address per minute
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
const friendly = (m: string) => (/network|fetch|failed to/i.test(m) ? "No connection. Check your signal or Wi-Fi and try again." : /expired|invalid|token/i.test(m) ? "That code didn't work. Check it, or send a new one." : /rate|too many|security purposes/i.test(m) ? "Too many tries. Wait a minute, then send a new code." : m);

export default function Login() {
  const { t } = useI18n();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [who, setWho] = useState<"customer" | "pro">("customer");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [len, setLen] = useState(6); // digits in the code (the server says; Supabase projects send 6–10)
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const codeRef = useRef<TextInput>(null);
  useEffect(() => { if (!wait) return; const iv = setTimeout(() => setWait((w) => Math.max(0, w - 1)), 1000); return () => clearTimeout(iv); }, [wait]);

  async function send() {
    if (!emailOk(email)) return setEmailErr(t("Enter a valid email"));
    setEmailErr(null);
    setBusy(true);
    const addr = email.trim().toLowerCase();
    // Handled emails the code (and a link that works on any device); Supabase's own email is the fallback
    const viaHandled = await fetch(`${API_URL}/api/auth/email-code`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: addr, next: who === "pro" ? "/pro" : "/account" }) })
      .then(async (r) => ({ status: r.status, body: (await r.json().catch(() => ({}))) as { ok?: boolean; codeLength?: number; fallback?: boolean; error?: string; wait?: number } }))
      .catch(() => null);
    // too many requests, or a code went out moments ago: the last code still works — open the code box
    if (viaHandled?.status === 429 || viaHandled?.body.wait) {
      setBusy(false); setSent(true); setCode(""); setWait(viaHandled.body.wait ?? 0);
      setTimeout(() => codeRef.current?.focus(), 300);
      return Alert.alert(t("Check your email"), viaHandled.body.error ?? t("We just sent you a code. Use the newest one in your email."));
    }
    let error: Error | null = null;
    if (viaHandled?.body.ok) setLen(Number(viaHandled.body.codeLength) || 6);
    else ({ error } = await supabase.auth.signInWithOtp({ email: addr }).catch((e) => ({ error: e as Error })));
    setBusy(false);
    if (error) return Alert.alert(t("Couldn't send the code"), t(friendly(error.message)));
    setSent(true);
    setCode("");
    setWait(RESEND_SECONDS);
    setTimeout(() => codeRef.current?.focus(), 300);
  }

  async function verify(token = code) {
    if (token.length < len || busy) return;
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: "email" }).catch((e) => ({ error: e as Error }));
    if (error) { haptic("error"); setBusy(false); setCode(""); return Alert.alert(t("Couldn't sign in"), t(friendly(error.message))); }
    haptic("success");
    await session.refresh();
    const r = await api<{ user: { contractorId: string | null } | null }>("/api/me");
    setBusy(false);
    const pro = Boolean(r.ok && r.data.user?.contractorId);
    if (who === "pro" && !pro) {
      Alert.alert(t("No pro account for this email"), t("Apply first — your pro account opens once you're approved. Use the email from your application."), [
        { text: t("Apply"), onPress: () => Linking.openURL(`${API_URL}/pros?src=app#apply`) }, { text: "OK" }]);
      return router.replace("/");
    }
    router.replace(pro && who === "pro" ? "/work" : "/");
  }

  return (
    <Form>
      <Text style={s.h1}>{t("Sign in")}</Text>
      <Text style={[s.p, { marginBottom: 14 }]}>{t("Sign in or create your account — we'll email you a code.")}</Text>
      {!sent ? (
        <>
          <Text style={s.label}>{t("Who are you?")}</Text>
          <View style={[s.row, { marginBottom: 6 }]}>
            <Chip label={`🏠 ${t("I book services")}`} on={who === "customer"} onPress={() => setWho("customer")} />
            <Chip label={`🧰 ${t("I'm a pro")}`} on={who === "pro"} onPress={() => setWho("pro")} />
          </View>
          {who === "pro" ? <Text style={[s.p, { fontSize: 15, marginBottom: 8 }]}>{t("Not a pro yet?")} <Text style={{ color: C.brand, fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/pros?src=app#apply`)}>{t("Apply")}</Text></Text> : null}
          <Field label={t("Email")} value={email} onChangeText={(v) => { setEmail(v); if (emailErr) setEmailErr(null); }} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" returnKeyType="send" onSubmitEditing={send} error={emailErr} autoFocus />
          <Button title={t("Send code")} onPress={send} busy={busy} />
          <Text style={[s.p, { fontSize: 14, marginTop: 12 }]}>{t("Business accounts and the Handled team sign in on the website.")}</Text>
        </>
      ) : (
        <>
          <Text style={[s.p, { color: C.ink }]}>{t("We sent a sign-in code to")} <Text style={{ fontWeight: "800" }}>{email.trim()}</Text></Text>
          <TextInput
            ref={codeRef}
            value={code}
            onChangeText={(v) => { const d = v.replace(/\D/g, "").slice(0, len); setCode(d); if (d.length === len) verify(d); }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={len}
            accessibilityLabel={t("Sign-in code")}
            placeholder="••••••"
            placeholderTextColor={C.line}
            style={[s.input, { fontSize: 30, letterSpacing: 12, textAlign: "center", marginTop: 14, fontWeight: "800" }]}
          />
          <Button title={t("Verify")} onPress={() => verify()} busy={busy} disabled={code.length !== len} style={{ marginTop: 12 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
            <Pressable onPress={() => { setSent(false); setCode(""); }} hitSlop={10} accessibilityRole="button"><Text style={{ color: C.brand, fontWeight: "700" }}>{t("Use a different email")}</Text></Pressable>
            <Pressable onPress={wait ? undefined : send} disabled={Boolean(wait) || busy} hitSlop={10} accessibilityRole="button"><Text style={{ color: wait ? C.soft : C.brand, fontWeight: "700" }}>{wait ? `${t("Resend in")} ${wait}s` : t("Resend code")}</Text></Pressable>
          </View>
          <Text style={[s.p, { fontSize: 14, marginTop: 14 }]}>{t("Can't find it? Check spam or promotions.")}</Text>
        </>
      )}
      <Text style={[s.p, { marginTop: 28, textAlign: "center", fontSize: 14 }]}>
        {t("By continuing you agree to our")} <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/terms/service-agreement`)}>{t("Service Agreement")}</Text> {t("and")} <Text style={{ fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>{t("Privacy Policy")}</Text>.
      </Text>
    </Form>
  );
}
