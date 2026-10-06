/*
 * FILE    : apps/web/lib/safe-fetch.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_0726 UTC
 * PURPOSE : Fetch a website someone else gave us (lead engines read a business's own site for its
 *           contact email) without letting it point our server at internal addresses (SSRF): the URL and
 *           every redirect hop must pass safeExternalUrl() (public http(s) hosts only, no private or
 *           metadata IPs), at most 3 redirects. Returns null when refused or unreachable.
 */
import "server-only";
import { safeExternalUrl } from "@handled/core";

export async function safeFetch(url: string, init: RequestInit = {}, hops = 3): Promise<Response | null> {
  let target = safeExternalUrl(url);
  for (let i = 0; target && i <= hops; i++) {
    const r = await fetch(target, { ...init, redirect: "manual" }).catch(() => null);
    if (!r) return null;
    if (r.status < 300 || r.status >= 400) return r;
    const loc = r.headers.get("location");
    target = loc ? safeExternalUrl(new URL(loc, target).toString()) : null;
  }
  return null;
}
