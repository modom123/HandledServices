/*
 * FILE    : apps/mobile/app/index.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish, with an EN | ES switch.
 * PURPOSE : Home — services, concierge, my jobs; switches to pro mode for subcontractors.
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 */
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { BRAND, CATEGORIES, SERVICES, money, priceHint } from "@handled/core";
import { API_URL, api, supabase } from "../lib/supabase";
import { Button, C, Card, s } from "../components/ui";
import { useI18n } from "../lib/i18n";

type Me = { email: string; role: string; contractorId: string | null } | null;

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  const { t, locale, setLocale, svc, cat } = useI18n();
  useEffect(() => {
    const load = async () => { const r = await api<{ user: Me }>("/api/me"); setMe(r.ok ? r.data.user : null); };
    load();
    const { data } = supabase.auth.onAuthStateChange(() => load());
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginBottom: 6 }}>
        {(["en", "es"] as const).map((l) => <Pressable key={l} onPress={() => setLocale(l)}><Text style={{ fontWeight: locale === l ? "800" : "400", color: locale === l ? C.ink : C.soft }}>{l.toUpperCase()}</Text></Pressable>)}
      </View>
      <Text style={s.h1}>{t("What can we take off your plate?")}</Text>
      <Text style={[s.p, { marginTop: 6 }]}>{locale === "es" ? t("BRAND_PITCH") : BRAND.pitch}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Button title={`💬 ${t("Ask for a price")}`} kind="dark" onPress={() => router.push("/chat")} style={{ flex: 1 }} />
        {me ? <Button title={t("My bookings")} kind="ghost" onPress={() => router.push("/jobs")} style={{ flex: 1 }} /> : <Button title={t("Sign in")} kind="ghost" onPress={() => router.push("/login")} style={{ flex: 1 }} />}
      </View>
      {me?.contractorId && <Button title={`🧰 ${t("Open Pro mode")}`} onPress={() => router.push("/pro")} style={{ marginTop: 10 }} />}
      {!me?.contractorId && <Button title={`💼 ${t("Become a pro — get prepaid jobs")}`} kind="ghost" onPress={() => Linking.openURL(`${API_URL}/pros?src=app`)} style={{ marginTop: 10 }} />}
      {CATEGORIES.map((c) => (
        <View key={c.id}>
          <Text style={s.h2}>{c.icon} {cat(c).name}</Text>
          {SERVICES.filter((x) => x.category === c.id).map((x) => (
            <Link key={x.slug} href={{ pathname: "/book/[slug]", params: { slug: x.slug } }} asChild>
              <Pressable><Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 30 }}>{x.icon}</Text>
                <View style={{ flex: 1 }}><Text style={s.b}>{svc(x).name}</Text><Text style={s.p}>{svc(x).tagline}</Text></View>
                <Text style={{ color: C.brand, fontWeight: "700", fontSize: 13 }}>{priceHint(x.slug, locale)}</Text>
              </Card></Pressable>
            </Link>
          ))}
        </View>
      ))}
      {me && <Pressable onPress={() => router.push("/account")}><Text style={[s.p, { textAlign: "center", marginTop: 20 }]}>{t("Signed in as")} {me.email} · {t("Account & sign out")}</Text></Pressable>}
    </ScrollView>
  );
}
