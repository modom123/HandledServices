/*
 * FILE    : apps/web/lib/indexnow.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-24_2200 UTC
 * PURPOSE : IndexNow: tells Bing (and through it Yahoo, DuckDuckGo and Ecosia), Yandex, Seznam, Naver and Yep the moment
 *           pages change, instead of waiting for them to crawl. One call to api.indexnow.org reaches every engine.
 *             indexNowKey()       — the site's key (INDEXNOW_KEY, else a stable key derived from the site address);
 *                                   served at /indexnow-key.txt so engines can check we own the site
 *             submitToIndexNow()  — send up to 10,000 URLs (our own host only)
 *             submitSitemap()     — send every page in sitemap.xml (the daily sweep calls it once a week, on Mondays)
 */
import "server-only";
import { createHash } from "node:crypto";
import { siteUrl } from "./site-url";

export const indexNowKey = () => process.env.INDEXNOW_KEY?.trim() || createHash("sha256").update(`handled-indexnow:${new URL(siteUrl()).host}`).digest("hex").slice(0, 32);

export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status: number; sent: number }> {
  const base = new URL(siteUrl());
  const list = [...new Set(urls)].filter((u) => { try { return new URL(u).host === base.host; } catch { return false; } }).slice(0, 10000);
  if (!list.length || base.hostname === "localhost") return { ok: false, status: 0, sent: 0 };
  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: base.host, key: indexNowKey(), keyLocation: `${base.origin}/indexnow-key.txt`, urlList: list }),
  }).catch(() => null);
  return { ok: Boolean(r && (r.status === 200 || r.status === 202)), status: r?.status ?? 0, sent: list.length };
}

export async function submitSitemap() {
  const sitemap = (await import("@/app/sitemap")).default;
  return submitToIndexNow(sitemap().map((e) => e.url));
}
