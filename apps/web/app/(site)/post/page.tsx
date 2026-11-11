/*
 * FILE    : apps/web/app/(site)/post/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-07_1614 UTC
 * PURPOSE : /post — "Post your project" (like Angi, but Handled keeps the lead): anyone describes a project, it lands in
 *           the Lead inbox for Handled to call and book with its own vetted pros. Nothing is sold to other contractors.
 *           ?service= preselects a service; utm / ref links record where the post came from (Hub → Lead inbox → Links
 *           to share). English / Spanish.
 * UPDATED : 2026-11-07_1500 UTC — Post & earn: "Get 10% back, up to $250" (posting can make you a partner).
 * UPDATED : 2026-11-09_0330 UTC — Professional look: tighter spacing (pro: utilities; other looks unchanged).
 * UPDATED : 2026-11-09_1600 UTC — Professional look: line icons instead of emoji (ThemedIcon / Ico switch by look; Original unchanged).
 * UPDATED : 2026-11-10_0320 UTC — the Snap a photo button now says "Snap a photo, post a job".
 * UPDATED : 2026-11-10_0430 UTC — "insured pros" → "background-checked, vetted pros" (insurance is only required for services that need it).
 */
import Link from "next/link";
import { Ico } from "@/components/Glyph";
import { BRAND, SERVICES, firstProjectLine, serviceText } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { PostProjectForm } from "@/components/PostProjectForm";

export const metadata = {
  title: "Post your project",
  description: `Tell ${BRAND.name} what you need done — cleaning, repairs, remodeling, moving, business services and more. We call you within minutes with a plan and an upfront price, and send one background-checked, vetted pro.`,
  alternates: { canonical: "/post" },
};

export default async function PostProject({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const l = await getLocale();
  const es = l === "es";
  const { service } = await searchParams;
  const services = SERVICES.map((s) => ({ slug: s.slug, name: serviceText(l, s.slug, s).name })).sort((a, b) => a.name.localeCompare(b.name));
  const preset = services.some((s) => s.slug === service) ? service! : null;
  const steps = es
    ? [["Publique su proyecto", "Díganos qué necesita, cuándo y su presupuesto. Toma un minuto."], ["Le llamamos en minutos", "Una persona de Handled le llama con un plan y un precio fijo, o agenda una visita gratis para trabajos grandes."], ["Un profesional verificado lo hace", "Verificado y con antecedentes revisados. Fotos al terminar y lo rehacemos gratis si algo falta."], ["Le devolvemos dinero", `Marque la casilla de socio y le pagamos ${firstProjectLine(true)} cuando terminemos su proyecto, más una parte de cada trabajo de las personas que nos envíe.`]]
    : [["Post your project", "Tell us what you need, when, and your budget. It takes a minute."], ["We call you within minutes", "A real Handled person calls with a plan and an upfront price — or books a free visit for big jobs."], ["One vetted pro does it", "Background-checked and vetted. Photo check-out after every job, and a free redo if anything's missed."], ["Get paid back", `Tick the partner box and we pay you ${firstProjectLine()} once your project is done, plus a share of every job from people you send us.`]];
  return (
    <div className="wrap grid gap-10 pro:gap-8 py-12 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark"><Ico i="📝" className="mr-0" />{es ? "Gratis y sin compromiso" : "Free, no obligation"}</span>
        <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-gold-light/30 px-3 py-1 text-xs font-semibold"><Ico i="💵" className="mr-0" />{es ? `Reciba ${firstProjectLine(true)}` : `Get ${firstProjectLine()}`}</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{es ? "Publique su proyecto." : "Post your project."} <span className="text-brand">{es ? "Nosotros nos encargamos." : "We'll handle it."}</span></h1>
        <p className="mt-4 text-lg text-ink-soft">{es ? "Cualquier trabajo para su hogar o negocio, grande o pequeño. A diferencia de los sitios de clientes potenciales, no vendemos su información a cinco contratistas: Handled se encarga del trabajo de principio a fin." : "Any job for your home or business, big or small. Unlike lead sites, we don't sell your details to five contractors — Handled takes the job from first call to finished work."}</p>
        <ol className="mt-8 space-y-5">{steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{i + 1}</span><span><span className="block font-semibold">{t}</span><span className="block text-sm text-ink-soft">{d}</span></span></li>
        ))}</ol>
        <p className="mt-8 text-sm text-ink-soft">{es ? "¿Ya sabe lo que quiere?" : "Already know what you want?"} <Link href="/book" className="font-semibold text-brand">{es ? "Vea su precio al instante" : "Get an instant price"} →</Link> · <Link href="/snap" className="font-semibold text-brand">{es ? "Tome una foto, publique un trabajo" : "Snap a photo, post a job"} →</Link></p>
      </div>
      <PostProjectForm es={es} services={services} preset={preset} />
    </div>
  );
}
