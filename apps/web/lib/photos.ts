/*
 * FILE    : apps/web/lib/photos.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Private job-photo storage helpers (bucket: job-photos).
 * UPDATED : 2026-10-18_0248 UTC — uploadDoc takes the allowed types (resumes: PDF or Word; profile photos: images).
 * UPDATED : 2026-11-04_2345 UTC — onboarding files go straight from the browser to storage (Vercel refuses request bodies over
 *           4.5 MB, so phone photos and scanned PDFs sent through the app never arrived):
 *             docUploadTicket — checks type and size, returns a one-time signed upload for <pro>/<step>/…
 *             confirmDocUpload — checks the path belongs to that pro and step and the file is really in storage
 *           docType infers the type from the file name when the browser sends none (common for .docx and .heic).
 */
import "server-only";
import { adminClient } from "./supabase/server";

const BUCKET = "job-photos";
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function uploadPhoto(file: File, folder: string): Promise<string> {
  if (!TYPES.includes(file.type)) throw new Error("Photos must be JPG, PNG, WEBP or HEIC");
  if (file.size > MAX_BYTES) throw new Error("Photos must be under 8 MB");
  const ext = file.type.split("/")[1];
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await adminClient().storage.from(BUCKET).upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedUrls(paths: string[], seconds = 3600): Promise<string[]> {
  if (!paths.length) return [];
  const { data } = await adminClient().storage.from(BUCKET).createSignedUrls(paths, seconds);
  return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
}

const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
const WORD_TYPES: Record<string, string> = { "application/msword": "doc", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx" };
/** Allowed types per kind of upload, and the message when the file isn't one of them. */
export const UPLOAD_TYPES = {
  doc: { types: DOC_TYPES, error: "Upload a PDF or photo" },
  resume: { types: ["application/pdf", ...Object.keys(WORD_TYPES)], error: "Upload your resume as a PDF or Word document" },
  photo: { types: TYPES, error: "Photos must be JPG, PNG, WEBP or HEIC" },
};

/** Private compliance documents (W-9, COI, licenses, resumes, profile photos) — bucket pro-docs, staff-only access. */
export async function uploadDoc(file: File, folder: string, allowed = UPLOAD_TYPES.doc): Promise<string> {
  const type = docType(file.name, file.type);
  if (!allowed.types.includes(type)) throw new Error(allowed.error);
  if (file.size > 10 * 1024 * 1024) throw new Error("Documents must be under 10 MB");
  if (allowed === UPLOAD_TYPES.photo && file.size > MAX_BYTES) throw new Error("Photos must be under 8 MB");
  const ext = type === "application/pdf" ? "pdf" : WORD_TYPES[type] ?? type.split("/")[1];
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await adminClient().storage.from("pro-docs").upload(path, file, { contentType: type });
  if (error) throw new Error(error.message);
  return path;
}

const EXT_TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heic",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
/** The file's type, from the browser or (when it sends none or a generic one) from the file name. */
export function docType(name: string, type: string): string {
  if (type && type !== "application/octet-stream") return type === "image/heif" ? "image/heic" : type;
  return EXT_TYPES[(name.split(".").pop() ?? "").toLowerCase()] ?? type;
}

const DOC_STEPS = ["w9", "coi", "license", "coverage", "resume", "photo"] as const;
export type DocStep = (typeof DOC_STEPS)[number];
export const isDocStep = (s: string): s is DocStep => (DOC_STEPS as readonly string[]).includes(s);

/** A one-time signed upload into pro-docs/<contractor>/<step>/ — the browser sends the file straight to storage. */
export async function docUploadTicket(contractorId: string, step: DocStep, name: string, rawType: string, size: number): Promise<{ path: string; token: string; type: string }> {
  const type = docType(name, rawType);
  const allowed = step === "resume" ? UPLOAD_TYPES.resume : step === "photo" ? UPLOAD_TYPES.photo : UPLOAD_TYPES.doc;
  if (!allowed.types.includes(type)) throw new Error(allowed.error);
  if (!size) throw new Error("That file is empty");
  if (size > 10 * 1024 * 1024) throw new Error("Documents must be under 10 MB");
  if (step === "photo" && size > MAX_BYTES) throw new Error("Photos must be under 8 MB");
  const ext = type === "application/pdf" ? "pdf" : WORD_TYPES[type] ?? type.split("/")[1];
  const path = `${contractorId}/${step}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { data, error } = await adminClient().storage.from("pro-docs").createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Storage isn't ready: ${error?.message ?? "no upload link"}`);
  return { path, token: data.token, type };
}

/** True when `path` is this pro's file for this step and it is actually in storage (not just claimed). */
export async function confirmDocUpload(contractorId: string, step: DocStep, path: string): Promise<boolean> {
  const prefix = `${contractorId}/${step}/`;
  if (!path.startsWith(prefix) || !/^[\w-]+\.[a-z]{3,4}$/.test(path.slice(prefix.length))) return false;
  const { data } = await adminClient().storage.from("pro-docs").list(`${contractorId}/${step}`, { search: path.slice(prefix.length), limit: 1 });
  return Boolean(data?.some((f) => f.name === path.slice(prefix.length)));
}

/** Remove an uploaded file when saving its record failed (no orphan files). */
export async function removeDoc(path: string) {
  await adminClient().storage.from("pro-docs").remove([path]).catch(() => null);
}

export async function signedDocUrl(path: string, seconds = 600): Promise<string | null> {
  const { data } = await adminClient().storage.from("pro-docs").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
