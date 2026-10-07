/*
 * FILE    : apps/web/app/api/lang/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * UPDATED : 2026-10-02_1412 UTC — signed in → also saved on the account, so texts and emails follow it.
 * UPDATED : 2026-10-07_1545 UTC — security: next= goes through safeNext() ("/\\evil.com" was an open redirect).
 * PURPOSE : Language switch: /api/lang?l=es&next=/home → remembers the choice (1 year), goes back.
 */
import { saveLocale } from "@/lib/locale-save";
import { safeNext } from "@/lib/safe-redirect";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const l = url.searchParams.get("l") === "es" ? "es" : "en";
  await saveLocale(req, l);
  const safe = safeNext(url.searchParams.get("next"), url.origin, "/home");
  return new Response(null, { status: 303, headers: { Location: safe, "Set-Cookie": `lang=${l}; Path=/; Max-Age=31536000; SameSite=Lax` } });
}
