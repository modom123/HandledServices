/*
 * FILE    : apps/mobile/app/pro/refer.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-29_0715 UTC
 * PURPOSE : Pro mode → Refer & earn ("make money while you wait"): join the Partner Program in one tap, share the
 *           link, and send a photo-first referral ticket (/api/partner). Commissions (25% / 10% / 15%, core
 *           partners.ts) are paid into the same Stripe account as job pay. EN / ES.
 */
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, RefreshControl, ScrollView, Share, Switch, Text, TextInput, View } from "react-native";
import { PARTNER_PROGRAM, PARTNER_TIERS, PRO_REFERRAL, TICKET_CONTACT, TICKET_JOB_TYPES, TICKET_RELATIONSHIPS, TICKET_TIMING, money, partnerTerms, tierPct, type PartnerTier } from "@handled/core";
import { api } from "../../lib/supabase";
import { pickAndUpload, type Shot } from "../../lib/photos";
import { Button, C, Card, s } from "../../components/ui";
import { useI18n } from "../../lib/i18n";
import { haptic } from "../../lib/haptics";

type Data = { partner: { code: string; link: string; short: string; status: string } | null; stats?: { customers: number; paid: number; ready: number; upcoming: number }; ready?: boolean; proLink?: string };
const blank = { name: "", email: "", phone: "", city: "", zip: "", details: "", job_type: "one_time", contact_pref: "call", timing: "week", relationship: "friend" };

function Chips<K extends string>({ opts, value, onChange }: { opts: [K, string][]; value: string; onChange: (k: K) => void }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>{opts.map(([k, l]) => (
    <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="radio" accessibilityState={{ selected: value === k }}
      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: value === k ? C.brand : C.line, backgroundColor: value === k ? C.tint : C.white }}>
      <Text style={{ fontSize: 13, color: value === k ? C.deep : C.soft }}>{l}</Text>
    </Pressable>
  ))}</View>;
}

export default function Refer() {
  const { locale } = useI18n();
  const es = locale === "es";
  const [d, setD] = useState<Data | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(blank);
  const [shots, setShots] = useState<Shot[]>([]);
  const [consent, setConsent] = useState(false);
  const load = useCallback(async () => { const r = await api<Data>("/api/pro/refer"); if (r.ok) setD(r.data); }, []);
  useEffect(() => { load(); }, [load]);
  const field = (k: keyof typeof blank, label: string, extra: object = {}) => <TextInput style={[s.input, { marginBottom: 8, fontSize: 15 }]} placeholder={label} value={f[k]} onChangeText={(v) => setF({ ...f, [k]: v })} {...extra} />;
  const add = async (camera: boolean) => { const got = await pickAndUpload(camera, 8 - shots.length); if (got.length) setShots([...shots, ...got]); };
  const earns = TICKET_JOB_TYPES[f.job_type as keyof typeof TICKET_JOB_TYPES]?.earns;

  async function send() {
    setBusy(true);
    const r = await api<{ ok: boolean; ticket_no?: string; error?: string }>("/api/partner", { method: "POST", body: JSON.stringify({
      action: "ticket", ...f, phone: f.phone || null, city: f.city || null, details: f.details || null, service_slug: null, address: null, best_time: null, company: null, note: null, preferred_date: null, consent: true, photos: shots.map((x) => x.path),
    }) });
    setBusy(false);
    if (!r.ok) return Alert.alert(es ? "No se pudo enviar" : "Couldn't send", r.data.error ?? "");
    haptic("success");
    Alert.alert(es ? `Ticket ${r.data.ticket_no ?? ""} enviado` : `Ticket ${r.data.ticket_no ?? ""} sent`, es ? `Le enviamos a ${f.name.split(" ")[0]} un enlace para reservar de su parte, y también lo contactaremos.` : `We emailed ${f.name.split(" ")[0]} a booking link from you, and we'll reach out too.`);
    setF(blank); setShots([]); setConsent(false); load();
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
      <Text style={s.h1}>💸 {es ? "Gane dinero mientras espera" : "Make money while you wait"}</Text>
      <Text style={s.p}>{es ? "No necesita estar aprobado. Tome fotos de un trabajo que alguien necesita, llene un ticket y cobre cuando se haga." : "You don't need to be approved. Snap photos of a job someone needs, fill out a ticket, and get paid when it's done."}</Text>
      <View style={{ flexDirection: "row", gap: 6, marginVertical: 8 }}>{(Object.keys(PARTNER_TIERS) as PartnerTier[]).map((t) => (
        <Card key={t} style={{ flex: 1, padding: 10 }}><Text style={{ fontSize: 22, fontWeight: "800", color: C.deep }}>{tierPct(t)}</Text><Text style={[s.p, { fontSize: 12 }]}>{PARTNER_TIERS[t].label}</Text></Card>
      ))}</View>
      <Text style={[s.p, { fontSize: 14 }]}>{es ? `Ejemplo: un trabajo de $300 le paga ${money(75)}. Pagado los lunes, en la misma cuenta que su pago por trabajos, después de la garantía de ${PARTNER_PROGRAM.holdDays} días.` : `Example: a $300 job pays you ${money(75)}. Paid Mondays, into the same account as your job pay, once the ${PARTNER_PROGRAM.holdDays}-day guarantee has passed.`}</Text>

      {!d ? <Text style={s.p}>…</Text> : !d.partner ? (
        <Card>
          <Text style={s.b}>{es ? "Empiece en un toque" : "Start in one tap"}</Text>
          {partnerTerms().map((x) => <Text key={x} style={[s.p, { fontSize: 12, marginTop: 4 }]}>• {x}</Text>)}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}><Switch value={agree} onValueChange={setAgree} /><Text style={[s.p, { flex: 1 }]}>{es ? "Acepto los términos del programa de referidos." : "I agree to the referral partner terms."}</Text></View>
          <Button title={es ? "Empezar a ganar" : "Start earning"} busy={busy} disabled={!agree} style={{ marginTop: 10 }} onPress={async () => {
            setBusy(true); const r = await api<{ ok: boolean; error?: string }>("/api/pro/refer", { method: "POST", body: JSON.stringify({ agree: true }) }); setBusy(false);
            if (!r.ok) return Alert.alert(es ? "No se pudo" : "Couldn't sign you up", r.data.error ?? ""); haptic("success"); load();
          }} />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={s.b}>{es ? "Su código" : "Your code"}: {d.partner.code}</Text>
            <Text selectable style={[s.p, { fontSize: 13 }]}>{d.partner.short}</Text>
            <Text style={[s.p, { fontSize: 13, marginTop: 4 }]}>{es ? `Referidos: ${d.stats?.customers ?? 0} · Pagado: ${money(d.stats?.paid ?? 0)} · Próximo: ${money((d.stats?.ready ?? 0) + (d.stats?.upcoming ?? 0))}` : `Referred: ${d.stats?.customers ?? 0} · Paid: ${money(d.stats?.paid ?? 0)} · Coming: ${money((d.stats?.ready ?? 0) + (d.stats?.upcoming ?? 0))}`}</Text>
            {!d.ready && <Text style={{ color: C.amber, fontSize: 13, marginTop: 4 }}>{es ? "Termine su configuración de pagos para cobrar." : "Finish your payout setup to get paid."}</Text>}
            <Button title={es ? "Compartir mi enlace" : "Share my link"} kind="ghost" style={{ marginTop: 10 }} onPress={() => Share.share({ message: es ? `Reserve servicios para el hogar o su negocio con Handled: ${d.partner!.short}` : `Book home or business services with Handled: ${d.partner!.short}` })} />
          </Card>

          <Text style={s.h2}>{es ? "Nuevo ticket de referido" : "New referral ticket"}</Text>
          <Card>
            <Text style={s.b}>1 · {es ? "Fotos del trabajo" : "Photos of the job"} ({shots.length}/8)</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 8 }}>{shots.map((x) => <Image key={x.path} source={{ uri: x.uri }} style={{ width: 64, height: 64, borderRadius: 8 }} />)}</View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title={es ? "📷 Tomar foto" : "📷 Take photo"} onPress={() => add(true)} disabled={shots.length >= 8} style={{ flex: 1 }} />
              <Button title={es ? "Galería" : "Library"} kind="ghost" onPress={() => add(false)} disabled={shots.length >= 8} style={{ flex: 1 }} />
            </View>
          </Card>
          <Card>
            <Text style={[s.b, { marginBottom: 8 }]}>2 · {es ? "Cliente" : "Customer"}</Text>
            {field("name", es ? "Nombre completo" : "Full name")}
            {field("email", es ? "Correo" : "Email", { keyboardType: "email-address", autoCapitalize: "none" })}
            {field("phone", es ? "Teléfono" : "Phone", { keyboardType: "phone-pad" })}
            <Chips opts={Object.entries(TICKET_CONTACT) as [string, string][]} value={f.contact_pref} onChange={(k) => setF({ ...f, contact_pref: k })} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 2 }}>{field("city", es ? "Ciudad" : "City")}</View>
              <View style={{ flex: 1 }}>{field("zip", "ZIP", { keyboardType: "number-pad", maxLength: 5 })}</View>
            </View>
          </Card>
          <Card>
            <Text style={[s.b, { marginBottom: 8 }]}>3 · {es ? "El trabajo" : "The job"}</Text>
            <Chips opts={Object.entries(TICKET_JOB_TYPES).map(([k, x]) => [k, x.label]) as [string, string][]} value={f.job_type} onChange={(k) => setF({ ...f, job_type: k })} />
            <Chips opts={(Object.entries(TICKET_TIMING) as [string, string][]).filter(([k]) => k !== "date")} value={f.timing} onChange={(k) => setF({ ...f, timing: k })} />
            {field("details", es ? "Qué se necesita (opcional)" : "What needs doing (optional)", { multiline: true })}
            {earns && <Text style={[s.p, { fontSize: 13 }]}>{es ? "Usted gana" : "You earn"}: {earns}</Text>}
          </Card>
          <Card>
            <Text style={[s.b, { marginBottom: 8 }]}>4 · {es ? "Usted y ellos" : "You and them"}</Text>
            <Chips opts={Object.entries(TICKET_RELATIONSHIPS) as [string, string][]} value={f.relationship} onChange={(k) => setF({ ...f, relationship: k })} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Switch value={consent} onValueChange={setConsent} /><Text style={[s.p, { flex: 1, fontSize: 13 }]}>{es ? "Aceptaron que comparta sus datos y que Handled los contacte sobre este trabajo." : "They agreed that I can share their details and that Handled may contact them about this job."}</Text></View>
            <Button title={es ? "Enviar ticket" : "Submit ticket"} busy={busy} disabled={!consent || !f.name || !f.email || !/^\d{5}$/.test(f.zip) || (f.contact_pref !== "email" && !f.phone)} style={{ marginTop: 10 }} onPress={send} />
          </Card>
          {d.proLink && <Card><Text style={s.b}>👷 {es ? `Gane ${money(PRO_REFERRAL.bonus)} por cada profesional` : `Earn ${money(PRO_REFERRAL.bonus)} per pro you bring`}</Text>
            <Text style={[s.p, { fontSize: 13 }]}>{es ? `Cuando termine ${PRO_REFERRAL.afterJobs} trabajos.` : `Once they finish ${PRO_REFERRAL.afterJobs} jobs.`}</Text>
            <Button title={es ? "Compartir" : "Share"} kind="ghost" style={{ marginTop: 8 }} onPress={() => Share.share({ message: es ? `Trabaje con Handled: trabajos prepagados, pago cada lunes. ${d.proLink}` : `Work with Handled: prepaid jobs, paid every Monday. ${d.proLink}` })} /></Card>}
        </>
      )}
    </ScrollView>
  );
}
