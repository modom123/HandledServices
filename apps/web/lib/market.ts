/*
 * FILE    : apps/web/lib/market.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0147 UTC
 * PURPOSE : The market sets the price — inside guardrails:
 *             getMarketFactor     — what we've learned for a service in an area (manual override wins)
 *             recordSignal        — every accept / decline / counter / expiry vs. our suggestion
 *             refreshMarketFactors — daily: move each suggestion toward what pros actually accept
 *             proCounter          — a pro says "I'll do it for $X"; the customer is asked
 *             startRaise          — the customer raises their offer or accepts a counter: the
 *                                   difference is charged (saved card, else a payment link);
 *                                   once paid (markPaid "offer_raise") the job is re-offered at the
 *                                   higher pay, or assigned to the pro whose counter they took
 *             nudgeLowOffers      — no pro yet after a while → suggest raising, from real counters
 */
import "server-only";
import { BRAND, MARKET_BOUNDS, clampFactor, getService, marketFactor, money, priceForPayout, serviceText, type Job, type PriceSignal } from "@handled/core";
import { adminClient } from "./supabase/server";
import { notify } from "./push";
import { siteUrl } from "./notify";
import { chargeSavedCard, createCheckout } from "./stripe";

const db = () => adminClient();
const area = (zip: string | null | undefined) => (zip && /^\d{5}$/.test(zip) ? zip.slice(0, 3) : "all");
const svcEs = (slug: string) => { const s = getService(slug); return s ? serviceText("es", slug, s).name : slug; };

/** The factor for this service near this ZIP (falls back to all areas, then 1). */
export async function getMarketFactor(slug: string, zip?: string | null): Promise<number> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return 1;
  try {
    const { data } = await db().from("market_factors").select("area, factor, manual_factor").eq("service_slug", slug).in("area", [area(zip), "all"]);
    const rows = (data ?? []) as { area: string; factor: number; manual_factor: number | null }[];
    const pick = rows.find((r) => r.area === area(zip) && r.area !== "all") ?? rows.find((r) => r.area === "all");
    return pick ? clampFactor(Number(pick.manual_factor ?? pick.factor)) : 1;
  } catch { return 1; }
}

/** The list price behind a job (before promo / Plus savings, which come out of our share). */
export const listPriceOf = (job: Pick<Job, "price_final" | "discount" | "member_benefit">) =>
  Number(job.price_final ?? 0) + Number(job.discount ?? 0) + Number(job.member_benefit ?? 0);

export async function recordSignal(job: Pick<Job, "id" | "service_slug" | "zip" | "price_final" | "discount" | "member_benefit"> & { suggested_price?: number | null }, outcome: PriceSignal["outcome"], contractorId?: string | null, counter?: number | null) {
  const price = listPriceOf(job);
  const suggested = Number(job.suggested_price ?? price);
  if (!(price > 0) || !(suggested > 0)) return;
  await db().from("price_signals").insert({ service_slug: job.service_slug, area: area(job.zip), price, suggested, outcome, counter: counter ?? null, job_id: job.id, contractor_id: contractorId ?? null })
    .then(({ error }) => { if (error) console.error("[signal]", error.message); });
}

/** Daily: learn from the last 60 days of outcomes, per service, overall and per ZIP area. */
export async function refreshMarketFactors() {
  const since = new Date(Date.now() - 60 * 86400000).toISOString();
  const { data } = await db().from("price_signals").select("service_slug, area, price, suggested, outcome, counter").gte("created_at", since).limit(50000);
  const rows = (data ?? []) as (PriceSignal & { service_slug: string; area: string })[];
  const { data: cur } = await db().from("market_factors").select("service_slug, area, factor, manual_factor");
  const current = new Map(((cur ?? []) as { service_slug: string; area: string; factor: number; manual_factor: number | null }[]).map((c) => [`${c.service_slug}|${c.area}`, c]));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) for (const a of ["all", r.area]) { const k = `${r.service_slug}|${a}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  let updated = 0;
  for (const [k, sig] of groups) {
    const [slug, a] = k.split("|");
    const c = current.get(k);
    const m = marketFactor(sig, Number(c?.factor ?? 1));
    if (m.samples < MARKET_BOUNDS.minSamples && !c) continue;
    await db().from("market_factors").upsert({ service_slug: slug, area: a, factor: m.factor, samples: m.samples, target: m.target, updated_at: new Date().toISOString(), updated_by: "learning" }, { onConflict: "service_slug,area" });
    updated++;
  }
  return { updated, signals: rows.length };
}

/** A pro counters an offer: "I'll do it for $X" (their payout). The customer decides. */
export async function proCounter(offerId: string, contractorId: string, wantPayout: number, note: string) {
  const { data: offer } = await db().from("job_offers").select("*").eq("id", offerId).eq("contractor_id", contractorId).maybeSingle();
  if (!offer || offer.status !== "offered" || new Date(offer.expires_at) < new Date()) return { ok: false, error: "Offer is no longer available" };
  const { data: j } = await db().from("jobs").select("*").eq("id", offer.job_id).single();
  const job = j as Job & { suggested_price: number | null };
  if (!job || job.contractor_id) return { ok: false, error: "Someone already took this job" };
  const want = Math.round(wantPayout);
  if (!(want > Number(offer.payout))) return { ok: false, error: `Counter above the offered ${money(Number(offer.payout))}` };
  if (want > Number(offer.payout) * 2) return { ok: false, error: "That's more than double the offer — message us if the job is bigger than described" };
  const newList = priceForPayout(want, job.service_slug);
  const extra = Math.max(0, newList - listPriceOf(job));
  const counterPrice = Math.round((Number(job.price_final) + extra) * 100) / 100;
  await db().from("job_offers").update({ status: "countered", counter_payout: want, counter_price: counterPrice, counter_note: note || null, countered_at: new Date().toISOString(), responded_at: new Date().toISOString() }).eq("id", offerId);
  await recordSignal(job, "countered", contractorId, newList);
  const { data: pro } = await db().from("contractors").select("contact_name, rating, jobs_completed").eq("id", contractorId).single();
  const who = `${String(pro?.contact_name ?? "A pro").split(" ")[0]} (${Number(pro?.rating ?? 5).toFixed(1)}★, ${pro?.jobs_completed ?? 0} jobs)`;
  const link = `${siteUrl()}/account/jobs/${job.id}`;
  await notify(job.customer_id, {
    title: `A pro can do it for ${money(counterPrice)}`, body: `${who} — ${money(extra)} more than your offer. Tap to accept or keep waiting.`, data: { type: "job", jobId: job.id },
    email: { to: job.contact_email, subject: `A pro offered to do your ${getService(job.service_slug)?.name} for ${money(counterPrice)} (${job.ref})`,
      text: `${who} can do it for ${money(counterPrice)} — ${money(extra)} more than you offered.${note ? `\n\nTheir note: "${note}"` : ""}\n\nAccept it (we charge only the difference) or keep waiting for another pro: ${link}\n\n— ${BRAND.name}` },
    locale: job.locale,
    es: { title: `Un profesional puede hacerlo por ${money(counterPrice)}`, body: `${who} — ${money(extra)} más que su oferta. Toque para aceptar o seguir esperando.`,
      subject: `Un profesional ofreció hacer su ${svcEs(job.service_slug)} por ${money(counterPrice)} (${job.ref})`,
      text: `${who} puede hacerlo por ${money(counterPrice)} — ${money(extra)} más de lo que usted ofreció.${note ? `\n\nSu nota: "${note}"` : ""}\n\nAcéptelo (solo cobramos la diferencia) o siga esperando a otro profesional: ${link}\n\n— ${BRAND.name}` },
  });
  return { ok: true, counterPrice, extra };
}

/**
 * The customer raises their offer (to `newPrice`) or accepts a counter (`counterOfferId`).
 * Charges the difference: saved card first, else a payment link. markPaid("offer_raise") finishes it.
 */
export async function startRaise(jobId: string, customerId: string | null, o: { newPrice?: number; counterOfferId?: string }) {
  const { data: j } = await db().from("jobs").select("*").eq("id", jobId).single();
  const job = j as Job | null;
  if (!job || (customerId && job.customer_id !== customerId)) return { ok: false, error: "Not found" };
  if (job.contractor_id) return { ok: false, error: "A pro already took this job" };
  if (!job.paid_at && !job.deposit_paid_at) return { ok: false, error: "Pay for the booking first" };
  let target = Number(o.newPrice ?? 0);
  let counterId: string | null = null;
  if (o.counterOfferId) {
    const { data: off } = await db().from("job_offers").select("id, status, counter_price, job_id").eq("id", o.counterOfferId).maybeSingle();
    if (!off || off.job_id !== jobId || off.status !== "countered") return { ok: false, error: "That counter is no longer available" };
    target = Number(off.counter_price); counterId = off.id;
  }
  const extra = Math.round((target - Number(job.price_final)) * 100) / 100;
  if (!(extra >= 1)) return { ok: false, error: "Enter a higher price than you're paying now" };
  if (target > Number(job.price_final) * 3) return { ok: false, error: "That's more than triple the price — call us" };
  await db().from("jobs").update({ pending_counter_offer: counterId, pending_raise: extra }).eq("id", jobId);
  const got = await chargeSavedCard(job, extra, "offer_raise");
  if (got) {
    const { markPaid } = await import("./jobs");
    await markPaid(jobId, { amount: got, via: "saved card", kind: "offer_raise" });
    return { ok: true, charged: got };
  }
  const svc = getService(job.service_slug)!;
  const link = await createCheckout({ amount: extra, kind: "offer_raise", job, name: `${counterId ? "Accept pro's price" : "Raise your offer"} — ${svc.name} ${job.ref}`,
    description: counterId ? "Difference to the price a pro offered" : "Raised offer — goes to pros at the higher pay", customerEmail: job.contact_email, customerName: job.contact_name, createdBy: "customer" });
  return link ? { ok: true, url: link.url } : { ok: false, error: "Payments aren't set up yet — call us to raise your offer" };
}

/** After markPaid("offer_raise"): assign the countering pro, or re-offer at the higher pay. */
export async function afterRaisePaid(job: Job & { pending_counter_offer?: string | null }) {
  if (job.pending_counter_offer) {
    const { data: off } = await db().from("job_offers").select("id, contractor_id, counter_payout").eq("id", job.pending_counter_offer).single();
    await db().from("jobs").update({ pending_counter_offer: null, pending_raise: null, contractor_payout: off?.counter_payout ?? job.contractor_payout }).eq("id", job.id);
    if (off) {
      await db().from("job_offers").update({ status: "offered", payout: off.counter_payout, expires_at: new Date(Date.now() + 3600000).toISOString() }).eq("id", off.id);
      const { acceptOffer } = await import("./jobs");
      const r = await acceptOffer(off.id, off.contractor_id);
      if (r.ok) return { assigned: true };
    }
  }
  await db().from("jobs").update({ pending_counter_offer: null, pending_raise: null }).eq("id", job.id);
  // re-offer at the higher pay (open offers end; everyone eligible sees the new number)
  await db().from("job_offers").update({ status: "taken" }).eq("job_id", job.id).in("status", ["offered", "countered"]);
  const { dispatchJob } = await import("./jobs");
  await dispatchJob(job.id).catch((e) => console.error("[raise]", e));
  return { assigned: false };
}

/** No pro yet: suggest a higher offer, from real counters (else our suggestion). Once per job. */
export async function nudgeLowOffers() {
  const now = Date.now();
  const { data } = await db().from("jobs").select("*").is("contractor_id", null).eq("status", "dispatched").is("offer_nudged_at", null).not("paid_at", "is", null).limit(300);
  let nudged = 0;
  for (const job of (data ?? []) as (Job & { suggested_price: number | null; customer_offer: number | null })[]) {
    const waitH = job.priority === "urgent" || job.urgency === "asap" ? 2 : 12;
    if (now - new Date(job.updated_at).getTime() < waitH * 3600000) continue;
    const { data: counters } = await db().from("job_offers").select("counter_price").eq("job_id", job.id).eq("status", "countered");
    const cp = ((counters ?? []) as { counter_price: number }[]).map((c) => Number(c.counter_price)).sort((a, b) => a - b);
    const fromCounters = cp.length ? cp[Math.floor((cp.length - 1) / 2)] : null;
    const suggestion = Math.max(Number(job.price_final) + 5, Math.round(fromCounters ?? Math.max(Number(job.suggested_price ?? 0), Number(job.price_final) * 1.1)));
    await db().from("jobs").update({ offer_nudged_at: new Date().toISOString() }).eq("id", job.id);
    const link = `${siteUrl()}/account/jobs/${job.id}`;
    await notify(job.customer_id, {
      title: "No pro yet — raise your offer?", body: `${cp.length ? `${cp.length} pro(s) offered to do it for more.` : "Pros nearby usually take this for a bit more."} Try ${money(suggestion)}.`, data: { type: "job", jobId: job.id },
      email: { to: job.contact_email, subject: `No pro yet for ${job.ref} — raise your offer?`, text: `We haven't found a pro at ${money(Number(job.price_final))} yet.${cp.length ? ` ${cp.length} pro(s) offered to do it for more — you can accept one on your booking page.` : ""} Raising to about ${money(suggestion)} usually gets it covered quickly. You only pay the difference.\n\n${link}\n\nOr keep waiting — we'll keep trying at your price.\n\n— ${BRAND.name}` },
      locale: job.locale,
      es: { title: "Aún sin profesional — ¿sube su oferta?", body: `${cp.length ? `${cp.length} profesional(es) ofrecieron hacerlo por más.` : "Los profesionales cercanos suelen aceptarlo por un poco más."} Pruebe ${money(suggestion)}.`,
        subject: `Aún sin profesional para ${job.ref} — ¿sube su oferta?`, text: `Todavía no encontramos un profesional por ${money(Number(job.price_final))}.${cp.length ? ` ${cp.length} profesional(es) ofrecieron hacerlo por más; puede aceptar uno en la página de su reserva.` : ""} Subir a unos ${money(suggestion)} normalmente lo cubre rápido. Solo paga la diferencia.\n\n${link}\n\nO siga esperando: seguiremos intentando a su precio.\n\n— ${BRAND.name}` },
    });
    nudged++;
  }
  return nudged;
}

