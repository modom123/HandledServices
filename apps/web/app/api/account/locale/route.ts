/*
 * FILE    : apps/web/app/api/account/locale/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1412 UTC
 * PURPOSE : Set my language (app and website): { locale: "en" | "es" } → saved on my account and
 *           in the "lang" cookie. GET returns the saved language.
 */
import { deny, getViewer } from "@/lib/auth";
import { saveLocale } from "@/lib/locale-save";

export async function GET(req: Request) {
  const v = await getViewer(req);
  if (!v) return deny(401, "Sign in first");
  const { data } = await v.db.from("profiles").select("locale").eq("id", v.userId).maybeSingle();
  return Response.json({ locale: data?.locale === "es" ? "es" : "en" });
}

export async function POST(req: Request) {
  const { locale } = (await req.json().catch(() => ({}))) as { locale?: string };
  if (locale !== "en" && locale !== "es") return deny(400, "locale must be en or es");
  await saveLocale(req, locale);
  return new Response(JSON.stringify({ ok: true, locale }), { headers: { "Content-Type": "application/json", "Set-Cookie": `lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax` } });
}
