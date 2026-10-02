/*
 * FILE    : apps/web/lib/locale.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : The visitor's language (English / Spanish) from the "lang" cookie set by the
 *           language switch (/api/lang).
 */
import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "@handled/core";

export async function getLocale(): Promise<Locale> {
  try { return (await cookies()).get("lang")?.value === "es" ? "es" : "en"; } catch { return "en"; }
}
