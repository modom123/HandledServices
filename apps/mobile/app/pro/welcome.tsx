/*
 * FILE    : apps/mobile/app/pro/welcome.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-29_0715 UTC
 * PURPOSE : Pro mode → Welcome to Handled: the six required orientation lessons (core orientation.ts), each with its
 *           question. A right answer is saved (/api/pro/orientation) and moves to the next lesson. EN / ES.
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ORIENTATION, ORIENTATION_MINUTES } from "@handled/core";
import { api } from "../../lib/supabase";
import { Button, C, Card, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { haptic } from "../../lib/haptics";

type Progress = { lessons: Record<string, string>; done: number; total: number; complete: boolean; next: string | null };

export default function Welcome() {
  const { locale } = useI18n();
  const es = locale === "es";
  const [p, setP] = useState<Progress | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await api<Progress>("/api/pro/orientation"); if (r.ok) setP(r.data); else setErr(r.data.error ?? null); }, []);
  useEffect(() => { load(); }, [load]);
  const show = (id: string | null) => { setOpen(id); setPick(null); setWrong(false); setErr(null); };

  const lesson = ORIENTATION.find((l) => l.id === open);
  if (lesson) {
    const x = es ? lesson.es : lesson.en;
    const i = ORIENTATION.indexOf(lesson);
    const done = Boolean(p?.lessons[lesson.id]);
    const next = ORIENTATION[i + 1];
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.pad}>
        <Pressable onPress={() => show(null)}><Text style={{ color: C.brand, marginBottom: 8 }}>← {es ? "Todas las lecciones" : "All lessons"}</Text></Pressable>
        <Text style={[s.p, { fontSize: 13 }]}>{es ? `Lección ${i + 1} de ${ORIENTATION.length}` : `Lesson ${i + 1} of ${ORIENTATION.length}`} · {lesson.minutes} min</Text>
        <Text style={s.h1}>{lesson.icon} {x.title}</Text>
        <Card>{x.points.map((pt) => <Text key={pt} style={[s.p, { marginBottom: 6 }]}>• {pt}</Text>)}</Card>
        <Card style={{ borderColor: C.brand }}>
          <Text style={s.b}>{es ? "Pregunta" : "Question"}: {x.q}</Text>
          {x.options.map((o, k) => (
            <Pressable key={k} disabled={done || busy} onPress={() => { setPick(k); setWrong(false); }} accessibilityRole="radio" accessibilityState={{ selected: pick === k }}
              style={{ marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: pick === k ? C.brand : C.line, backgroundColor: pick === k ? C.tint : C.white }}>
              <Text style={s.p}>{pick === k ? "◉ " : "○ "}{o}</Text>
            </Pressable>
          ))}
          {wrong && <Text style={{ color: C.red, marginTop: 8 }}>{es ? "No es correcto. Vuelva a leer los puntos e inténtelo otra vez." : "Not quite. Read the points again and try another answer."}</Text>}
          {err && <Text style={{ color: C.red, marginTop: 8 }}>{err}</Text>}
          {done
            ? <><Text style={[s.b, { color: C.deep, marginTop: 10 }]}>✅ {es ? "¡Correcto! Lección terminada." : "Correct! Lesson done."}</Text>
                <Button title={next ? (es ? "Siguiente lección →" : "Next lesson →") : (es ? "Terminar" : "Finish")} onPress={() => show(next?.id ?? null)} style={{ marginTop: 10 }} /></>
            : <Button title={es ? "Revisar respuesta" : "Check answer"} busy={busy} disabled={pick === null} style={{ marginTop: 10 }} onPress={async () => {
                setBusy(true); setErr(null);
                const r = await api<{ ok: boolean; correct: boolean; error?: string }>("/api/pro/orientation", { method: "POST", body: JSON.stringify({ lesson: lesson.id, choice: pick }) });
                setBusy(false);
                if (!r.ok) { setErr(r.data.error ?? (es ? "No se pudo guardar." : "Couldn't save.")); return; }
                if (r.data.correct) { haptic("success"); load(); } else { haptic("warning"); setWrong(true); }
              }} />}
        </Card>
      </ScrollView>
    );
  }

  const pct = p ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={s.h1}>👋 {es ? "Bienvenida a Handled" : "Welcome to Handled"}</Text>
      <Text style={s.p}>{es
        ? `Seis lecciones cortas sobre cómo trabajamos (unos ${ORIENTATION_MINUTES} minutos). Cada una termina con una pregunta. Son obligatorias antes de que Handled lo apruebe.`
        : `Six short lessons on how we work (about ${ORIENTATION_MINUTES} minutes). Each ends with one question. Required before Handled can approve you.`}</Text>
      <Card>
        <Text style={s.b}>{p ? `${p.done} / ${p.total}` : "…"} · {pct}%</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: C.paper, marginTop: 8 }}><View style={{ height: 8, borderRadius: 4, backgroundColor: C.brand, width: `${pct}%` }} /></View>
        {p?.complete
          ? <Text style={[s.p, { marginTop: 8 }]}>✅ {es ? "Orientación terminada." : "Orientation complete."}</Text>
          : p && <Button title={p.done ? (es ? "Continuar →" : "Continue →") : (es ? "Empezar →" : "Start →")} onPress={() => show(p.next)} style={{ marginTop: 10 }} />}
      </Card>
      {ORIENTATION.map((l, i) => {
        const done = Boolean(p?.lessons[l.id]);
        return (
          <Pressable key={l.id} onPress={() => show(l.id)} accessibilityRole="button">
            <Card style={{ borderColor: done ? C.brand : C.line }}>
              <Text style={s.b}>{done ? "✅" : l.icon} {i + 1}. {(es ? l.es : l.en).title}</Text>
              <Text style={[s.p, { fontSize: 13 }]}>{done ? (es ? "terminada" : "done") : `${l.minutes} min`}</Text>
            </Card>
          </Pressable>
        );
      })}
      <Pressable onPress={() => router.push("/pro/refer")}><Card style={{ borderColor: C.amber }}>
        <Text style={s.b}>💸 {es ? "Gane dinero mientras espera" : "Make money while you wait"}</Text>
        <Text style={s.p}>{es ? "Tome fotos de un trabajo, llene un ticket y cobre cuando se haga." : "Snap photos of a job, fill out a ticket, get paid when it's done."}</Text>
      </Card></Pressable>
    </ScrollView>
  );
}
