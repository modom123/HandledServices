/*
 * FILE    : apps/mobile/lib/push.ts
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_2047 UTC
 * PURPOSE : Push notifications: permission, Android channels ("offers" rings loud for new
 *           work, "updates" for job progress), and registering this phone's Expo push token
 *           with the Handled API for the signed-in user.
 */
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let lastToken: string | null = null;

export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators can't receive push
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("offers", { name: "New job offers", importance: Notifications.AndroidImportance.MAX, sound: "default", vibrationPattern: [0, 400, 200, 400] });
    await Notifications.setNotificationChannelAsync("updates", { name: "Job updates", importance: Notifications.AndroidImportance.DEFAULT });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(projectId && /^[0-9a-f-]{36}$/i.test(projectId) ? { projectId } : undefined);
  await api("/api/me/push-token", { method: "POST", body: JSON.stringify({ token, platform: Platform.OS }) });
  lastToken = token;
  return token;
}

/** Call before signing out so this phone stops getting the previous user's notifications. */
export async function unregisterPush() {
  if (lastToken) await api("/api/me/push-token", { method: "DELETE", body: JSON.stringify({ token: lastToken }) }).catch(() => null);
  lastToken = null;
}

/** Where a tapped notification should open. */
export function routeFor(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (data.type === "offer" && data.offerId) return `/pro/offer/${data.offerId}`;
  if (data.type === "job_pro" && data.jobId) return `/pro/${data.jobId}`;
  if (data.type === "job" && data.jobId) return `/job/${data.jobId}`;
  if (data.type === "earnings") return "/pro/earnings";
  if (data.type === "onboarding" || data.type === "pro_home") return "/pro";
  return null;
}
