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
