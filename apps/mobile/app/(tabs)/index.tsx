/*
 * FILE    : apps/mobile/app/(tabs)/index.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish, with an EN | ES switch.
 * PURPOSE : Home — services, concierge, my jobs; switches to pro mode for subcontractors.
 * UPDATED : 2026-10-04_1950 UTC — lists show a typical job price ("typically $X"), not the minimum (every order is different).
 * UPDATED : 2026-10-05_0419 UTC — lists show "Instant upfront price" (priceHint), no dollar figures.
 * UPDATED : 2026-10-05_0449 UTC — 📸 Snap a photo, post a job.
 * UPDATED : 2026-10-06_0645 UTC — Home tab rebuilt like the apps people know: "What do you need done?" search across
 *           every service (English and Spanish), Snap / Ask actions, popular cleaning in Metro Detroit
 *           (MARKETING_FOCUS) as big tiles, and category chips that show one category at a time instead of
 *           one long list. Bookings, Pro and Account moved to the tab bar.
 */
import { useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CATEGORIES, MARKETING_FOCUS, SERVICES, getService, priceHint, type CategoryId } from "@handled/core";
import { API_URL } from "../../lib/supabase";
import { Button, C, Card, Empty, SearchBox, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";

const fold = (x: string) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** One service in a list: icon, name, tagline and how it's priced. */
function ServiceRow({ slug }: { slug: string }) {
  const { locale, svc } = useI18n();
  const x = getService(slug);
  if (!x) return null;
  return (
    <Pressable onPress={() => router.push({ pathname: "/book/[slug]", params: { slug: x.slug } })} accessibilityRole="button" accessibilityLabel={`${svc(x).name}. ${svc(x).tagline}`} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
        <Text style={{ fontSize: 30 }}>{x.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.b}>{svc(x).name}</Text>
          <Text style={[s.p, { fontSize: 15 }]} numberOfLines={2}>{svc(x).tagline}</Text>
          <Text style={{ color: C.brand, fontWeight: "700", fontSize: 14, marginTop: 4 }}>{priceHint(x.slug, locale)}</Text>
        </View>
        <Text style={{ fontSize: 22, color: C.soft }}>›</Text>
      </Card>
    </Pressable>
  );
}

export default function Home() {
  const { t, locale, setLocale, svc, cat } = useI18n();
  const { me } = useSession();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<CategoryId>(CATEGORIES[0].id);
  const open = (slug: string) => router.push({ pathname: "/book/[slug]", params: { slug } });

  // search both languages, the category and the tagline, accent-insensitive ("limpieza", "mower", "jardin")
  const results = useMemo(() => {
    const words = fold(q.trim()).split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    return SERVICES.filter((x) => {
      const c = CATEGORIES.find((k) => k.id === x.category)!;
      const hay = fold([x.name, x.tagline, x.slug.replace(/-/g, " "), svc(x).name, svc(x).tagline, c.name, cat(c).name].join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [q, locale]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={[s.p, { fontWeight: "600" }]}>{me?.email ? `${t("Hi")} 👋` : t("Metro Detroit")}</Text>
        <View style={{ flexDirection: "row", gap: 14 }}>
          {(["en", "es"] as const).map((l) => <Pressable key={l} onPress={() => setLocale(l)} hitSlop={10} accessibilityRole="button" accessibilityState={{ selected: locale === l }}><Text style={{ fontSize: 15, fontWeight: locale === l ? "800" : "500", color: locale === l ? C.ink : C.soft }}>{l.toUpperCase()}</Text></Pressable>)}
        </View>
      </View>
      <Text style={s.h1}>{t("What do you need done?")}</Text>
      <View style={{ marginTop: 14 }}>
        <SearchBox value={q} onChangeText={setQ} placeholder={t("Search: cleaning, lawn, junk, rides…")} />
      </View>

      {results ? (
        <View style={{ marginTop: 16 }}>
          {results.length ? results.map((x) => <ServiceRow key={x.slug} slug={x.slug} />) : (
            <Empty icon="🤔" title={t("No match yet")} body={t("Describe it to our concierge and we'll price it for you.")} action={<Button title={`💬 ${t("Ask for a price")}`} onPress={() => router.push("/chat")} />} />
          )}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Pressable onPress={() => router.push("/snap")} accessibilityRole="button" style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}>
              <Card style={{ backgroundColor: C.deep, borderColor: C.deep, marginBottom: 0, minHeight: 96 }}>
                <Text style={{ fontSize: 26 }}>📸</Text>
                <Text style={[s.b, { color: C.white, marginTop: 4 }]}>{t("Snap a photo")}</Text>
                <Text style={{ color: "#cfe9e1", fontSize: 14 }}>{t("We'll price the job")}</Text>
              </Card>
            </Pressable>
            <Pressable onPress={() => router.push("/chat")} accessibilityRole="button" style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.85 : 1 }]}>
              <Card style={{ marginBottom: 0, minHeight: 96 }}>
                <Text style={{ fontSize: 26 }}>💬</Text>
                <Text style={[s.b, { marginTop: 4 }]}>{t("Ask for a price")}</Text>
                <Text style={[s.p, { fontSize: 14 }]}>{t("Describe anything")}</Text>
              </Card>
            </Pressable>
          </View>

          <Text style={s.h2}>{t("Popular in Metro Detroit")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {MARKETING_FOCUS.services.map((slug) => {
              const x = getService(slug);
              if (!x) return null;
              return (
                <Pressable key={slug} onPress={() => open(slug)} accessibilityRole="button" accessibilityLabel={svc(x).name} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
                  <Card style={{ width: 168, minHeight: 150, marginBottom: 0, backgroundColor: C.tint, borderColor: C.brand }}>
                    <Text style={{ fontSize: 34 }}>{x.icon}</Text>
                    <Text style={[s.b, { marginTop: 6 }]} numberOfLines={2}>{svc(x).name}</Text>
                    <Text style={{ color: C.brand, fontWeight: "700", fontSize: 14, marginTop: "auto" }}>{t("Book")} →</Text>
                  </Card>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={s.h2}>{t("All services")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {CATEGORIES.map((c) => {
              const on = picked === c.id;
              return (
                <Pressable key={c.id} onPress={() => setPicked(c.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.chip, on && { backgroundColor: C.ink, borderColor: C.ink }]}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: on ? C.white : C.ink }}>{c.icon} {cat(c).short}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={[s.p, { marginTop: 4, marginBottom: 10 }]}>{cat(CATEGORIES.find((c) => c.id === picked)!).blurb}</Text>
          {SERVICES.filter((x) => x.category === picked).map((x) => <ServiceRow key={x.slug} slug={x.slug} />)}

          {!me?.contractorId ? (
            <Pressable onPress={() => Linking.openURL(`${API_URL}/pros?src=app`)} accessibilityRole="link" style={{ marginTop: 18 }}>
              <Text style={[s.p, { textAlign: "center" }]}>💼 {t("Own a crew or trade?")} <Text style={{ color: C.brand, fontWeight: "700" }}>{t("Become a pro — get prepaid jobs")}</Text></Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
