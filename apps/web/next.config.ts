/*
 * FILE    : apps/web/next.config.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0255 UTC — allow geolocation on our own pages (pro "On call" location sharing).
 * UPDATED : 2026-10-06_0726 UTC — security headers: Content-Security-Policy (frame-ancestors, object-src, base-uri, upgrade-insecure-requests)
 *           and Cross-Origin-Opener-Policy.
 * UPDATED : 2026-10-28_1810 UTC — /about redirects to /home (the About page was removed).
 * UPDATED : 2026-10-28_1840 UTC — the five Mastermind "moved" stub pages are redirects here instead.
 */
import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  transpilePackages: ["@handled/core"],
  turbopack: { root: path.join(process.cwd(), "../..") },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  poweredByHeader: false,
  // the About page was removed (its story is on the home page): old links land there
  async redirects() {
    return [
      { source: "/about", destination: "/home", permanent: true },
      // Mastermind pages that moved into a tab of another page (old bookmarks and emailed links; the query string carries over)
      { source: "/hub/market", destination: "/hub/pricing?view=market", permanent: true },
      { source: "/hub/pricing-accuracy", destination: "/hub/pricing?view=accuracy", permanent: true },
      { source: "/hub/network", destination: "/hub/pros?view=health", permanent: true },
      { source: "/hub/workforce", destination: "/hub/agents?view=workforce", permanent: true },
      { source: "/hub/gov", destination: "/hub/bids?view=gov", permanent: true },
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        // no framing by other sites, no plugins, no <base> hijacking, never load anything over plain http
        { key: "Content-Security-Policy", value: `frame-ancestors 'self'; object-src 'none'; base-uri 'self'${process.env.NODE_ENV === "production" ? "; upgrade-insecure-requests" : ""}` },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      ],
    }];
  },
};

export default config;
