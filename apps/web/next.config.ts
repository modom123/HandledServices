/*
 * FILE    : apps/web/next.config.ts
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 */
import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  transpilePackages: ["@handled/core"],
  turbopack: { root: path.join(process.cwd(), "../..") },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default config;
