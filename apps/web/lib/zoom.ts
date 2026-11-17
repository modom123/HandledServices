/*
 * FILE    : apps/web/lib/zoom.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-17_2300 UTC
 * PURPOSE : Zoom meetings for the Front Office offices. Uses a Zoom "Server-to-Server OAuth" app on the company Zoom
 *           account (Zoom App Marketplace → Develop → Build App → Server-to-Server OAuth, scope meeting:write:admin or
 *           meeting:write:meeting:admin). Settings (Vercel → Environment Variables):
 *             ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET
 *             zoomReady()                      — whether scheduling works
 *             createZoomMeeting(user, …)       — a scheduled meeting on that Zoom user's account → join / start links
 *             upcomingZoomMeetings(user)      — their upcoming scheduled meetings
 */
import "server-only";

export const zoomReady = () => Boolean(process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET);

let token: { value: string; until: number } | null = null;
async function accessToken(): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(process.env.ZOOM_ACCOUNT_ID!)}`, {
    method: "POST", headers: { Authorization: `Basic ${basic}` },
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; reason?: string; error?: string };
  if (!r.ok || !j.access_token) throw new Error(`Zoom sign-in failed: ${j.reason ?? j.error ?? r.status}`);
  token = { value: j.access_token, until: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return token.value;
}

export interface ZoomMeeting { id: number; join_url: string; start_url: string; password: string | null; start_time: string | null }

/** Schedule a meeting on `user`'s Zoom (their Zoom login email). `start` is ISO; duration in minutes. */
export async function createZoomMeeting(user: string, o: { topic: string; start: string; minutes: number; agenda?: string | null }): Promise<ZoomMeeting> {
  if (!zoomReady()) throw new Error("Zoom isn't connected (ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET)");
  const r = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(user)}/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: o.topic.slice(0, 200), type: 2, start_time: o.start, duration: o.minutes, timezone: "America/Detroit", agenda: o.agenda?.slice(0, 2000) ?? undefined,
      settings: { join_before_host: false, waiting_room: true, mute_upon_entry: true },
    }),
  });
  const j = (await r.json().catch(() => ({}))) as Partial<ZoomMeeting> & { message?: string };
  if (!r.ok || !j.join_url) throw new Error(`Zoom: ${j.message ?? r.status}`);
  return { id: j.id!, join_url: j.join_url, start_url: j.start_url ?? j.join_url, password: j.password ?? null, start_time: j.start_time ?? null };
}

/** The user's upcoming scheduled meetings (soonest first, max 10). */
export async function upcomingZoomMeetings(user: string): Promise<{ id: number; topic: string; start_time: string; join_url: string }[]> {
  if (!zoomReady()) return [];
  const r = await fetch(`https://api.zoom.us/v2/users/${encodeURIComponent(user)}/meetings?type=upcoming&page_size=10`, { headers: { Authorization: `Bearer ${await accessToken()}` } });
  if (!r.ok) throw new Error(`Zoom: ${r.status}`);
  const j = (await r.json()) as { meetings?: { id: number; topic: string; start_time?: string; join_url: string }[] };
  return (j.meetings ?? []).filter((m) => m.start_time).map((m) => ({ id: m.id, topic: m.topic, start_time: m.start_time!, join_url: m.join_url }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}
