/*
 * FILE    : apps/web/components/LangSwitch.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : EN | ES switch — keeps the visitor on the same page.
 */
"use client";

import { usePathname } from "next/navigation";
import type { Locale } from "@handled/core";

export function LangSwitch({ locale, light = false }: { locale: Locale; light?: boolean }) {
  const path = usePathname() || "/home";
  const base = light ? "text-white/70 hover:text-white" : "text-ink-soft hover:text-ink";
  const on = light ? "font-bold text-white" : "font-bold text-ink";
  return (
    <span className="flex items-center gap-1 text-sm" aria-label="Language">
      <a href={`/api/lang?l=en&next=${encodeURIComponent(path)}`} className={locale === "en" ? on : base} hrefLang="en">EN</a>
      <span className={light ? "text-white/40" : "text-line"}>|</span>
      <a href={`/api/lang?l=es&next=${encodeURIComponent(path)}`} className={locale === "es" ? on : base} hrefLang="es">ES</a>
    </span>
  );
}
