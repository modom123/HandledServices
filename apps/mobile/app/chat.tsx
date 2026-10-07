/*
 * FILE    : apps/mobile/app/chat.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish (the concierge answers in the customer's language).
 * PURPOSE : AI concierge chat (same backend as the website widget).
 */
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../lib/supabase";
import { Button, C, s } from "../components/ui";
import { useI18n } from "../lib/i18n";

type Turn = { role: "user" | "assistant"; content: string };

export default function Chat() {
  const { t } = useI18n();
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", content: t("Hi! Tell me the job and I'll give you a price.") }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scroll = useRef<ScrollView>(null);
  async function send() {
    if (!text.trim()) return;
    const next = [...turns, { role: "user" as const, content: text.trim() }];
    setTurns(next); setText(""); setBusy(true);
    const r = await api<{ reply: string }>("/api/concierge", { method: "POST", body: JSON.stringify({ messages: next.slice(1) }) });
    setTurns([...next, { role: "assistant", content: r.data.reply ?? t("Sorry, something went wrong.") }]);
    setBusy(false);
    setTimeout(() => scroll.current?.scrollToEnd(), 50);
  }
  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={s.pad}>
        {turns.map((t, i) => (
          <View key={i} style={{ alignSelf: t.role === "user" ? "flex-end" : "flex-start", backgroundColor: t.role === "user" ? C.brand : C.white, borderRadius: 16, padding: 12, marginBottom: 8, maxWidth: "85%", borderWidth: t.role === "user" ? 0 : 1, borderColor: C.line }}>
            <Text style={{ color: t.role === "user" ? C.white : C.ink, fontSize: 17 }}>{t.content}</Text>
          </View>
        ))}
        {busy && <Text style={s.p}>…</Text>}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderColor: C.line }}>
        <TextInput style={[s.input, { flex: 1 }]} value={text} onChangeText={setText} placeholder={t("e.g. haul away an old couch")} onSubmitEditing={send} />
        <Button title={t("Send")} onPress={send} busy={busy} />
      </View>
    </KeyboardAvoidingView>
  );
}
