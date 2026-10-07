/*
 * FILE    : apps/web/lib/geo.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2334 UTC
 * PURPOSE : ZIP code → coordinates (centroid) for dispatch distance and the booking
 *           calendar's driving-radius check. Looked up once from a free public service
 *           (no key) and cached in zip_geo. Returns null when unknown — dispatch then falls
 *           back to each pro's ZIP list, so nothing stops if the lookup is down.
 * UPDATED : 2026-10-06_2010 UTC — geocodeAddress(): exact street-address location (Google Geocoding) for jobs and pros'
 *           places of business, falling back to the ZIP centroid.
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

/**
 * A street address → coordinates, for exact distances (the customer's job, the pro's place of business).
 * Uses Google's Geocoding API when GOOGLE_MAPS_API_KEY (or GOOGLE_PLACES_API_KEY with the Geocoding API enabled) is
 * set; otherwise — or if the lookup fails — the ZIP centroid, so dispatch always has a location.
 */
export async function geocodeAddress(a: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null }): Promise<{ lat: number; lng: number; exact: boolean } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const line = [a.address, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter((x) => x && String(x).trim()).join(", ");
  if (key && a.address && a.address.trim().length > 3) {
    try {
      const u = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(line)}&components=country:US&key=${key}`;
      const res = await fetch(u, { signal: AbortSignal.timeout(4000) });
      const j = (await res.json()) as { status: string; results?: { geometry: { location: { lat: number; lng: number }; location_type: string } }[] };
      const g = j.status === "OK" ? j.results?.[0]?.geometry : undefined;
      if (g && g.location_type !== "APPROXIMATE") return { lat: g.location.lat, lng: g.location.lng, exact: true };
    } catch { /* fall back to the ZIP */ }
  }
  const z = await zipCentroid(a.zip);
  return z ? { ...z, exact: false } : null;
}
