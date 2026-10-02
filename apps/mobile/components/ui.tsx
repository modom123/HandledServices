/*
 * FILE    : apps/mobile/components/ui.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { JOB_STATUS_LABEL, type JobStatus } from "@handled/core";
import { useI18n } from "../lib/i18n";

export const C = { ink: "#0b1b2b", soft: "#5b6a7a", brand: "#0e7c66", deep: "#0a4a3e", tint: "#e6f4f0", paper: "#f0ead6", line: "#d9d0b8", white: "#fff", red: "#be123c" };

export function Button({ title, onPress, kind = "primary", disabled, busy, style }: { title: string; onPress: () => void; kind?: "primary" | "ghost" | "dark"; disabled?: boolean; busy?: boolean; style?: ViewStyle }) {
  const bg = kind === "primary" ? C.brand : kind === "dark" ? C.deep : C.white;
  return (
    <Pressable onPress={onPress} disabled={disabled || busy} style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1, borderWidth: kind === "ghost" ? 1 : 0 }, style]}>
      {busy ? <ActivityIndicator color={kind === "ghost" ? C.ink : C.white} /> : <Text style={[s.btnText, { color: kind === "ghost" ? C.ink : C.white }]}>{title}</Text>}
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={C.soft} style={s.input} {...props} />
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: C.tint, borderColor: C.brand }]}>
      <Text style={{ color: on ? C.brand : C.ink, fontWeight: on ? "700" : "400" }}>{label}</Text>
    </Pressable>
  );
}

export function Status({ status }: { status: JobStatus }) {
  const { t } = useI18n();
  return <Text style={s.status}>{t(JOB_STATUS_LABEL[status])}</Text>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  pad: { padding: 16, paddingBottom: 48 },
  h1: { fontSize: 28, fontWeight: "800", color: C.ink },
  h2: { fontSize: 20, fontWeight: "700", color: C.ink, marginTop: 20, marginBottom: 8 },
  p: { fontSize: 16, color: C.soft, lineHeight: 20 },
  b: { fontSize: 17, fontWeight: "700", color: C.ink },
  btn: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 20, alignItems: "center", borderColor: C.line },
  btnText: { fontWeight: "700", fontSize: 17 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 10 },
  label: { fontSize: 13, fontWeight: "700", color: C.soft, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 },
  input: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17, color: C.ink },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, marginBottom: 8, backgroundColor: C.white },
  row: { flexDirection: "row", flexWrap: "wrap" },
  status: { fontSize: 14, fontWeight: "700", color: C.brand, backgroundColor: C.tint, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: "hidden", alignSelf: "flex-start" },
});
