/*
 * FILE    : apps/web/app/api/lang/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * UPDATED : 2026-10-02_1412 UTC — signed in → also saved on the account, so texts and emails follow it.
 * PURPOSE : Language switch: /api/lang?l=es&next=/home → remembers the choice (1 year), goes back.
 */
import { saveLocale } from "@/lib/locale-save";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const l = url.searchParams.get("l") === "es" ? "es" : "en";
  await saveLocale(req, l);
  const next = url.searchParams.get("next") ?? "/home";
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/home";
  return new Response(null, { status: 303, headers: { Location: safe, "Set-Cookie": `lang=${l}; Path=/; Max-Age=31536000; SameSite=Lax` } });
}
