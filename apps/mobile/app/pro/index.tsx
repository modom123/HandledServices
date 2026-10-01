/*
 * FILE    : apps/mobile/app/pro/index.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Pro mode — live job offers (accept/pass) and today's schedule.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { TIME_WINDOW_LABEL, getService, money, type Job } from "@handled/core";
import { api, supabase } from "../../lib/supabase";
import { Button, C, Card, Status, s } from "../../components/ui";

type Offer = { id: string; payout: number; expires_at: string; jobs: Pick<Job, "ref" | "service_slug" | "city" | "zip" | "scheduled_date" | "time_window" | "notes"> | null };

export default function ProHome() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
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

  async function respond(id: string, action: "accept" | "decline") {
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/offers/${id}`, { method: "POST", body: JSON.stringify({ action }) });
    if (!r.ok) Alert.alert("Not available", r.data.error ?? "");
    load();
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={s.h2}>New offers</Text>
      {!offers.length && <Text style={s.p}>No open offers. We'll notify you when one comes in.</Text>}
      {offers.map((o) => {
        const svc = getService(o.jobs?.service_slug ?? "");
        return (
          <Card key={o.id}>
            <Text style={s.b}>{svc?.icon} {svc?.name} · <Text style={{ color: C.brand }}>{o.payout ? money(o.payout) : "site visit"}</Text></Text>
            <Text style={s.p}>{o.jobs?.city} {o.jobs?.zip} · {o.jobs?.scheduled_date} · {o.jobs ? TIME_WINDOW_LABEL[o.jobs.time_window] : ""}</Text>
            {o.jobs?.notes ? <Text style={[s.p, { marginTop: 4 }]}>“{o.jobs.notes}”</Text> : null}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button title="Pass" kind="ghost" onPress={() => respond(o.id, "decline")} style={{ flex: 1 }} />
              <Button title="Accept" onPress={() => respond(o.id, "accept")} style={{ flex: 2 }} />
            </View>
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
