/*
 * FILE    : apps/web/components/PersonFiles.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0000 UTC
 * PURPOSE : Mastermind: a person's file — every document and photo that belongs to a customer, pro, staff member,
 *           partner or business account (lib/person-files.ts, /api/hub/files), with Open links, photo thumbnails and
 *           an "Add a file" box. Added files go straight from the browser to private storage (no size problems) and
 *           are checked before they're recorded. Used on the existing person pages, not a separate menu item.
 * UPDATED : 2026-11-06_0600 UTC — the file shows the person: name and profile photo at the top (or initials); any photo in the
 *           file can be made their profile photo, or upload one with "Use as their profile photo".
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { shrinkPhoto } from "@/lib/upload-photos";

type File_ = { id: string; bucket?: string; path?: string; group: "Documents" | "Photos"; title: string; detail: string; at: string; url?: string | null; isImage: boolean; removable: boolean; fileId?: string; job?: { id: string; ref: string } | null; status?: string | null };
const KINDS: [string, string][] = [["id", "Photo ID"], ["contract", "Contract / agreement"], ["resume", "Résumé"], ["photo", "Photo"], ["insurance", "Insurance"], ["license", "License"],
  ["tax", "Tax form (W-9, 1099)"], ["receipt", "Receipt"], ["invoice", "Invoice"], ["certification", "Certification"], ["correspondence", "Letter / email"], ["other", "Other"]];

export function PersonFiles({ type, ownerKey, title = "Files" }: { type: "customer" | "pro" | "staff" | "partner" | "business"; ownerKey: string; title?: string }) {
  const [files, setFiles] = useState<File_[] | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"Documents" | "Photos">("Documents");
  const [owner, setOwner] = useState<{ name: string; sub: string } | null>(null);
  const [profile, setProfile] = useState<{ url: string; id: string | null; chosen: boolean } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch(`/api/hub/files?type=${type}&key=${encodeURIComponent(ownerKey)}`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setErr(j.error ?? "Couldn't load the files"); return; }
    setFiles(j.files ?? []); setOwner(j.owner ?? null); setProfile(j.profile ?? null); setErr("");
  }, [type, ownerKey]);
  useEffect(() => { load(); }, [load]);

  async function add(form: HTMLFormElement) {
    const input = form.querySelector<HTMLInputElement>('input[type="file"]');
    const picked = input?.files?.[0];
    if (!picked) return;
    const fd = new FormData(form);
    setBusy(true); setMsg(null);
    try {
      const file = await shrinkPhoto(picked, 2400);
      const call = (body: object) => fetch("/api/hub/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, key: ownerKey, ...body }) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }));
      const t = await call({ action: "ticket", name: file.name, mime: file.type, size: file.size });
      if (!t.ok) return setMsg({ ok: false, text: t.j.error ?? "Upload failed" });
      const { error } = await browserClient().storage.from("person-files").uploadToSignedUrl(String(t.j.path), String(t.j.token), file, { contentType: String(t.j.type || file.type) });
      if (error) return setMsg({ ok: false, text: `Upload failed: ${error.message}` });
      const asProfile = fd.get("as_profile") === "on" && /^image\/(jpeg|png|webp)$/.test(file.type);
      const s = await call({ action: "save", path: t.j.path, kind: asProfile ? "photo" : String(fd.get("kind") ?? "other"), label: String(fd.get("label") ?? "") || (asProfile ? "Profile photo" : undefined) });
      if (!s.ok) return setMsg({ ok: false, text: s.j.error ?? "Couldn't save" });
      if (asProfile) {
        const pr = await call({ action: "profile", file_id: `file:${s.j.id}` });
        if (!pr.ok) { setMsg({ ok: false, text: `Saved to the file, but not set as the profile photo: ${pr.j.error ?? "try “Make profile photo”"}` }); form.reset(); await load(); return; }
      }
      setMsg({ ok: true, text: asProfile ? `Profile photo set ✓` : `Saved ✓ · ${picked.name}` });
      form.reset();
      await load();
    } catch {
      setMsg({ ok: false, text: "Couldn't reach Handled — check your connection and try again" });
    } finally {
      setBusy(false);
    }
  }
  async function makeProfile(fileId: string | null) {
    setMsg(null);
    const r = await fetch("/api/hub/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fileId ? { action: "profile", type, key: ownerKey, file_id: fileId } : { action: "profile_clear", type, key: ownerKey }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setMsg({ ok: false, text: j.error ?? "Couldn't set the profile photo" });
    else setMsg({ ok: true, text: fileId ? "Profile photo set ✓" : "Profile photo removed" });
    await load();
  }
  async function hide(id: string) {
    if (!confirm("Remove this file from their file? (It's kept, just hidden.)")) return;
    await fetch("/api/hub/files", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "hide", id }) });
    await load();
  }

  const list = (files ?? []).filter((f) => f.group === tab);
  const count = (g: string) => (files ?? []).filter((f) => f.group === g).length;
  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
        {profile?.url
          // eslint-disable-next-line @next/next/no-img-element
          ? <a href={profile.url} target="_blank" rel="noreferrer"><img src={profile.url} alt={owner?.name ?? "Profile photo"} className="h-20 w-20 rounded-full border-2 border-brand object-cover" /></a>
          : <div className="flex h-20 w-20 items-center justify-center rounded-full bg-paper text-2xl font-bold text-ink-soft" aria-label="No profile photo">{initials(owner?.name)}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-xl font-bold">{owner?.name ?? "…"}</div>
          {owner?.sub && <div className="text-sm text-ink-soft">{owner.sub}</div>}
          <div className="mt-1 text-xs text-ink-soft">
            {profile?.url ? (profile.chosen ? <>Profile photo · <button type="button" className="underline" onClick={() => makeProfile(null)}>remove</button></> : "Profile photo from their onboarding") : "No profile photo yet — add one below, or pick one under Photos"}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex gap-1 text-sm">{(["Documents", "Photos"] as const).map((g) => (
          <button key={g} type="button" onClick={() => setTab(g)} className={`rounded-full px-3 py-1 ${tab === g ? "bg-brand text-white" : "bg-paper"}`}>{g} ({count(g)})</button>
        ))}</div>
      </div>
      {err && <p className="text-sm text-red-700">{err}</p>}
      {!files && !err && <p className="text-sm text-ink-soft">Loading…</p>}
      {files && !list.length && <p className="text-sm text-ink-soft">No {tab.toLowerCase()} yet.</p>}
      {tab === "Photos" ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {list.map((f) => (
            <figure key={f.id} className="text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={f.url ?? "#"} target="_blank" rel="noreferrer"><img src={f.url ?? ""} alt={f.title} loading="lazy" className="aspect-square w-full rounded-lg object-cover bg-paper" /></a>
              <figcaption className="mt-1 truncate" title={`${f.title} · ${f.detail}`}>{f.job ? <a className="underline" href={`/hub/jobs/${f.job.id}`}>{f.job.ref}</a> : f.title} · {f.at.slice(0, 10)}</figcaption>
              {profile?.id && f.bucket && profile.id === `${f.bucket}:${f.path}`
                ? <div className="font-semibold text-brand">★ Profile photo</div>
                : !/\.hei[cf]$/i.test(f.path ?? "") && <button type="button" className="block text-brand underline" onClick={() => makeProfile(f.id)}>Make profile photo</button>}
              {f.removable && f.fileId && <button type="button" className="text-ink-soft underline" onClick={() => hide(f.fileId!)}>remove</button>}
            </figure>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {list.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div><b>{f.title}</b>{f.job && <> · <a className="underline" href={`/hub/jobs/${f.job.id}`}>{f.job.ref}</a></>}<div className="text-xs text-ink-soft">{f.detail} · {f.at.slice(0, 10)}</div></div>
              <div className="flex gap-3 text-xs">{f.url ? <a className="underline" href={f.url} target="_blank" rel="noreferrer">Open</a> : <span className="text-ink-soft">file missing</span>}{f.removable && f.fileId && <button type="button" className="text-ink-soft underline" onClick={() => hide(f.fileId!)}>remove</button>}</div>
            </li>
          ))}
        </ul>
      )}
      <form className="flex flex-wrap items-end gap-2 border-t border-line pt-3" onSubmit={(e) => { e.preventDefault(); add(e.currentTarget); }}>
        <div><label className="label">Add a file</label><input className="input" name="file" type="file" required accept="application/pdf,image/*,.doc,.docx,.txt" /></div>
        <div><label className="label">Type</label><select className="input" name="kind" defaultValue="other">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div className="min-w-40 flex-1"><label className="label">Name (optional)</label><input className="input" name="label" maxLength={200} placeholder="e.g. Driver's license, signed SOW" /></div>
        <label className="flex items-center gap-1 pb-2 text-sm"><input type="checkbox" name="as_profile" /> Use as their profile photo</label>
        <button className="btn-primary" disabled={busy}>{busy ? "Uploading…" : "Add to file"}</button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-brand-dark" : "text-red-700"}`}>{msg.text}</span>}
      </form>
    </section>
  );
}

const initials = (name?: string | null) => (name ?? "").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
