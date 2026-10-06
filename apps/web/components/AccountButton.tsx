/*
 * FILE    : apps/web/components/AccountButton.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-05_0434 UTC
 * PURPOSE : The header's one account button (replaces "My Bookings" + "Sign in"). Signed out: "Sign in". Signed in, by
 *           who the email belongs to: staff → "Hub", pro → "Pro portal", everyone else → "My account" — with a menu to
 *           the other places they can go and Sign out. Client-side (keeps pages static); visible on phones. EN / ES.
 * UPDATED : 2026-10-06_0618 UTC — never takes the page down: without NEXT_PUBLIC_SUPABASE_URL / anon key (e.g. a Vercel
 *           deployment missing them) or when the session check fails, it just shows "Sign in". Before, the
 *           Supabase client threw and every public page, the home page included, showed the error screen.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { supabaseConfigured } from "@/lib/supabase/env";

type Me = { email: string; role: string; contractorId: string | null } | null;

export function AccountButton({ es }: { es: boolean }) {
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", close);
    // Supabase not set up for this deployment: show "Sign in" instead of crashing the page.
    if (!supabaseConfigured) { setMe(null); return () => { alive = false; document.removeEventListener("click", close); }; }
    const load = async () => {
      try {
        const { data } = await browserClient().auth.getSession();
        if (!data.session) { if (alive) setMe(null); return; }
        const r = await fetch("/api/me").then((x) => (x.ok ? x.json() : { user: null })).catch(() => ({ user: null }));
        if (alive) setMe(r.user ?? null);
      } catch {
        if (alive) setMe(null);
      }
    };
    load();
    let sub: { unsubscribe: () => void } | null = null;
    try { sub = browserClient().auth.onAuthStateChange(() => load()).data.subscription; } catch { /* signed-out header is fine */ }
    return () => { alive = false; sub?.unsubscribe(); document.removeEventListener("click", close); };
  }, []);
  if (me === undefined) return <span className="w-16" />;
  if (!me) return <a href="/login" className="whitespace-nowrap text-sm font-semibold text-ink hover:text-brand">{es ? "Iniciar sesión" : "Sign in"}</a>;
  const staff = me.role === "admin" || me.role === "dispatcher";
  const main = staff ? { href: "/hub", label: "Hub" } : me.contractorId ? { href: "/pro", label: es ? "Portal pro" : "Pro portal" } : { href: "/account", label: es ? "Mi cuenta" : "My account" };
  const links = [
    ...(staff ? [{ href: "/hub", label: "Hub" }] : []),
    ...(me.contractorId ? [{ href: "/pro", label: es ? "Portal pro" : "Pro portal" }] : []),
    { href: "/account", label: es ? "Mis reservas" : "My bookings" },
    { href: "/account/business", label: es ? "Cuenta empresarial" : "Business account" },
  ];
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:border-brand">👤 {main.label} ▾</button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-white p-1 text-sm shadow-lg">
          <div className="truncate px-3 py-2 text-xs text-ink-soft">{me.email}</div>
          {links.map((l) => <a key={l.href} href={l.href} className="block rounded-lg px-3 py-2 hover:bg-paper">{l.label}</a>)}
          <form action="/auth/signout" method="post"><button className="block w-full rounded-lg px-3 py-2 text-left text-ink-soft hover:bg-paper">{es ? "Cerrar sesión" : "Sign out"}</button></form>
        </div>
      )}
    </div>
  );
}
