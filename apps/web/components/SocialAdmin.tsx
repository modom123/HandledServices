/*
 * FILE    : apps/web/components/SocialAdmin.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Hub → Social media controls: engine settings (on/off, auto-publish, posts per week per network, the owner's
 *           themes and offers), "write this / next week now", and per post: edit caption, hashtags, photo link and time,
 *           approve, skip, retry, mark posted (TikTok).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SOCIAL_CHANNELS, fitCaption, type SocialChannel } from "@handled/core";

async function post(body: unknown): Promise<{ ok: boolean; error?: string; result?: Record<string, unknown> }> {
  const r = await fetch("/api/hub/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ...j, ok: r.ok, error: j.error };
}

export interface SocialSettingsState { enabled: boolean; auto_publish: boolean; per_week: Record<SocialChannel, number>; themes: string | null }

export function SocialSettingsForm({ s, ready }: { s: SocialSettingsState; ready: Record<SocialChannel, boolean> }) {
  const router = useRouter();
  const [f, setF] = useState(s);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(SOCIAL_CHANNELS) as SocialChannel[]).map((c) => (
          <div key={c}><label className="label">{SOCIAL_CHANNELS[c].label} posts / week {ready[c] ? "✅" : c === "tiktok" ? "(post from the app)" : "(not connected)"}</label>
            <input className="input" type="number" min={0} max={7} value={f.per_week[c]} onChange={(e) => setF({ ...f, per_week: { ...f.per_week, [c]: Math.max(0, Math.min(7, Number(e.target.value) || 0)) } })} /></div>
        ))}
      </div>
      <div><label className="label">Themes, offers and things to mention (the AI only uses offers you write here)</label>
        <textarea className="input min-h-20" placeholder="e.g. Fall gutter cleaning this month; we serve Detroit, Dearborn and Southfield; first-time customers get 10% off with code FIRST10" value={f.themes ?? ""} onChange={(e) => setF({ ...f, themes: e.target.value })} /></div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} /> Write next week’s posts every Monday</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.auto_publish} onChange={(e) => setF({ ...f, auto_publish: e.target.checked })} /> Auto-publish (skip my approval)</label>
        <button className="btn-ghost" disabled={busy} onClick={async () => { setBusy(true); const r = await post({ action: "settings", ...f }); setBusy(false); setMsg(r.ok ? "Saved." : String(r.error ?? "Failed")); router.refresh(); }}>Save</button>
        <button className="btn-primary" disabled={busy} onClick={async () => { setBusy(true); setMsg("The AI is writing this week’s posts…"); const r = await post({ action: "generate", week: "this" }); setBusy(false); setMsg(r.ok ? `${(r.result?.added as number) ?? 0} posts written${r.result?.error ? ` · ${r.result.error}` : ""}` : String(r.error ?? "Failed")); router.refresh(); }}>✨ Write this week</button>
        <button className="btn-ghost" disabled={busy} onClick={async () => { setBusy(true); setMsg("Writing next week…"); const r = await post({ action: "generate", week: "next" }); setBusy(false); setMsg(r.ok ? `${(r.result?.added as number) ?? 0} posts written for next week` : String(r.error ?? "Failed")); router.refresh(); }}>Write next week</button>
        <button className="btn-ghost" disabled={busy} onClick={async () => { setBusy(true); const r = await post({ action: "publish_now" }); setBusy(false); const x = r.result as { posted?: number; failed?: number; manual?: number } | undefined; setMsg(r.ok ? `${x?.posted ?? 0} posted, ${x?.failed ?? 0} failed, ${x?.manual ?? 0} to post from the TikTok app` : String(r.error ?? "Failed")); router.refresh(); }}>Post what’s due now</button>
      </div>
      {msg && <p className="text-ink-soft">{msg}</p>}
    </div>
  );
}

export interface SocialPostRow { id: string; channel: SocialChannel; scheduled_for: string; status: string; caption: string; hashtags: string[]; media_idea: string | null; media_url: string | null; error: string | null; external_id: string | null }

export function SocialPostCard({ p }: { p: SocialPostRow }) {
  const router = useRouter();
  const [caption, setCaption] = useState(p.caption);
  const [tags, setTags] = useState(p.hashtags.join(" "));
  const [media, setMedia] = useState(p.media_url ?? "");
  const [when, setWhen] = useState(p.scheduled_for.slice(0, 16));
  const [msg, setMsg] = useState("");
  const dirty = caption !== p.caption || tags !== p.hashtags.join(" ") || media !== (p.media_url ?? "") || when !== p.scheduled_for.slice(0, 16);
  const save = async () => {
    const r = await post({ action: "update", id: p.id, caption, hashtags: tags.split(/[\s,]+/).map((t) => t.replace(/^#+/, "")).filter(Boolean), media_url: media.trim() || null, scheduled_for: new Date(`${when}:00Z`).toISOString() });
    setMsg(r.ok ? "Saved" : String(r.error ?? "Failed")); return r.ok;
  };
  const status = async (s: string) => { if (dirty && !(await save())) return; const r = await post({ action: "status", id: p.id, status: s }); setMsg(r.ok ? "" : String(r.error ?? "Failed")); router.refresh(); };
  const c = SOCIAL_CHANNELS[p.channel];
  const preview = fitCaption(p.channel, caption, tags.split(/[\s,]+/).filter(Boolean));
  const locked = p.status === "posted";
  return (
    <div className="card space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{c.label} · <span className="text-ink-soft">{new Date(p.scheduled_for).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", timeZone: "America/Detroit" })}</span></div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "posted" ? "bg-green-100 text-green-800" : p.status === "approved" ? "bg-blue-100 text-blue-800" : p.status === "failed" ? "bg-rose-100 text-rose-800" : p.status === "skipped" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-800"}`}>{p.status}</span>
      </div>
      <textarea className="input min-h-28" disabled={locked} value={caption} onChange={(e) => setCaption(e.target.value)} />
      <input className="input text-xs" disabled={locked} placeholder="hashtags" value={tags} onChange={(e) => setTags(e.target.value)} />
      {p.media_idea && <p className="text-xs text-ink-soft">🎬 {c.video ? "Video" : "Photo"} idea: {p.media_idea}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <input className="input text-xs" disabled={locked} placeholder={c.needsMedia ? (c.video ? "Video is posted from the TikTok app" : "Photo link (https://…) — required for Instagram") : "Photo link (optional)"} value={media} onChange={(e) => setMedia(e.target.value)} />
        <input className="input text-xs" disabled={locked} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} title="Time in UTC" />
      </div>
      <p className="text-xs text-ink-soft">{preview.length}/{c.maxCaption} characters</p>
      {p.error && <p className="text-xs text-rose-700">{p.error}</p>}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          {dirty && <button className="btn-ghost text-xs" onClick={async () => { await save(); router.refresh(); }}>Save</button>}
          {p.status !== "approved" && <button className="btn-primary text-xs" onClick={() => status("approved")}>{p.status === "failed" ? "Retry" : "Approve"}</button>}
          {p.channel === "tiktok" && <button className="btn-ghost text-xs" onClick={async () => { await navigator.clipboard?.writeText(preview).catch(() => {}); setMsg("Caption copied — post it in the TikTok app"); }}>Copy caption</button>}
          {(p.channel === "tiktok" || p.status === "failed") && <button className="btn-ghost text-xs" onClick={() => status("posted")}>Mark posted</button>}
          {p.status !== "skipped" && <button className="btn-ghost text-xs" onClick={() => status("skipped")}>Skip</button>}
          {p.status === "skipped" && <button className="btn-ghost text-xs" onClick={() => status("draft")}>Restore</button>}
        </div>
      )}
      {msg && <p className="text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
