/*
 * FILE    : apps/mobile/app/pro/earnings.tsx
 * PROJECT : Handled (myhumanai)
 * CREATED : 2026-10-01_2140 UTC
 * PURPOSE : Pro earnings in the app — approved balance, instant pay (cash out now via Stripe,
 *           for the fee set in Hub → Pro Program), and this year's payouts.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Linking, RefreshControl, ScrollView, Text, View } from "react-native";
import { money } from "@handled/core";
import { API_URL, api, supabase } from "../../lib/supabase";
import { Button, C, Card, s } from "../../components/ui";

type Instant = { balance: number; fee: number; minAmount: number; feePct: number; allowed: boolean; reason: string | null; ready: boolean };
type Payout = { id: string; amount: number; status: string; kind: string; method: string | null; instant_fee: number; reason: string | null; created_at: string; jobs: { ref: string } | null };

const KIND: Record<string, string> = { job: "Job", show_up: "Show-up pay", guarantee: "Weekly minimum", stipend: "Insurance stipend", materials: "Materials", clawback: "Adjustment" };

export default function Earnings() {
  const [info, setInfo] = useState<Instant | null>(null);
  const [rows, setRows] = useState<Payout[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const year = new Date().getFullYear();
    const [i, p] = await Promise.all([
      api<Instant>("/api/pro/payouts/instant"),
      supabase.from("payouts").select("id, amount, status, kind, method, instant_fee, reason, created_at, jobs(ref)").gte("created_at", `${year}-01-01`).order("created_at", { ascending: false }).limit(100),
    ]);
    if (i.ok) setInfo(i.data);
    setRows((p.data ?? []) as unknown as Payout[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    // coming back from Stripe setup in the browser → refresh
    const sub = AppState.addEventListener("change", (st) => { if (st === "active") load(); });
    return () => sub.remove();
  }, [load]);

  async function setup() {
    setBusy(true);
    const r = await api<{ url?: string; error?: string }>("/api/pro/payouts/instant", { method: "POST", body: JSON.stringify({ setup: true }) });
    setBusy(false);
    if (r.data.url) Linking.openURL(r.data.url); else Alert.alert("Payout setup", r.data.error ?? "Not available yet");
  }
  function cashOut() {
    if (!info) return;
    Alert.alert("Cash out now?", `${money(info.balance)} − ${money(info.fee)} fee = ${money(info.balance - info.fee)} to your debit card.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Cash out", onPress: async () => {
        setBusy(true);
        const r = await api<{ ok: boolean; amount?: number; note?: string; error?: string; needsSetup?: boolean }>("/api/pro/payouts/instant", { method: "POST", body: "{}" });
        setBusy(false);
        if (r.data.ok) Alert.alert(`${money(r.data.amount ?? 0)} sent`, r.data.note ?? "");
        else if (r.data.needsSetup) setup();
        else Alert.alert("Couldn't cash out", r.data.error ?? "");
        load();
      } },
    ]);
  }

  const paidYtd = rows.filter((r) => ["paid", "clawback"].includes(r.status)).reduce((t, r) => t + Number(r.amount), 0);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <Card style={{ backgroundColor: C.tint, borderColor: C.brand }}>
        <Text style={s.label}>Ready to pay out</Text>
        <Text style={{ fontSize: 34, fontWeight: "800", color: C.deep }}>{money(info?.balance ?? 0)}</Text>
        {!info ? <Text style={s.p}>Loading…</Text>
          : !info.allowed ? <Text style={s.p}>⚡ Instant pay: {info.reason}. Approved payouts go out free on the weekly run.</Text>
          : !info.ready ? (
            <>
              <Text style={s.p}>⚡ Instant pay: connect your bank or debit card through Stripe once, then cash out any time for {(info.feePct * 100).toFixed(1)}%.</Text>
              <Button title="Set up instant pay" busy={busy} onPress={setup} style={{ marginTop: 10 }} />
            </>
          ) : (
            <>
              <Text style={s.p}>Cash out now for a {money(info.fee)} fee, or wait for the free weekly payout. Minimum {money(info.minAmount)}.</Text>
              <Button title={`⚡ Cash out ${money(Math.max(0, info.balance - info.fee))}`} busy={busy} disabled={info.balance < info.minAmount} onPress={cashOut} style={{ marginTop: 10 }} />
            </>
          )}
      </Card>
      <Text style={s.p}>Paid to you this year: <Text style={s.b}>{money(paidYtd)}</Text></Text>
      <Text style={s.h2}>Payouts</Text>
      {!rows.length && <Text style={s.p}>No payouts yet this year.</Text>}
      {rows.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.b}>{KIND[r.kind] ?? r.kind}{r.jobs ? ` · ${r.jobs.ref}` : ""}</Text>
            <Text style={[s.b, { color: Number(r.amount) < 0 ? C.red : C.ink }]}>{money(Number(r.amount))}</Text>
          </View>
          <Text style={s.p}>{r.created_at.slice(0, 10)} · {r.status}{r.method === "instant" ? " · instant" : ""}{Number(r.instant_fee) ? ` (fee ${money(Number(r.instant_fee))})` : ""}</Text>
          {r.reason && r.kind !== "job" ? <Text style={s.p}>{r.reason}</Text> : null}
        </Card>
      ))}
      <Button title="Full statement & 1099 (web)" kind="ghost" onPress={() => Linking.openURL(`${API_URL}/pro/earnings`)} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}
