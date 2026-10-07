/*
 * FILE    : apps/mobile/app/snap.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0449 UTC
 * PURPOSE : "Snap & post a job" in the app: take photos with the camera (or pick from the library) and say what you
 *           need → the AI names the service and fills in the job details (/api/snap) → choose when it needs doing →
 *           the booking screen opens with everything filled in (address, exact price, pay) → the paid job goes out to
 *           matching pros to accept. English / Spanish.
 */
import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { SERVICES, URGENCY, getService, type Urgency } from "@handled/core";
import { api } from "../lib/supabase";
import { pickAndUpload, type Shot } from "../lib/photos";
import { Button, C, Card, Chip, s } from "../components/ui";
import { useI18n } from "../lib/i18n";

type Result = { service_slug: string | null; alternatives: string[]; summary: string | null; answers: Record<string, string | number | boolean>; notes: string | null; ai: boolean };

export default function Snap() {
  const { t, locale, svc: svcText } = useI18n();
  const es = locale === "es";
  const [shots, setShots] = useState<Shot[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [slug, setSlug] = useState("");
  const [when, setWhen] = useState<Urgency | null>(null);
  const [picking, setPicking] = useState(false);

  async function add(camera: boolean) {
    setBusy(true);
    const more = await pickAndUpload(camera, 8 - shots.length);
    setBusy(false);
    if (more.length) { setShots([...shots, ...more]); setRes(null); }
  }
  async function identify() {
    setBusy(true);
    const r = await api<Result & { ok: boolean; error?: string }>("/api/snap", { method: "POST", body: JSON.stringify({ photos: shots.map((x) => x.path), note: note || null, locale }) });
    setBusy(false);
    if (!r.ok || !r.data.ok) return Alert.alert(es ? "No se pudo revisar" : "Couldn't check that", r.data.error ?? "");
    setRes(r.data); setSlug(r.data.service_slug ?? "");
  }
  function go() {
    const svc = getService(slug);
    if (!svc) return;
    const notes = [note.trim(), res?.service_slug === slug ? res?.notes ?? "" : ""].filter(Boolean).join("\n");
    router.push({ pathname: "/book/[slug]", params: {
      slug, shots: JSON.stringify(shots), ...(notes ? { notes } : {}), ...(when && !svc.leadDays ? { when } : {}),
      ...(res?.service_slug === slug ? { answers: JSON.stringify(res.answers) } : {}),
    } });
  }
  const label = (sl: string) => { const x = getService(sl); return x ? `${x.icon} ${svcText(x).name}` : sl; };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Text style={s.h1}>📸 {es ? "Tome una foto, publique su trabajo" : "Snap a photo, post a job"}</Text>
      <Text style={s.p}>{es ? "Muéstrenos qué hay que hacer. Le decimos qué servicio es, llenamos los detalles y usted elige cuándo. Ve el precio exacto antes de pagar." : "Show us what needs doing. We'll name the service, fill in the details, and you choose when. You see the exact price before you pay."}</Text>

      <Text style={s.h2}>1. {es ? "Fotos" : "Photos"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {shots.map((x) => (
          <Pressable key={x.path} onLongPress={() => setShots(shots.filter((y) => y.path !== x.path))}>
            <Image source={{ uri: x.uri }} style={{ width: 92, height: 92, borderRadius: 10 }} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Button title={`📷 ${es ? "Tomar foto" : "Take photo"}`} onPress={() => add(true)} busy={busy && !res} style={{ flex: 1 }} />
        <Button title={es ? "De la galería" : "From library"} kind="ghost" onPress={() => add(false)} style={{ flex: 1 }} />
      </View>
      {shots.length ? <Text style={[s.p, { fontSize: 12 }]}>{es ? "Mantenga presionada una foto para quitarla." : "Press and hold a photo to remove it."}</Text> : null}
      <TextInput style={[s.input, { marginTop: 10, minHeight: 70 }]} multiline placeholder={es ? "¿Qué necesita? (opcional)" : "What do you need? (optional)"} value={note} onChangeText={(v) => { setNote(v); setRes(null); }} />
      {!res ? <Button title={busy ? (es ? "Revisando sus fotos…" : "Looking at your photos…") : es ? "Continuar" : "Continue"} busy={busy} disabled={!shots.length && note.trim().length < 3} onPress={identify} style={{ marginTop: 10 }} /> : null}

      {res ? (
        <>
          <Text style={s.h2}>2. {es ? "Su trabajo" : "Your job"}</Text>
          {res.service_slug ? (
            <Card style={{ backgroundColor: C.tint, borderColor: C.brand }}>
              <Text style={s.b}>{es ? "Parece: " : "Looks like: "}{label(res.service_slug)}</Text>
              {res.summary ? <Text style={s.p}>{res.summary}</Text> : null}
            </Card>
          ) : <Text style={s.p}>{es ? "No estamos seguros de qué servicio es. Elíjalo:" : "We're not sure which service this is. Pick one:"}</Text>}
          <View style={s.row}>
            {[...(res.service_slug ? [res.service_slug] : []), ...res.alternatives].map((x) => <Chip key={x} label={label(x)} on={slug === x} onPress={() => setSlug(x)} />)}
            <Chip label={es ? "Otro…" : "Other…"} on={picking} onPress={() => setPicking(!picking)} />
          </View>
          {picking ? <View style={[s.row, { marginTop: 6 }]}>{SERVICES.map((x) => <Chip key={x.slug} label={label(x.slug)} on={slug === x.slug} onPress={() => { setSlug(x.slug); setPicking(false); }} />)}</View> : null}
        </>
      ) : null}

      {slug ? (
        <>
          <Text style={s.h2}>3. {es ? "¿Para cuándo?" : "When does it need to be done?"}</Text>
          {getService(slug)?.leadDays ? <Text style={s.p}>{es ? "Elija la fecha en el siguiente paso." : "You'll pick the date on the next step."}</Text>
            : <View style={s.row}>{URGENCY.map((u) => <Chip key={u.id} label={`${u.id === "asap" ? "⚡ " : ""}${t(u.label)}`} on={when === u.id} onPress={() => setWhen(u.id)} />)}</View>}
          {when ? <Text style={[s.p, { fontSize: 13 }]}>{t(URGENCY.find((u) => u.id === when)?.hint ?? "")}</Text> : null}
          <Button title={es ? "Ver mi precio y reservar →" : "See my price & book →"} disabled={!getService(slug)?.leadDays && !when} onPress={go} style={{ marginTop: 12 }} />
          <Text style={[s.p, { fontSize: 12, marginTop: 6 }]}>{es ? "En cuanto paga, el trabajo se ofrece a profesionales verificados cerca de usted; el primero que acepta lo toma, y le avisamos." : "As soon as you pay, the job is offered to vetted pros near you; the first to accept takes it, and we let you know."}</Text>
        </>
      ) : null}
    </ScrollView>
  );
}
