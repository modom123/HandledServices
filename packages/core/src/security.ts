/*
 * FILE    : packages/core/src/security.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0726 UTC
 * PURPOSE : Small, pure security checks shared by the web app and tested in pricing.test.ts.
 *             safeNext(next, origin)   — where to send someone after sign-in: only a page on our own site.
 *                                        "//evil.com", "/\evil.com" (browsers read "\" as "/"), "javascript:"
 *                                        and control characters fall back, so a sign-in link can't be used
 *                                        to bounce someone to a phishing page.
 *             safeExternalUrl(url)     — whether the server may fetch a website someone gave us (lead
 *                                        engines read a business's own site for its email): http(s) only,
 *                                        no localhost / internal names / private, loopback, link-local or
 *                                        cloud-metadata addresses, no credentials in the URL, normal ports.
 *             PHOTO_PATH / isPhotoPath — a booking photo path exactly as /api/uploads creates it.
 */

export function safeNext(next: string | null | undefined, origin: string, fallback = "/auth/home"): string {
  if (!next || next.length > 2000) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const u = new URL(next, origin);
    if (u.origin !== new URL(origin).origin) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}

const PRIVATE_V4: [number, number][] = [
  [0x00000000, 8], [0x0a000000, 8], [0x7f000000, 8], [0xa9fe0000, 16], [0xac100000, 12], [0xc0a80000, 16],
  [0x64400000, 10], [0xc0000000, 24], [0xc6120000, 15], [0xe0000000, 4], [0xf0000000, 4],
];

function ipv4(host: string): number | null {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((x) => x > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

export function safeExternalUrl(raw: string | null | undefined): URL | null {
  if (!raw || raw.length > 2000) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || !host.includes(".")) return null; // "localhost", "intranet", bare names
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(host)) return null;
  if (host.startsWith("[") || host.includes(":")) return null; // IPv6 literals: never needed for a business website
  const v4 = ipv4(host);
  if (v4 !== null) {
    for (const [base, bits] of PRIVATE_V4) { const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0; if (((v4 & mask) >>> 0) === base) return null; }
  }
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return null; // decimal / hex IP tricks
  return u;
}

/**
 * A photo path the app may attach to a booking: exactly what /api/uploads creates (a customer booking
 * folder by date, or the uploader's pro folder, then a generated file name). No "..", no other buckets.
 */
export const PHOTO_PATH = /^(booking\/\d{4}-\d{2}-\d{2}|pro\/[0-9a-f-]{36})\/\d{10,16}-[0-9a-f]{8}\.(jpeg|jpg|png|webp|heic)$/;
export const isPhotoPath = (p: unknown): p is string => typeof p === "string" && PHOTO_PATH.test(p);
