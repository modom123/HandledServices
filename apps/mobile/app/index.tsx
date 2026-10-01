/*
 * FILE    : apps/mobile/app/index.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Home — services, concierge, my jobs; switches to pro mode for subcontractors.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Link, router } from "expo-router";
import { BRAND, CATEGORIES, SERVICES, money } from "@handled/core";
import { api, supabase } from "../lib/supabase";
import { unregisterPush } from "../lib/push";
import { Button, C, Card, s } from "../components/ui";

type Me = { email: string; role: string; contractorId: string | null } | null;

export default function Home() {
  const [me, setMe] = useState<Me>(null);
  useEffect(() => {
    const load = async () => { const r = await api<{ user: Me }>("/api/me"); setMe(r.ok ? r.data.user : null); };
    load();
    const { data } = supabase.auth.onAuthStateChange(() => load());
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>What can we take off your plate?</Text>
      <Text style={[s.p, { marginTop: 6 }]}>{BRAND.pitch}</Text>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
        <Button title="💬 Ask for a price" kind="dark" onPress={() => router.push("/chat")} style={{ flex: 1 }} />
        {me ? <Button title="My bookings" kind="ghost" onPress={() => router.push("/jobs")} style={{ flex: 1 }} /> : <Button title="Sign in" kind="ghost" onPress={() => router.push("/login")} style={{ flex: 1 }} />}
      </View>
      {me?.contractorId && <Button title="🧰 Open Pro mode" onPress={() => router.push("/pro")} style={{ marginTop: 10 }} />}
      {CATEGORIES.map((c) => (
        <View key={c.id}>
          <Text style={s.h2}>{c.name}</Text>
          {SERVICES.filter((x) => x.category === c.id).map((x) => (
            <Link key={x.slug} href={{ pathname: "/book/[slug]", params: { slug: x.slug } }} asChild>
              <Pressable><Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Text style={{ fontSize: 28 }}>{x.icon}</Text>
                <View style={{ flex: 1 }}><Text style={s.b}>{x.name}</Text><Text style={s.p}>{x.tagline}</Text></View>
                <Text style={{ color: C.brand, fontWeight: "700" }}>from {money(x.minimum)}</Text>
              </Card></Pressable>
            </Link>
          ))}
        </View>
      ))}
      {me && <Pressable onPress={async () => { await unregisterPush(); await supabase.auth.signOut(); }}><Text style={[s.p, { textAlign: "center", marginTop: 20 }]}>Signed in as {me.email} · Sign out</Text></Pressable>}
    </ScrollView>
  );
}
