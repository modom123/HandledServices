/*
 * FILE    : apps/web/lib/office-docs.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_2100 UTC
 * PURPOSE : Front Office documents (owner, 2026-11-25: upload documents in the office and assign team members to view
 *           them or have access to them). Tables in supabase/setup/RUN_ONCE_OFFICE_DOCUMENTS_2026-11-25_2100.sql.
 *             Who sees a document
 *               • admins (the offices are admin pages): every document, full access
 *               • whoever uploaded it: full access
 *               • a team member it's shared with: "view" (open and read it) or "full" (also download it, share it with
 *                 others, change who has access, rename and remove it)
 *               • nobody else (dispatchers see only what's shared with them, in Hub → Front Office → Documents)
 *             docTicket()   one-time signed upload (the browser sends the file straight to storage, up to 50 MB)
 *             saveDoc()     records it after checking the file is really there; shares it with the people picked
 *             listOfficeDocs() / listSharedWith() / docTeam()
 *             shareDoc() / unshareDoc() / renameDoc() / removeDoc()  (full access only; a share emails the person)
 *             openDoc()     a 5-minute link, after the access check; "view" opens it in the browser, "full" can download
 *           Every step is kept in office_document_events (who opened what, and when).
 */
import "server-only";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { docType } from "./photos";
import { OFFICES, officeBySlug } from "./offices";
import type { Viewer } from "./auth";

export type DocLevel = "view" | "full";
export interface TeamMember { id: string; name: string; email: string; role: string }
export interface DocAccess { profile_id: string; name: string; level: DocLevel; last_opened_at: string | null }
export interface OfficeDoc {
  id: string; office: string; title: string; folder: string | null; note: string | null; file_name: string | null; content_type: string | null;
  size_bytes: number | null; uploaded_by: string | null; uploaded_by_name: string | null; created_at: string;
  access: DocAccess[]; myLevel: DocLevel;
}

const BUCKET = "office-docs";
const db = () => adminClient();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OK_TYPES: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "text/plain": "txt", "text/csv": "csv",
  "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};
const who = (v: Viewer) => v.fullName || v.email;
const notSetUp = (m: string) => (/relation|schema cache|does not exist|bucket/i.test(m) ? "Office documents aren't set up yet: run supabase/setup/RUN_ONCE_OFFICE_DOCUMENTS_2026-11-25_2100.sql in Supabase." : m);

async function log(documentId: string, action: string, actor: string, note?: string | null) {
  await db().from("office_document_events").insert({ document_id: documentId, action, actor, note: note ?? null }).then(() => null, () => null);
}

/** Everyone with Hub access (admins and dispatchers): the people a document can be shared with. */
export async function docTeam(): Promise<TeamMember[]> {
  const { data } = await db().from("profiles").select("id, full_name, email, role").in("role", ["admin", "dispatcher"]).order("full_name");
  return ((data ?? []) as { id: string; full_name: string | null; email: string; role: string }[]).map((p) => ({ id: p.id, name: p.full_name || p.email, email: p.email, role: p.role }));
}

/** This viewer's access to one document: "full", "view" or null (none). */
async function levelFor(v: Viewer, doc: { id: string; uploaded_by: string | null }): Promise<DocLevel | null> {
  if (v.role === "admin" || doc.uploaded_by === v.userId) return "full";
  const { data } = await db().from("office_document_access").select("level").eq("document_id", doc.id).eq("profile_id", v.userId).maybeSingle();
  return (data?.level as DocLevel | undefined) ?? null;
}

async function loadDoc(id: string) {
  if (!UUID.test(id)) return null;
  const { data } = await db().from("office_documents").select("*").eq("id", id).is("removed_at", null).maybeSingle();
  return data as (Omit<OfficeDoc, "access" | "myLevel"> & { path: string }) | null;
}

/** Attach each document's access list (names) and this viewer's level. */
async function withAccess(v: Viewer, rows: (Omit<OfficeDoc, "access" | "myLevel"> & { path?: string })[]): Promise<OfficeDoc[]> {
  if (!rows.length) return [];
  const [{ data: acc }, team] = await Promise.all([
    db().from("office_document_access").select("document_id, profile_id, level, last_opened_at").in("document_id", rows.map((r) => r.id)),
    docTeam(),
  ]);
  const names = new Map(team.map((t) => [t.id, t.name]));
  const by = new Map<string, DocAccess[]>();
  for (const a of (acc ?? []) as { document_id: string; profile_id: string; level: DocLevel; last_opened_at: string | null }[])
    by.set(a.document_id, [...(by.get(a.document_id) ?? []), { profile_id: a.profile_id, name: names.get(a.profile_id) ?? "Former team member", level: a.level, last_opened_at: a.last_opened_at }]);
  return rows.map(({ path: _p, ...r }) => {
    const access = by.get(r.id) ?? [];
    const mine = access.find((a) => a.profile_id === v.userId)?.level ?? null;
    const myLevel: DocLevel = v.role === "admin" || r.uploaded_by === v.userId ? "full" : mine ?? "view";
    return { ...r, access, myLevel };
  });
}

/** An office's documents (the office page: admins only), newest first. */
export async function listOfficeDocs(v: Viewer, office: string): Promise<{ docs: OfficeDoc[]; error: string | null }> {
  if (!officeBySlug(office)) return { docs: [], error: "Unknown office" };
  const { data, error } = await db().from("office_documents").select("*").eq("office", office).is("removed_at", null).order("created_at", { ascending: false }).limit(500);
  if (error) return { docs: [], error: notSetUp(error.message) };
  return { docs: await withAccess(v, data ?? []), error: null };
}

/** Documents this person can open: everything for admins; otherwise what they uploaded or what's shared with them. */
export async function listSharedWith(v: Viewer): Promise<{ docs: OfficeDoc[]; error: string | null }> {
  if (v.role === "admin") {
    const { data, error } = await db().from("office_documents").select("*").is("removed_at", null).order("created_at", { ascending: false }).limit(500);
    return error ? { docs: [], error: notSetUp(error.message) } : { docs: await withAccess(v, data ?? []), error: null };
  }
  const { data: acc, error } = await db().from("office_document_access").select("document_id").eq("profile_id", v.userId);
  if (error) return { docs: [], error: notSetUp(error.message) };
  const ids = ((acc ?? []) as { document_id: string }[]).map((a) => a.document_id);
  const [{ data: shared }, { data: own }] = await Promise.all([
    ids.length ? db().from("office_documents").select("*").in("id", ids).is("removed_at", null) : Promise.resolve({ data: [] }),
    db().from("office_documents").select("*").eq("uploaded_by", v.userId).is("removed_at", null),
  ]);
  const seen = new Set<string>();
  const rows = [...(shared ?? []), ...(own ?? [])].filter((r: { id: string }) => !seen.has(r.id) && seen.add(r.id))
    .sort((a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at));
  return { docs: await withAccess(v, rows), error: null };
}

/** One-time signed upload into the office's folder. */
export async function docTicket(office: string, name: string, rawType: string, size: number): Promise<{ path: string; token: string; type: string }> {
  if (!officeBySlug(office)) throw new Error("Unknown office");
  const type = docType(name, rawType);
  const ext = OK_TYPES[type];
  if (!ext) throw new Error("Upload a PDF, Word, Excel, PowerPoint, text or CSV file, or a photo");
  if (!size) throw new Error("That file is empty");
  if (size > 50 * 1024 * 1024) throw new Error("Files must be under 50 MB");
  const path = `${office}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(notSetUp(error?.message ?? "no upload link"));
  return { path, token: data.token, type };
}

/** Record an uploaded document (after checking it's in this office's folder and really in storage) and share it. */
export async function saveDoc(v: Viewer, d: { office: string; path: string; title: string; fileName?: string | null; folder?: string | null; note?: string | null; share?: { profile_id: string; level: DocLevel }[] }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!officeBySlug(d.office)) return { ok: false, error: "Unknown office" };
  const name = d.path.startsWith(`${d.office}/`) ? d.path.slice(d.office.length + 1) : "";
  if (!/^[\w-]+\.[a-z]{3,4}$/.test(name)) return { ok: false, error: "That upload doesn't belong to this office" };
  const { data: found } = await db().storage.from(BUCKET).list(d.office, { search: name, limit: 1 });
  const obj = found?.find((x) => x.name === name);
  if (!obj) return { ok: false, error: "We couldn't find the upload: choose the file again" };
  const meta = (obj.metadata ?? {}) as { mimetype?: string; size?: number };
  const { data, error } = await db().from("office_documents").insert({
    office: d.office, title: d.title.trim().slice(0, 200) || d.fileName?.slice(0, 200) || "Document", folder: d.folder?.trim().slice(0, 80) || null,
    note: d.note?.trim().slice(0, 2000) || null, path: d.path, file_name: d.fileName?.slice(0, 240) ?? null, content_type: meta.mimetype ?? null,
    size_bytes: meta.size ?? null, uploaded_by: v.userId, uploaded_by_name: who(v),
  }).select("id").single();
  if (error) { await db().storage.from(BUCKET).remove([d.path]).catch(() => null); return { ok: false, error: notSetUp(error.message) }; }
  const id = String(data.id);
  await log(id, "uploaded", who(v), d.title);
  for (const s of d.share ?? []) await shareDoc(v, id, s.profile_id, s.level).catch(() => null);
  return { ok: true, id };
}

async function needFull(v: Viewer, id: string) {
  const doc = await loadDoc(id);
  if (!doc) throw new Error("Document not found");
  if ((await levelFor(v, doc)) !== "full") throw new Error("You can view this document but not change it. Ask whoever shared it for full access.");
  return doc;
}

/** Share with a team member (or change their level). They get an email with a link. */
export async function shareDoc(v: Viewer, id: string, profileId: string, level: DocLevel): Promise<{ ok: true }> {
  const doc = await needFull(v, id);
  const person = (await docTeam()).find((t) => t.id === profileId);
  if (!person) throw new Error("Only people on the team (Hub → Team) can be given access");
  const { data: had } = await db().from("office_document_access").select("level").eq("document_id", id).eq("profile_id", profileId).maybeSingle();
  const { error } = await db().from("office_document_access").upsert({ document_id: id, profile_id: profileId, level, granted_by: who(v), granted_at: new Date().toISOString() }, { onConflict: "document_id,profile_id" });
  if (error) throw new Error(notSetUp(error.message));
  await log(id, had ? "access_changed" : "shared", who(v), `${person.name}: ${level === "full" ? "full access" : "view only"}`);
  if (!had && person.id !== v.userId) {
    const office = OFFICES.find((o) => o.slug === doc.office);
    await sendEmail(person.email, `${who(v)} shared a document with you: ${doc.title}`,
      `Hi ${person.name.split(" ")[0]},\n\n${who(v)} shared "${doc.title}"${office ? ` from ${office.name}'s office` : ""} with you (${level === "full" ? "full access: you can download it and share it" : "view only"}).${doc.note ? `\n\nNote: ${doc.note}` : ""}\n\nOpen it in the Hub: ${siteUrl()}/hub/documents?doc=${id}\n\n— Handled`).catch(() => false);
  }
  return { ok: true };
}

export async function unshareDoc(v: Viewer, id: string, profileId: string): Promise<{ ok: true }> {
  await needFull(v, id);
  await db().from("office_document_access").delete().eq("document_id", id).eq("profile_id", profileId);
  const person = (await docTeam()).find((t) => t.id === profileId);
  await log(id, "unshared", who(v), person?.name ?? profileId);
  return { ok: true };
}

export async function renameDoc(v: Viewer, id: string, f: { title?: string; folder?: string | null; note?: string | null }): Promise<{ ok: true }> {
  await needFull(v, id);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (f.title?.trim()) patch.title = f.title.trim().slice(0, 200);
  if (f.folder !== undefined) patch.folder = f.folder?.trim().slice(0, 80) || null;
  if (f.note !== undefined) patch.note = f.note?.trim().slice(0, 2000) || null;
  await db().from("office_documents").update(patch).eq("id", id);
  await log(id, "edited", who(v), f.title ?? null);
  return { ok: true };
}

/** Remove from the office (the file is kept in storage and the row kept, so it can be restored in the database). */
export async function removeDoc(v: Viewer, id: string): Promise<{ ok: true }> {
  await needFull(v, id);
  await db().from("office_documents").update({ removed_at: new Date().toISOString(), removed_by: who(v) }).eq("id", id);
  await log(id, "removed", who(v));
  return { ok: true };
}

/** A 5-minute link after the access check. View-only opens in the browser; full access may download. */
export async function openDoc(v: Viewer, id: string, download = false): Promise<{ url: string }> {
  const doc = await loadDoc(id);
  if (!doc) throw new Error("Document not found");
  const level = await levelFor(v, doc);
  if (!level) throw new Error("This document hasn't been shared with you");
  const dl = download && level === "full";
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(doc.path, 300, dl ? { download: doc.file_name || doc.title } : undefined);
  if (error || !data) throw new Error(notSetUp(error?.message ?? "no link"));
  await log(id, dl ? "downloaded" : "opened", who(v));
  if (v.role !== "admin" && doc.uploaded_by !== v.userId)
    await db().from("office_document_access").update({ last_opened_at: new Date().toISOString() }).eq("document_id", id).eq("profile_id", v.userId);
  return { url: data.signedUrl };
}

/** A document's history (full access only). */
export async function docHistory(v: Viewer, id: string) {
  await needFull(v, id);
  const { data } = await db().from("office_document_events").select("action, actor, note, created_at").eq("document_id", id).order("created_at", { ascending: false }).limit(100);
  return (data ?? []) as { action: string; actor: string | null; note: string | null; created_at: string }[];
}
