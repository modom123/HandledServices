/*
 * FILE    : apps/mobile/app/pro/[id].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-01_2140 UTC — materials receipts (reimbursed at cost) and "Can't get in?".
 * UPDATED : 2026-10-02_1329 UTC — On my way button (customer gets a live ETA link).
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * UPDATED : 2026-10-03_0124 UTC — hand back an upcoming job (late cancel inside 24h).
 * UPDATED : 2026-10-03_1337 UTC — crew accounts: pick who's doing the job.
 * UPDATED : 2026-10-04_2204 UTC — the customer's crew member request (★ on that person; the owner decides) and "asked for you".
 * UPDATED : 2026-10-05_0221 UTC — the job checklist: tap items as they're done, hold for N/A with the reason.
 * PURPOSE : Pro job sheet — navigate, start, take completion photos, submit for AI QA.
 */
import { shareLocationOnce } from "../../lib/location";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { getService, localDate, money, questionVisible, scopeChange, type Job } from "@handled/core";
import { api, supabase } from "../../lib/supabase";
import { Button, C, Card, Chip, Status, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { ProChecklist } from "../../components/Checklist";

type CrewPick = { ready: string | null; current: string | null; askedForYou?: boolean; requested?: { id: string; name: string } | null; options: { id: string; name: string; why: string | null }[] };
type Materials = { allowed: boolean; reason: string | null; autoApproveUpTo: number; shopping: boolean; expenses: { id: string; amount: number; description: string; status: string; notes: string | null }[] };
const EXP_STATUS: Record<string, string> = { pending: "waiting for approval", approved: "approved", billed: "approved — waiting on the customer", paid: "reimbursed", rejected: "not approved" };

export default function ProJob() {
  const { t, locale, svc: svcText } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [mat, setMat] = useState<Materials | null>(null);
  const [amount, setAmount] = useState("");
  const [release, setRelease] = useState<string | null>(null);
  const [what, setWhat] = useState("");
  const [receipt, setReceipt] = useState<{ uri: string; type: string } | null>(null);
  const [lockout, setLockout] = useState<string | null>(null);
  const [scope, setScope] = useState<Record<string, string | number | boolean> | null>(null);
  const [scopeNote, setScopeNote] = useState("");
  const [crew, setCrew] = useState<CrewPick | null>(null);
  const load = useCallback(async () => {
    const { data } = await supabase.from("jobs").select("*").eq("id", id).single();
    setJob(data as Job);
    const m = await api<Materials>(`/api/pro/jobs/${id}/expenses`);
    if (m.ok) setMat(m.data);
    const c = await api<CrewPick>(`/api/pro/crew?job=${id}`);
    if (c.ok && (c.data.options?.length || c.data.askedForYou)) setCrew(c.data); else setCrew(null);
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
    if (!up.ok) return Alert.alert(t("Upload failed"), up.data.error ?? "");
    setPhotos((p) => [...p, ...up.data.paths]);
  }
  async function snapReceipt() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const r = perm.granted ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled) setReceipt({ uri: r.assets[0].uri, type: r.assets[0].mimeType ?? "image/jpeg" });
  }
  async function sendReceipt() {
    const n = Number(amount);
    if (!(n > 0) || what.trim().length < 3 || !receipt) return Alert.alert(t("Receipt"), t("Add the amount, what you bought and a photo of the receipt."));
    const fd = new FormData();
    fd.append("amount", String(n));
    fd.append("description", what.trim());
    fd.append("file", { uri: receipt.uri, name: `receipt-${Date.now()}.jpg`, type: receipt.type } as never);
    setBusy(true);
    const r = await api<{ ok: boolean; status?: string; error?: string }>(`/api/pro/jobs/${job!.id}/expenses`, { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) return Alert.alert(t("Not accepted"), r.data.error ?? "");
    Alert.alert(t("Receipt sent"), r.data.status === "pending" ? t("Sent for approval.") : t("Approved — you're reimbursed once the customer pays."));
    setAmount(""); setWhat(""); setReceipt(null);
    load();
  }
  async function sendScope() {
    setBusy(true);
    const r = await api<{ ok: boolean; extra?: number; error?: string }>(`/api/pro/jobs/${job!.id}`, { method: "POST", body: JSON.stringify({ action: "scope_change", answers: scope, note: scopeNote }) });
    setBusy(false);
    if (!r.ok) return Alert.alert(t("Not sent"), r.data.error ?? "");
    setScope(null); setScopeNote("");
    Alert.alert(t("Change order sent"), locale === "es" ? `Se le pide al cliente que apruebe ${money(r.data.extra ?? 0)}. Haga solo el trabajo reservado hasta que la app indique que está pagado.` : `The customer is asked to approve ${money(r.data.extra ?? 0)}. Do only the booked work until the app says it's paid.`);
    load();
  }
  async function reportLockout() {
    if (!lockout || lockout.trim().length < 3) return Alert.alert(t("Can't get in"), t("Say what happened (knocked, called, gate locked…)."));
    setBusy(true);
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/jobs/${job!.id}`, { method: "POST", body: JSON.stringify({ action: "lockout", note: lockout.trim() }) });
    setBusy(false);
    if (!r.ok) return Alert.alert(t("Couldn't send"), r.data.error ?? "");
    setLockout(null);
    Alert.alert(t("We're on it"), t("We're calling the customer now. Please wait 15 minutes on site. A confirmed lockout earns show-up pay."));
  }
  async function post(body: object) {
    setBusy(true);
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/jobs/${job!.id}`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok || !r.data.ok) Alert.alert(t("Couldn't update"), r.data.error ?? "");
    load();
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>{svc.icon} {svcText(svc).name}</Text>
      <Status status={job.status} />
      <Card style={{ marginTop: 12 }}>
        <Text style={s.b}>{job.contact_name} · {job.contact_phone}</Text>
        <Text style={s.p} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${job.address}, ${job.city} ${job.zip}`)}`)}>📍 {job.address}, {job.city} {job.zip}</Text>
        <Text style={[s.b, { marginTop: 8 }]}>{t("Payout")} {money(job.contractor_payout)}</Text>
      </Card>
      <Card>
        {svc.questions.filter((q) => questionVisible(q, job.answers as Record<string, string | number | boolean>, svc.questions)).map((q) => <Text key={q.id} style={s.p}>{t(q.label)}: <Text style={s.b}>{(() => { const v = job.answers[q.id]; if (v === undefined || v === null) return "—"; if (typeof v === "boolean") return t(v ? "Yes" : "No"); const o = q.type === "select" ? q.options.find((x) => x.value === v) : undefined; return o ? t(o.label) : String(v); })()}</Text></Text>)}
        {job.notes ? <Text style={[s.p, { marginTop: 8 }]}>“{job.notes}”</Text> : null}
      </Card>
      {crew?.askedForYou && (
        <Card style={{ borderColor: C.brand, backgroundColor: C.tint }}>
          <Text style={s.b}>★ {t("This customer asked for you.")}</Text>
          {crew.requested ? <Text style={s.p}>{locale === "es" ? `Pidieron a ${crew.requested.name}; usted decide quién va.` : `They asked for ${crew.requested.name}; who goes is your call.`}</Text> : null}
        </Card>
      )}
      {crew && crew.options.length > 0 && ["assigned", "in_progress"].includes(job.status) && (
        <Card>
          {crew.requested && !crew.askedForYou ? <Text style={[s.p, { fontSize: 14 }]}>★ {locale === "es" ? `El cliente pidió a ${crew.requested.name}. Es una solicitud: usted decide quién va.` : `The customer asked for ${crew.requested.name}. It's a request — who goes is your call.`}</Text> : null}
          <Text style={s.b}>{t("Who’s doing this job?")}</Text>
          {crew.ready && <Text style={[s.p, { fontSize: 14, color: "#92400e" }]}>{t("To send your crew:")} {crew.ready.includes("workers") ? t("upload a current workers’ comp policy (the no-employees statement doesn’t cover a crew)") : t(crew.ready)}</Text>}
          <View style={[s.row, { marginTop: 8 }]}>
            <Chip label={t("Me")} on={!crew.current} onPress={() => crew.current && post({ action: "crew", crew_member_id: null })} />
            {crew.options.map((o) => <Chip key={o.id} label={`${crew.requested?.id === o.id ? "★ " : ""}${o.name}${o.why ? " ⛔" : ""}`} on={crew.current === o.id}
              onPress={() => (o.why || crew.ready ? Alert.alert(o.name, o.why ? t(o.why) : t(crew.ready!)) : crew.current !== o.id && post({ action: "crew", crew_member_id: o.id }))} />)}
          </View>
          <Text style={[s.p, { fontSize: 13 }]}>{t("The customer sees the first name of who’s coming.")}</Text>
        </Card>
      )}
      {["assigned", "in_progress", "qa_review", "completed"].includes(job.status) ? <ProChecklist jobId={job.id} es={locale === "es"} /> : null}
      {job.status === "assigned" && job.scheduled_date === localDate() && !job.en_route_at && <Button title={`🚗 ${t("On my way")}`} kind="ghost" onPress={() => { shareLocationOnce().catch(() => {}); post({ action: "on_my_way" }); }} busy={busy} style={{ marginBottom: 8 }} />}
      {job.status === "assigned" && job.en_route_at ? <Text style={[s.p, { marginBottom: 8 }]}>🚗 {t("The customer can see your ETA while the app is open.")}</Text> : null}
      {job.status === "assigned" && <Button title={t("I've arrived — start job")} onPress={() => { shareLocationOnce().catch(() => {}); post({ action: "start" }); }} busy={busy} />}
      {(job.status === "assigned" || job.status === "in_progress") && (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.b}>{t("Finish the job")}</Text>
          <Text style={s.p}>{t("Photograph every area you worked on. AI checks them and approves your payout.")}</Text>
          <Button title={`📷 ${t("Take photos")} (${photos.length})`} kind="ghost" onPress={shoot} busy={busy} style={{ marginTop: 10 }} />
          <TextInput style={[s.input, { marginTop: 10 }]} placeholder={t("Note for the customer (optional)")} value={note} onChangeText={setNote} multiline />
          <Button title={t("Mark complete")} disabled={!photos.length} busy={busy} onPress={() => post({ action: "complete", photos, note: note || null })} style={{ marginTop: 10 }} />
        </Card>
      )}
      {job.status === "qa_review" && <Text style={[s.p, { marginTop: 12 }]}>{t("Submitted — AI quality check in progress.")}</Text>}

      {(job.status === "assigned" || job.status === "in_progress") && !job.remedy && (
        scope === null
          ? <Button title={t("More work than booked?")} kind="ghost" onPress={() => setScope({ ...(job.answers as Record<string, string | number | boolean>) })} style={{ marginTop: 12 }} />
          : (() => {
            const sc = scopeChange(job.service_slug, job.answers as Record<string, string | number | boolean>, scope, job.frequency);
            return (
              <Card style={{ marginTop: 12 }}>
                <Text style={s.b}>{t("Update the scope to what's really here")}</Text>
                <Text style={s.p}>{t("The difference is priced at our standard rates and sent to the customer to approve and pay.")}</Text>
                {svc.questions.filter((q) => questionVisible(q, { ...(job.answers as Record<string, string | number | boolean>), ...scope }, svc.questions)).map((q) => (
                  <View key={q.id} style={{ marginTop: 10 }}>
                    <Text style={s.label}>{t(q.label)}</Text>
                    {q.type === "number" ? <TextInput style={s.input} keyboardType="number-pad" value={String(scope[q.id] ?? q.default)} onChangeText={(v) => setScope({ ...scope, [q.id]: Math.min(q.max, Math.max(q.min, Number(v) || q.min)) })} />
                      : q.type === "select" ? <View style={s.row}>{q.options.map((o) => <Chip key={o.value} label={t(o.label)} on={scope[q.id] === o.value} onPress={() => setScope({ ...scope, [q.id]: o.value })} />)}</View>
                      : <View style={s.row}><Chip label={t(scope[q.id] ? "Yes" : "No")} on={Boolean(scope[q.id])} onPress={() => setScope({ ...scope, [q.id]: !scope[q.id] })} /></View>}
                  </View>
                ))}
                <TextInput style={[s.input, { marginTop: 10 }]} placeholder={t("What you found (the customer sees this)")} value={scopeNote} onChangeText={setScopeNote} multiline />
                <Text style={[s.b, { marginTop: 10 }]}>{sc.extra > 0 ? `${t("Extra for the customer:")} ${money(sc.extra)}` : t("No extra charge for this change")}</Text>
                <Button title={t("Send change order")} disabled={sc.extra <= 0} busy={busy} onPress={sendScope} style={{ marginTop: 8 }} />
                <Button title={t("Never mind")} kind="ghost" onPress={() => setScope(null)} style={{ marginTop: 6 }} />
              </Card>
            );
          })()
      )}

      {(job.status === "assigned" || job.status === "in_progress") && (
        lockout === null
          ? <Button title={t("Can't get in?")} kind="ghost" onPress={() => setLockout("")} style={{ marginTop: 12 }} />
          : (
            <Card style={{ marginTop: 12, borderColor: C.red }}>
              <Text style={s.b}>{t("Can't get access")}</Text>
              <TextInput style={[s.input, { marginTop: 8 }]} placeholder={t("Knocked and called at 9:05, gate locked, no answer…")} value={lockout} onChangeText={setLockout} multiline />
              <Button title={t("Report no access")} busy={busy} onPress={reportLockout} style={{ marginTop: 10 }} />
              <Button title={t("Never mind")} kind="ghost" onPress={() => setLockout(null)} style={{ marginTop: 6 }} />
            </Card>
          )
      )}

      {["assigned", "in_progress", "qa_review", "completed"].includes(job.status) && mat && (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.b}>🧾 {t(mat.shopping ? "Purchases" : "Materials")}</Text>
          {!mat.allowed ? <Text style={s.p}>{t("Reimbursement:")} {mat.reason ? t(mat.reason) : ""}. {t("Materials for this job are included in your payout.")}</Text> : (
            <>
              <Text style={s.p}>{t(mat.shopping ? "Store purchases for the customer" : "Parts not included in the price")}{locale === "es" ? `, al costo con el recibo. Hasta ${money(mat.autoApproveUpTo)} se aprueba automáticamente; llámenos antes de una compra mayor. Se le reembolsa cuando el cliente pague.` : `, at cost with the receipt. Up to ${money(mat.autoApproveUpTo)} is approved automatically — call us before a bigger purchase. You're reimbursed once the customer pays.`}</Text>
              <TextInput style={[s.input, { marginTop: 10 }]} placeholder={t("$ amount")} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
              <TextInput style={[s.input, { marginTop: 8 }]} placeholder={t(mat.shopping ? "What you bought (e.g. supplies at Home Depot)" : "What you bought (e.g. wax ring + supply line)")} value={what} onChangeText={setWhat} />
              <Button title={`📷 ${t(receipt ? "Receipt added ✓ (retake)" : "Photo of receipt")}`} kind="ghost" onPress={snapReceipt} style={{ marginTop: 8 }} />
              <Button title={t("Submit receipt")} busy={busy} onPress={sendReceipt} style={{ marginTop: 8 }} />
            </>
          )}
          {mat.expenses.map((e) => (
            <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, marginTop: 8 }}>
              <Text style={[s.p, { flex: 1 }]}>{e.description}{"\n"}<Text style={{ fontSize: 14 }}>{EXP_STATUS[e.status] ? t(EXP_STATUS[e.status]) : e.status}{e.status === "rejected" && e.notes ? ` — ${e.notes}` : ""}</Text></Text>
              <Text style={s.b}>{money(Number(e.amount))}</Text>
            </View>
          ))}
        </Card>
      )}
      {job.status === "assigned" && (release === null
        ? <Button title={t("Can't make it? Hand this job back")} kind="ghost" onPress={() => setRelease("")} style={{ marginTop: 12 }} />
        : <Card style={{ marginTop: 12 }}>
            <Text style={s.p}>{t("The job goes back out right away. Inside 24 hours of the arrival window it counts as a late cancel.")}</Text>
            <TextInput style={[s.input, { marginTop: 8 }]} placeholder={t("Reason (only we see it)")} value={release} onChangeText={setRelease} />
            <Button title={t("Hand it back")} kind="ghost" disabled={release.trim().length < 3} busy={busy} onPress={() => post({ action: "release", reason: release })} style={{ marginTop: 8 }} />
          </Card>)}
    </ScrollView>
  );
}
