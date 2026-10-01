/*
 * FILE    : apps/mobile/app/_layout.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 */
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { C } from "../components/ui";

export default function Layout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: C.ink, headerStyle: { backgroundColor: C.paper }, headerShadowVisible: false, contentStyle: { backgroundColor: C.paper } }}>
        <Stack.Screen name="index" options={{ title: "Handled" }} />
        <Stack.Screen name="book/[slug]" options={{ title: "Book" }} />
        <Stack.Screen name="chat" options={{ title: "Concierge" }} />
        <Stack.Screen name="login" options={{ title: "Sign in" }} />
        <Stack.Screen name="jobs" options={{ title: "My jobs" }} />
        <Stack.Screen name="pro/index" options={{ title: "Pro" }} />
        <Stack.Screen name="pro/[id]" options={{ title: "Job" }} />
      </Stack>
    </>
  );
}
