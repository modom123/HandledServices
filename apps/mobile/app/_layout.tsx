/*
 * FILE    : apps/mobile/app/_layout.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish (LocaleProvider).
 * UPDATED : 2026-10-02_1329 UTC — crash reporting to the Hub; Account screen (delete my account).
 * UPDATED : 2026-10-02_0255 UTC — My calendar screen for pros.
 * UPDATED : 2026-10-01_2047 UTC — push notifications: register on sign-in, open the right
 *           screen when a notification is tapped (offer → offer screen, job → job screen).
 * UPDATED : 2026-10-03_1337 UTC — My crew and Fast track screens.
 * UPDATED : 2026-10-05_0418 UTC — Rewards screen.
 * UPDATED : 2026-10-05_0449 UTC — Snap screen.
 * UPDATED : 2026-10-06_0645 UTC — bottom tabs (Home, Bookings, Pro, Account) in the (tabs) group; a crash shows
 *           a friendly "Try again" screen (and is reported to the Hub) instead of closing the app; a build
 *           without its settings shows a setup notice instead of crashing; a tapped notification waits until
 *           navigation is ready (cold start) before opening its screen; SessionProvider.
 */
import { useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { Stack, router, useRootNavigationState, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { Button, C, s } from "../components/ui";
import { configured, supabase } from "../lib/supabase";
import { registerForPush, routeFor } from "../lib/push";
import { installErrorReporting, reportAppError } from "../lib/errors";
import { LocaleProvider, translate, useI18n } from "../lib/i18n";
import { SessionProvider } from "../lib/session";

installErrorReporting();

/** Any screen that throws lands here instead of crashing the app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { reportAppError(error, "screen"); }, [error]);
  const es = (() => { try { return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("es"); } catch { return false; } })();
  const tr = (x: string) => translate(es ? "es" : "en", x);
  return (
    <View style={[s.screen, { justifyContent: "center", padding: 24 }]}>
      <Text style={{ fontSize: 44, textAlign: "center" }}>🛠️</Text>
      <Text style={[s.h1, { textAlign: "center", marginTop: 8 }]}>{tr("Something went wrong")}</Text>
      <Text style={[s.p, { textAlign: "center", marginTop: 8 }]}>{tr("We've been notified and are on it. Your bookings and payments are safe.")}</Text>
      <Button title={tr("Try again")} onPress={retry} style={{ marginTop: 20 }} />
      <Button title={tr("Go to Home")} kind="ghost" onPress={() => { try { router.replace("/"); } catch { retry(); } }} style={{ marginTop: 10 }} />
    </View>
  );
}

export default function Layout() {
  if (!configured) {
    return (
      <View style={[s.screen, { justifyContent: "center", padding: 24 }]}>
        <Text style={[s.h1, { textAlign: "center" }]}>Handled</Text>
        <Text style={[s.p, { textAlign: "center", marginTop: 10 }]}>This build is missing its server settings (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_API_URL). Add them to the EAS build profile and rebuild.</Text>
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <SessionProvider>
          <StatusBar style="dark" />
          <AppStack />
          <NotificationRouter />
        </SessionProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}

/** Registers for push and opens the screen a tapped notification points to, once navigation is ready. */
function NotificationRouter() {
  const nav = useRootNavigationState();
  const ready = Boolean(nav?.key);
  const readyRef = useRef(false);
  const pending = useRef<string | null>(null);
  const handled = useRef<Set<string>>(new Set());
  const go = (to: string | null) => {
    if (!to) return;
    if (!readyRef.current) { pending.current = to; return; }
    try { router.push(to as never); } catch (e) { reportAppError(e, "notification-route"); }
  };
  useEffect(() => {
    readyRef.current = ready;
    if (ready && pending.current) { const to = pending.current; pending.current = null; go(to); }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) registerForPush().catch(() => null); }).catch(() => null);
    const { data: auth } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") registerForPush().catch(() => null); });
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const id = r.notification.request.identifier;
      if (handled.current.has(id)) return; // the launch notification is reported by both calls below
      handled.current.add(id);
      go(routeFor(r.notification.request.content.data as Record<string, unknown>));
    };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => null); // app launched from a notification
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => { auth.subscription.unsubscribe(); sub.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Screens and their titles, in the chosen language. */
function AppStack() {
  const { t } = useI18n();
  return (
    <Stack screenOptions={{ headerTintColor: C.ink, headerStyle: { backgroundColor: C.paper }, headerShadowVisible: false, headerBackTitle: t("Back"), contentStyle: { backgroundColor: C.paper } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Handled" }} />
      <Stack.Screen name="book/[slug]" options={{ title: t("Book") }} />
      <Stack.Screen name="chat" options={{ title: t("Concierge") }} />
      <Stack.Screen name="snap" options={{ title: t("Snap a job") }} />
      <Stack.Screen name="login" options={{ title: t("Sign in"), presentation: "modal" }} />
      <Stack.Screen name="job/[id]" options={{ title: t("Booking") }} />
      <Stack.Screen name="pro/index" options={{ title: t("Pro") }} />
      <Stack.Screen name="pro/offer/[id]" options={{ title: t("Job offer"), presentation: "modal" }} />
      <Stack.Screen name="pro/[id]" options={{ title: t("Job") }} />
      <Stack.Screen name="pro/earnings" options={{ title: t("Earnings") }} />
      <Stack.Screen name="pro/schedule" options={{ title: t("My calendar") }} />
      <Stack.Screen name="pro/crew" options={{ title: t("My crew") }} />
      <Stack.Screen name="pro/fast-track" options={{ title: t("Fast track") }} />
      <Stack.Screen name="pro/rewards" options={{ title: t("Rewards") }} />
    </Stack>
  );
}
