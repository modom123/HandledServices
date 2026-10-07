/*
 * FILE    : apps/web/app/not-found.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-07_1640 UTC
 * PURPOSE : Branded "page not found" (any unknown URL): the site header and footer, and the most useful next steps.
 */
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Page not found" };

export default async function NotFound() {
  const es = (await getLocale()) === "es";
  return (
    <>
      <SiteHeader />
      <main className="wrap max-w-2xl py-20 text-center">
        <div className="text-5xl">🧭</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{es ? "No encontramos esa página" : "We couldn’t find that page"}</h1>
        <p className="mt-2 text-ink-soft">{es ? "Puede que el enlace sea antiguo o tenga un error. Esto es lo que la mayoría busca:" : "The link may be old or mistyped. Here’s what most people are looking for:"}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/book" className="btn-primary">{es ? "Reservar un servicio" : "Book a service"}</Link>
          <Link href="/services" className="btn-ghost">{es ? "Ver servicios" : "See services"}</Link>
          <Link href="/account" className="btn-ghost">{es ? "Mis reservas" : "My bookings"}</Link>
          <Link href="/contact" className="btn-ghost">{es ? "Contacto" : "Contact us"}</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
