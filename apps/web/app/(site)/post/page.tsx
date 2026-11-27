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
 * UPDATED : 2026-11-17_1446 UTC — Estimate first: posting gives an instant price estimate, then the customer books, works
 *           it through with an AI project manager, or has a real person call (steps and copy updated).
 * UPDATED : 2026-11-27_1500 UTC — "Get it Handled": the page is branded Get it Handled; 3 steps (pick it, snap 3 photos, see
 *           your price); services carry their category for the category-first picker.
 * UPDATED : 2026-11-17_1600 UTC — copy: projects up to $2,500 are priced instantly and booked with no call or site visit.
 */
import Link from "next/link";
import { Ico } from "@/components/Glyph";
import { BRAND, SERVICES, firstProjectLine, serviceText } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { PostProjectForm } from "@/components/PostProjectForm";
import { popularServices } from "@/lib/popular-services";

export const metadata = {
  title: "Get it Handled",
  description: `Get it Handled: pick what you need, snap 3 photos, answer 3 quick questions and see your price in about a minute. Cleaning, repairs, remodeling, moving, business services and more, done by one background-checked, vetted ${BRAND.name} pro.`,
  alternates: { canonical: "/post" },
};

export default async function PostProject({ searchParams }: { searchParams: Promise<{ service?: string; for?: string }> }) {
  const l = await getLocale();
  const es = l === "es";
  const { service, for: forWho } = await searchParams;
  const services = SERVICES.map((s) => ({ slug: s.slug, name: serviceText(l, s.slug, s).name, category: s.category })).sort((a, b) => a.name.localeCompare(b.name));
  const popular = await popularServices().catch(() => ({ home: [], business: [] }));
  const preset = services.some((s) => s.slug === service) ? service! : null;
  const steps = es
    ? [["Hogar o negocio, y lo que necesita", "Toque Hogar o Negocio y siga el camino hasta el servicio. ¿No sabe cómo se llama? Omítalo: sus fotos nos lo dicen."], ["Tome 3 fotos", "Le decimos qué fotografiar. Nuestra IA mide el trabajo con ellas: sin visita."], ["Vea su precio y resérvelo", `Código postal, cuándo, y listo: su precio en un minuto. Hasta $2,500 se reserva a ese precio; los proyectos más grandes reciben un precio fijo. Marque la casilla de socio y reciba ${firstProjectLine(true)}.`]]
    : [["Home or business, then what you need", "Tap Home or Business, then follow the path to the service. Not sure what it's called? Skip it: your photos tell us."], ["Snap 3 photos", "We tell you what to shoot. Our AI sizes the job from them, so there's no walkthrough."], ["See your price and book it", `ZIP, when, done: your price in about a minute. Up to $2,500 books at that price; bigger projects get a firm price. Tick the partner box and get ${firstProjectLine()}.`]];
  return (
    <div className="wrap grid gap-10 pro:gap-8 py-12 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-dark"><Ico i="📝" className="mr-0" />{es ? "Gratis y sin compromiso" : "Free, no obligation"}</span>
        <span className="ml-2 inline-flex items-center gap-2 rounded-full bg-gold-light/30 px-3 py-1 text-xs font-semibold"><Ico i="💵" className="mr-0" />{es ? `Reciba ${firstProjectLine(true)}` : `Get ${firstProjectLine()}`}</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight">{es ? "Resuélvalo con" : "Get it"} <span className="text-brand">Handled.</span></h1>
        <p className="mt-4 text-lg text-ink-soft">{es ? "Elija, tome 3 fotos, responda 3 preguntas: su precio en un minuto. Cualquier trabajo para su hogar o negocio, y nunca vendemos sus datos a otros contratistas." : "Pick it, snap 3 photos, answer 3 quick questions: your price in about a minute. Any job for your home or business, and we never sell your details to other contractors."}</p>
        <ol className="mt-8 space-y-5">{steps.map(([t, d], i) => (
          <li key={t} className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-sm font-bold text-white">{i + 1}</span><span><span className="block font-semibold">{t}</span><span className="block text-sm text-ink-soft">{d}</span></span></li>
        ))}</ol>
        <p className="mt-8 text-sm text-ink-soft">{es ? "¿Ya sabe lo que quiere?" : "Already know what you want?"} <Link href="/book" className="font-semibold text-brand">{es ? "Vea su precio al instante" : "Get an instant price"} →</Link> · <Link href="/snap" className="font-semibold text-brand">{es ? "Tome una foto, publique un trabajo" : "Snap a photo, post a job"} →</Link></p>
      </div>
      <PostProjectForm es={es} services={services} preset={preset} audience={forWho === "business" ? "business" : forWho === "home" ? "home" : null} popular={popular} />
    </div>
  );
}
