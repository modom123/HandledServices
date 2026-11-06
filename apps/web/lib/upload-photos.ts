/*
 * FILE    : apps/web/lib/upload-photos.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-04_2345 UTC
 * PURPOSE : Browser-side photo helpers shared by every photo upload (pro job photos, fast-track sign-up, partner
 *           tickets, pro onboarding). Vercel refuses request bodies over 4.5 MB, and a phone photo is often 3–8 MB,
 *           so photos are resized to JPEG in the browser and sent one per request:
 *             shrinkPhoto  — resize + re-encode (anything that isn't a decodable image goes as it is)
 *             uploadPhotos — /api/uploads one photo at a time → { paths, error }; a failed photo doesn't lose the rest
 */
"use client";

export async function shrinkPhoto(file: File, maxSide = 1600): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export async function uploadPhotos(files: File[], url = "/api/uploads"): Promise<{ paths: string[]; previews: string[]; error: string | null }> {
  const paths: string[] = [], previews: string[] = [];
  let error: string | null = null;
  for (const f of files) {
    try {
      const small = await shrinkPhoto(f);
      const fd = new FormData();
      fd.append("photos", small);
      const res = await fetch(url, { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.paths?.[0]) { error = j.error ?? (res.status === 413 ? "That photo is too large" : `Upload failed (${res.status})`); continue; }
      paths.push(String(j.paths[0]));
      previews.push(URL.createObjectURL(small));
    } catch {
      error = "Couldn't reach Handled — check your connection and try again";
    }
  }
  return { paths, previews, error };
}
