/*
 * FILE    : apps/mobile/app/apply.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-27_2300 UTC
 * PURPOSE : Apply to be a pro, in the app (twin of the website's ApplyForm → POST /api/applications). Same quick start
 *           (name, contact, trades, ZIP codes) plus "Who does the work?": just me, or a company that sends a crew — whether
 *           the owner goes to jobs, what customers see (first name or company name), crew size and the people on the crew.
 *           English / Spanish.
 */
import { useState } from "react";
import { Alert, Linking, Text, View } from "react-native";
import { router } from "expo-router";
import { CREW_LIMITS, CREW_ROLES, MAX_TRADES, TRADES, TRADE_PROFILES, type AccountType, type CrewRole, type CustomerDisplay, type OwnerOnSite } from "@handled/core";
import { API_URL } from "../lib/supabase";
import { useI18n } from "../lib/i18n";
import { Button, C, Card, Chip, Field, Form, s } from "../components/ui";
import { haptic } from "../lib/haptics";

type Row = { full_name: string; role: CrewRole; email: string; phone: string; license_number: string };
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export default function Apply() {
  const { t, locale } = useI18n();
  const [f, setF] = useState({ business_name: "", contact_name: "", email: "", phone: "", zips: "", years: "", license: "", crew_size: "" });
  const [trades, setTrades] = useState<string[]>([]);
  const [insured, setInsured] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("solo");
  const [onSite, setOnSite] = useState<OwnerOnSite>("sometimes");
  const [display, setDisplay] = useState<CustomerDisplay>("person");
  const [roster, setRoster] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const crew = accountType === "crew";
  const needsLicense = trades.some((x) => TRADE_PROFILES[x]?.license);
  const setRow = (i: number, k: keyof Row, v: string) => setRoster(roster.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const ready = f.business_name.trim().length >= 2 && f.contact_name.trim().length >= 2 && emailOk(f.email) && f.phone.replace(/\D/g, "").length >= 7 && trades.length > 0;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    const body = {
      business_name: f.business_name.trim(), contact_name: f.contact_name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.trim(),
      trades, zips: f.zips.trim() || undefined, insured, years_experience: f.years || undefined, license_number: f.license.trim() || undefined,
      source: "Handled app", account_type: accountType, customer_display: display,
      ...(crew ? {
        owner_on_site: onSite, crew_size: f.crew_size || undefined,
        crew_roster: roster.filter((r) => r.full_name.trim().length >= 2).map((r) => ({ full_name: r.full_name.trim(), role: r.role, email: r.email.trim() || undefined, phone: r.phone.trim() || undefined, license_number: r.license_number.trim() || undefined })),
      } : {}),
    };
    const res = await fetch(`${API_URL}/api/applications`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: locale === "es" ? "lang=es" : "lang=en" }, body: JSON.stringify(body) })
      .then(async (r) => ({ ok: r.ok, data: (await r.json().catch(() => ({}))) as { error?: string; existing?: boolean } }))
      .catch(() => ({ ok: false, data: { error: "No connection. Check your signal or Wi-Fi and try again." } as { error?: string; existing?: boolean } }));
    setBusy(false);
    if (!res.ok) { haptic("error"); return Alert.alert(t("Couldn't send"), t(res.data.error ?? "Try again")); }
    haptic("success");
    if (res.data.existing) {
      Alert.alert(t("You already have a pro account"), t("We emailed you a sign-in link. Or sign in here with your email."), [{ text: t("Sign in"), onPress: () => router.replace("/login") }]);
      return;
    }
    setDone(true);
  }

  if (done) return (
    <Form>
      <Text style={[s.h1, { textAlign: "center" }]}>🎉</Text>
      <Text style={[s.h1, { textAlign: "center" }]}>{t("Application received")}</Text>
      <Text style={[s.p, { textAlign: "center", marginTop: 8 }]}>{t("Check your email — we just sent what happens next. Most applicants hear back the same day. If you’re invited, one click opens your setup checklist (about 15 minutes on your phone).")}</Text>
      {crew && <Text style={[s.p, { textAlign: "center", marginTop: 8 }]}>{t("Once you're in, add your crew in My crew — each person gets their background check link — and give your office manager a login in Office team.")}</Text>}
      <Button title={t("Done")} onPress={() => router.replace("/")} style={{ marginTop: 18 }} />
    </Form>
  );

  return (
    <Form footer={<Button title={busy ? t("Sending…") : trades.length ? t("Apply") : t("Pick at least one trade to apply")} onPress={submit} busy={busy} disabled={!ready} />}>
      <Text style={s.h1}>{t("Become a Handled pro")}</Text>
      <Text style={[s.p, { marginBottom: 12 }]}>{t("Takes 2 minutes. Prepaid, pre-priced jobs in your area, paid weekly, no lead fees.")}</Text>
      <Field label={t("Business name (or your name)")} value={f.business_name} onChangeText={set("business_name")} autoCapitalize="words" textContentType="organizationName" />
      <Field label={t("Your name")} value={f.contact_name} onChangeText={set("contact_name")} autoCapitalize="words" textContentType="name" autoComplete="name" />
      <Field label={t("Email")} value={f.email} onChangeText={set("email")} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" autoComplete="email" />
      <Field label={t("Mobile")} value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" />
      <Text style={[s.p, { fontSize: 13, marginTop: -4, marginBottom: 12 }]}>{t("By giving your mobile number, you agree to receive automated texts from Handled about your application, job offers and payouts. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help. We never sell your number.")} <Text style={{ color: C.brand, fontWeight: "700" }} onPress={() => Linking.openURL(`${API_URL}/privacy`)}>{t("Privacy")}</Text></Text>

      <Text style={s.label}>{t("What do you do?")} ({trades.length}/{MAX_TRADES})</Text>
      <View style={[s.row, { marginBottom: 12 }]}>
        {TRADES.map((x) => <Chip key={x.id} label={t(x.label)} on={trades.includes(x.id)} onPress={() => setTrades(trades.includes(x.id) ? trades.filter((y) => y !== x.id) : trades.length >= MAX_TRADES ? trades : [...trades, x.id])} />)}
      </View>
      <Field label={t("ZIP codes you serve")} value={f.zips} onChangeText={set("zips")} placeholder="48201, 48202" keyboardType="numbers-and-punctuation" />
      <View style={[s.row, { marginBottom: 12 }]}><Chip label={`${insured ? "☑" : "☐"} ${t("I carry general liability insurance")}`} on={insured} onPress={() => setInsured(!insured)} /></View>
      <Field label={t("Years in business")} value={f.years} onChangeText={(v) => set("years")(v.replace(/\D/g, ""))} keyboardType="number-pad" />
      {needsLicense && <Field label={t("License # (if your trade needs one)")} value={f.license} onChangeText={set("license")} autoCapitalize="characters" />}

      <Card style={{ marginTop: 6 }}>
        <Text style={s.label}>{t("Who does the work?")}</Text>
        <View style={s.row}>
          <Chip label={t("Just me")} on={!crew} onPress={() => setAccountType("solo")} />
          <Chip label={t("My company sends a crew")} on={crew} onPress={() => setAccountType("crew")} />
        </View>
        {crew && (
          <>
            <Text style={[s.label, { marginTop: 10 }]}>{t("Do you go to jobs?")}</Text>
            <View style={s.row}>
              {([["always", "I'm on every job"], ["sometimes", "Me or my crew"], ["never", "My crew does the jobs"]] as [OwnerOnSite, string][]).map(([id, label]) => <Chip key={id} label={t(label)} on={onSite === id} onPress={() => setOnSite(id)} />)}
            </View>
            <Text style={[s.label, { marginTop: 10 }]}>{t("Customers see")}</Text>
            <View style={s.row}>
              <Chip label={t("My first name")} on={display === "person"} onPress={() => setDisplay("person")} />
              <Chip label={t("My company name")} on={display === "company"} onPress={() => setDisplay("company")} />
            </View>
            <View style={{ marginTop: 10 }}><Field label={t("Crew size (including you)")} value={f.crew_size} onChangeText={(v) => set("crew_size")(v.replace(/\D/g, ""))} keyboardType="number-pad" /></View>
            <Text style={s.label}>{t("Your crew (optional now)")}</Text>
            {roster.map((r, i) => (
              <Card key={i} style={{ marginTop: 6 }}>
                <Field label={t("Full name")} value={r.full_name} onChangeText={(v) => setRow(i, "full_name", v)} autoCapitalize="words" />
                <View style={[s.row, { marginBottom: 8 }]}>{CREW_ROLES.map((x) => <Chip key={x.id} label={t(x.label)} on={r.role === x.id} onPress={() => setRow(i, "role", x.id)} />)}</View>
                <Field label={t("Email (for their background check)")} value={r.email} onChangeText={(v) => setRow(i, "email", v)} keyboardType="email-address" autoCapitalize="none" />
                <Field label={t("Phone")} value={r.phone} onChangeText={(v) => setRow(i, "phone", v)} keyboardType="phone-pad" />
                {r.role === "licensed" && <Field label={t("License number")} value={r.license_number} onChangeText={(v) => setRow(i, "license_number", v)} autoCapitalize="characters" />}
                <Button title={t("Remove")} kind="ghost" onPress={() => setRoster(roster.filter((_, j) => j !== i))} />
              </Card>
            ))}
            {roster.length < CREW_LIMITS.maxActive && <Button title={`+ ${t("Add someone on your crew")}`} kind="ghost" onPress={() => setRoster([...roster, { full_name: "", role: "lead", email: "", phone: "", license_number: "" }])} style={{ marginTop: 8 }} />}
            <Text style={[s.p, { fontSize: 13, marginTop: 8 }]}>{t("Your company directs and pays them and keeps their I-9s. Each person passes our background check before going to a job; we send it when you add them in My crew after you're invited. You'll need a workers' comp policy to send a crew.")}</Text>
          </>
        )}
      </Card>
    </Form>
  );
}
