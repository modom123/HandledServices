/*
 * FILE    : apps/mobile/app/pro/[id].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-01_2140 UTC — materials receipts (reimbursed at cost) and "Can't get in?".
 * PURPOSE : Pro job sheet — navigate, start, take completion photos, submit for AI QA.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { getService, money, questionVisible, scopeChange, type Job } from "@handled/core";
import { api, supabase } from "../../lib/supabase";
import { Button, C, Card, Chip, Status, s } from "../../components/ui";

type Materials = { allowed: boolean; reason: string | null; autoApproveUpTo: number; shopping: boolean; expenses: { id: string; amount: number; description: string; status: string; notes: string | null }[] };
const EXP_STATUS: Record<string, string> = { pending: "waiting for approval", approved: "approved", billed: "approved — waiting on the customer", paid: "reimbursed", rejected: "not approved" };

export default function ProJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [mat, setMat] = useState<Materials | null>(null);
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [receipt, setReceipt] = useState<{ uri: string; type: string } | null>(null);
  const [lockout, setLockout] = useState<string | null>(null);
  const [scope, setScope] = useState<Record<string, string | number | boolean> | null>(null);
  const [scopeNote, setScopeNote] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
    setJob(data as Job);
    const m = await api<Materials>(`/api/pro/jobs/${id}/expenses`);
    if (m.ok) setMat(m.data);
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
  async function snapReceipt() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const r = perm.granted ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled) setReceipt({ uri: r.assets[0].uri, type: r.assets[0].mimeType ?? "image/jpeg" });
  }
  async function sendReceipt() {
    const n = Number(amount);
    if (!(n > 0) || what.trim().length < 3 || !receipt) return Alert.alert("Receipt", "Add the amount, what you bought and a photo of the receipt.");
    const fd = new FormData();
    fd.append("amount", String(n));
    fd.append("description", what.trim());
    fd.append("file", { uri: receipt.uri, name: `receipt-${Date.now()}.jpg`, type: receipt.type } as never);
    setBusy(true);
    const r = await api<{ ok: boolean; status?: string; error?: string }>(`/api/pro/jobs/${job!.id}/expenses`, { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) return Alert.alert("Not accepted", r.data.error ?? "");
    Alert.alert("Receipt sent", r.data.status === "pending" ? "Sent for approval." : "Approved — you're reimbursed once the customer pays.");
    setAmount(""); setWhat(""); setReceipt(null);
    load();
  }
  async function sendScope() {
    setBusy(true);
    const r = await api<{ ok: boolean; extra?: number; error?: string }>(`/api/pro/jobs/${job!.id}`, { method: "POST", body: JSON.stringify({ action: "scope_change", answers: scope, note: scopeNote }) });
    setBusy(false);
    if (!r.ok) return Alert.alert("Not sent", r.data.error ?? "");
    setScope(null); setScopeNote("");
    Alert.alert("Change order sent", `The customer is asked to approve ${money(r.data.extra ?? 0)}. Do only the booked work until the app says it's paid.`);
    load();
  }
  async function reportLockout() {
    if (!lockout || lockout.trim().length < 3) return Alert.alert("Can't get in", "Say what happened (knocked, called, gate locked…).");
    setBusy(true);
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/jobs/${job!.id}`, { method: "POST", body: JSON.stringify({ action: "lockout", note: lockout.trim() }) });
    setBusy(false);
    if (!r.ok) return Alert.alert("Couldn't send", r.data.error ?? "");
    setLockout(null);
    Alert.alert("We're on it", "We're calling the customer now. Please wait 15 minutes on site. A confirmed lockout earns show-up pay.");
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
        {svc.questions.filter((q) => questionVisible(q, job.answers as Record<string, string | number | boolean>, svc.questions)).map((q) => <Text key={q.id} style={s.p}>{q.label}: <Text style={s.b}>{String(job.answers[q.id] ?? "—")}</Text></Text>)}
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

      {(job.status === "assigned" || job.status === "in_progress") && !job.remedy && (
        scope === null
          ? <Button title="More work than booked?" kind="ghost" onPress={() => setScope({ ...(job.answers as Record<string, string | number | boolean>) })} style={{ marginTop: 12 }} />
          : (() => {
            const sc = scopeChange(job.service_slug, job.answers as Record<string, string | number | boolean>, scope, job.frequency);
            return (
              <Card style={{ marginTop: 12 }}>
                <Text style={s.b}>Update the scope to what's really here</Text>
                <Text style={s.p}>The difference is priced at our standard rates and sent to the customer to approve and pay.</Text>
                {svc.questions.filter((q) => questionVisible(q, { ...(job.answers as Record<string, string | number | boolean>), ...scope }, svc.questions)).map((q) => (
                  <View key={q.id} style={{ marginTop: 10 }}>
                    <Text style={s.label}>{q.label}</Text>
                    {q.type === "number" ? <TextInput style={s.input} keyboardType="number-pad" value={String(scope[q.id] ?? q.default)} onChangeText={(t) => setScope({ ...scope, [q.id]: Math.min(q.max, Math.max(q.min, Number(t) || q.min)) })} />
                      : q.type === "select" ? <View style={s.row}>{q.options.map((o) => <Chip key={o.value} label={o.label} on={scope[q.id] === o.value} onPress={() => setScope({ ...scope, [q.id]: o.value })} />)}</View>
                      : <View style={s.row}><Chip label={scope[q.id] ? "Yes" : "No"} on={Boolean(scope[q.id])} onPress={() => setScope({ ...scope, [q.id]: !scope[q.id] })} /></View>}
                  </View>
                ))}
                <TextInput style={[s.input, { marginTop: 10 }]} placeholder="What you found (the customer sees this)" value={scopeNote} onChangeText={setScopeNote} multiline />
                <Text style={[s.b, { marginTop: 10 }]}>{sc.extra > 0 ? `Extra for the customer: ${money(sc.extra)}` : "No extra charge for this change"}</Text>
                <Button title="Send change order" disabled={sc.extra <= 0} busy={busy} onPress={sendScope} style={{ marginTop: 8 }} />
                <Button title="Never mind" kind="ghost" onPress={() => setScope(null)} style={{ marginTop: 6 }} />
              </Card>
            );
          })()
      )}

      {(job.status === "assigned" || job.status === "in_progress") && (
        lockout === null
          ? <Button title="Can't get in?" kind="ghost" onPress={() => setLockout("")} style={{ marginTop: 12 }} />
          : (
            <Card style={{ marginTop: 12, borderColor: C.red }}>
              <Text style={s.b}>Can't get access</Text>
              <TextInput style={[s.input, { marginTop: 8 }]} placeholder="Knocked and called at 9:05, gate locked, no answer…" value={lockout} onChangeText={setLockout} multiline />
              <Button title="Report no access" busy={busy} onPress={reportLockout} style={{ marginTop: 10 }} />
              <Button title="Never mind" kind="ghost" onPress={() => setLockout(null)} style={{ marginTop: 6 }} />
            </Card>
          )
      )}

      {["assigned", "in_progress", "qa_review", "completed"].includes(job.status) && mat && (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.b}>🧾 {mat.shopping ? "Purchases" : "Materials"}</Text>
          {!mat.allowed ? <Text style={s.p}>Reimbursement: {mat.reason}. Materials for this job are included in your payout.</Text> : (
            <>
              <Text style={s.p}>{mat.shopping ? "Store purchases for the customer" : "Parts not included in the price"}, at cost with the receipt. Up to {money(mat.autoApproveUpTo)} is approved automatically — call us before a bigger purchase. You're reimbursed once the customer pays.</Text>
              <TextInput style={[s.input, { marginTop: 10 }]} placeholder="$ amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
              <TextInput style={[s.input, { marginTop: 8 }]} placeholder={mat.shopping ? "What you bought (e.g. groceries at Kroger)" : "What you bought (e.g. wax ring + supply line)"} value={what} onChangeText={setWhat} />
              <Button title={receipt ? "📷 Receipt added ✓ (retake)" : "📷 Photo of receipt"} kind="ghost" onPress={snapReceipt} style={{ marginTop: 8 }} />
              <Button title="Submit receipt" busy={busy} onPress={sendReceipt} style={{ marginTop: 8 }} />
            </>
          )}
          {mat.expenses.map((e) => (
            <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, marginTop: 8 }}>
              <Text style={[s.p, { flex: 1 }]}>{e.description}{"\n"}<Text style={{ fontSize: 14 }}>{EXP_STATUS[e.status] ?? e.status}{e.status === "rejected" && e.notes ? ` — ${e.notes}` : ""}</Text></Text>
              <Text style={s.b}>{money(Number(e.amount))}</Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}
