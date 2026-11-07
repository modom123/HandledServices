/*
 * FILE    : apps/web/app/(site)/post/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-07_1614 UTC
 * PURPOSE : /post — "Post your project" (like Angi, but Handled keeps the lead): anyone describes a project, it lands in
 *           the Lead inbox for Handled to call and book with its own vetted pros. Nothing is sold to other contractors.
 *           ?service= preselects a service; utm / ref links record where the post came from (Hub → Lead inbox → Links
 *           to share). English / Spanish.
 */
import Link from "next/link";
import { BRAND, SERVICES, serviceText } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { PostProjectForm } from "@/components/PostProjectForm";

export const metadata = {
  title: "Post your project",
  description: `Tell ${BRAND.name} what you need done — cleaning, repairs, remodeling, moving, business services and more. We call you within minutes with a plan and an upfront price, and send one vetted, insured pro.`,
  alternates: { canonical: "/post" },
};

export default async function PostProject({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const l = await getLocale();
  const es = l === "es";
  const { service } = await searchParams;
  const services = SERVICES.map((s) => ({ slug: s.slug, name: serviceText(l, s.slug, s).name })).sort((a, b) => a.name.localeCompare(b.name));
  const preset = services.some((s) => s.slug === service) ? service! : null;
  const steps = es
    ? [["Publique su proyecto", "Díganos qué necesita, cuándo y su presupuesto. Toma un minuto."], ["Le llamamos en minutos", "Una persona de Handled le llama con un plan y un precio fijo, o agenda una visita gratis para trabajos grandes."], ["Un profesional verificado lo hace", "Asegurado y con verificación de antecedentes. Fotos al terminar y lo rehacemos gratis si algo falta."]]
    : [["Post your project", "Tell us what you need, when, and your budget. It takes a minute."], ["We call you within minutes", "A real Handled person calls with a plan and an upfront price — or books a free visit for big jobs."], ["One vetted pro does it", "Insured and background-checked. Photo check-out after every job, and a free redo if anything's missed."]];
  return (
    <div className="wrap grid gap-10 py-12 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark">📝 {es ? "Gratis y sin compromiso" : "Free, no obligation"}</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{es ? "Publique su proyecto." : "Post your project."} <span className="text-brand">{es ? "Nosotros nos encargamos." : "We'll handle it."}</span></h1>
        <p className="mt-4 text-lg text-ink-soft">{es ? "Cualquier trabajo para su hogar o negocio, grande o pequeño. A diferencia de los sitios de clientes potenciales, no vendemos su información a cinco contratistas: Handled se encarga del trabajo de principio a fin." : "Any job for your home or business, big or small. Unlike lead sites, we don't sell your details to five contractors — Handled takes the job from first call to finished work."}</p>
        <ol className="mt-8 space-y-5">{steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{i + 1}</span><span><span className="block font-semibold">{t}</span><span className="block text-sm text-ink-soft">{d}</span></span></li>
        ))}</ol>
        <p className="mt-8 text-sm text-ink-soft">{es ? "¿Ya sabe lo que quiere?" : "Already know what you want?"} <Link href="/book" className="font-semibold text-brand">{es ? "Vea su precio al instante" : "Get an instant price"} →</Link> · <Link href="/snap" className="font-semibold text-brand">{es ? "Mande una foto" : "Snap a photo"} →</Link></p>
      </div>
      <PostProjectForm es={es} services={services} preset={preset} />
    </div>
  );
}
