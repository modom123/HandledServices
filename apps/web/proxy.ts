/*
 * FILE    : apps/web/proxy.ts   (Next.js 16 "proxy", formerly middleware)
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-03_0306 UTC — ?lang=es / ?lang=en on any page sets the language (links in Spanish
 *           Indeed posts, emails and ads open the site in Spanish).
 * UPDATED : 2026-10-07_0240 UTC — ?theme= picks and remembers one of the three website looks (lib/theme.ts).
 * UPDATED : 2026-10-07_0110 UTC — ?partner=CODE on any public page remembers the referral partner (90 days, first click wins).
 * PURPOSE : Refreshes the Supabase auth session cookie on every request to the
 *           signed-in areas (account, pro portal, ops hub).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/env";

const SIGNED_IN = /^\/(account|pro|hub|login|partner)(\/|$)/;

export async function proxy(request: NextRequest) {
  // ?lang= switches the site language (and remembers it) — this request sees it too
  const lang = request.nextUrl.searchParams.get("lang");
  const setLang = lang === "es" || lang === "en" ? lang : null;
  if (setLang) request.cookies.set("lang", setLang);
  // ?partner=CODE (Referral Partner Program): remember the partner for 90 days; the first partner link clicked wins
  const partner = (request.nextUrl.searchParams.get("partner") ?? "").trim().toUpperCase();
  const setPartner = /^[A-Z0-9]{4,16}$/.test(partner) && !request.cookies.get("handled_partner") ? partner : null;
  // ?theme=classic|greengold|modern (one link per market) shows that website look and remembers it; ?theme=default forgets it
  const themeQ = request.nextUrl.searchParams.get("theme");
  const setTheme = themeQ && ["classic", "greengold", "modern", "default"].includes(themeQ) ? themeQ : null;
  if (setTheme && setTheme !== "default") request.cookies.set("site_theme", setTheme);
  if (setTheme === "default") request.cookies.delete("site_theme");
  let response = NextResponse.next({ request }); // after the cookie changes above, so this request sees them
  const remember = (r: NextResponse) => {
    if (setTheme) r.cookies.set("site_theme", setTheme === "default" ? "" : setTheme, { path: "/", maxAge: setTheme === "default" ? 0 : 60 * 60 * 24 * 90, sameSite: "lax" });
    if (setLang) r.cookies.set("lang", setLang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    if (setPartner) r.cookies.set("handled_partner", setPartner, { path: "/", maxAge: 60 * 60 * 24 * 90, sameSite: "lax", httpOnly: true, secure: true });
    return r;
  };
  if (!supabaseConfigured || !SIGNED_IN.test(request.nextUrl.pathname)) return remember(response);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return remember(response);
}

// signed-in areas (session refresh) + public pages that may carry ?lang=
export const config = { matcher: ["/account/:path*", "/pro/:path*", "/hub/:path*", "/login", "/pros", "/book", "/home", "/", "/terms/:path*", "/services/:path*", "/business", "/plus", "/gift-cards", "/book/:path*", "/partners", "/partner", "/events", "/talent"] };
