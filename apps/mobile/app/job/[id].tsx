/*
 * FILE    : apps/mobile/app/job/[id].tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_2047 UTC
 * UPDATED : 2026-10-02_1329 UTC — live pro ETA, tip your pro, reschedule.
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish; reschedule right in the app.
 * UPDATED : 2026-10-02_2256 UTC — after rating, everyone is invited to review us on Google.
 * PURPOSE : Customer booking screen — "Covered ✓" by which pro, live timeline (realtime),
 *           pay now, invoice & agreement, and rating when done. Opened from notifications.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { BRAND, TIME_WINDOW_LABEL, TIP_PRESETS, getService, money, moneyRange, type Job, type TimeWindow } from "@handled/core";
import { API_URL, api, supabase } from "../../lib/supabase";
import { Button, C, Card, Status, s } from "../../components/ui";
import { PhotoStrip } from "../../components/PhotoStrip";
import type { Shot } from "../../lib/photos";
import { useI18n } from "../../lib/i18n";
import { Calendar } from "../../components/BookingPickers";

type Pro = { business_name: string; contact_first_name: string; rating: number; jobs_completed: number };
type Ev = { id: number; message: string; message_es?: string | null; created_at: string };

export default function Booking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [pro, setPro] = useState<Pro | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [rated, setRated] = useState(false);
  const [stars, setStars] = useState(5);
  const { t, locale, svc: svcText } = useI18n();
  const es = locale === "es";
  const load = useCallback(async () => {
    const [{ data: j }, { data: p }, { data: ev }, { data: rv }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).single(),
      supabase.rpc("job_pro", { p_job: id }),
      supabase.from("job_events").select("id, message, message_es, created_at").eq("job_id", id).order("created_at", { ascending: false }),
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
  if (!job) return <View style={[s.screen, s.pad]}><Text style={s.p}>{t("Loading…")}</Text></View>;
  const svc = getService(job.service_slug);
  const unpaid = !job.paid_at && !job.remedy && job.price_final && job.status !== "cancelled";
  const depositDue = job.payment_plan === "deposit" && !job.deposit_paid_at && Number(job.amount_paid ?? 0) === 0 && job.deposit_amount;
  const due = depositDue ? Number(job.deposit_amount) : Math.max(0, Number(job.price_final ?? 0) - Number(job.amount_paid ?? 0));

  async function savePhotos() {
    const r = await api<{ ok?: boolean; error?: string }>(`/api/account/jobs/${id}/photos`, { method: "POST", body: JSON.stringify({ paths: shots.map((x) => x.path) }) });
    if (!r.ok) return Alert.alert(t("Couldn't add photos"), r.data.error ?? "");
    setShots([]);
    Alert.alert(t("Photos added"), t("Your pro can see them now."));
    load();
  }
  async function pay() {
    const r = await api<{ url?: string; error?: string }>(`/api/account/jobs/${id}/pay`, { method: "POST" });
    if (r.data.url) Linking.openURL(r.data.url); else Alert.alert(t("Payment"), r.data.error ?? t("Couldn't start payment"));
  }
  async function rate() {
    const { error } = await supabase.from("reviews").insert({ job_id: id, rating: stars });
    if (error) return Alert.alert(t("Couldn't save"), error.message);
    setRated(true);
    // Asked of everyone, whatever the stars — Google forbids asking only happy customers.
    const google = BRAND.googleReviewUrl;
    Alert.alert(t("Thank you!"), google ? t("Would you share your experience on Google too? It’s how neighbors find good pros.") : t("Your rating helps us send the best pros."),
      google ? [{ text: t("Not now"), style: "cancel" }, { text: t("Review us on Google"), onPress: () => { api(`/api/account/jobs/${id}/google-review`, { method: "POST" }).catch(() => {}); Linking.openURL(google); } }] : undefined);
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={{ fontSize: 36 }}>{svc?.icon}</Text>
      <Text style={s.h1}>{svc ? svcText(svc).name : job.service_slug}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}><Status status={job.status} /><Text style={s.p}>{job.ref}</Text></View>
      <Text style={[s.p, { marginTop: 6 }]}>{job.scheduled_date ?? t("Date TBD")} · {t(TIME_WINDOW_LABEL[job.time_window])}</Text>
      <Text style={s.p}>{job.address}, {job.city}</Text>

      {pro ? (
        <Card style={{ marginTop: 14, backgroundColor: C.tint, borderColor: C.brand }}>
          <Text style={{ fontWeight: "800", color: C.deep, fontSize: 18 }}>{t("Covered ✓")}</Text>
          <Text style={s.b}>{pro.business_name}{pro.contact_first_name ? ` · ${pro.contact_first_name}` : ""}</Text>
          <Text style={s.p}>{pro.rating}★ · {pro.jobs_completed} {t("jobs completed · vetted & insured")}</Text>
        </Card>
      ) : job.paid_at || job.deposit_paid_at ? (
        <Card style={{ marginTop: 14 }}><Text style={s.b}>{t("Finding your pro…")}</Text><Text style={s.p}>{t("You'll get a notification the moment your job is covered.")}</Text></Card>
      ) : null}

      <Card style={{ marginTop: 6 }}>
        <Text style={s.label}>{t("Price")}</Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: C.ink }}>{job.price_final ? money(job.price_final) : moneyRange(job.estimate_low, job.estimate_high)}</Text>
        <Text style={s.p}>{job.remedy ? t("No charge") : job.paid_at ? `${t("Paid")} ${money(job.amount_paid)}` : job.deposit_paid_at ? (es ? `Depósito pagado ${money(job.amount_paid)} · saldo ${money(due)} pendiente${job.balance_due_date ? ` ${job.balance_due_date}` : ""}` : `Deposit paid ${money(job.amount_paid)} · balance ${money(due)} due${job.balance_due_date ? ` ${job.balance_due_date}` : ""}`) : job.price_final ? t("Payment due — your pro is dispatched once paid") : t("Firm price after the free site visit")}</Text>
        {unpaid ? <Button title={depositDue ? (es ? `Pagar depósito de ${money(due)}` : `Pay ${money(due)} deposit`) : job.deposit_paid_at ? (es ? `Pagar saldo ${money(due)}` : `Pay balance ${money(due)}`) : `${t("Pay")} ${money(due)}`} onPress={pay} style={{ marginTop: 10 }} /> : null}
        <Pressable onPress={() => Linking.openURL(`${API_URL}/invoice/${id}`)}><Text style={[s.p, { color: C.brand, fontWeight: "700", marginTop: 10 }]}>{t("Invoice & service agreement")} →</Text></Pressable>
      </Card>

      {!["completed", "cancelled"].includes(job.status) && (
        <Card>
          <Text style={s.b}>{t("Add photos for your pro")}</Text>
          <Text style={s.p}>{t("More angles, a close-up, the spot you're worried about.")}{job.photos?.length ? ` ${job.photos.length} ${t("on file.")}` : ""}</Text>
          <PhotoStrip shots={shots} onChange={setShots} max={Math.max(0, 12 - (job.photos?.length ?? 0))} />
          {shots.length > 0 && <Button title={es ? `Agregar ${shots.length} foto${shots.length > 1 ? "s" : ""} a mi reserva` : `Add ${shots.length} photo${shots.length > 1 ? "s" : ""} to my booking`} onPress={savePhotos} style={{ marginTop: 8 }} />}
        </Card>
      )}

      <TrackCard jobId={job.id} />
      {["requested", "quoted", "scheduled", "dispatched", "assigned"].includes(job.status) && !job.remedy && job.scheduled_date ? (
        <RescheduleCard job={job} onDone={load} />
      ) : null}
      {job.status === "completed" && job.contractor_id && !job.remedy ? (
        <Card style={{ marginTop: 12 }}>
          <Text style={s.b}>💚 {t("Tip your pro")}</Text>
          <Text style={s.p}>{t("100% goes to your pro.")}{Number(job.tip_total) ? (es ? ` Ha dado ${money(Number(job.tip_total))} de propina.` : ` You've tipped ${money(Number(job.tip_total))}.`) : ""}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
            {TIP_PRESETS.map((amt) => <Button key={amt} title={money(amt)} kind="ghost" style={{ flex: 1 }} onPress={async () => {
              const r = await api<{ url?: string; error?: string }>(`/api/account/jobs/${job.id}/tip`, { method: "POST", body: JSON.stringify({ amount: amt }) });
              if (r.data.url) return Linking.openURL(r.data.url);
              if (!r.ok) return Alert.alert(t("Couldn't tip"), r.data.error ?? t("Try again"));
              Alert.alert(t("Thank you!"), es ? `${money(amt)} va en camino a su profesional.` : `${money(amt)} is on its way to your pro.`); load();
            }} />)}
          </View>
        </Card>
      ) : null}
      {job.status === "completed" && !rated && (
        <Card>
          <Text style={s.b}>{es ? `¿Qué tal lo hizo ${pro?.business_name ?? "nuestro equipo"}?` : `How did ${pro?.business_name ?? "we"} do?`}</Text>
          <View style={{ flexDirection: "row", gap: 6, marginVertical: 10 }}>{[1, 2, 3, 4, 5].map((n) => <Pressable key={n} onPress={() => setStars(n)}><Text style={{ fontSize: 34, opacity: n <= stars ? 1 : 0.25 }}>★</Text></Pressable>)}</View>
          <Button title={t("Submit rating")} onPress={rate} />
        </Card>
      )}

      <Text style={s.h2}>{t("Timeline")}</Text>
      {events.map((e) => (
        <View key={e.id} style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.brand, marginTop: 6 }} />
          <View style={{ flex: 1 }}><Text style={{ color: C.ink }}>{es ? e.message_es ?? e.message : e.message}</Text><Text style={[s.p, { fontSize: 14 }]}>{new Date(e.created_at).toLocaleString(es ? "es-US" : "en-US")}</Text></View>
        </View>
      ))}
    </ScrollView>
  );
}

type Track = { tracking: boolean; arrived?: boolean; name?: string | null; eta?: number | null; miles?: number; updatedMinAgo?: number };

/** "Your pro is ~12 min away" — refreshes every 30 seconds while they're on the way. */
function TrackCard({ jobId }: { jobId: string }) {
  const { t, locale } = useI18n();
  const es = locale === "es";
  const [tr, setT] = useState<Track | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api<Track>(`/api/account/jobs/${jobId}/track`).then((r) => { if (live && r.ok) setT(r.data); });
    load();
    const id = setInterval(load, 30000);
    return () => { live = false; clearInterval(id); };
  }, [jobId]);
  if (!tr?.tracking) return null;
  const who = tr.name ?? t("Your pro");
  return (
    <Card style={{ marginTop: 14, borderColor: C.brand }}>
      <Text style={{ fontWeight: "800", color: C.deep, fontSize: 18 }}>{tr.arrived ? `✅ ${t("Your pro has arrived")}` : es ? `🚗 ${who} va en camino${tr.eta ? ` — ~${tr.eta} min` : ""}` : `🚗 ${who} is on the way${tr.eta ? ` — ~${tr.eta} min` : ""}`}</Text>
      {!tr.arrived && tr.miles != null ? <Text style={s.p}>{es ? `a ${tr.miles} millas · actualizado ${tr.updatedMinAgo ? `hace ${tr.updatedMinAgo} min` : "ahora"}` : `${tr.miles} miles away · updated ${tr.updatedMinAgo ? `${tr.updatedMinAgo} min ago` : "just now"}`}</Text> : null}
    </Card>
  );
}

/** Move the booking to another open day and time (free until 24 hours before). */
function RescheduleCard({ job, onDone }: { job: Job; onDone: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(job.scheduled_date ?? "");
  const [win, setWin] = useState<TimeWindow>(job.time_window);
  const [busy, setBusy] = useState(false);
  if (!open) return <Button title={`📅 ${t("Reschedule")}`} kind="ghost" onPress={() => setOpen(true)} style={{ marginTop: 12 }} />;
  const changed = date !== job.scheduled_date || win !== job.time_window;
  return (
    <Card style={{ marginTop: 12 }}>
      <Text style={s.b}>{t("Pick a new day and time")}</Text>
      <Text style={[s.p, { marginBottom: 8 }]}>{t("Free until 24 hours before. If your pro isn't free at the new time, we'll match another vetted pro.")}</Text>
      <Calendar service={job.service_slug} zip={job.zip} date={date} win={win} onChange={(d, w) => { setDate(d); setWin(w); }} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title={busy ? t("Moving…") : t("Move my booking")} disabled={!changed || busy} style={{ flex: 1 }} onPress={async () => {
          setBusy(true);
          const r = await api<{ ok?: boolean; keptPro?: boolean; error?: string }>(`/api/account/jobs/${job.id}/reschedule`, { method: "POST", body: JSON.stringify({ date, window: win }) });
          setBusy(false);
          if (!r.ok) return Alert.alert(t("Couldn't move it"), r.data.error ?? t("Try again"));
          Alert.alert(t("Moved ✓"), r.data.keptPro ? t("Same pro, new time.") : t("We're matching a pro for the new time."));
          setOpen(false); onDone();
        }} />
        <Button title={t("Keep current time")} kind="ghost" style={{ flex: 1 }} onPress={() => setOpen(false)} />
      </View>
    </Card>
  );
}
