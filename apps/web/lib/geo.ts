/*
 * FILE    : apps/web/lib/geo.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-01_2334 UTC
 * PURPOSE : ZIP code → coordinates (centroid) for dispatch distance and the booking
 *           calendar's driving-radius check. Looked up once from a free public service
 *           (no key) and cached in zip_geo. Returns null when unknown — dispatch then falls
 *           back to each pro's ZIP list, so nothing stops if the lookup is down.
 */
import "server-only";
import { adminClient } from "./supabase/server";

const memo = new Map<string, { lat: number; lng: number } | null>();

export async function zipCentroid(zip: string | null | undefined): Promise<{ lat: number; lng: number } | null> {
  if (!zip || !/^\d{5}$/.test(zip)) return null;
  if (memo.has(zip)) return memo.get(zip)!;
  const db = adminClient();
  const { data } = await db.from("zip_geo").select("lat, lng").eq("zip", zip).maybeSingle();
  if (data) { memo.set(zip, data); return data; }
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) { memo.set(zip, null); return null; }
    const j = (await res.json()) as { places?: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[] };
    const p = j.places?.[0];
    if (!p) return null;
    const out = { lat: Number(p.latitude), lng: Number(p.longitude) };
    await db.from("zip_geo").upsert({ zip, ...out, city: p["place name"], state: p["state abbreviation"] });
    memo.set(zip, out);
    return out;
  } catch {
    return null;
  }
}
