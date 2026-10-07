/*
 * FILE    : apps/mobile/lib/haptics.ts
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-06_0708 UTC
 * PURPOSE : Small vibrations that make the app feel solid, like the apps people use every day:
 *           a light tick when you pick an option, a firm tap on the main button, and success /
 *           warning / error buzzes when a booking or payment goes through or doesn't. Never throws;
 *           does nothing on web.
 *             haptic("select") · haptic("tap") · haptic("success") · haptic("warning") · haptic("error")
 */
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export type HapticKind = "select" | "tap" | "success" | "warning" | "error";

export function haptic(kind: HapticKind): void {
  if (Platform.OS === "web") return;
  const run = (): Promise<void> => {
    switch (kind) {
      case "select": return Haptics.selectionAsync();
      case "tap": return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case "success": return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case "warning": return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      default: return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  try { run().catch(() => {}); } catch { /* no haptics hardware */ }
}
