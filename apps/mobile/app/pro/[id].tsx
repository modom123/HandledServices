/*
 * FILE    : apps/mobile/app/pro/[id].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Pro job sheet — navigate, start, take completion photos, submit for AI QA.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { getService, money, type Job } from "@handled/core";
import { api, supabase } from "../../lib/supabase";
import { Button, Card, Status, s } from "../../components/ui";

export default function ProJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
    setJob(data as Job);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  if (!job) return null;
  const svc = getService(job.service_slug)!;

  async function shoot() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const r = perm.granted ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.6 });
    if (r.canceled) return;
    const fd = new FormData();
    r.assets.forEach((a, i) => fd.append("photos", { uri: a.uri, name: `after-${Date.now()}-${i}.jpg`, type: a.mimeType ?? "image/jpeg" } as never));
    setBusy(true);
    const up = await api<{ paths: string[]; error?: string }>("/api/uploads", { method: "POST", body: fd });
    setBusy(false);
    if (!up.ok) return Alert.alert("Upload failed", up.data.error ?? "");
    setPhotos((p) => [...p, ...up.data.paths]);
  }
  async function post(body: object) {
    setBusy(true);
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/jobs/${job!.id}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok || !r.data.ok) Alert.alert("Couldn't update", r.data.error ?? "");
    load();
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>{svc.icon} {svc.name}</Text>
      <Status status={job.status} />
      <Card style={{ marginTop: 12 }}>
        <Text style={s.b}>{job.contact_name} · {job.contact_phone}</Text>
        <Text style={s.p} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city} ${job.zip}`)}`)}>📍 {job.address}, {job.city} {job.zip}</Text>
        <Text style={[s.b, { marginTop: 8 }]}>Payout {money(job.contractor_payout)}</Text>
      </Card>
      <Card>
        {svc.questions.map((q) => <Text key={q.id} style={s.p}>{q.label}: <Text style={s.b}>{String(job.answers[q.id] ?? "—")}</Text></Text>)}
        {job.notes ? <Text style={[s.p, { marginTop: 8 }]}>“{job.notes}”</Text> : null}
      </Card>
      {job.status === "assigned" && <Button title="I've arrived — start job" onPress={() => post({ action: "start" })} busy={busy} />}
      {(job.status === "assigned" || job.status === "in_progress") && (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.b}>Finish the job</Text>
          <Text style={s.p}>Photograph every area you worked on. AI checks them and approves your payout.</Text>
          <Button title={`📷 Take photos (${photos.length})`} kind="ghost" onPress={shoot} busy={busy} style={{ marginTop: 10 }} />
          <TextInput style={[s.input, { marginTop: 10 }]} placeholder="Note for the customer (optional)" value={note} onChangeText={setNote} multiline />
          <Button title="Mark complete" disabled={!photos.length} busy={busy} onPress={() => post({ action: "complete", photos, note: note || null })} style={{ marginTop: 10 }} />
        </Card>
      )}
      {job.status === "qa_review" && <Text style={[s.p, { marginTop: 12 }]}>Submitted — AI quality check in progress.</Text>}
    </ScrollView>
  );
}
