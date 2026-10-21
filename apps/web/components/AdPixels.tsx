/*
 * FILE    : apps/web/components/AdPixels.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0100 UTC
 * PURPOSE : Ad platform pixels, each loaded only when its id is set in Vercel:
 *             NEXT_PUBLIC_META_PIXEL_ID   — Meta Pixel (Facebook + Instagram ads)
 *             NEXT_PUBLIC_GOOGLE_ADS_ID   — Google Ads tag (AW-…)
 *             NEXT_PUBLIC_TIKTOK_PIXEL_ID — TikTok pixel
 *           Page views here; conversions (Lead, Purchase) from lib/track.ts, matched to the server events
 *           (lib/conversions.ts) by event id. Public pages only: never in the Hub, the pro portal or signed-in account pages.
 */
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const safe = (v: string | undefined) => (v && /^[A-Za-z0-9-]{4,40}$/.test(v) ? v : null);

export function AdPixels() {
  const path = usePathname() ?? "/";
  if (/^\/(hub|pro|account|partner|iebc|api)(\/|$)/.test(path)) return null;
  const meta = safe(process.env.NEXT_PUBLIC_META_PIXEL_ID);
  const google = safe(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID);
  const tiktok = safe(process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID);
  return (
    <>
      {meta && <Script id="meta-pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`}</Script>}
      {google && <Script id="google-ads-src" src={`https://www.googletagmanager.com/gtag/js?id=${google}`} strategy="afterInteractive" />}
      {google && <Script id="google-ads" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${google}');`}</Script>}
      {tiktok && <Script id="tiktok-pixel" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');`}</Script>}
    </>
  );
}
