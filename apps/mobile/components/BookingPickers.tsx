/*
 * FILE    : apps/mobile/components/BookingPickers.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1405 UTC
 * PURPOSE : Shared pickers for booking and rescheduling: the availability calendar (real open
 *           days and arrival windows for the ZIP) and a typed number box. English / Spanish.
 * UPDATED : 2026-10-02_2255 UTC — no pros in the ZIP yet → waitlist sign-up (we tell them when it opens).
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { RUSH_SURCHARGE, TIME_WINDOW_LABEL, type DaySlots, type TimeWindow } from "@handled/core";
import { api, supabase } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { Button, C, Chip, s } from "./ui";

/** Typed number entry for large ranges (square feet, linear feet): clamps when you finish typing. */
export function NumberBox({ value, min, max, unit, onChange }: { value: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <TextInput style={[s.input, { flex: 1 }]} keyboardType="number-pad" value={text}
        onChangeText={(t) => { const raw = t.replace(/[^0-9]/g, ""); setText(raw); const n = Number(raw); if (raw && n >= min && n <= max) onChange(n); }}
        onEndEditing={() => { const n = Math.min(max, Math.max(min, Number(text) || value)); setText(String(n)); onChange(n); }} />
      {unit ? <Text style={s.p}>{unit}</Text> : null}
    </View>
  );
}

/** Booking calendar: days with real availability for this ZIP, then an arrival window. */
export function Calendar({ service, zip, date, win, onChange, today = false, until, earliest = false }: { service: string; zip: string; date: string; win: TimeWindow; onChange: (d: string, w: TimeWindow) => void; today?: boolean; until?: string; earliest?: boolean }) {
  const { t, locale } = useI18n();
  const dl = locale === "es" ? "es-US" : "en-US";
  const [data, setData] = useState<{ mode: string; days: DaySlots[] } | null>(null);
  useEffect(() => {
    if (!/^\d{5}$/.test(zip)) return setData(null);
    api<{ mode: string; days: DaySlots[] }>(`/api/availability?service=${service}&zip=${zip}${today ? "&today=1" : ""}`).then((r) => {
      if (!r.ok) return;
      const days = until ? r.data.days.filter((d) => d.date <= until) : r.data.days;
      setData({ ...r.data, days });
      const ok = (d?: DaySlots) => d && !d.closed && d.level !== "full";
      if (!ok(days.find((d) => d.date === date)) || earliest) {
        const first = (earliest ? undefined : days.find((d) => ok(d) && !d.rush)) ?? days.find(ok);
        if (first) onChange(first.date, win);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, zip]);
  if (!data) return <Text style={[s.p, { marginBottom: 12 }]}>{t("Enter your ZIP to see open dates.")}</Text>;
  const day = data.days.find((d) => d.date === date);
  return (
    <View style={{ marginBottom: 12 }}>
      {data.mode === "request" && <Text style={[s.p, { marginBottom: 8 }]}>{t("We're adding pros in your area — pick a time and we'll confirm within one business day.")}</Text>}
      {data.mode === "request" && <Waitlist service={service} zip={zip} />}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {data.days.map((d) => {
          const dt = new Date(`${d.date}T12:00:00`);
          const off = d.closed || d.level === "full";
          const sel = d.date === date;
          return (
            <Pressable key={d.date} disabled={off} onPress={() => onChange(d.date, win)}
              style={{ width: 62, marginRight: 6, padding: 8, borderRadius: 12, borderWidth: 1, borderColor: sel ? C.brand : C.line, backgroundColor: sel ? C.brand : off ? C.paper : C.white, opacity: off ? 0.45 : 1 }}>
              <Text style={{ fontSize: 13, color: sel ? C.white : C.soft }}>{dt.toLocaleDateString(dl, { weekday: "short" })}</Text>
              <Text style={{ fontSize: 20, fontWeight: "800", color: sel ? C.white : C.ink }}>{dt.getDate()}</Text>
              <Text style={{ fontSize: 12, color: sel ? C.white : d.level === "limited" ? "#b45309" : C.soft }}>{d.closed ? t("closed") : d.level === "full" ? t("full") : d.rush ? `+${RUSH_SURCHARGE * 100}%` : d.level === "limited" ? t("few left") : dt.toLocaleDateString(dl, { month: "short" })}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {day && !day.closed && (
        <View style={s.row}>
          {(["morning", "midday", "afternoon", "flexible"] as TimeWindow[]).map((w) => {
            const left = w === "flexible" ? 99 : day.windows[w as "morning"];
            const off = data.mode === "live" && left === 0;
            return <Chip key={w} label={`${t(TIME_WINDOW_LABEL[w])}${off ? ` · ${t("full")}` : w !== "flexible" && data.mode === "live" && left <= 2 ? ` · ${left} ${t("left")}` : ""}`} on={win === w} onPress={() => !off && onChange(day.date, w)} />;
          })}
        </View>
      )}
    </View>
  );
}

/** No pro covers this ZIP yet: get told the day one does. */
function Waitlist({ service, zip }: { service: string; zip: string }) {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [msg, setMsg] = useState("");
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session?.user.email) setEmail((e) => e || data.session!.user.email!); }); }, []);
  if (state === "done") return <Text style={[s.p, { marginBottom: 10 }]}>✓ {locale === "es" ? `Listo. Le avisaremos en cuanto tengamos un profesional en ${zip}.` : `You're on the list. We'll tell you the day a pro covers ${zip}.`}</Text>;
  return (
    <View style={{ marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.white }}>
      <Text style={{ fontWeight: "700", marginBottom: 4 }}>{t("Rather wait for a confirmed pro?")}</Text>
      <Text style={[s.p, { marginBottom: 8 }]}>{locale === "es" ? `Únase a la lista de espera y le avisaremos en cuanto un profesional cubra ${zip}.` : `Join the waitlist and we'll tell you the day a pro covers ${zip}.`}</Text>
      <TextInput style={[s.input, { marginBottom: 8 }]} placeholder={t("Email")} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={[s.input, { marginBottom: 8 }]} placeholder={t("Mobile (optional, for a text)")} keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <Button kind="ghost" title={t("Notify me")} busy={state === "busy"} disabled={!email.includes("@")} onPress={async () => {
        setState("busy"); setMsg("");
        const r = await api<{ error?: string }>("/api/waitlist", { method: "POST", body: JSON.stringify({ email, phone: phone || null, zip, service, locale, source: "app" }) });
        if (r.ok) setState("done"); else { setState("idle"); setMsg(t(r.data.error ?? "Try again")); }
      }} />
      {msg ? <Text style={{ color: "#be123c", marginTop: 6 }}>{msg}</Text> : null}
    </View>
  );
}
