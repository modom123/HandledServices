/*
 * FILE    : apps/web/lib/locale.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : The visitor's language (English / Spanish) from the "lang" cookie set by the
 *           language switch (/api/lang).
 * UPDATED : 2026-10-02_1412 UTC — no cookie yet (new device) → the signed-in person's saved language.
 */
import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "@handled/core";

export async function getLocale(): Promise<Locale> {
  try {
    const c = (await cookies()).get("lang")?.value;
    if (c === "es" || c === "en") return c;
    const { getViewer } = await import("./auth");
    const v = await getViewer();
    if (!v) return "en";
    const { data } = await v.db.from("profiles").select("locale").eq("id", v.userId).maybeSingle();
    return data?.locale === "es" ? "es" : "en";
  } catch { return "en"; }
}
