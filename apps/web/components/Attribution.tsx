/*
 * FILE    : apps/web/components/Attribution.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : First-touch marketing source: on a visitor's first page view, remember utm_source /
 *           medium / campaign, the referring site and the landing page (this browser only).
 *           Bookings send it, so the Hub can show which ads and channels bring paying customers.
 */
"use client";

import { useEffect } from "react";

export function Attribution() {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const utm = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].map((k) => [k, url.searchParams.get(k)]).filter(([, v]) => v)) as Record<string, string>;
      const existing = localStorage.getItem("handled_attr");
      // a new paid click replaces an old organic first touch; otherwise keep the first one
      if (existing && !Object.keys(utm).length) return;
      const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? new URL(document.referrer).hostname : "";
      const source = utm.utm_source || (utm.gclid ? "google_ads" : utm.fbclid ? "facebook_ads" : ref || "direct");
      localStorage.setItem("handled_attr", JSON.stringify({ source, ...utm, ...(ref ? { referrer: ref } : {}), landing: url.pathname.slice(0, 120), first_seen: new Date().toISOString().slice(0, 10) }));
    } catch { /* storage blocked — fine */ }
  }, []);
  return null;
}
