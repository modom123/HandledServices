/*
 * FILE    : apps/web/app/sitemap.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : sitemap.xml for search engines: main pages, every service, every service × city.
 */
import type { MetadataRoute } from "next";
import { SEO_CITIES, SERVICES } from "@handled/core";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const pages = ["", "/home", "/services", "/book", "/business", "/events", "/pros", "/plus", "/gift-cards", "/reviews"].map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" || p === "/home" ? 1 : 0.8 }));
  const services = SERVICES.map((s) => ({ url: `${base}/services/${s.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.8 }));
  const cities = SERVICES.flatMap((s) => SEO_CITIES.map((c) => ({ url: `${base}/services/${s.slug}/in/${c.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 })));
  return [...pages, ...services, ...cities];
}
