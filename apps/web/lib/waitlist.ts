/*
 * FILE    : apps/web/lib/waitlist.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_2241 UTC
 * PURPOSE : Waitlist — people who wanted a service where no pro covers their ZIP yet.
 *             joinWaitlist   — saves (or refreshes) the sign-up
 *             notifyWaitlist — daily sweep: once an active pro can take that service there,
 *                              email/text them a booking link in their language (once)
 *           Sign-ups also feed Hub → Supply gaps, so recruiting goes where people are waiting.
 * UPDATED : 2026-10-04_1934 UTC — waits until the service is open in that city (launch set), not just covered by a pro.
 */
import "server-only";
import { openFor } from "./launch";
import { BRAND, eligible, getService, serviceText, type Contractor } from "@handled/core";
import { adminClient } from "./supabase/server";
import { zipCentroid } from "./geo";
import { notify } from "./push";
import { siteUrl } from "./notify";

export interface WaitlistEntry { email: string; phone?: string | null; name?: string | null; zip: string; service_slug: string; locale: "en" | "es"; profile_id?: string | null; source?: string }

export async function joinWaitlist(w: WaitlistEntry) {
  const { error } = await adminClient().from("waitlist").upsert(
    { ...w, email: w.email.trim().toLowerCase(), notified_at: null, created_at: new Date().toISOString() },
    { onConflict: "email,service_slug,zip" },
  );
  if (error) throw new Error(error.message);
}

/** Tell waiting people their area is open. Returns how many were told. */
export async function notifyWaitlist(limit = 300): Promise<number> {
  const db = adminClient();
  const { data: open } = await db.from("waitlist").select("*").is("notified_at", null).order("created_at").limit(limit);
  if (!open?.length) return 0;
  const { data: pros } = await db.from("contractors").select("*").eq("status", "approved");
  const contractors = (pros ?? []) as Contractor[];
  if (!contractors.length) return 0;
  let told = 0;
  for (const w of open as (WaitlistEntry & { id: string })[]) {
    const svc = getService(w.service_slug);
    if (!svc) continue;
    const g = await zipCentroid(w.zip);
    if (!(await openFor(w.service_slug, w.zip)).open) continue; // not launched in that city yet
    const covered = contractors.some((c) => eligible(c, { service_slug: w.service_slug, zip: w.zip, scheduled_date: null, lat: g?.lat, lng: g?.lng }) === null);
    if (!covered) continue;
    const link = `${siteUrl()}/book?service=${w.service_slug}`;
    const es = serviceText("es", svc.slug, svc).name;
    const first = w.name?.split(" ")[0];
    await notify(w.profile_id ?? null, {
      title: `${svc.name} is now in ${w.zip}`,
      body: "You asked us to tell you — book now.",
      data: { type: "book", slug: w.service_slug },
      email: { to: w.email, subject: `${svc.name} is now available in ${w.zip}`,
        text: `${first ? `Hi ${first},\n\n` : ""}You asked us to let you know when ${BRAND.name} could do ${svc.name.toLowerCase()} in ${w.zip}. We can now — vetted, insured pros and an upfront price.\n\nBook here: ${link}\n\n${BRAND.promise}` },
      sms: w.phone ? { to: w.phone, body: `${BRAND.name}: ${svc.name} is now available in ${w.zip}, as you asked. Book: ${link}` } : undefined,
      locale: w.locale,
      es: {
        title: `${es} ya está disponible en ${w.zip}`,
        body: "Nos pidió que le avisáramos — reserve ahora.",
        subject: `${es} ya está disponible en ${w.zip}`,
        text: `${first ? `Hola ${first}:\n\n` : ""}Nos pidió que le avisáramos cuando ${BRAND.name} pudiera ofrecer ${es.toLowerCase()} en ${w.zip}. Ya podemos: profesionales verificados y asegurados, con precio por adelantado.\n\nReserve aquí: ${link}\n\nPague por adelantado para asegurar a su profesional. ¿No quedó bien? Lo repetimos gratis o le devolvemos su dinero dentro de 30 días.`,
        sms: `${BRAND.name}: ${es} ya está disponible en ${w.zip}, como nos pidió. Reserve: ${link}`,
      },
    });
    await db.from("waitlist").update({ notified_at: new Date().toISOString() }).eq("id", w.id);
    told++;
  }
  return told;
}
