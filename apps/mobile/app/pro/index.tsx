/*
 * FILE    : apps/mobile/app/pro/index.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_1800 UTC
 * UPDATED : 2026-10-01_2140 UTC — Earnings opens the in-app earnings screen (instant pay).
 * UPDATED : 2026-10-02_0255 UTC — On call switch (location shared while on call / on a job today) and My calendar.
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * UPDATED : 2026-10-03_0042 UTC — My contracts (opens the signed copies in the pro portal).
 * UPDATED : 2026-10-03_1337 UTC — My crew, and the fast track to Pro+ for pros still at the Pro tier.
 * UPDATED : 2026-10-04_2204 UTC — Jobs near you (open job board): take a job nobody took yet → the usual offer screen.
 * UPDATED : 2026-10-05_0418 UTC — Rewards button (Handled Pro Rewards).
 * PURPOSE : Pro mode — live job offers (accept/pass) and today's schedule.
 * UPDATED : 2026-10-06_0645 UTC — laid out like a driver app: the on-call switch first, then new offers with the payout
 *           large and a live countdown, jobs near you, today's schedule; tools (earnings, calendar, crew, rewards,
 *           setup, contracts) move to a grid at the bottom. A dropped connection shows Try again instead of
 *           an empty screen. Also shown as the Pro tab.
 * UPDATED : 2026-10-06_0708 UTC — haptics when going on / off call.
 * UPDATED : 2026-10-06_2120 UTC — Your cancellations card (last 90 days: late, no-shows, short notice, free, excused).
 * UPDATED : 2026-10-06_1950 UTC — Standby requests: confirm you can cover as backup #1–#3, or pass (free).
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { TIME_WINDOW_LABEL, getService, localDate, money, type Job } from "@handled/core";
import { API_URL, api, supabase } from "../../lib/supabase";
import { useLocationSharing } from "../../lib/location";
import { useI18n } from "../../lib/i18n";
import { Button, C, Card, ErrorState, Status, s } from "../../components/ui";
import { haptic } from "../../lib/haptics";

type BoardCard = { job_id: string; service: string; icon: string; city: string; zip: string; when: string; payLabel: string; miles: number | null; scope: string[]; priority: boolean; offerId: string | null };
type Standby = { id: string; rank: number; status: "asked" | "standby"; service_slug: string; city: string; zip: string; scheduled_date: string; time_window: Job["time_window"]; pay: number };
type Offer = { id: string; payout: number; expires_at: string; jobs: Pick<Job, "ref" | "service_slug" | "city" | "zip" | "scheduled_date" | "time_window" | "notes"> | null };

export default function ProHome() {
  const { t, locale, svc } = useI18n();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [board, setBoard] = useState<BoardCard[]>([]);
  const [standby, setStandby] = useState<Standby[]>([]);
  const [record, setRecord] = useState<{ days: number; free: number; shortNotice: number; late: number; excused: number; noShows: number } | null>(null);
  async function answer(b: Standby, yes: boolean) {
    haptic(yes ? "success" : "tap");
    const r = await api<{ ok: boolean; error?: string }>("/api/pro/backups", { method: "POST", body: JSON.stringify({ id: b.id, answer: yes ? "yes" : "no" }) });
    if (!r.ok) Alert.alert(t("Couldn't update"), r.data.error ?? t("Try again"));
    load();
  }
  const [claiming, setClaiming] = useState<string | null>(null);
  async function claim(b: BoardCard) {
    if (b.offerId) return router.push({ pathname: "/pro/offer/[id]", params: { id: b.offerId } });
    setClaiming(b.job_id);
    const r = await api<{ ok: boolean; offerId?: string; error?: string }>("/api/pro/board", { method: "POST", body: JSON.stringify({ job_id: b.job_id }) });
    setClaiming(null);
    if (r.ok && r.data.offerId) router.push({ pathname: "/pro/offer/[id]", params: { id: r.data.offerId } });
    else { Alert.alert(t("Couldn't take it"), r.data.error ?? t("Try again")); load(); }
  }
  const [fast, setFast] = useState<{ status: string; tier: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  const [onCall, setOnCall] = useState<{ on: boolean; until: string | null }>({ on: false, until: null });
  const activeToday = jobs.some((j) => j.scheduled_date === localDate() && ["assigned", "in_progress"].includes(j.status));
  useLocationSharing(onCall.on || activeToday);
  async function toggleOnCall(hours = 4) {
    const r = await api<{ onCall: boolean; until: string | null; error?: string }>("/api/pro/status", { method: "POST", body: JSON.stringify({ on_call: !onCall.on, hours }) });
    if (!r.ok) { haptic("error"); return Alert.alert(t("Couldn't update"), r.data.error ?? t("Try again")); }
    haptic(r.data.onCall ? "success" : "tap");
    setOnCall({ on: r.data.onCall, until: r.data.until });
  }
  const load = useCallback(async () => {
    setLoading(true);
    api<{ status: string; tier: string }>("/api/pro/fast-track").then((r) => { if (r.ok) setFast(r.data); });
    api<{ jobs: BoardCard[] }>(`/api/pro/board?locale=${locale}`).then((r) => setBoard(r.ok ? r.data.jobs ?? [] : []));
    api<{ standby: Standby[] }>("/api/pro/backups").then((r) => setStandby(r.ok ? r.data.standby ?? [] : []));
    api<{ record: NonNullable<typeof record> }>("/api/pro/standing").then((r) => { if (r.ok) setRecord(r.data.record); });
    api<{ onCall: boolean; onCallUntil: string | null }>("/api/pro/schedule?days=7").then((r) => { if (r.ok) setOnCall({ on: r.data.onCall, until: r.data.onCallUntil }); });
    const [o, j] = await Promise.all([
      supabase.from("job_offers").select("id, payout, expires_at, jobs(ref, service_slug, city, zip, scheduled_date, time_window, notes)").eq("status", "offered"),
      supabase.from("jobs").select("*").in("status", ["assigned", "in_progress", "qa_review", "site_visit"]).not("contractor_id", "is", null).order("scheduled_date"),
    ]);
    setErr(o.error || j.error ? "No connection. Check your signal or Wi-Fi and try again." : null);
    if (!o.error) setOffers((o.data ?? []) as unknown as Offer[]);
    if (!j.error) setJobs((j.data ?? []) as Job[]);
    setLoading(false);
  }, [locale]);
  useEffect(() => {
    load();
    const ch = supabase.channel("pro-offers").on("postgres_changes", { event: "*", schema: "public", table: "job_offers" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const today = localDate();
  const left = (iso: string) => { const sec = Math.max(0, Math.floor((new Date(iso).getTime() - now) / 1000)); return { sec, label: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` }; };
  const tools: { icon: string; label: string; go: () => void }[] = [
    { icon: "⚡", label: t("Earnings"), go: () => router.push("/pro/earnings") },
    { icon: "📅", label: t("My calendar & days off"), go: () => router.push("/pro/schedule") },
    { icon: "👷", label: t("My crew"), go: () => router.push("/pro/crew") },
    { icon: "🎁", label: t("Rewards"), go: () => router.push("/pro/rewards") },
    { icon: "📄", label: t("Setup & documents"), go: () => Linking.openURL(`${API_URL}/pro/onboarding`) },
    { icon: "✍️", label: t("My contracts"), go: () => Linking.openURL(`${API_URL}/pro/contracts`) },
  ];
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.brand} />}>
      {err ? <ErrorState message={err} onRetry={load} /> : null}
      <Card style={{ borderColor: onCall.on ? C.brand : C.line, backgroundColor: onCall.on ? C.tint : C.white, borderWidth: onCall.on ? 2 : 1 }}>
        <Text style={[s.b, { fontSize: 20 }]}>{onCall.on ? `🟢 ${t("You're on call")}` : `⚪ ${t("Off call")}`}</Text>
        <Text style={s.p}>{onCall.on ? `${t("Same-day jobs near you come to you first")}${onCall.until ? ` ${t("until")} ${new Date(onCall.until).toLocaleTimeString(locale === "es" ? "es-US" : "en-US", { hour: "numeric", minute: "2-digit" })}` : ""}.` : t("Go on call to get same-day jobs, even on a day you don't usually work.")}</Text>
        {onCall.on
          ? <Button title={t("Go off call")} kind="ghost" onPress={() => toggleOnCall()} style={{ marginTop: 10 }} />
          : <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>{[2, 4, 8].map((h) => <Button key={h} title={`${t("On call")} ${h}h`} onPress={() => toggleOnCall(h)} style={{ flex: 1, paddingHorizontal: 8 }} />)}</View>}
        <Text style={[s.p, { fontSize: 14, marginTop: 6 }]}>{onCall.on || activeToday ? `📍 ${t("Sharing your location while on call or on a job today (app open only).")}` : t("Your location isn't shared when you're off call and not on a job.")}</Text>
      </Card>

      <Text style={s.h2}>{t("New offers")}{offers.length ? ` (${offers.length})` : ""}</Text>
      {!offers.length && <Card><Text style={s.p}>🔔 {t("No open offers. We'll notify you when one comes in.")}</Text></Card>}
      {offers.map((o) => {
        const sv = getService(o.jobs?.service_slug ?? "");
        const exp = left(o.expires_at);
        return (
          <Pressable key={o.id} onPress={() => router.push({ pathname: "/pro/offer/[id]", params: { id: o.id } })} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
            <Card style={{ borderColor: C.brand, borderWidth: 2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.b}>{sv?.icon} {sv ? svc(sv).name : ""}</Text>
                  <Text style={s.p}>{o.jobs?.city} {o.jobs?.zip} · {o.jobs?.scheduled_date} · {o.jobs ? t(TIME_WINDOW_LABEL[o.jobs.time_window]) : ""}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: C.deep }}>{o.payout ? money(o.payout) : t("Site visit")}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: exp.sec < 300 ? C.red : C.soft }}>⏱ {exp.sec ? exp.label : t("Expired")}</Text>
                </View>
              </View>
              {o.jobs?.notes ? <Text style={[s.p, { marginTop: 6 }]} numberOfLines={2}>“{o.jobs.notes}”</Text> : null}
              <Button title={`${t("View & accept")} →`} onPress={() => router.push({ pathname: "/pro/offer/[id]", params: { id: o.id } })} style={{ marginTop: 10 }} />
            </Card>
          </Pressable>
        );
      })}

      {standby.length > 0 && <Text style={s.h2}>{t("Standby requests")}</Text>}
      {standby.length > 0 && <Text style={[s.p, { fontSize: 14, marginBottom: 8 }]}>{t("Another pro has these jobs. If they can't make it, you get the first call. Passing is free; you're paid only if you're called and do the job.")}</Text>}
      {standby.map((b) => {
        const sv = getService(b.service_slug);
        return (
          <Card key={b.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={[s.b, { flex: 1 }]}>{t("Backup")} #{b.rank} · {sv?.icon} {sv ? svc(sv).name : ""}</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: C.deep }}>{money(b.pay)}</Text>
            </View>
            <Text style={s.p}>{b.city} {b.zip} · {b.scheduled_date} · {t(TIME_WINDOW_LABEL[b.time_window])}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              {b.status === "asked"
                ? <Button title={t("Yes, I can cover")} onPress={() => answer(b, true)} style={{ flex: 1 }} />
                : <Text style={[s.status, { alignSelf: "center" }]}>✓ {t("You're on standby")}</Text>}
              <Button title={b.status === "asked" ? t("Pass") : t("Can't anymore")} kind="ghost" onPress={() => answer(b, false)} style={{ flex: 1 }} />
            </View>
          </Card>
        );
      })}

      {record && (record.late + record.noShows + record.shortNotice + record.free + record.excused) > 0 ? (
        <Card style={{ marginTop: 16, borderColor: record.late >= 2 || record.noShows >= 1 ? C.amber : C.line }}>
          <Text style={s.b}>🛟 {t("Your cancellations")} ({record.days} {t("days")})</Text>
          <Text style={s.p}>{record.late} {t("late")} · {record.noShows} {t("no-shows")} · {record.shortNotice} {t("short notice")} · {record.free} {t("free")}{record.excused ? ` · ${record.excused} ${t("excused")}` : ""}</Text>
          <Text style={[s.p, { fontSize: 14 }]}>{t("Only late cancels (3) and no-shows (2) in 90 days lead to a written warning. Hand jobs back early so your backup can take them.")}</Text>
        </Card>
      ) : null}

      <Text style={s.h2}>{t("Jobs near you")}</Text>
      <Text style={[s.p, { fontSize: 14, marginBottom: 8 }]}>{t("Paid jobs nobody has taken yet that fit your trades, area and schedule. First to take it gets it. Taking them is always up to you.")}</Text>
      {!board.length && <Text style={s.p}>{t("No open jobs near you right now.")}</Text>}
      {board.map((b) => (
        <Card key={b.job_id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={[s.b, { flex: 1 }]}>{b.icon} {b.service}{b.priority ? `  · ${t("Priority")}` : ""}</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: C.deep }}>{b.payLabel}</Text>
          </View>
          <Text style={s.p}>{b.city} {b.zip}{b.miles != null ? ` · ${b.miles} mi` : ""} · {b.when}</Text>
          {b.scope.length ? <Text style={[s.p, { fontSize: 14 }]}>{b.scope.join(" · ")}</Text> : null}
          <Button title={b.offerId ? `${t("View & accept")} →` : `${t("Take it")} →`} busy={claiming === b.job_id} onPress={() => claim(b)} style={{ marginTop: 10 }} />
        </Card>
      ))}

      <Text style={s.h2}>{t("My schedule")}</Text>
      {!jobs.length && <Text style={s.p}>{t("Nothing scheduled.")}</Text>}
      {jobs.map((j) => (
        <Pressable key={j.id} onPress={() => router.push({ pathname: "/pro/[id]", params: { id: j.id } })} accessibilityRole="button" style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}>
          <Card style={j.scheduled_date === today ? { borderColor: C.brand, borderWidth: 2 } : undefined}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}><Text style={[s.b, { flex: 1 }]}>{j.scheduled_date === today ? `${t("Today")} · ` : ""}{(() => { const sv = getService(j.service_slug); return sv ? svc(sv).name : ""; })()}</Text><Status status={j.status} /></View>
            <Text style={s.p}>{j.ref} · {j.scheduled_date} · {j.address}, {j.city}</Text>
            <Text style={[s.b, { marginTop: 4 }]}>{money(j.contractor_payout)}</Text>
          </Card>
        </Pressable>
      ))}

      {fast && fast.tier === "pro" && fast.status !== "approved" && (
        <Pressable onPress={() => router.push("/pro/fast-track")} accessibilityRole="button">
          <Card style={{ marginTop: 10, borderColor: C.brand, backgroundColor: C.tint }}>
            <Text style={[s.b, { color: C.deep }]}>{fast.status === "applied" ? t("Fast track: we’re reviewing your portfolio") : fast.status === "trial" ? t("Fast track: your next finished job is your trial") : fast.status === "declined" ? t("Fast track: see our answer") : `★ ${t("Already a master at your trade? Start at Pro+ with the fast track →")}`}</Text>
          </Card>
        </Pressable>
      )}

      <Text style={s.h2}>{t("Tools")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {tools.map((x) => (
          <Pressable key={x.label} onPress={x.go} accessibilityRole="button" style={({ pressed }) => [{ width: "48%", opacity: pressed ? 0.85 : 1 }]}>
            <Card style={{ marginBottom: 0, minHeight: 84 }}>
              <Text style={{ fontSize: 24 }}>{x.icon}</Text>
              <Text style={[s.b, { fontSize: 15, marginTop: 4 }]}>{x.label}</Text>
            </Card>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
