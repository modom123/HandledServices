/*
 * FILE    : apps/web/components/PhotoPicker.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0201 UTC
 * PURPOSE : Easy photo capture and upload on phone and desktop.
 *             • Phone: "Take photo" opens the camera; "Choose photos" opens the library
 *             • Desktop: choose files, drag & drop, or paste a screenshot (Ctrl/Cmd+V)
 *             • Photos are shrunk to ~1600px JPEG in the browser first (fast on cellular, and
 *               iPhone HEIC becomes JPEG the AI can read), then uploaded one at a time with
 *               progress; thumbnails with remove.
 * UPDATED : 2026-10-02_1412 UTC — English / Spanish (locale prop).
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { t as tr, type Locale } from "@handled/core";

const MAX_SIDE = 1600;

/** Resize + re-encode to JPEG in the browser. Falls back to the original file if it can't be decoded. */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export function PhotoPicker({ value, onChange, max = 8, uploadUrl = "/api/uploads", onError, locale = "en" }: {
  value: string[];
  onChange: (paths: string[]) => void;
  max?: number;
  uploadUrl?: string;
  onError?: (msg: string) => void;
  locale?: Locale;
}) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const [touch, setTouch] = useState(false);
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => { setTouch(window.matchMedia("(pointer: coarse)").matches); }, []);

  async function add(files: File[] | FileList | null) {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    const room = max - valueRef.current.length;
    if (room <= 0) return onError?.(es ? `Hasta ${max} fotos` : `Up to ${max} photos`);
    const take = list.slice(0, room);
    const added: string[] = [];
    for (let i = 0; i < take.length; i++) {
      setBusy(es ? `Subiendo ${i + 1} de ${take.length}…` : `Uploading ${i + 1} of ${take.length}…`);
      const small = await shrink(take[i]);
      const fd = new FormData();
      fd.append("photos", small);
      const res = await fetch(uploadUrl, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.paths?.[0]) { onError?.(json.error ?? t("Upload failed — try again")); continue; }
      const path = json.paths[0] as string;
      added.push(path);
      setPreviews((p) => ({ ...p, [path]: URL.createObjectURL(small) }));
      onChange([...valueRef.current, path]);
    }
    setBusy("");
    if (list.length > take.length) onError?.(es ? `Solo se agregaron las primeras ${take.length} (máximo ${max})` : `Only the first ${take.length} were added (max ${max})`);
  }

  // paste a screenshot or copied image anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); add(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
      className={`rounded-2xl border-2 border-dashed p-4 transition ${drag ? "border-brand bg-brand-tint" : "border-line bg-white"}`}
    >
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={libRef} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <div className="flex flex-wrap items-center gap-2">
        {touch && <button type="button" className="btn-primary" disabled={Boolean(busy) || value.length >= max} onClick={() => camRef.current?.click()}>📷 {t("Take photo")}</button>}
        <button type="button" className={touch ? "btn-ghost" : "btn-primary"} disabled={Boolean(busy) || value.length >= max} onClick={() => libRef.current?.click()}>🖼️ {t(touch ? "Choose from library" : "Choose photos")}</button>
        <span className="text-xs text-ink-soft">{busy || (touch ? `${value.length}/${max} ${t("added")}` : `${t("or drag & drop, or paste (Ctrl/⌘+V)")} · ${value.length}/${max}`)}</span>
      </div>
      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {value.map((p) => (
            <div key={p} className="relative">
              {previews[p] ? <img src={previews[p]} alt={t("Your photo")} className="aspect-square w-full rounded-lg object-cover" /> : <div className="grid aspect-square place-items-center rounded-lg bg-paper text-xs text-ink-soft">{t("photo")}</div>}
              <button type="button" aria-label={t("Remove photo")} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-xs text-white" onClick={() => onChange(value.filter((x) => x !== p))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
