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
 * UPDATED : 2026-11-05_1530 UTC — free address lookup first: the US Census Bureau geocoder (no key, no card, US street
 *           addresses). Google Geocoding is only a backup when a key happens to be set; then the ZIP centroid.
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

/** US Census Bureau geocoder (free, no key): a US street address → coordinates, or null when it can't match it. */
export async function censusGeocode(a: { address: string; city?: string | null; state?: string | null; zip?: string | null }): Promise<{ lat: number; lng: number } | null> {
  const q = new URLSearchParams({ street: a.address.trim(), benchmark: "Public_AR_Current", format: "json" });
  if (a.city) q.set("city", a.city.trim());
  if (a.state) q.set("state", a.state.trim());
  if (a.zip) q.set("zip", a.zip.trim());
  try {
    const res = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/address?${q}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { result?: { addressMatches?: { coordinates?: { x?: number; y?: number } }[] } };
    const c = j.result?.addressMatches?.[0]?.coordinates;
    const lat = Number(c?.y), lng = Number(c?.x);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * A street address → coordinates, for exact distances (the customer's job, the pro's place of business).
 * Free US Census geocoder first; Google's Geocoding API as a backup only when GOOGLE_MAPS_API_KEY (or a Places key
 * with Geocoding enabled) is set; otherwise — or if both fail — the ZIP centroid, so dispatch always has a location.
 */
export async function geocodeAddress(a: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null }): Promise<{ lat: number; lng: number; exact: boolean } | null> {
  const hasStreet = Boolean(a.address && a.address.trim().length > 3);
  if (hasStreet) {
    const c = await censusGeocode({ address: a.address!, city: a.city, state: a.state, zip: a.zip });
    if (c) return { ...c, exact: true };
  }
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const line = [a.address, a.city, [a.state, a.zip].filter(Boolean).join(" ")].filter((x) => x && String(x).trim()).join(", ");
  if (key && hasStreet) {
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
