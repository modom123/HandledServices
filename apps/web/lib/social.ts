/*
 * FILE    : apps/web/lib/social.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : The social engine (Hub → Social media):
 *             generateWeek — every Monday (when on) the AI writes the week's Facebook / Instagram / TikTok posts into the
 *                            calendar as drafts (or approved, when auto-publish is on)
 *             publishDue   — every 10 minutes: approved posts whose time has come go out —
 *                              Facebook Page: Graph API (META_PAGE_ID + META_PAGE_ACCESS_TOKEN), text or photo
 *                              Instagram: Graph API (META_IG_USER_ID, same token) — needs a public photo URL
 *                              TikTok: video only, posted from the TikTok app (the post shows the caption and shot list);
 *                                      staff mark it posted
 *             updatePost / setPostStatus — edit, approve, skip, mark posted
 *           Nothing goes out without approval unless auto-publish is switched on.
 */
import "server-only";
import { fitCaption, socialSlots, SOCIAL_CHANNELS, type SocialChannel } from "@handled/core";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";
import { writeSocialWeek } from "./ai/social";

const db = () => adminClient();
const GRAPH = "https://graph.facebook.com/v21.0";

export interface SocialSettings { enabled: boolean; auto_publish: boolean; per_week: Record<SocialChannel, number>; themes: string | null }
export async function getSocialSettings(): Promise<SocialSettings> {
  const { data } = await db().from("social_settings").select("*").eq("id", 1).maybeSingle();
  return { enabled: false, auto_publish: false, themes: null, ...(data ?? {}), per_week: { facebook: 3, instagram: 3, tiktok: 2, ...((data?.per_week as Record<string, number>) ?? {}) } } as SocialSettings;
}

export const facebookReady = () => Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN);
export const instagramReady = () => Boolean(process.env.META_IG_USER_ID && process.env.META_PAGE_ACCESS_TOKEN);

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStart(d = new Date()): Date {
  const m = new Date(d); m.setUTCHours(0, 0, 0, 0);
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m;
}

/** Write the week's posts (skips channels that already have posts that week). */
export async function generateWeek(start = weekStart(), actor = "AI social writer"): Promise<{ added: number; skipped: string[] }> {
  const s = await getSocialSettings();
  const end = new Date(start.getTime() + 7 * 86400000);
  const { data: existing } = await db().from("social_posts").select("channel").gte("scheduled_for", start.toISOString()).lt("scheduled_for", end.toISOString());
  const have = new Set((existing ?? []).map((p) => p.channel));
  const now = Date.now();
  const slots = (Object.keys(SOCIAL_CHANNELS) as SocialChannel[]).filter((c) => !have.has(c))
    .flatMap((c) => socialSlots(start, c, s.per_week[c] ?? 0).map((when) => ({ channel: c, when }))).filter((x) => Date.parse(x.when) > now - 3600000);
  if (!slots.length) return { added: 0, skipped: [...have] };
  const { data: recent } = await db().from("social_posts").select("caption").order("created_at", { ascending: false }).limit(20);
  const posts = await writeSocialWeek(slots, { siteUrl: siteUrl(), themes: s.themes, recent: (recent ?? []).map((r) => r.caption as string) });
  if (!posts.length) return { added: 0, skipped: [...have] };
  const { error } = await db().from("social_posts").insert(posts.map((p) => ({
    channel: p.channel, scheduled_for: p.when, status: s.auto_publish ? "approved" : "draft", caption: p.caption, hashtags: p.hashtags.map((h) => h.replace(/^#+/, "")),
    media_idea: p.media_idea, service_slug: p.service_slug, created_by: actor, approved_by: s.auto_publish ? "auto-publish" : null,
  })));
  if (error) throw new Error(error.message);
  return { added: posts.length, skipped: [...have] };
}

type Post = { id: string; channel: SocialChannel; caption: string; hashtags: string[]; media_url: string | null };

async function graph(path: string, params: Record<string, string>): Promise<{ id?: string; error?: string }> {
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...params, access_token: process.env.META_PAGE_ACCESS_TOKEN! }), signal: AbortSignal.timeout(20000) }).catch((e) => ({ ok: false, json: async () => ({ error: { message: String(e) } }) }) as unknown as Response);
  const j = (await r.json().catch(() => ({}))) as { id?: string; post_id?: string; error?: { message?: string } };
  return r.ok ? { id: j.post_id ?? j.id } : { error: j.error?.message ?? `Graph API error ${r.status}` };
}

async function publishOne(p: Post): Promise<{ id?: string; error?: string; manual?: boolean }> {
  const text = fitCaption(p.channel, p.caption, p.hashtags);
  if (p.channel === "facebook") {
    if (!facebookReady()) return { error: "Connect Facebook: set META_PAGE_ID and META_PAGE_ACCESS_TOKEN in Vercel" };
    return p.media_url ? graph(`${process.env.META_PAGE_ID}/photos`, { url: p.media_url, caption: text }) : graph(`${process.env.META_PAGE_ID}/feed`, { message: text });
  }
  if (p.channel === "instagram") {
    if (!instagramReady()) return { error: "Connect Instagram: set META_IG_USER_ID and META_PAGE_ACCESS_TOKEN in Vercel" };
    if (!p.media_url) return { error: "Instagram needs a photo: add a public image URL to the post" };
    const c = await graph(`${process.env.META_IG_USER_ID}/media`, { image_url: p.media_url, caption: text });
    if (!c.id) return c;
    return graph(`${process.env.META_IG_USER_ID}/media_publish`, { creation_id: c.id });
  }
  return { manual: true }; // TikTok: post the video from the TikTok app, then mark it posted
}

/** Post everything approved and due. Failures keep the post (status 'failed' with the reason) so staff can fix and retry. */
export async function publishDue(): Promise<{ posted: number; failed: number; manual: number }> {
  const { data } = await db().from("social_posts").select("id, channel, caption, hashtags, media_url").eq("status", "approved").lte("scheduled_for", new Date().toISOString()).is("error", null).order("scheduled_for").limit(10);
  let posted = 0, failed = 0, manual = 0;
  for (const p of (data ?? []) as Post[]) {
    const r = await publishOne(p);
    const now = new Date().toISOString();
    if (r.manual) { await db().from("social_posts").update({ error: "Post this video from the TikTok app, then tap “Mark posted”.", updated_at: now }).eq("id", p.id); manual++; }
    else if (r.id) { await db().from("social_posts").update({ status: "posted", external_id: r.id, posted_at: now, error: null, updated_at: now }).eq("id", p.id); posted++; }
    else { await db().from("social_posts").update({ status: "failed", error: (r.error ?? "Failed").slice(0, 500), updated_at: now }).eq("id", p.id); failed++; }
  }
  return { posted, failed, manual };
}

export async function updatePost(id: string, patch: { caption?: string; hashtags?: string[]; media_url?: string | null; scheduled_for?: string }) {
  await db().from("social_posts").update({ ...patch, error: null, updated_at: new Date().toISOString() }).eq("id", id);
}

/** approve → goes out at its time (or now, if overdue); skip; retry a failed one; posted (done by hand, e.g. TikTok). */
export async function setPostStatus(id: string, status: "draft" | "approved" | "skipped" | "posted", actor: string) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status, error: null, updated_at: now };
  if (status === "approved") patch.approved_by = actor;
  if (status === "posted") patch.posted_at = now;
  await db().from("social_posts").update(patch).eq("id", id);
}

export async function socialEngine() {
  const s = await getSocialSettings();
  if (!s.enabled) return { skipped: "off" };
  return generateWeek();
}

