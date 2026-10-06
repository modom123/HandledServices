/*
 * FILE    : apps/web/next.config.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0255 UTC — allow geolocation on our own pages (pro "On call" location sharing).
 * UPDATED : 2026-10-06_0726 UTC — security headers: Content-Security-Policy (frame-ancestors, object-src, base-uri, upgrade-insecure-requests)
 *           and Cross-Origin-Opener-Policy.
 */
import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  transpilePackages: ["@handled/core"],
  turbopack: { root: path.join(process.cwd(), "../..") },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  poweredByHeader: false,
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
