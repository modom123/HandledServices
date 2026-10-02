/*
 * FILE    : apps/web/lib/push.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * UPDATED : 2026-10-02_1412 UTC — English / Spanish: each notice may carry a Spanish version (es); the
 *           person's language comes from their profile (their toggle), else the booking's language.
 * UPDATED : 2026-10-02_0316 UTC — plus a text message (sms) when given, unless the person opted out.
 * PURPOSE : One way to reach a person: push to every phone they've signed in on (Expo push
 *           service → APNs/FCM), plus email, plus a row in their in-app inbox. Dead device
 *           tokens are pruned automatically. Works with no phones registered (email only).
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { sendEmail } from "./notify";
import { sendSms } from "./sms";
import type { Locale } from "@handled/core";

export interface Notice {
  title: string;
  body: string;
  /** Deep-link data for the app, e.g. { type: "offer", offerId } or { type: "job", jobId }. */
  data?: Record<string, string>;
  /** Android channel: "offers" rings loud for new work; "updates" for everything else. */
  channel?: "offers" | "updates";
  email?: { to: string; subject: string; text: string } | null;
  /** Also text this number (customers: job updates; pros: offers and reminders). */
  sms?: { to: string | null | undefined; body: string } | null;
  /** Language when the person has no account (e.g. the booking's language for a guest). */
  locale?: Locale | string | null;
  /** Spanish version — used when the person's language is Spanish. */
  es?: { title?: string; body?: string; subject?: string; text?: string; sms?: string } | null;
}

/** The person's language: their profile setting (the toggle) if they have an account, else the fallback. */
export async function localeOf(profileId: string | null | undefined, fallback?: string | null): Promise<Locale> {
  if (profileId) {
    const { data } = await adminClient().from("profiles").select("locale").eq("id", profileId).maybeSingle();
    if (data?.locale === "es" || data?.locale === "en") return data.locale;
  }
  return fallback === "es" ? "es" : "en";
}

export async function notify(profileId: string | null | undefined, notice: Notice) {
  const db = adminClient();
  const lang = notice.es ? await localeOf(profileId, notice.locale) : "en";
  const es = lang === "es" ? notice.es : null;
  const n: Notice = es ? {
    ...notice,
    title: es.title ?? notice.title, body: es.body ?? notice.body,
    email: notice.email ? { ...notice.email, subject: es.subject ?? notice.email.subject, text: es.text ?? notice.email.text } : notice.email,
    sms: notice.sms ? { ...notice.sms, body: es.sms ?? notice.sms.body } : notice.sms,
  } : notice;
  const channels: string[] = [];
  if (profileId) {
    const { data: tokens } = await db.from("push_tokens").select("token").eq("profile_id", profileId);
    const list = (tokens ?? []).map((t: { token: string }) => t.token);
    if (list.length) {
      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json", Accept: "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
          },
          body: JSON.stringify(list.map((to) => ({ to, title: n.title, body: n.body, data: n.data ?? {}, sound: "default", priority: "high", channelId: n.channel ?? "updates" }))),
        });
        const json = (await res.json().catch(() => ({}))) as { data?: { status: string; details?: { error?: string } }[] };
        const dead = (json.data ?? []).map((t, i) => (t.details?.error === "DeviceNotRegistered" ? list[i] : null)).filter(Boolean) as string[];
        if (dead.length) await db.from("push_tokens").delete().in("token", dead);
        if ((json.data ?? []).some((t) => t.status === "ok")) channels.push("push");
      } catch (e) {
        console.error("[push]", e);
      }
    }
  }
  if (n.sms?.to) {
    const { data: me } = profileId ? await db.from("profiles").select("sms_opt_out").eq("id", profileId).maybeSingle() : { data: null };
    if (!me?.sms_opt_out && (await sendSms(n.sms.to, n.sms.body))) channels.push("sms");
  }
  if (n.email?.to) {
    await sendEmail(n.email.to, n.email.subject, n.email.text);
    channels.push("email");
  }
  await db.from("notifications").insert({ profile_id: profileId ?? null, email: n.email?.to ?? null, title: n.title, body: n.body, data: n.data ?? {}, channels });
}
