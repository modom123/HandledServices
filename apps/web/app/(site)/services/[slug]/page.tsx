/*
 * FILE    : apps/web/app/(site)/services/[slug]/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_1329 UTC — shared ServiceLanding: real reviews, rating markup, city links.
 * PURPOSE : Service detail page (SEO landing page per service).
 */
import { notFound } from "next/navigation";
import { SERVICES, getService } from "@handled/core";
import { publicReviews } from "@/lib/reviews";
import { ServiceLanding } from "@/components/ServiceLanding";

export const revalidate = 3600;

export function generateStaticParams() {
  return SERVICES.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const s = getService((await params).slug);
  return s ? { title: s.name, description: s.description, alternates: { canonical: `/services/${s.slug}` } } : {};
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const s = getService((await params).slug);
  if (!s) notFound();
  return <ServiceLanding s={s} reviews={await publicReviews({ slug: s.slug, limit: 5 })} />;
}
