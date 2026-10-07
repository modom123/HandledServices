/*
 * FILE    : apps/mobile/app/(tabs)/_layout.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-06_0645 UTC
 * PURPOSE : The bottom tab bar, like the apps people already know: Home (book anything), Bookings (live
 *           status of every job), Pro (pros only: offers, on call, schedule) and Account. Labels follow the
 *           chosen language; the Pro tab only appears for an approved pro.
 */
import { Text } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";

const icon = (glyph: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 20, lineHeight: 24, height: 24, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>;

export default function TabsLayout() {
  const { t } = useI18n();
  const { me } = useSession();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.soft,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        tabBarStyle: { backgroundColor: C.white, borderTopColor: C.line, height: 70 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(8, insets.bottom) },
        tabBarIconStyle: { width: 28, height: 26 },
        headerStyle: { backgroundColor: C.paper },
        headerShadowVisible: false,
        headerTintColor: C.ink,
        headerTitleStyle: { fontWeight: "800" },
        sceneStyle: { backgroundColor: C.paper },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("Home"), headerTitle: "Handled", tabBarIcon: icon("🏠") }} />
      <Tabs.Screen name="jobs" options={{ title: t("Bookings"), headerTitle: t("My bookings"), tabBarIcon: icon("📋") }} />
      <Tabs.Screen name="work" options={{ title: t("Pro"), headerTitle: t("Pro mode"), tabBarIcon: icon("🧰"), href: me?.contractorId ? "/work" : null }} />
      <Tabs.Screen name="account" options={{ title: t("Account"), tabBarIcon: icon("👤") }} />
    </Tabs>
  );
}
