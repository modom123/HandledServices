/*
 * FILE    : apps/mobile/app/pro/schedule.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0255 UTC
 * UPDATED : 2026-10-02_1405 UTC — English / Spanish.
 * PURPOSE : Pro calendar in the app — the next five weeks: jobs booked, open slots against the
 *           daily limit, and days off (take a day off or reopen it). Usual days and hours are
 *           set in Setup → Work area & hours.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { TIME_WINDOW_LABEL, getService, type CalendarDay } from "@handled/core";
import { API_URL, api } from "../../lib/supabase";
import { Button, C, Card, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";

type Schedule = { onCall: boolean; capacity: number; days: CalendarDay[] };

export default function ProSchedule() {
  const { t, locale, svc } = useI18n();
  const lc = locale === "es" ? "es-US" : "en-US";
  const [data, setData] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const r = await api<Schedule>("/api/pro/schedule?days=35");
    if (r.ok) setData(r.data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(date: string, off: boolean) {
    const r = await api<{ error?: string }>("/api/pro/schedule", { method: "POST", body: JSON.stringify({ date, off }) });
    if (!r.ok) Alert.alert(t("Couldn't update"), r.data.error ?? t("Try again"));
    load();
  }

  const booked = data?.days.reduce((t, d) => t + d.jobs.length, 0) ?? 0;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Text style={s.h2}>{t("My calendar")}</Text>
      <Text style={s.p}>{locale === "es" ? `Próximas 5 semanas · ${booked} ${booked === 1 ? "trabajo reservado" : "trabajos reservados"} · hasta ${data?.capacity ?? "—"} al día` : `Next 5 weeks · ${booked} job${booked === 1 ? "" : "s"} booked · up to ${data?.capacity ?? "—"} a day`}</Text>
      <Button title={t("Change usual days, hours or daily limit")} kind="ghost" onPress={() => Linking.openURL(`${API_URL}/pro/onboarding`)} style={{ marginTop: 10 }} />
      {data?.days.map((d, i) => {
        const dt = new Date(`${d.date}T12:00:00Z`);
        const label = `${i === 0 ? t("Today") : dt.toLocaleDateString(lc, { weekday: "short", timeZone: "UTC" })} · ${dt.toLocaleDateString(lc, { month: "short", day: "numeric", timeZone: "UTC" })}`;
        const canToggle = !d.off || d.off === "Day off";
        return (
          <Card key={d.date} style={{ marginTop: 10, opacity: d.off ? 0.7 : 1, borderColor: d.jobs.length ? C.brand : undefined }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={s.b}>{label}</Text>
              <Text style={s.p}>{d.off ? t(d.off) : `${d.jobs.length}/${d.capacity} ${t("booked")}`}</Text>
            </View>
            {d.jobs.map((j) => (
              <Pressable key={j.id} onPress={() => router.push({ pathname: "/pro/[id]", params: { id: j.id } })}>
                <Text style={[s.p, { marginTop: 4 }]}>{getService(j.service_slug)?.icon} {(() => { const sv = getService(j.service_slug); return sv ? svc(sv).name : ""; })()} · {t(TIME_WINDOW_LABEL[j.time_window])}{j.city ? ` · ${j.city}` : ""} ›</Text>
              </Pressable>
            ))}
            {canToggle && !(d.jobs.length && !d.off) && (
              <Pressable onPress={() => toggle(d.date, !d.off)}><Text style={{ color: C.brand, marginTop: 6, fontWeight: "600" }}>{t(d.off ? "Reopen this day" : "Take this day off")}</Text></Pressable>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}
