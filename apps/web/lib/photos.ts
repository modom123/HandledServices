/*
 * FILE    : apps/web/lib/photos.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Private job-photo storage helpers (bucket: job-photos).
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

/** Private compliance documents (W-9, COI, licenses) — bucket pro-docs, staff-only access. */
export async function uploadDoc(file: File, folder: string): Promise<string> {
  if (!DOC_TYPES.includes(file.type)) throw new Error("Upload a PDF or photo");
  if (file.size > 10 * 1024 * 1024) throw new Error("Documents must be under 10 MB");
  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const { error } = await adminClient().storage.from("pro-docs").upload(path, file, { contentType: file.type });
  if (error) throw new Error(error.message);
  return path;
}

export async function signedDocUrl(path: string, seconds = 600): Promise<string | null> {
  const { data } = await adminClient().storage.from("pro-docs").createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}
