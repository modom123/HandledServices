/*
 * FILE    : apps/web/lib/push.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2043 UTC
 * PURPOSE : One way to reach a person: push to every phone they've signed in on (Expo push
 *           service → APNs/FCM), plus email, plus a row in their in-app inbox. Dead device
 *           tokens are pruned automatically. Works with no phones registered (email only).
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { sendEmail } from "./notify";

export interface Notice {
  title: string;
  body: string;
  /** Deep-link data for the app, e.g. { type: "offer", offerId } or { type: "job", jobId }. */
  data?: Record<string, string>;
  /** Android channel: "offers" rings loud for new work; "updates" for everything else. */
  channel?: "offers" | "updates";
  email?: { to: string; subject: string; text: string } | null;
}

export async function notify(profileId: string | null | undefined, n: Notice) {
  const db = adminClient();
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
  if (n.email?.to) {
    await sendEmail(n.email.to, n.email.subject, n.email.text);
    channels.push("email");
  }
  await db.from("notifications").insert({ profile_id: profileId ?? null, email: n.email?.to ?? null, title: n.title, body: n.body, data: n.data ?? {}, channels });
}
