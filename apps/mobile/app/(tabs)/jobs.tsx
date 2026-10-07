/*
 * FILE    : apps/mobile/app/(tabs)/jobs.tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Customer's jobs with live status (Supabase RLS + realtime).
 * UPDATED : 2026-10-06_0645 UTC — Bookings tab: Upcoming and Past, pull to refresh, a spinner on first load, a plain
 *           "Try again" when the connection drops, a sign-in prompt when signed out, and an empty state that
 *           leads to booking. Live updates keep working.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { TIME_WINDOW_LABEL, getService, money, moneyRange, type Job } from "@handled/core";
import { supabase, NETWORK_ERROR } from "../../lib/supabase";
import { Button, C, Card, Empty, ErrorState, Loading, Status, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { useSession } from "../../lib/session";

const DONE = ["completed", "cancelled"];

export default function Jobs() {
  const { t, svc } = useI18n();
  const { me, ready } = useSession();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from("jobs").select("*").order("scheduled_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) { setErr(/fetch|network/i.test(error.message) ? NETWORK_ERROR : "Couldn't load your bookings."); return; }
    setErr(null);
    setJobs((data ?? []) as Job[]);
  }, []);
  useEffect(() => {
    if (!me) return;
    load();
    const ch = supabase.channel("my-jobs").on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!ready) return <Loading />;
  if (!me) return <ScrollView style={s.screen} contentContainerStyle={s.pad}><Empty icon="📋" title={t("Sign in to see your bookings")} body={t("Live status, your pro, payments and receipts, all in one place.")} action={<Button title={t("Sign in")} onPress={() => router.push("/login")} />} /></ScrollView>;
  if (!jobs && err) return <ScrollView style={s.screen} contentContainerStyle={s.pad}><ErrorState message={err} onRetry={load} /></ScrollView>;
  if (!jobs) return <Loading />;

  const upcoming = jobs.filter((j) => !DONE.includes(j.status));
  const past = jobs.filter((j) => DONE.includes(j.status)).reverse();
  const row = (j: Job) => {
    const sv = getService(j.service_slug);
    return (
      <Pressable key={j.id} onPress={() => router.push({ pathname: "/job/[id]", params: { id: j.id } })} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <Text style={[s.b, { flex: 1 }]}>{sv?.icon} {sv ? svc(sv).name : j.service_slug}</Text>
            <Status status={j.status} />
          </View>
          <Text style={[s.p, { marginTop: 4 }]}>{j.scheduled_date ?? t("Date TBD")} · {t(TIME_WINDOW_LABEL[j.time_window])}</Text>
          <Text style={s.p} numberOfLines={1}>{j.address}{j.city ? `, ${j.city}` : ""}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <Text style={s.b}>{j.price_final ? money(j.price_final) : moneyRange(j.estimate_low, j.estimate_high)}</Text>
            <Text style={{ color: C.brand, fontWeight: "700" }}>{t("Details")} ›</Text>
          </View>
        </Card>
      </Pressable>
    );
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.brand} />}>
      {err ? <ErrorState message={err} onRetry={load} /> : null}
      {!jobs.length ? (
        <Empty icon="🧽" title={t("No bookings yet")} body={t("Book your first job in about a minute. Bookings made with your email appear here.")} action={<Button title={t("Book a service")} onPress={() => router.push("/")} />} />
      ) : null}
      {upcoming.length ? <Text style={[s.h2, { marginTop: 4 }]}>{t("Upcoming")}</Text> : null}
      {upcoming.map(row)}
      {past.length ? <Text style={s.h2}>{t("Past")}</Text> : null}
      {past.map(row)}
    </ScrollView>
  );
}
