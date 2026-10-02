/*
 * FILE    : apps/mobile/app/pro/index.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-01_2140 UTC — Earnings opens the in-app earnings screen (instant pay).
 * UPDATED : 2026-10-02_0255 UTC — On call switch (location shared while on call / on a job today) and My calendar.
 * PURPOSE : Pro mode — live job offers (accept/pass) and today's schedule.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { TIME_WINDOW_LABEL, getService, localDate, money, type Job } from "@handled/core";
import { API_URL, api, supabase } from "../../lib/supabase";
import { useLocationSharing } from "../../lib/location";
import { Button, C, Card, Status, s } from "../../components/ui";

type Offer = { id: string; payout: number; expires_at: string; jobs: Pick<Job, "ref" | "service_slug" | "city" | "zip" | "scheduled_date" | "time_window" | "notes"> | null };

export default function ProHome() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [onCall, setOnCall] = useState<{ on: boolean; until: string | null }>({ on: false, until: null });
  const activeToday = jobs.some((j) => j.scheduled_date === localDate() && ["assigned", "in_progress"].includes(j.status));
  useLocationSharing(onCall.on || activeToday);
  async function toggleOnCall(hours = 4) {
    const r = await api<{ onCall: boolean; until: string | null; error?: string }>("/api/pro/status", { method: "POST", body: JSON.stringify({ on_call: !onCall.on, hours }) });
    if (!r.ok) return Alert.alert("Couldn't update", r.data.error ?? "Try again");
    setOnCall({ on: r.data.onCall, until: r.data.until });
  }
  const load = useCallback(async () => {
    setLoading(true);
    api<{ onCall: boolean; onCallUntil: string | null }>("/api/pro/schedule?days=7").then((r) => { if (r.ok) setOnCall({ on: r.data.onCall, until: r.data.onCallUntil }); });
    const [o, j] = await Promise.all([
      supabase.from("job_offers").select("id, payout, expires_at, jobs(ref, service_slug, city, zip, scheduled_date, time_window, notes)").eq("status", "offered"),
      supabase.from("jobs").select("*").in("status", ["assigned", "in_progress", "qa_review", "site_visit"]).not("contractor_id", "is", null).order("scheduled_date"),
    ]);
    setOffers((o.data ?? []) as unknown as Offer[]);
    setJobs((j.data ?? []) as Job[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel("pro-offers").on("postgres_changes", { event: "*", schema: "public", table: "job_offers" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="Setup & documents" kind="ghost" onPress={() => Linking.openURL(`${API_URL}/pro/onboarding`)} style={{ flex: 1 }} />
        <Button title="⚡ Earnings" kind="ghost" onPress={() => router.push("/pro/earnings")} style={{ flex: 1 }} />
      </View>
      <Card style={{ marginTop: 12, borderColor: onCall.on ? C.brand : undefined }}>
        <Text style={s.b}>{onCall.on ? "🟢 You're on call" : "⚪ Off call"}</Text>
        <Text style={s.p}>{onCall.on ? `Same-day jobs near you come to you first${onCall.until ? ` until ${new Date(onCall.until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}.` : "Go on call to get same-day jobs, even on a day you don't usually work."}</Text>
        {onCall.on
          ? <Button title="Go off call" kind="ghost" onPress={() => toggleOnCall()} style={{ marginTop: 10 }} />
          : <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>{[2, 4, 8].map((h) => <Button key={h} title={`On call ${h}h`} onPress={() => toggleOnCall(h)} style={{ flex: 1 }} />)}</View>}
        <Text style={[s.p, { fontSize: 14, marginTop: 6 }]}>{onCall.on || activeToday ? "📍 Sharing your location while on call or on a job today (app open only)." : "Your location isn't shared when you're off call and not on a job."}</Text>
      </Card>
      <Button title="📅 My calendar & days off" kind="ghost" onPress={() => router.push("/pro/schedule")} style={{ marginTop: 10 }} />
      <Text style={s.h2}>New offers</Text>
      {!offers.length && <Text style={s.p}>No open offers. We'll notify you when one comes in.</Text>}
      {offers.map((o) => {
        const svc = getService(o.jobs?.service_slug ?? "");
        return (
          <Card key={o.id}>
            <Text style={s.b}>{svc?.icon} {svc?.name} · <Text style={{ color: C.brand }}>{o.payout ? money(o.payout) : "site visit"}</Text></Text>
            <Text style={s.p}>{o.jobs?.city} {o.jobs?.zip} · {o.jobs?.scheduled_date} · {o.jobs ? TIME_WINDOW_LABEL[o.jobs.time_window] : ""}</Text>
            {o.jobs?.notes ? <Text style={[s.p, { marginTop: 4 }]}>“{o.jobs.notes}”</Text> : null}
            <Button title="View & accept →" onPress={() => router.push({ pathname: "/pro/offer/[id]", params: { id: o.id } })} style={{ marginTop: 10 }} />
          </Card>
        );
      })}
      <Text style={s.h2}>My schedule</Text>
      {!jobs.length && <Text style={s.p}>Nothing scheduled.</Text>}
      {jobs.map((j) => (
        <Pressable key={j.id} onPress={() => router.push({ pathname: "/pro/[id]", params: { id: j.id } })}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={s.b}>{getService(j.service_slug)?.name}</Text><Status status={j.status} /></View>
            <Text style={s.p}>{j.ref} · {j.scheduled_date} · {j.address}, {j.city}</Text>
            <Text style={[s.b, { marginTop: 4 }]}>{money(j.contractor_payout)}</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}
