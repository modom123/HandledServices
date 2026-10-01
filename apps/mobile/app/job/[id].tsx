/*
 * FILE    : apps/mobile/app/job/[id].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_2047 UTC
 * PURPOSE : Customer booking screen — "Covered ✓" by which pro, live timeline (realtime),
 *           pay now, invoice & agreement, and rating when done. Opened from notifications.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { TIME_WINDOW_LABEL, getService, money, moneyRange, type Job } from "@handled/core";
import { API_URL, api, supabase } from "../../lib/supabase";
import { Button, C, Card, Status, s } from "../../components/ui";

type Pro = { business_name: string; contact_first_name: string; rating: number; jobs_completed: number };
type Ev = { id: number; message: string; created_at: string };

export default function Booking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [pro, setPro] = useState<Pro | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [rated, setRated] = useState(false);
  const [stars, setStars] = useState(5);
  const load = useCallback(async () => {
    const [{ data: j }, { data: p }, { data: ev }, { data: rv }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).single(),
      supabase.rpc("job_pro", { p_job: id }),
      supabase.from("job_events").select("id, message, created_at").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.from("reviews").select("id").eq("job_id", id).maybeSingle(),
    ]);
    setJob(j as Job); setPro(((p ?? []) as Pro[])[0] ?? null); setEvents((ev ?? []) as Ev[]); setRated(Boolean(rv));
  }, [id]);
  useEffect(() => {
    load();
    const ch = supabase.channel(`booking-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "job_events", filter: `job_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, load]);
  if (!job) return <View style={[s.screen, s.pad]}><Text style={s.p}>Loading…</Text></View>;
  const svc = getService(job.service_slug);
  const unpaid = !job.paid_at && !job.remedy && job.price_final && job.status !== "cancelled";

  async function pay() {
    const r = await api<{ url?: string; error?: string }>(`/api/account/jobs/${id}/pay`, { method: "POST" });
    if (r.data.url) Linking.openURL(r.data.url); else Alert.alert("Payment", r.data.error ?? "Couldn't start payment");
  }
  async function rate() {
    const { error } = await supabase.from("reviews").insert({ job_id: id, rating: stars });
    if (error) Alert.alert("Couldn't save", error.message); else { setRated(true); Alert.alert("Thank you!", "Your rating helps us send the best pros."); }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={{ fontSize: 34 }}>{svc?.icon}</Text>
      <Text style={s.h1}>{svc?.name}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}><Status status={job.status} /><Text style={s.p}>{job.ref}</Text></View>
      <Text style={[s.p, { marginTop: 6 }]}>{job.scheduled_date ?? "Date TBD"} · {TIME_WINDOW_LABEL[job.time_window]}</Text>
      <Text style={s.p}>{job.address}, {job.city}</Text>

      {pro ? (
        <Card style={{ marginTop: 14, backgroundColor: C.tint, borderColor: C.brand }}>
          <Text style={{ fontWeight: "800", color: C.deep, fontSize: 16 }}>Covered ✓</Text>
          <Text style={s.b}>{pro.business_name}{pro.contact_first_name ? ` · ${pro.contact_first_name}` : ""}</Text>
          <Text style={s.p}>{pro.rating}★ · {pro.jobs_completed} jobs completed · vetted & insured</Text>
        </Card>
      ) : job.paid_at ? (
        <Card style={{ marginTop: 14 }}><Text style={s.b}>Finding your pro…</Text><Text style={s.p}>You'll get a notification the moment your job is covered.</Text></Card>
      ) : null}

      <Card style={{ marginTop: 6 }}>
        <Text style={s.label}>Price</Text>
        <Text style={{ fontSize: 22, fontWeight: "800", color: C.ink }}>{job.price_final ? money(job.price_final) : moneyRange(job.estimate_low, job.estimate_high)}</Text>
        <Text style={s.p}>{job.remedy ? "No charge" : job.paid_at ? `Paid ${money(job.amount_paid)}` : job.price_final ? "Payment due — your pro is dispatched once paid" : "Firm price after the free site visit"}</Text>
        {unpaid ? <Button title={`Pay ${money(job.price_final)}`} onPress={pay} style={{ marginTop: 10 }} /> : null}
        <Pressable onPress={() => Linking.openURL(`${API_URL}/invoice/${id}`)}><Text style={[s.p, { color: C.brand, fontWeight: "700", marginTop: 10 }]}>Invoice & service agreement →</Text></Pressable>
      </Card>

      {job.status === "completed" && !rated && (
        <Card>
          <Text style={s.b}>How did {pro?.business_name ?? "we"} do?</Text>
          <View style={{ flexDirection: "row", gap: 6, marginVertical: 10 }}>{[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setStars(n)}><Text style={{ fontSize: 32, opacity: n <= stars ? 1 : 0.25 }}>★</Text></Pressable>)}</View>
          <Button title="Submit rating" onPress={rate} />
        </Card>
      )}

      <Text style={s.h2}>Timeline</Text>
      {events.map((e) => (
        <View key={e.id} style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand, marginTop: 6 }} />
          <View style={{ flex: 1 }}><Text style={{ color: C.ink }}>{e.message}</Text><Text style={[s.p, { fontSize: 12 }]}>{new Date(e.created_at).toLocaleString()}</Text></View>
        </View>
      ))}
    </ScrollView>
  );
}
