/*
 * FILE    : apps/mobile/lib/i18n.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1405 UTC
 * PURPOSE : English / Spanish in the app. Starts from the phone's language, can be switched on
 *           the home and Account screens, and is remembered on the device.
 *             const { t, locale, setLocale, svc, cat } = useI18n();
 *             t("Book now") → "Reservar" in Spanish; unknown strings stay English.
 *           Service names, categories and every pricing question come from @handled/core.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { categoryText, serviceText, t as coreT, type CategoryId, type Locale } from "@handled/core";
import { ES_APP } from "./es-app";
import { ES_PRO } from "./es-pro";

const KEY = "handled_lang";
const deviceLocale = (): Locale => { try { return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("es") ? "es" : "en"; } catch { return "en"; } };

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void }>({ locale: "en", setLocale: () => {} });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, set] = useState<Locale>(deviceLocale());
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v === "es" || v === "en") set(v); }).catch(() => {}); }, []);
  const setLocale = (l: Locale) => { set(l); AsyncStorage.setItem(KEY, l).catch(() => {}); };
  return <Ctx.Provider value={{ locale, setLocale }}>{children}</Ctx.Provider>;
}

/** Translate for the current language. */
export function translate(locale: Locale, s: string): string {
  if (locale !== "es") return s;
  return ES_APP[s] ?? ES_PRO[s] ?? coreT("es", s);
}

export function useI18n() {
  const { locale, setLocale } = useContext(Ctx);
  return {
    locale, setLocale,
    t: (s: string) => translate(locale, s),
    svc: (s: { slug: string; name: string; tagline: string }) => serviceText(locale, s.slug, s),
    cat: (c: { id: CategoryId; name: string; short: string; blurb: string }) => categoryText(locale, c.id, c),
  };
}
