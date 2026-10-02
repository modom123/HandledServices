/*
 * FILE    : apps/mobile/app/jobs.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Customer's jobs with live status (Supabase RLS + realtime).
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { getService, money, moneyRange, type Job } from "@handled/core";
import { supabase } from "../lib/supabase";
import { Card, Status, s } from "../components/ui";
import { useI18n } from "../lib/i18n";

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const { t, svc } = useI18n();
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("jobs").select("*").order("created_at", { ascending: false });
    setJobs((data ?? []) as Job[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel("my-jobs").on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      {!jobs.length && <Text style={s.p}>{t("No jobs yet. Bookings made with your email appear here.")}</Text>}
      {jobs.map((j) => (
        <Pressable key={j.id} onPress={() => router.push({ pathname: "/job/[id]", params: { id: j.id } })}><Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={s.b}>{getService(j.service_slug)?.icon} {getService(j.service_slug) ? svc(getService(j.service_slug)!).name : j.service_slug}</Text><Status status={j.status} /></View>
          <Text style={s.p}>{j.ref} · {j.scheduled_date ?? t("date TBD")} · {j.address}</Text>
          <Text style={[s.b, { marginTop: 6 }]}>{j.price_final ? money(j.price_final) : moneyRange(j.estimate_low, j.estimate_high)}</Text>
        </Card></Pressable>
      ))}
    </ScrollView>
  );
}
