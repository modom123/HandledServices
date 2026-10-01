/*
 * FILE    : apps/mobile/app/_layout.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-01_2047 UTC — push notifications: register on sign-in, open the right
 *           screen when a notification is tapped (offer → offer screen, job → job screen).
 */
import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { C } from "../components/ui";
import { supabase } from "../lib/supabase";
import { registerForPush, routeFor } from "../lib/push";

export default function Layout() {
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) registerForPush().catch(() => null); });
    const { data: auth } = supabase.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN") registerForPush().catch(() => null); });
    const open = (r: Notifications.NotificationResponse | null) => { const to = routeFor(r?.notification.request.content.data as Record<string, unknown>); if (to) router.push(to as never); };
    Notifications.getLastNotificationResponseAsync().then(open); // app launched from a notification
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => { auth.subscription.unsubscribe(); sub.remove(); };
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: C.ink, headerStyle: { backgroundColor: C.paper }, headerShadowVisible: false, contentStyle: { backgroundColor: C.paper } }}>
        <Stack.Screen name="index" options={{ title: "Handled" }} />
        <Stack.Screen name="book/[slug]" options={{ title: "Book" }} />
        <Stack.Screen name="chat" options={{ title: "Concierge" }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="jobs" options={{ title: "My bookings" }} />
        <Stack.Screen name="job/[id]" options={{ title: "Booking" }} />
        <Stack.Screen name="pro/index" options={{ title: "Pro" }} />
        <Stack.Screen name="pro/offer/[id]" options={{ title: "Job offer", presentation: "modal" }} />
        <Stack.Screen name="pro/[id]" options={{ title: "Job" }} />
      </Stack>
    </>
  );
}
