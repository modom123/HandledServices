"use client";
/*
 * FILE    : apps/web/components/OfficeDocuments.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_2100 UTC
 * PURPOSE : Front Office documents (owner, 2026-11-25): upload a document in the office and choose which team members can
 *           view it (open and read) or have full access (also download, share, rename, remove). The same list, without
 *           the upload box, is Hub → Front Office → Documents for everyone on the team ("Shared with me").
 *             <OfficeDocuments office="odom" />   an office's documents + upload (admins)
 *             <OfficeDocuments mine focus={id} /> what this person can open
 *           API: /api/hub/office-docs (lib/office-docs.ts). The browser sends the file straight to storage (signed upload).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";

type Level = "view" | "full";
type Member = { id: string; name: string; email: string; role: string };
type Access = { profile_id: string; name: string; level: Level; last_opened_at: string | null };
type Doc = { id: string; office: string; title: string; folder: string | null; note: string | null; file_name: string | null; content_type: string | null; size_bytes: number | null;
  uploaded_by_name: string | null; created_at: string; access: Access[]; myLevel: Level };
type Ev = { action: string; actor: string | null; note: string | null; created_at: string };

const OFFICE_NAME: Record<string, string> = { odom: "Mark Odom's office", gulley: "Cecilia Gulley's office" };
const LEVEL_LABEL: Record<Level, string> = { view: "View only", full: "Full access" };
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Detroit", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const size = (n: number | null) => (n == null ? "" : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const icon = (t: string | null) => (!t ? "📄" : t.startsWith("image/") ? "🖼️" : t.includes("pdf") ? "📕" : /sheet|excel|csv/.test(t) ? "📊" : /presentation|powerpoint/.test(t) ? "📽️" : /word/.test(t) ? "📝" : "📄");
const post = (body: object) => fetch("/api/hub/office-docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, j: { error: "Couldn't reach Handled: check your connection" } }));

/** Pick team members and a level for each: used when uploading and when sharing an existing document. */
function SharePicker({ team, value, onChange, exclude = [] }: { team: Member[]; value: Record<string, Level>; onChange: (v: Record<string, Level>) => void; exclude?: string[] }) {
  const people = team.filter((t) => !exclude.includes(t.id));
  if (!people.length) return <p className="text-xs text-ink-soft">Everyone on the team already has access. Add people in Hub → Team.</p>;
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line p-2">
      {people.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(value[t.id])} onChange={(e) => { const n = { ...value }; if (e.target.checked) n[t.id] = "view"; else delete n[t.id]; onChange(n); }} />
            {t.name} <span className="text-xs text-ink-soft">{t.role}</span></label>
          {value[t.id] && <select className="input w-auto py-0.5 text-xs" value={value[t.id]} onChange={(e) => onChange({ ...value, [t.id]: e.target.value as Level })}>
            <option value="view">View only</option><option value="full">Full access</option></select>}
        </div>
      ))}
    </div>
  );
}

function DocRow({ d, team, reload, focus }: { d: Doc; team: Member[]; reload: () => void; focus: boolean }) {
  const [open, setOpen] = useState(focus);
  const [adding, setAdding] = useState<Record<string, Level>>({});
  const [msg, setMsg] = useState("");
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [edit, setEdit] = useState<{ title: string; folder: string; note: string } | null>(null);
  const full = d.myLevel === "full";
  const go = async (download: boolean) => {
    setMsg("");
    const w = download ? null : window.open("", "_blank");
    const r = await post({ action: "open", id: d.id, download });
    if (!r.ok) { w?.close(); return setMsg(String(r.j.error ?? "Couldn't open it")); }
    if (w) w.location.href = String(r.j.url); else window.location.href = String(r.j.url);
  };
  const act = async (body: object, done = "Saved") => { setMsg("…"); const r = await post({ id: d.id, ...body }); setMsg(r.ok ? done : String(r.j.error ?? "Failed")); if (r.ok) reload(); return r.ok; };
  return (
    <li id={`doc-${d.id}`} className={`py-2 ${focus ? "rounded bg-brand-tint px-2" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(!open)}>
          <div className="font-semibold">{icon(d.content_type)} {d.title} {d.folder && <span className="ml-1 rounded-full bg-paper px-2 py-0.5 text-xs font-normal">{d.folder}</span>}</div>
          <div className="text-xs text-ink-soft">{OFFICE_NAME[d.office] ?? d.office} · {d.uploaded_by_name ?? "someone"} · {when(d.created_at)}{d.size_bytes ? ` · ${size(d.size_bytes)}` : ""} · {d.access.length ? `shared with ${d.access.length}` : "admins only"}{!full ? " · you: view only" : ""}</div>
        </button>
        <div className="flex gap-1">
          <button className="btn-ghost text-xs" onClick={() => go(false)}>Open</button>
          {full && <button className="btn-ghost text-xs" onClick={() => go(true)}>Download</button>}
        </div>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-line p-3 text-sm">
          {d.note && <p className="whitespace-pre-wrap text-ink-soft">{d.note}</p>}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Who can see it</div>
            <ul className="mt-1 space-y-1">
              <li className="text-xs text-ink-soft">Admins and the person who uploaded it: always full access.</li>
              {d.access.map((a) => (
                <li key={a.profile_id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{a.name} <span className="text-xs text-ink-soft">{a.last_opened_at ? `opened ${when(a.last_opened_at)}` : "not opened yet"}</span></span>
                  {full ? (
                    <span className="flex items-center gap-1">
                      <select className="input w-auto py-0.5 text-xs" value={a.level} onChange={(e) => act({ action: "share", profile_id: a.profile_id, level: e.target.value })}>
                        <option value="view">View only</option><option value="full">Full access</option></select>
                      <button className="text-xs text-rose-700 underline" onClick={() => act({ action: "unshare", profile_id: a.profile_id }, "Access removed")}>Remove</button>
                    </span>
                  ) : <span className="text-xs">{LEVEL_LABEL[a.level]}</span>}
                </li>
              ))}
            </ul>
          </div>
          {full && (
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Share with more of the team</div>
                <SharePicker team={team} value={adding} onChange={setAdding} exclude={d.access.map((a) => a.profile_id)} />
                {Object.keys(adding).length > 0 && <button className="btn-primary mt-1 text-xs" onClick={async () => {
                  let ok = true;
                  for (const [pid, level] of Object.entries(adding)) ok = (await post({ action: "share", id: d.id, profile_id: pid, level })).ok && ok;
                  setAdding({}); setMsg(ok ? "Shared: they got an email with a link" : "Some couldn't be shared"); reload();
                }}>Share ({Object.keys(adding).length})</button>}
              </div>
              {edit ? (
                <div className="space-y-1">
                  <input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Title" />
                  <input className="input" value={edit.folder} onChange={(e) => setEdit({ ...edit, folder: e.target.value })} placeholder="Folder (optional)" />
                  <textarea className="input h-16" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Note (optional)" />
                  <div className="flex gap-2"><button className="btn-primary text-xs" onClick={async () => { if (await act({ action: "edit", ...edit })) setEdit(null); }}>Save</button><button className="btn-ghost text-xs" onClick={() => setEdit(null)}>Cancel</button></div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 text-xs">
                  <button className="underline" onClick={() => setEdit({ title: d.title, folder: d.folder ?? "", note: d.note ?? "" })}>Rename / edit</button>
                  <button className="underline" onClick={async () => { const r = await fetch(`/api/hub/office-docs?history=${d.id}`).then((x) => x.json()).catch(() => ({})); setEvents(r.events ?? []); }}>History</button>
                  <button className="text-rose-700 underline" onClick={() => { if (confirm(`Remove "${d.title}"? Everyone loses access. (It's kept and can be restored.)`)) act({ action: "remove" }, "Removed"); }}>Remove</button>
                </div>
              )}
              {events && <ul className="space-y-0.5 text-xs text-ink-soft">{events.map((e, i) => <li key={i}>{when(e.created_at)} · {e.actor ?? ""} {e.action.replace(/_/g, " ")}{e.note ? `: ${e.note}` : ""}</li>)}{!events.length && <li>No history yet.</li>}</ul>}
            </>
          )}
          {msg && <p className="text-xs text-ink-soft">{msg}</p>}
        </div>
      )}
    </li>
  );
}

export function OfficeDocuments({ office, mine, focus }: { office?: string; mine?: boolean; focus?: string | null }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("");
  const [uploading, setUploading] = useState(false);
  const [share, setShare] = useState<Record<string, Level>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/hub/office-docs?${office ? `office=${office}` : "mine=1"}`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setErr(j.error ?? "Couldn't load the documents"); setDocs([]); return; }
    setDocs(j.docs ?? []); setTeam(j.team ?? []); setErr(j.error ?? "");
  }, [office]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (focus && docs?.length) document.getElementById(`doc-${focus}`)?.scrollIntoView({ block: "center" }); }, [focus, docs]);
  const folders = useMemo(() => [...new Set((docs ?? []).map((d) => d.folder).filter(Boolean) as string[])].sort(), [docs]);
  const shown = (docs ?? []).filter((d) => (!folder || d.folder === folder) && (!q || `${d.title} ${d.folder ?? ""} ${d.note ?? ""} ${d.file_name ?? ""}`.toLowerCase().includes(q.toLowerCase())));

  async function upload(form: HTMLFormElement) {
    const file = form.querySelector<HTMLInputElement>('input[type="file"]')?.files?.[0];
    if (!file || !office) return;
    const fd = new FormData(form);
    setUploading(true); setMsg(null);
    try {
      const t = await post({ action: "ticket", office, name: file.name, mime: file.type, size: file.size });
      if (!t.ok) return setMsg({ ok: false, text: String(t.j.error ?? "Upload failed") });
      const { error } = await browserClient().storage.from("office-docs").uploadToSignedUrl(String(t.j.path), String(t.j.token), file, { contentType: String(t.j.type || file.type) });
      if (error) return setMsg({ ok: false, text: `Upload failed: ${error.message}` });
      const s = await post({ action: "save", office, path: t.j.path, file_name: file.name, title: String(fd.get("title") || file.name.replace(/\.[^.]+$/, "")),
        folder: String(fd.get("folder") || "") || undefined, note: String(fd.get("note") || "") || undefined, share: Object.entries(share).map(([profile_id, level]) => ({ profile_id, level })) });
      if (!s.ok) return setMsg({ ok: false, text: String(s.j.error ?? "Couldn't save it") });
      const n = Object.keys(share).length;
      setMsg({ ok: true, text: `Uploaded ✓ ${n ? `· shared with ${n} (they got an email)` : "· admins only until you share it"}` });
      form.reset(); setShare({}); setShowUpload(false); load();
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-3">
      {office && (
        showUpload ? (
          <form className="space-y-2 rounded-lg border border-line p-3 text-sm" onSubmit={(e) => { e.preventDefault(); upload(e.currentTarget); }}>
            <input type="file" required className="block w-full text-sm" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*" />
            <div className="grid gap-2 sm:grid-cols-2">
              <input name="title" className="input" placeholder="Title (defaults to the file name)" maxLength={200} />
              <input name="folder" className="input" placeholder="Folder, e.g. Contracts, HR, Finance (optional)" maxLength={80} list={`folders-${office}`} />
              <datalist id={`folders-${office}`}>{folders.map((f) => <option key={f} value={f} />)}</datalist>
            </div>
            <textarea name="note" className="input h-16" placeholder="Note for the people you share it with (optional)" maxLength={2000} />
            <div>
              <div className="text-xs font-semibold">Who can see it <span className="font-normal text-ink-soft">(admins always can; nobody else unless you pick them)</span></div>
              <SharePicker team={team} value={share} onChange={setShare} />
            </div>
            <div className="flex gap-2"><button className="btn-primary" disabled={uploading}>{uploading ? "Uploading…" : "Upload"}</button><button type="button" className="btn-ghost" onClick={() => setShowUpload(false)}>Cancel</button></div>
          </form>
        ) : <button className="btn-primary text-sm" onClick={() => { setShowUpload(true); setMsg(null); }}>⬆️ Upload a document</button>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-rose-700"}`}>{msg.text}</p>}
      {err && <p className="text-sm text-amber-800">{err}</p>}
      {(docs?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <input className="input w-auto flex-1" placeholder="Search documents" value={q} onChange={(e) => setQ(e.target.value)} />
          {folders.length > 0 && <select className="input w-auto" value={folder} onChange={(e) => setFolder(e.target.value)}><option value="">All folders</option>{folders.map((f) => <option key={f}>{f}</option>)}</select>}
        </div>
      )}
      {docs === null ? <p className="text-sm text-ink-soft">Loading…</p> : (
        <ul className="divide-y divide-line">
          {shown.map((d) => <DocRow key={d.id} d={d} team={team} reload={load} focus={focus === d.id} />)}
          {!shown.length && <li className="py-2 text-sm text-ink-soft">{docs.length ? "No documents match." : mine ? "Nothing has been shared with you yet." : "No documents yet. Upload one and choose who on the team can see it."}</li>}
        </ul>
      )}
    </div>
  );
}
