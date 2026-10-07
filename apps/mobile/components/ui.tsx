/*
 * FILE    : apps/mobile/components/ui.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-06_0645 UTC — world-class basics shared by every screen: Form (keyboard never covers
 *           the field you're typing in), StickyBar (price + main button always in reach), Loading,
 *           ErrorState (plain message + Try again), Empty, SearchBox; buttons and chips announce
 *           themselves to screen readers, have 44 pt+ touch targets and a pressed state.
 * UPDATED : 2026-10-06_0708 UTC — chips give a light haptic tick when picked.
 */
import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewProps, type TextInputProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JOB_STATUS_LABEL, type JobStatus } from "@handled/core";
import { useI18n } from "../lib/i18n";
import { haptic } from "../lib/haptics";

export const C = { ink: "#0b1b2b", soft: "#4b5a6a", brand: "#0e7c66", deep: "#0a4a3e", tint: "#e6f4f0", paper: "#f0ead6", line: "#d9d0b8", white: "#fff", red: "#be123c", amber: "#b45309" };

export function Button({ title, onPress, kind = "primary", disabled, busy, style, label }: { title: string; onPress: () => void; kind?: "primary" | "ghost" | "dark"; disabled?: boolean; busy?: boolean; style?: ViewStyle; label?: string }) {
  const bg = kind === "primary" ? C.brand : kind === "dark" ? C.deep : C.white;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1, borderWidth: kind === "ghost" ? 1 : 0, transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] }, style]}
    >
      {busy ? <ActivityIndicator color={kind === "ghost" ? C.ink : C.white} /> : <Text style={[s.btnText, { color: kind === "ghost" ? C.ink : C.white }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.soft} accessibilityLabel={label} style={[s.input, error ? { borderColor: C.red, borderWidth: 2 } : null]} {...props} />
      {error ? <Text style={{ color: C.red, fontSize: 14, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={() => { haptic("select"); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: on }} hitSlop={4} style={({ pressed }) => [s.chip, on && { backgroundColor: C.tint, borderColor: C.brand }, pressed && { opacity: 0.8 }]}>
      <Text style={{ color: on ? C.brand : C.ink, fontWeight: on ? "700" : "500", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Status({ status }: { status: JobStatus }) {
  const { t } = useI18n();
  return <Text style={s.status}>{t(JOB_STATUS_LABEL[status])}</Text>;
}

/** A scrolling form that moves out of the keyboard's way (iOS and Android). */
export function Form({ children, footer, ...props }: ScrollViewProps & { children: ReactNode; footer?: ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.paper }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}>
      <ScrollView style={s.screen} contentContainerStyle={[s.pad, footer ? { paddingBottom: 140 } : null]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" {...props}>
        {children}
      </ScrollView>
      {footer}
    </KeyboardAvoidingView>
  );
}

/** The bar pinned to the bottom of a screen: the price and the one button that matters. */
export function StickyBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.sticky, { paddingBottom: Math.max(14, insets.bottom + 6) }]}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={[s.screen, { alignItems: "center", justifyContent: "center", padding: 24 }]} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={C.brand} />
      {label ? <Text style={[s.p, { marginTop: 12, textAlign: "center" }]}>{label}</Text> : null}
    </View>
  );
}

/** Something failed: say what, in plain words, and offer the way out. */
export function ErrorState({ message, onRetry, style, icon = "📡" }: { message: string; onRetry?: () => void; style?: ViewStyle; icon?: string }) {
  const { t } = useI18n();
  return (
    <Card style={{ alignItems: "center", paddingVertical: 24, ...style }}>
      <Text style={{ fontSize: 34 }}>{icon}</Text>
      <Text style={[s.b, { textAlign: "center", marginTop: 6 }]}>{t(message)}</Text>
      {onRetry ? <Button title={t("Try again")} kind="ghost" onPress={onRetry} style={{ marginTop: 14, alignSelf: "stretch" }} /> : null}
    </Card>
  );
}

export function Empty({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 36, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 44 }}>{icon}</Text>
      <Text style={[s.b, { fontSize: 19, textAlign: "center", marginTop: 8 }]}>{title}</Text>
      {body ? <Text style={[s.p, { textAlign: "center", marginTop: 6 }]}>{body}</Text> : null}
      {action ? <View style={{ alignSelf: "stretch", marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

export function SearchBox({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  return (
    <View style={s.search}>
      <Text style={{ fontSize: 18 }}>🔎</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.soft} accessibilityLabel={placeholder} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" style={{ flex: 1, fontSize: 17, color: C.ink, paddingVertical: 12 }} />
      {value && Platform.OS !== "ios" ? <Pressable onPress={() => onChangeText("")} accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10}><Text style={{ fontSize: 18, color: C.soft }}>✕</Text></Pressable> : null}
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  pad: { padding: 16, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: "800", color: C.ink, marginTop: 22, marginBottom: 10 },
  p: { fontSize: 16, color: C.soft, lineHeight: 22 },
  b: { fontSize: 17, fontWeight: "700", color: C.ink },
  btn: { borderRadius: 999, minHeight: 50, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderColor: C.line },
  btnText: { fontWeight: "700", fontSize: 17 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "700", color: C.soft, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17, color: C.ink, minHeight: 50 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, minHeight: 44, justifyContent: "center", marginRight: 8, marginBottom: 8, backgroundColor: C.white },
  row: { flexDirection: "row", flexWrap: "wrap" },
  status: { fontSize: 14, fontWeight: "700", color: C.brand, backgroundColor: C.tint, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden", alignSelf: "flex-start" },
  sticky: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: C.white, borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 16, paddingTop: 12, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14 },
});
