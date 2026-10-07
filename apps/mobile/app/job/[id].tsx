/*
 * FILE    : apps/mobile/app/job/[id].tsx
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-01_2047 UTC
 * UPDATED : 2026-10-02_1329 UTC — live pro ETA, tip your pro, reschedule.
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish; reschedule right in the app.
 * UPDATED : 2026-10-02_2256 UTC — after rating, everyone is invited to review us on Google.
 * UPDATED : 2026-10-03_0154 UTC — accept pros' counter offers in the app.
 * UPDATED : 2026-10-03_0152 UTC — market pricing (raise your offer while no pro has taken the job; pros' counters open on the website).
 * PURPOSE : Customer booking screen — "Covered ✓" by which pro, live timeline (realtime),
 *           pay now, invoice & agreement, and rating when done. Opened from notifications.
 * UPDATED : 2026-10-04_2204 UTC — ★ favorite the pro (and the crew member who came) and "Book again with …".
 * UPDATED : 2026-10-05_0221 UTC — the job checklist (what's included / progress) and special requests.
 * UPDATED : 2026-10-06_0645 UTC — a booking that can't load (deleted, or no connection) says so with Try again, instead of
 *           "Loading…" forever.
 * UPDATED : 2026-10-06_0645 UTC — pay, tip and raise-your-offer open Stripe in an in-app sheet and refresh when it closes.
 * UPDATED : 2026-10-06_0708 UTC — Pay now opens Apple Pay / Google Pay / card in the app (Stripe PaymentSheet).
 * UPDATED : 2026-10-06_0708 UTC — live map of the pro on the way (🚗 → 🏠), refreshing every 15 s.
 * UPDATED : 2026-10-06_2120 UTC — "Confirming your backup pro" while a handed-back job is being re-covered.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { BRAND, TIME_WINDOW_LABEL, TIP_PRESETS, getService, money, moneyRange, type Job, type TimeWindow } from "@handled/core";
import { API_URL, NETWORK_ERROR, api, supabase } from "../../lib/supabase";
import { Button, C, Card, ErrorState, Loading, Status, s } from "../../components/ui";
import { PhotoStrip } from "../../components/PhotoStrip";
import type { Shot } from "../../lib/photos";
import { useI18n } from "../../lib/i18n";
import { Calendar } from "../../components/BookingPickers";
import { openInApp } from "../../lib/browser";
import { payForJob } from "../../lib/pay";
import { LiveMap } from "../../components/LiveMap";
import { haptic } from "../../lib/haptics";
import { ChecklistList } from "../../components/Checklist";
import type { ChecklistCheck, ChecklistExtra, JobChecklist } from "@handled/core";

/** What's included (or, once the pro starts, what's done) and the customer's special requests. */
function JobChecklistCard({ jobId, es }: { jobId: string; es: boolean }) {
  const [d, setD] = useState<{ checklist: JobChecklist; checks: ChecklistCheck[] | null; requests: ChecklistExtra[]; canEdit: boolean } | null>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { const r = await api<typeof d>(`/api/account/jobs/${jobId}/requests`); if (r.ok) setD(r.data); }, [jobId]);
  useEffect(() => { load(); }, [load]);
  if (!d) return null;
  return (
    <Card>
      <Pressable onPress={() => setOpen(!open)}><Text style={s.b}>✅ {es ? d.checklist.title_es : d.checklist.title} {open ? "▴" : "▾"}</Text></Pressable>
      <Text style={[s.p, { fontSize: 13 }]}>{es ? "Su profesional marca cada punto al terminarlo, con fotos de antes y después." : "Your pro checks off each item as it's done, with before-and-after photos."}</Text>
      {d.requests.map((x) => <Text key={x.id} style={[s.p, { fontSize: 14 }]}>📝 {x.text}</Text>)}
      {d.canEdit && d.requests.length < 5 ? (
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          <TextInput style={[s.input, { flex: 1, fontSize: 15 }]} placeholder={es ? "Solicitud especial (p. ej. use la puerta lateral)" : "Special request (e.g. use the side door)"} value={text} onChangeText={setText} />
          <Button title={es ? "Agregar" : "Add"} kind="ghost" disabled={text.trim().length < 3} onPress={async () => {
            const r = await api<{ ok: boolean; error?: string }>(`/api/account/jobs/${jobId}/requests`, { method: "POST", body: JSON.stringify({ text }) });
            if (r.ok && r.data.ok) { setText(""); load(); } else Alert.alert(es ? "No se pudo guardar" : "Couldn't save", r.data.error ?? "");
          }} />
        </View>
      ) : null}
      {open || d.checks ? <ChecklistList checklist={d.checklist} checks={d.checks ?? undefined} es={es} /> : null}
    </Card>
  );
}

type Crew = { crew_member_id: string; first_name: string; role: string };
type Pro = { business_name: string; contact_first_name: string; rating: number; jobs_completed: number };
type Ev = { id: number; message: string; message_es?: string | null; created_at: string };

export default function Booking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [pro, setPro] = useState<Pro | null>(null);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [favs, setFavs] = useState<(string | null)[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [rated, setRated] = useState(false);
  const [stars, setStars] = useState(5);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const { t, locale, svc: svcText } = useI18n();
  const es = locale === "es";
  const load = useCallback(async () => {
    const [{ data: j, error: jerr }, { data: p }, { data: ev }, { data: rv }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).single(),
      supabase.rpc("job_pro", { p_job: id }),
      supabase.from("job_events").select("id, message, message_es, created_at").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.from("reviews").select("id").eq("job_id", id).maybeSingle(),
    ]);
    if ((j as Job | null)?.contractor_id) {
      const [{ data: c }, { data: f }] = await Promise.all([
        supabase.rpc("job_crew", { p_job: id }),
        supabase.from("customer_favorites").select("crew_member_id").eq("contractor_id", (j as Job).contractor_id!),
      ]);
      setCrew(((c ?? []) as Crew[])[0] ?? null);
      setFavs(((f ?? []) as { crew_member_id: string | null }[]).map((x) => x.crew_member_id));
    }
    if (!j) { setLoadErr(jerr && !/0 rows|no rows/i.test(jerr.message) ? NETWORK_ERROR : "We couldn't find this booking."); return; }
    setLoadErr(null);
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
  if (!job && loadErr) return <View style={[s.screen, s.pad]}><ErrorState message={loadErr} onRetry={load} /><Button title={t("My bookings")} kind="ghost" onPress={() => router.replace("/jobs")} /></View>;
  if (!job) return <Loading label={t("Loading…")} />;
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
    if (!job) return;
    const r = await payForJob({ jobId: job.id, email: job.contact_email, locale });
    if (r.status === "paid") { haptic("success"); Alert.alert(`${t("Paid")} ✓`, t("Thank you! Your receipt is on its way by email.")); }
    else if (r.status === "error") { haptic("error"); Alert.alert(t("Payment didn't go through"), t(r.message ?? "Couldn't start payment")); }
    load();
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

      {!job.contractor_id && Number((job as Job & { handoffs?: number }).handoffs ?? 0) > 0 && ["dispatched", "scheduled"].includes(job.status) ? (
        <Card style={{ marginTop: 14, borderColor: C.amber, borderWidth: 2 }}>
          <Text style={[s.b, { color: C.amber }]}>🛟 {es ? "Confirmando su profesional de respaldo" : "Confirming your backup pro"}</Text>
          <Text style={s.p}>{es ? "Su profesional tuvo que retirarse. Cada reserva tiene respaldos y estamos confirmando el suyo — misma hora, no tiene que hacer nada. Le avisaremos su nombre." : "Your pro had to step away. Every booking has backups and we're confirming yours — same time, nothing for you to do. We'll tell you their name."}</Text>
        </Card>
      ) : null}

      {pro ? (
        <Card style={{ marginTop: 14, backgroundColor: C.tint, borderColor: C.brand }}>
          <Text style={{ fontWeight: "800", color: C.deep, fontSize: 18 }}>{t("Covered ✓")}</Text>
          <Text style={s.b}>{pro.business_name}{pro.contact_first_name ? ` · ${pro.contact_first_name}` : ""}</Text>
          <Text style={s.p}>{pro.rating}★ · {pro.jobs_completed} {t("jobs completed · vetted & insured")}</Text>
          {crew ? <Text style={s.p}>{es ? `Viene ${crew.first_name}` : `${crew.first_name} is coming`}</Text> : null}
          {(() => {
            const name = pro.contact_first_name || pro.business_name;
            const fav = async (isCrew: boolean) => {
              const r = await api<{ ok: boolean; error?: string }>("/api/account/favorites", { method: "POST", body: JSON.stringify({ job_id: job.id, crew: isCrew }) });
              if (!r.ok || !r.data.ok) Alert.alert(t("Couldn't save"), r.data.error ?? t("Try again")); else load();
            };
            return (
              <View style={{ marginTop: 10, gap: 8 }}>
                {favs.includes(null) ? <Text style={[s.b, { color: C.brand }]}>★ {es ? `${name} es favorito` : `${name} is a favorite`}</Text>
                  : <Button title={`☆ ${es ? `Marcar a ${name} como favorito` : `Favorite ${name}`}`} kind="ghost" onPress={() => fav(false)} />}
                {crew ? (favs.includes(crew.crew_member_id) ? <Text style={[s.b, { color: C.brand }]}>★ {es ? `${crew.first_name} es favorito` : `${crew.first_name} is a favorite`}</Text>
                  : <Button title={`☆ ${es ? `Marcar a ${crew.first_name} como favorito` : `Favorite ${crew.first_name}`}`} kind="ghost" onPress={() => fav(true)} />) : null}
                {job.status === "completed" ? <Button title={es ? `Reservar de nuevo con ${crew ? crew.first_name : name}` : `Book again with ${crew ? crew.first_name : name}`}
                  onPress={() => router.push({ pathname: "/book/[slug]", params: { slug: job.service_slug, pro: job.contractor_id!, ...(crew ? { crew: crew.crew_member_id } : {}) } })} /> : null}
                <Text style={[s.p, { fontSize: 13 }]}>{t("Favorites see your next booking for that kind of work first for a few hours; if they can't, another vetted pro takes it. Not guaranteed.")}</Text>
              </View>
            );
          })()}
        </Card>
      ) : null}
      {job.status !== "cancelled" ? <JobChecklistCard jobId={job.id} es={es} /> : null}
      {pro ? null : job.paid_at || job.deposit_paid_at ? (
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

      {(job.paid_at || job.deposit_paid_at) && !job.contractor_id && !job.remedy && ["dispatched", "scheduled"].includes(job.status) && Number(job.price_final) > 0 ? (
        <RaiseCard job={job} onDone={load} />
      ) : null}
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
              if (r.data.url) { await openInApp(r.data.url); return load(); }
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

type Track = { tracking: boolean; arrived?: boolean; name?: string | null; eta?: number | null; miles?: number; updatedMinAgo?: number; pro?: { lat: number; lng: number }; home?: { lat: number; lng: number } };

/** "Your pro is ~12 min away" with a live map — refreshes every 15 seconds while they're on the way. */
function TrackCard({ jobId }: { jobId: string }) {
  const { t, locale } = useI18n();
  const es = locale === "es";
  const [tr, setT] = useState<Track | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => api<Track>(`/api/account/jobs/${jobId}/track`).then((r) => { if (live && r.ok) setT(r.data); });
    load();
    const id = setInterval(load, 15000);
    return () => { live = false; clearInterval(id); };
  }, [jobId]);
  if (!tr?.tracking) return null;
  const who = tr.name ?? t("Your pro");
  return (
    <Card style={{ marginTop: 14, borderColor: C.brand }}>
      <Text style={{ fontWeight: "800", color: C.deep, fontSize: 18 }}>{tr.arrived ? `✅ ${t("Your pro has arrived")}` : es ? `🚗 ${who} va en camino${tr.eta ? ` — ~${tr.eta} min` : ""}` : `🚗 ${who} is on the way${tr.eta ? ` — ~${tr.eta} min` : ""}`}</Text>
      {!tr.arrived && tr.pro && tr.home ? <LiveMap pro={{ latitude: tr.pro.lat, longitude: tr.pro.lng }} home={{ latitude: tr.home.lat, longitude: tr.home.lng }} proLabel={who} homeLabel={t("Your place")} /> : null}
      {!tr.arrived && tr.miles != null ? <Text style={[s.p, { marginTop: 6 }]}>{es ? `a ${tr.miles} millas · actualizado ${tr.updatedMinAgo ? `hace ${tr.updatedMinAgo} min` : "ahora"}` : `${tr.miles} miles away · updated ${tr.updatedMinAgo ? `${tr.updatedMinAgo} min ago` : "just now"}`}</Text> : null}
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

/**
 * While no pro has taken the job: raise your offer (only the difference is charged — saved card,
 * else a payment link) — or accept a pro's counter offer (from /api/account/jobs/[id]/counters).
 */
function RaiseCard({ job, onDone }: { job: Job; onDone: () => void }) {
  const { t, locale } = useI18n();
  const es = locale === "es";
  const price = Number(job.price_final ?? 0);
  const suggested = job.suggested_price ? Number(job.suggested_price) : null;
  const [raise, setRaise] = useState(String(Math.max(Math.round(price * 1.1), Math.round(suggested ?? 0))));
  const [busy, setBusy] = useState(false);
  const [counters, setCounters] = useState<{ id: string; who: string; rating: number; jobs: number; price: number; note: string | null }[]>([]);
  useEffect(() => { api<{ counters?: typeof counters }>(`/api/account/jobs/${job.id}/counters`).then((r) => setCounters(r.data.counters ?? [])).catch(() => {}); }, [job.id]);
  const want = Math.round(Number(raise) || 0);
  async function go(body: Record<string, unknown> = { price: want }) {
    setBusy(true);
    const r = await api<{ ok?: boolean; url?: string; charged?: number; error?: string }>(`/api/account/jobs/${job.id}/raise`, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (r.data.url) { await openInApp(r.data.url); return onDone(); }
    if (!r.ok || r.data.ok === false) return Alert.alert(t("Couldn't raise your offer"), t(r.data.error ?? "Try again"));
    Alert.alert(t("Offer raised ✓"), es ? `Su oferta ahora es ${money(want)}. La enviamos de nuevo a los profesionales.` : `Your offer is now ${money(want)}. We've sent it back out to pros.`);
    onDone();
  }
  return (
    <Card style={{ marginTop: 12 }}>
      <Text style={s.b}>{es ? `Buscando un profesional a su precio · ${money(price)}` : `Finding a pro at your price · ${money(price)}`}</Text>
      <Text style={[s.p, { marginTop: 8, fontWeight: "700", color: C.ink }]}>{t("Raise your offer")}</Text>
      <Text style={s.p}>{es ? "Una oferta más alta se envía de nuevo a los profesionales con mejor pago. Solo paga la diferencia." : "A higher offer goes back out to pros at the higher pay. You only pay the difference."}{suggested && price < suggested ? (es ? ` Sugerido: ${money(suggested)}.` : ` Suggested: ${money(suggested)}.`) : ""}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
        <Text style={s.p}>$</Text>
        <TextInput value={raise} onChangeText={(v) => setRaise(v.replace(/[^\d]/g, ""))} keyboardType="number-pad" accessibilityLabel={t("Raise your offer")} style={[s.input, { flex: 1, paddingVertical: 8 }]} />
        <Button title={es ? `Subir a ${money(want)}` : `Raise to ${money(want)}`} kind="ghost" busy={busy} disabled={!(want > price)} onPress={() => go()} style={{ paddingVertical: 10 }} />
      </View>
      {counters.length > 0 && <Text style={[s.p, { marginTop: 10 }]}>{es ? "Estos profesionales ofrecieron hacerlo por un poco más. Acepte uno y el trabajo es suyo — solo cobramos la diferencia." : "These pros offered to do it for a bit more. Accept one and the job is theirs — we only charge the difference."}</Text>}
      {counters.map((c) => (
        <View key={c.id} style={{ marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: C.paper }}>
          <Text style={s.b}>{c.who} · {c.rating.toFixed(1)}★ · {c.jobs} {es ? "trabajos" : "jobs"}</Text>
          {c.note ? <Text style={s.p}>“{c.note}”</Text> : null}
          <Button title={es ? `Aceptar ${money(c.price)} (+${money(c.price - price)})` : `Accept ${money(c.price)} (+${money(c.price - price)})`} busy={busy} onPress={() => go({ counter_offer_id: c.id })} style={{ marginTop: 6 }} />
        </View>
      ))}
    </Card>
  );
}
