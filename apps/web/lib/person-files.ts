/*
 * FILE    : apps/web/lib/person-files.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-05_0000 UTC
 * PURPOSE : Universal person files — one place to pull up every upload that belongs to a person, whoever uploaded it.
 *           Owners: customer (lower-case email) · pro (contractor id) · staff (profile id) · partner (referral partner
 *           id) · business (business account id). listPersonFiles() gathers, newest first:
 *             files added to the person's file   person_files (bucket person-files) — staff uploads, or the person's own
 *             pro                                onboarding documents (W-9, insurance, license, coverage, résumé, photo,
 *                                                agreement), the résumé from their application, job-completion photos,
 *                                                expense receipts
 *             customer                           photos they sent with bookings and quote requests, completion photos of
 *                                                their jobs
 *             partner                            photos on their referral tickets
 *             business                           photos on the account's jobs
 *           Every item carries a short-lived signed link (private buckets; links expire). Staff add files with
 *           fileTicket() (one-time signed upload, the browser sends the file straight to storage — no 4.5 MB limit)
 *           then saveFile(), which checks the file is really there; hideFile() hides one (nothing is destroyed).
 */
import "server-only";
import { getService } from "@handled/core";
import { adminClient } from "./supabase/server";
import { docType } from "./photos";

export const OWNER_TYPES = ["customer", "pro", "staff", "partner", "business"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];
export interface Owner { type: OwnerType; key: string }

export const FILE_KINDS = ["id", "contract", "resume", "photo", "insurance", "license", "tax", "receipt", "invoice", "certification", "correspondence", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];
export const FILE_KIND_LABEL: Record<FileKind, string> = {
  id: "Photo ID", contract: "Contract / agreement", resume: "Résumé", photo: "Photo", insurance: "Insurance", license: "License",
  tax: "Tax form (W-9, 1099)", receipt: "Receipt", invoice: "Invoice", certification: "Certification", correspondence: "Letter / email", other: "Other",
};

export interface PersonFile {
  id: string;               // unique in the list (source:id)
  source: "file" | "pro_doc" | "application" | "job_photo" | "completion_photo" | "receipt" | "quote_photo" | "ticket_photo";
  group: "Documents" | "Photos";
  title: string;
  detail: string;
  bucket: string;
  path: string;
  at: string;
  job?: { id: string; ref: string } | null;
  status?: string | null;
  url?: string | null;
  isImage: boolean;
  removable: boolean;       // only files added to the person's file can be hidden here
  fileId?: string;          // person_files.id
}

const db = () => adminClient();
const isImg = (p: string) => /\.(jpe?g|png|webp|heic|gif)$/i.test(p);
const svc = (slug: string | null | undefined) => (slug ? getService(slug)?.name ?? slug : "Job");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Normalize and check an owner (emails lower-cased, ids must be ids). */
export function parseOwner(type: string, key: string): Owner | null {
  if (!(OWNER_TYPES as readonly string[]).includes(type)) return null;
  const k = key.trim();
  if (type === "customer") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k) ? { type: "customer", key: k.toLowerCase() } : null;
  return UUID.test(k) ? { type: type as OwnerType, key: k.toLowerCase() } : null;
}

/** Who the owner is (name and a link to their Hub page), or null when nobody matches. */
export async function describeOwner(o: Owner): Promise<{ name: string; sub: string; href: string | null } | null> {
  if (o.type === "pro") {
    const { data } = await db().from("contractors").select("business_name, contact_name, email").eq("id", o.key).maybeSingle();
    return data ? { name: data.business_name ?? data.contact_name, sub: `Pro · ${data.email}`, href: `/hub/pros/${o.key}` } : null;
  }
  if (o.type === "staff") {
    const { data } = await db().from("profiles").select("full_name, email, role").eq("id", o.key).maybeSingle();
    return data ? { name: data.full_name ?? data.email, sub: `${data.role === "admin" ? "Admin" : data.role === "dispatcher" ? "Dispatcher" : "Staff"} · ${data.email}`, href: "/hub/team" } : null;
  }
  if (o.type === "partner") {
    const { data } = await db().from("referral_partners").select("name, email").eq("id", o.key).maybeSingle();
    return data ? { name: data.name, sub: `Referral partner · ${data.email}`, href: "/hub/partners" } : null;
  }
  if (o.type === "business") {
    const { data } = await db().from("business_accounts").select("company, contact_name, email").eq("id", o.key).maybeSingle();
    return data ? { name: data.company, sub: `Business account · ${data.contact_name} · ${data.email}`, href: `/hub/business/${o.key}` } : null;
  }
  const pattern = o.key.replace(/[\\%_]/g, (c) => `\\${c}`);
  const [{ data: p }, { data: j }] = await Promise.all([
    db().from("profiles").select("full_name").ilike("email", pattern).maybeSingle(),
    db().from("jobs").select("contact_name, company_name").ilike("contact_email", pattern).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!p && !j) return null;
  return { name: j?.company_name ?? j?.contact_name ?? p?.full_name ?? o.key, sub: `Customer · ${o.key}`, href: `/hub/customers/${encodeURIComponent(o.key)}` };
}

/** Every file that belongs to the owner, newest first, with signed links (valid `seconds`). */
export async function listPersonFiles(o: Owner, seconds = 3600): Promise<PersonFile[]> {
  const out: PersonFile[] = [];
  const photos = (list: string[] | null | undefined, base: Omit<PersonFile, "id" | "path" | "isImage" | "removable" | "bucket">, source: PersonFile["source"], key: string) =>
    (list ?? []).forEach((path, i) => out.push({ ...base, source, id: `${source}:${key}:${i}`, bucket: "job-photos", path, isImage: true, removable: false }));

  // files added straight to the person's file (any owner type)
  const own = await db().from("person_files").select("*").eq("owner_type", o.type).eq("owner_key", o.key).is("deleted_at", null).order("created_at", { ascending: false }).limit(500);
  for (const f of (own.error ? [] : own.data ?? []) as Record<string, string | null>[]) {
    const kind = (f.kind ?? "other") as FileKind;
    out.push({ id: `file:${f.id}`, fileId: String(f.id), source: "file", group: kind === "photo" || isImg(String(f.path)) && kind === "other" ? "Photos" : "Documents",
      title: f.label || FILE_KIND_LABEL[kind] || "File", detail: `${FILE_KIND_LABEL[kind] ?? kind} · ${f.source === "self" ? "uploaded by them" : `added by ${f.uploaded_by_name ?? "staff"}`}`,
      bucket: "person-files", path: String(f.path), at: String(f.created_at), job: null, isImage: isImg(String(f.path)), removable: true });
  }

  if (o.type === "pro") {
    const [{ data: docs }, { data: pro }, { data: jobs }, { data: receipts }] = await Promise.all([
      db().from("contractor_documents").select("id, kind, status, storage_path, expires_on, created_at, notes").eq("contractor_id", o.key).not("storage_path", "is", null).order("created_at", { ascending: false }),
      db().from("contractors").select("application_id").eq("id", o.key).maybeSingle(),
      db().from("jobs").select("id, ref, service_slug, completion_photos, completed_at, created_at").eq("contractor_id", o.key).order("created_at", { ascending: false }).limit(200),
      db().from("job_expenses").select("id, description, amount, status, receipt_path, created_at, job_id, jobs(ref)").eq("contractor_id", o.key).order("created_at", { ascending: false }).limit(200),
    ]);
    for (const d of (docs ?? []) as Record<string, string | null>[]) {
      const kind = String(d.kind);
      out.push({ id: `pro_doc:${d.id}`, source: "pro_doc", group: kind === "photo" ? "Photos" : "Documents", title: kind === "photo" ? "Profile photo" : kind === "resume" ? "Résumé" : kind.toUpperCase().replace(/_/g, " "),
        detail: `Onboarding · ${d.status}${d.expires_on ? ` · expires ${d.expires_on}` : ""}`, status: d.status, bucket: "pro-docs", path: String(d.storage_path), at: String(d.created_at), isImage: isImg(String(d.storage_path)), removable: false });
    }
    if (pro?.application_id) {
      const { data: app } = await db().from("contractor_applications").select("resume_path, created_at").eq("id", pro.application_id).maybeSingle();
      if (app?.resume_path) out.push({ id: `application:${pro.application_id}`, source: "application", group: "Documents", title: "Résumé (from their application)", detail: "Sent with the application",
        bucket: "pro-docs", path: String(app.resume_path), at: String(app.created_at), isImage: isImg(String(app.resume_path)), removable: false });
    }
    for (const j of (jobs ?? []) as Record<string, unknown>[])
      photos(j.completion_photos as string[], { source: "completion_photo", group: "Photos", title: `Proof photo · ${j.ref}`, detail: `${svc(j.service_slug as string)} · finished work`, at: String(j.completed_at ?? j.created_at), job: { id: String(j.id), ref: String(j.ref) } }, "completion_photo", String(j.id));
    for (const r of (receipts ?? []) as Record<string, unknown>[])
      out.push({ id: `receipt:${r.id}`, source: "receipt", group: "Documents", title: `Receipt · $${Number(r.amount).toFixed(2)}`, detail: `${r.description} · ${r.status}`,
        status: String(r.status), bucket: "pro-docs", path: String(r.receipt_path), at: String(r.created_at), job: r.job_id ? { id: String(r.job_id), ref: String((r.jobs as { ref?: string } | null)?.ref ?? "job") } : null, isImage: isImg(String(r.receipt_path)), removable: false });
  }

  if (o.type === "customer" || o.type === "business") {
    let q = db().from("jobs").select("id, ref, service_slug, photos, completion_photos, created_at, completed_at").order("created_at", { ascending: false }).limit(300);
    if (o.type === "business") q = q.eq("business_account_id", o.key);
    else {
      const pattern = o.key.replace(/[\\%_]/g, (c) => `\\${c}`);
      const { data: p } = await db().from("profiles").select("id").ilike("email", pattern).maybeSingle();
      q = p ? q.or(`customer_id.eq.${p.id},contact_email.ilike.${pattern.replace(/[,()]/g, "")}`) : q.ilike("contact_email", pattern);
    }
    const { data: jobs } = await q;
    for (const j of (jobs ?? []) as Record<string, unknown>[]) {
      const job = { id: String(j.id), ref: String(j.ref) };
      photos(j.photos as string[], { source: "job_photo", group: "Photos", title: `Booking photo · ${j.ref}`, detail: `${svc(j.service_slug as string)} · sent by the customer`, at: String(j.created_at), job }, "job_photo", job.id);
      photos(j.completion_photos as string[], { source: "completion_photo", group: "Photos", title: `Finished work · ${j.ref}`, detail: `${svc(j.service_slug as string)} · pro's proof photo`, at: String(j.completed_at ?? j.created_at), job }, "completion_photo", job.id);
    }
    if (o.type === "customer") {
      const pattern = o.key.replace(/[\\%_]/g, (c) => `\\${c}`);
      const { data: quotes } = await db().from("quote_requests").select("id, service_slug, photos, created_at").ilike("contact_email", pattern).order("created_at", { ascending: false }).limit(100);
      for (const r of (quotes ?? []) as Record<string, unknown>[])
        photos(r.photos as string[], { source: "quote_photo", group: "Photos", title: "Quote request photo", detail: svc(r.service_slug as string), at: String(r.created_at), job: null }, "quote_photo", String(r.id));
    }
  }

  if (o.type === "partner") {
    const { data: tickets } = await db().from("referral_customers").select("id, ticket_no, customer_name, photos, created_at").eq("partner_id", o.key).order("created_at", { ascending: false }).limit(300);
    for (const t of (tickets ?? []) as Record<string, unknown>[])
      photos(t.photos as string[], { source: "ticket_photo", group: "Photos", title: `Ticket ${t.ticket_no ?? ""}`.trim(), detail: `Referral photo${t.customer_name ? ` · ${t.customer_name}` : ""}`, at: String(t.created_at), job: null }, "ticket_photo", String(t.id));
  }

  out.sort((a, b) => b.at.localeCompare(a.at));
  // signed links, one call per bucket
  const byBucket = new Map<string, PersonFile[]>();
  for (const f of out) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f]);
  await Promise.all([...byBucket].map(async ([bucket, list]) => {
    const { data } = await db().storage.from(bucket).createSignedUrls(list.map((f) => f.path), seconds);
    (data ?? []).forEach((d, i) => { list[i].url = d.signedUrl ?? null; });
  }));
  return out;
}

const folderOf = (o: Owner) => `${o.type}/${o.type === "customer" ? o.key.replace(/[^a-z0-9@._-]/g, "_") : o.key}`;

/** A one-time signed upload into person-files/<type>/<key>/… — the browser sends the file straight to storage. */
export async function fileTicket(o: Owner, name: string, rawType: string, size: number): Promise<{ path: string; token: string; type: string }> {
  const type = docType(name, rawType);
  const ok = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"].includes(type);
  if (!ok) throw new Error("Upload a PDF, Word document, text file or photo");
  if (!size) throw new Error("That file is empty");
  if (size > 25 * 1024 * 1024) throw new Error("Files must be under 25 MB");
  const ext = ({ "application/pdf": "pdf", "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "text/plain": "txt" } as Record<string, string>)[type] ?? type.split("/")[1];
  const path = `${folderOf(o)}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { data, error } = await db().storage.from("person-files").createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Storage isn't ready (run the person files database update): ${error?.message ?? "no upload link"}`);
  return { path, token: data.token, type };
}

/** Record an uploaded file on the person's file, after checking it's this owner's path and really in storage. */
export async function saveFile(o: Owner, f: { path: string; kind: FileKind; label?: string | null; jobId?: string | null; source: "staff" | "self"; by: { id: string; name: string } }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const folder = folderOf(o);
  const name = f.path.startsWith(`${folder}/`) ? f.path.slice(folder.length + 1) : "";
  if (!/^[\w-]+\.[a-z]{3,4}$/.test(name)) return { ok: false, error: "That upload doesn't belong to this person" };
  const { data: found } = await db().storage.from("person-files").list(folder, { search: name, limit: 1 });
  const obj = found?.find((x) => x.name === name);
  if (!obj) return { ok: false, error: "We couldn't find the upload — choose the file again" };
  const meta = (obj.metadata ?? {}) as { mimetype?: string; size?: number };
  const { data, error } = await db().from("person_files").insert({
    owner_type: o.type, owner_key: o.key, path: f.path, kind: f.kind, label: f.label?.trim().slice(0, 200) || null, job_id: f.jobId && UUID.test(f.jobId) ? f.jobId : null,
    content_type: meta.mimetype ?? null, size_bytes: meta.size ?? null, source: f.source, uploaded_by: f.by.id, uploaded_by_name: f.by.name,
  }).select("id").single();
  if (error) {
    await db().storage.from("person-files").remove([f.path]).catch(() => null);
    return { ok: false, error: /relation|schema cache/i.test(error.message) ? "Person files aren't set up yet — run the person files database update (Hub → Go-live setup)" : error.message };
  }
  return { ok: true, id: String(data.id) };
}

/** Hide a file added to a person's file (kept in storage; staff can restore it in the database). */
export async function hideFile(id: string, by: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const { error } = await db().from("person_files").update({ deleted_at: new Date().toISOString(), deleted_by: by }).eq("id", id).is("deleted_at", null);
  return !error;
}

/** Find people by name or email across customers, pros, staff, partners and business accounts (Mastermind → Files). */
export async function findPeople(q: string): Promise<{ type: OwnerType; key: string; name: string; sub: string }[]> {
  const term = q.trim().replace(/[\\%_,()]/g, "").slice(0, 80);
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const [pros, staff, partners, biz, jobs] = await Promise.all([
    db().from("contractors").select("id, business_name, contact_name, email").or(`business_name.ilike.${like},contact_name.ilike.${like},email.ilike.${like}`).limit(10),
    db().from("profiles").select("id, full_name, email, role").in("role", ["admin", "dispatcher"]).or(`full_name.ilike.${like},email.ilike.${like}`).limit(10),
    db().from("referral_partners").select("id, name, email").or(`name.ilike.${like},email.ilike.${like}`).limit(10),
    db().from("business_accounts").select("id, company, contact_name, email").or(`company.ilike.${like},contact_name.ilike.${like},email.ilike.${like}`).limit(10),
    db().from("jobs").select("contact_email, contact_name, company_name").or(`contact_name.ilike.${like},contact_email.ilike.${like},company_name.ilike.${like}`).not("contact_email", "is", null).order("created_at", { ascending: false }).limit(40),
  ]);
  const customers = new Map<string, { name: string }>();
  for (const j of (jobs.data ?? []) as { contact_email: string; contact_name: string | null; company_name: string | null }[]) {
    const e = j.contact_email.toLowerCase();
    if (!customers.has(e)) customers.set(e, { name: j.company_name ?? j.contact_name ?? e });
  }
  return [
    ...[...customers].slice(0, 10).map(([e, c]) => ({ type: "customer" as const, key: e, name: c.name, sub: `Customer · ${e}` })),
    ...((pros.data ?? []) as Record<string, string>[]).map((p) => ({ type: "pro" as const, key: p.id, name: p.business_name ?? p.contact_name, sub: `Pro · ${p.email}` })),
    ...((staff.data ?? []) as Record<string, string>[]).map((p) => ({ type: "staff" as const, key: p.id, name: p.full_name ?? p.email, sub: `${p.role === "admin" ? "Admin" : "Dispatcher"} · ${p.email}` })),
    ...((partners.data ?? []) as Record<string, string>[]).map((p) => ({ type: "partner" as const, key: p.id, name: p.name, sub: `Referral partner · ${p.email}` })),
    ...((biz.data ?? []) as Record<string, string>[]).map((b) => ({ type: "business" as const, key: b.id, name: b.company, sub: `Business account · ${b.email}` })),
  ];
}
