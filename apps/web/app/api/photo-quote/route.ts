/*
 * FILE    : apps/web/app/api/photo-quote/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_0200 UTC
 * PURPOSE : Price from photos (businesses, instead of a walkthrough). POST { service, frequency, details?, sqft?, zip,
 *           photos[], company, name, email, phone?, lead?, landing? } →
 *             • a price per visit (+ about-a-month for recurring work) from the rules engine, with the AI reading the
 *               photos to fill in the job's details (lib/project-estimate), and a link to book it at that price, or
 *             • when it's too big or unclear for an instant price: "our team sends your firm price from these photos
 *               within a few business hours", still no visit.
 *           Every request lands in the Lead inbox (with the photos) and alerts the team; a sales-email lead (?lead=)
 *           turns warm and its email sequence stops. Rate limited like the other AI price checks.
 */
import { z } from "zod";
import { BIZ_FREQUENCIES, PHOTO_QUOTE, getService, isPhotoPath, money, monthlyEstimate } from "@handled/core";
import { estimateProject } from "@/lib/project-estimate";
import { signedUrls } from "@/lib/photos";
import { rateLimit } from "@/lib/ratelimit";
import { intakeLead } from "@/lib/lead-intake";
import { raiseAlert } from "@/lib/jobs";
import { supabaseConfigured } from "@/lib/supabase/env";

const Body = z.object({
  service: z.string().max(80).refine((s) => Boolean(getService(s)), "Pick what you need"),
  frequency: z.enum(["once", "weekly", "biweekly", "monthly"]).default("once"),
  details: z.string().max(2000).nullable().optional(),
  sqft: z.number().int().min(0).max(2_000_000).nullable().optional(),
  zip: z.string().regex(/^\d{5}$/, "Add the 5-digit ZIP"),
  photos: z.array(z.string().refine(isPhotoPath, "Bad photo")).min(PHOTO_QUOTE.minPhotos, `Add at least ${PHOTO_QUOTE.minPhotos} photos`).max(PHOTO_QUOTE.maxPhotos),
  company: z.string().trim().min(2, "Add your company name").max(160),
  name: z.string().trim().min(2, "Add your name").max(120),
  email: z.string().trim().email("That email doesn't look right"),
  phone: z.string().trim().max(30).nullable().optional(),
  lead: z.string().regex(/^[a-z0-9]{8,40}$/).nullable().optional(),
  landing: z.string().max(60).nullable().optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "ai_quote");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: b.error.issues[0]?.message ?? "Check the form" }, { status: 400 });
  const d = b.data;
  const svc = getService(d.service)!;
  const freq = BIZ_FREQUENCIES.find((f) => f.value === d.frequency)!;
  const details = [`Business: ${d.company}.`, d.sqft ? `About ${d.sqft.toLocaleString("en-US")} sq ft.` : "", d.frequency !== "once" ? `${freq.label} service.` : "One-time job.", d.details?.trim() ?? ""].filter(Boolean).join(" ");
  const urls = await signedUrls(d.photos, 900).catch(() => [] as string[]);
  const est = await estimateProject({ service: d.service, details, zip: d.zip, photoUrls: urls, frequency: d.frequency });
  const perVisit = est.price?.point ?? null;
  const monthly = perVisit ? monthlyEstimate(perVisit, d.frequency) : null;
  const instant = Boolean(perVisit && !est.site_visit);

  // book it at this price: the booking page, pre-filled with what the photos showed
  const q = new URLSearchParams({ service: d.service, src: "photo_quote", utm_source: "photo_quote", for: "business", zip: d.zip });
  if (d.frequency !== "once") q.set("frequency", d.frequency);
  if (d.lead) q.set("lead", d.lead);
  q.set("photos", d.photos.join(","));
  const notes = [d.details?.trim(), est.notes].filter(Boolean).join("\n");
  if (notes) q.set("notes", notes.slice(0, 1500));
  for (const [k, v] of Object.entries(est.answers)) q.set(k, String(v));
  const bookUrl = instant ? `/book?${q}` : null;

  const priceLine = perVisit ? `${money(perVisit)}${d.frequency !== "once" ? ` per visit, ${freq.label.toLowerCase()}${monthly ? ` (about ${money(monthly)} a month)` : ""}` : ""}` : "no instant price";
  const summary = `${svc.name} for ${d.company}: ${priceLine}${instant ? "" : ` → firm price from the photos needed${est.visit_reason ? ` (${est.visit_reason})` : ""}`}`;
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await intakeLead({ name: d.name, email: d.email, phone: d.phone || null, company: d.company, zip: d.zip, service: d.service, campaign: d.landing ? `photo_quote_${d.landing}` : "photo_quote",
      message: `${summary}\n\n${details}${est.assumptions.length ? `\n\nWhat the photos showed: ${est.assumptions.map((a) => `${a.label}: ${a.value}`).join("; ")}` : ""}` }, { channel: d.lead ? "email" : "website", photos: d.photos }).catch((e) => console.error("[photo-quote] lead", e));
    const lead = d.lead ? await (await import("@/lib/biz-leads")).photoQuoteForLead(d.lead, summary).catch(() => null) : null;
    await raiseAlert("sales", instant ? "info" : "warn", `${instant ? "Price from photos" : "Firm price needed from photos"}: ${d.company}`,
      `${summary}\n${d.name} · ${d.email}${d.phone ? ` · ${d.phone}` : ""} · ${d.zip}${lead ? `\nBusiness lead: ${lead.business_name} (sequence stopped, marked to call)` : ""}\n${instant ? "They can book at this price now; follow up today." : `Send the firm price within ${PHOTO_QUOTE.reviewHours} business hours: the photos are on the lead in Hub → Lead inbox. No site visit needed unless the photos can't show it.`}`).catch(() => {});
  }
  return Response.json({
    ok: true, service: svc.name, frequency: d.frequency, per_visit: perVisit, monthly, low: est.price?.low ?? null, high: est.price?.high ?? null,
    instant, reason: est.visit_reason, assumptions: est.assumptions, tailored: est.tailored, book_url: bookUrl, review_hours: PHOTO_QUOTE.reviewHours,
  });
}
