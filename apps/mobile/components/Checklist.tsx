/*
 * FILE    : apps/mobile/components/Checklist.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0221 UTC
 * PURPOSE : Job checklist in the app (format in packages/core/src/checklists.ts), English and Spanish:
 *             ChecklistList   — read-only (offer screen, customer progress)
 *             ProChecklist    — the pro checks items off, or marks N/A with the reason (job screen)
 */
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { checklistProgress, type ChecklistCheck, type JobChecklist } from "@handled/core";
import { api } from "../lib/supabase";
import { Button, C, Card, s } from "./ui";

const tx = (es: boolean, en: string, sp: string) => (es ? sp : en);

function Progress({ c, checks, es }: { c: JobChecklist; checks: ChecklistCheck[]; es: boolean }) {
  const p = checklistProgress(c, checks);
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={[s.p, { fontSize: 13 }]}>{tx(es, `${p.done} done${p.na ? ` · ${p.na} N/A` : ""} · ${p.left} left · ${p.pct}%`, `${p.done} hechos${p.na ? ` · ${p.na} N/A` : ""} · ${p.left} pendientes · ${p.pct}%`)}</Text>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: C.paper }}><View style={{ height: 6, borderRadius: 3, backgroundColor: C.brand, width: `${p.pct}%` }} /></View>
      {p.open.length ? <Text style={{ color: "#b45309", fontSize: 13, marginTop: 2 }}>{tx(es, `${p.open.length} required item(s) still open`, `${p.open.length} punto(s) obligatorio(s) pendiente(s)`)}</Text> : null}
    </View>
  );
}

export function ChecklistList({ checklist, checks, es }: { checklist: JobChecklist; checks?: ChecklistCheck[]; es: boolean }) {
  const by = new Map((checks ?? []).map((x) => [x.item_id, x]));
  return (
    <View>
      {checks ? <Progress c={checklist} checks={checks} es={es} /> : null}
      {checklist.sections.map((sec) => (
        <View key={sec.id} style={{ marginTop: 8 }}>
          <Text style={[s.label, sec.id === "special" ? { color: "#b45309" } : null]}>{es ? sec.title_es : sec.title}</Text>
          {sec.items.map((x) => {
            const k = by.get(x.id);
            return <Text key={x.id} style={[s.p, { fontSize: 14 }]}>{k?.status === "done" ? "✅" : k?.status === "na" ? "➖" : "☐"} {es ? x.text_es : x.text}{x.required ? " *" : ""}{x.photo ? " 📷" : ""}{k?.status === "na" && k.note ? ` — N/A: ${k.note}` : ""}</Text>;
          })}
        </View>
      ))}
    </View>
  );
}

export function ProChecklist({ jobId, es, onChange }: { jobId: string; es: boolean; onChange?: () => void }) {
  const [data, setData] = useState<{ checklist: JobChecklist; checks: ChecklistCheck[]; locked: boolean } | null>(null);
  const [na, setNa] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const [msg, setMsg] = useState("");
  const load = useCallback(async () => {
    const r = await api<{ checklist: JobChecklist; checks: ChecklistCheck[]; locked: boolean }>(`/api/pro/jobs/${jobId}/checklist`);
    if (r.ok) setData(r.data);
  }, [jobId]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;
  const by = new Map(data.checks.map((x) => [x.item_id, x]));
  async function set(item_id: string, status: "done" | "na" | "undo", note?: string) {
    setMsg("");
    const r = await api<{ ok: boolean; error?: string }>(`/api/pro/jobs/${jobId}/checklist`, { method: "POST", body: JSON.stringify({ item_id, status, note: note ?? null }) });
    if (!r.ok || r.data.ok === false) setMsg(r.data.error ?? tx(es, "Try again", "Intente de nuevo"));
    await load(); onChange?.();
  }
  return (
    <Card>
      <Text style={s.b}>✅ {es ? data.checklist.title_es : data.checklist.title}</Text>
      <Text style={[s.p, { fontSize: 13 }]}>{tx(es, "Tap an item when it's done. Doesn't apply? Hold it to mark N/A with the reason. Items with * must be handled before you submit.", "Toque un punto al terminarlo. ¿No aplica? Manténgalo presionado para marcar N/A con el motivo. Los puntos con * deben quedar marcados antes de enviar.")}</Text>
      <Progress c={data.checklist} checks={data.checks} es={es} />
      {data.checklist.sections.map((sec) => (
        <View key={sec.id} style={{ marginTop: 10 }}>
          <Text style={[s.label, sec.id === "special" ? { color: "#b45309" } : null]}>{es ? sec.title_es : sec.title}</Text>
          {sec.items.map((x) => {
            const k = by.get(x.id);
            return (
              <View key={x.id}>
                <Pressable disabled={data.locked} onPress={() => set(x.id, k ? "undo" : "done")} onLongPress={() => { if (!k) { setNa(x.id); setWhy(""); } }}
                  style={{ flexDirection: "row", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, backgroundColor: k?.status === "done" ? "#ecfdf5" : sec.id === "special" && !k ? "#fffbeb" : undefined }}>
                  <Text style={{ fontSize: 18 }}>{k?.status === "done" ? "✅" : k?.status === "na" ? "➖" : "⬜"}</Text>
                  <Text style={[s.p, { flex: 1, fontSize: 15, textDecorationLine: k?.status === "na" ? "line-through" : "none" }]}>{es ? x.text_es : x.text}{x.required ? " *" : ""}{x.photo ? " 📷" : ""}{k?.status === "na" ? `\nN/A: ${k.note ?? ""}` : ""}</Text>
                </Pressable>
                {na === x.id ? (
                  <View style={{ flexDirection: "row", gap: 6, marginVertical: 6 }}>
                    <TextInput style={[s.input, { flex: 1 }]} autoFocus placeholder={tx(es, "Why doesn't it apply?", "¿Por qué no aplica?")} value={why} onChangeText={setWhy} />
                    <Button title="N/A" kind="ghost" disabled={why.trim().length < 3} onPress={() => { set(x.id, "na", why); setNa(null); }} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      {msg ? <Text style={{ color: C.red, marginTop: 6 }}>{msg}</Text> : null}
    </Card>
  );
}
