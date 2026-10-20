/*
 * FILE    : apps/web/lib/quotes.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Request-a-quote for big jobs (remodels, construction, large cleanouts, commercial cleaning…), still upfront:
 *             createQuoteRequest — the customer describes the job (photos optional); up to 3 nearby pros who'd be
 *                                  offered it (dispatch's eligible()) get a private link; the customer gets theirs
 *             submitBid          — the pro names their pay (+ earliest date, note) or declines; the customer sees the
 *                                  all-in price (core quoteCustomerPrice: same commission and fee rules as every job)
 *             bookableQuoteBid / quoteBooked — the customer books a quote through the normal checkout at exactly
 *                                  that price; that pro gets the job first; the other quotes close
 *             quoteSweep         — every 10 minutes: unanswered invites expire after 24 hours and the next pros are
 *                                  asked (once); no quotes at all → the team is alerted to set up a free site visit
 *           Pros never see each other's quotes; customers see business names, ratings and jobs done.
 */
import "server-only";
import { BRAND, QUOTE_REQUEST, SERVICE_BY_SLUG, eligible, isPhotoPath, money, quoteCustomerPrice, type Contractor } from "@handled/core";
import { adminClient } from "./supabase/server";
import { sendEmail, siteUrl } from "./notify";
import { raiseAlert } from "./jobs";
import { zipCentroid } from "./geo";
import { signedUrls } from "./photos";

const db = () => adminClient();
const HOUR = 3600000;

export interface QuoteRequestInput { contact_name: string; contact_email: string; contact_phone: string | null; service_slug: string; description: string; zip: string; city: string | null; preferred_date: string | null; photos: string[] }

/** Approved pros who'd be offered this job, best first, minus the ones already asked. */
async function prosFor(r: { service_slug: string; zip: string; preferred_date: string | null }, skip: string[], n: number): Promise<Contractor[]> {
  const svc = SERVICE_BY_SLUG[r.service_slug];
  if (!svc) return [];
  const [{ data }, g] = await Promise.all([
    db().from("contractors").select("*").eq("status", "approved").overlaps("trades", svc.trades).order("rating", { ascending: false }).limit(200),
    zipCentroid(r.zip).catch(() => null),
  ]);
  const job = { service_slug: r.service_slug, zip: r.zip, scheduled_date: r.preferred_date, lat: g?.lat ?? null, lng: g?.lng ?? null };
  return ((data ?? []) as Contractor[]).filter((c) => !skip.includes(c.id) && eligible(c, job) === null)
    .sort((a, b) => Number(b.rating) - Number(a.rating) || b.jobs_completed - a.jobs_completed).slice(0, n);
}

async function invite(requestId: string, pros: Contractor[]) {
  const { data: req } = await db().from("quote_requests").select("*").eq("id", requestId).single();
  const svc = SERVICE_BY_SLUG[req.service_slug];
  let n = 0;
  for (const p of pros) {
    const { data: bid } = await db().from("quote_bids").insert({ request_id: requestId, contractor_id: p.id }).select("token").single();
    if (!bid || !p.email) continue;
    await sendEmail(p.email, `Quote request: ${svc?.name ?? "a job"} in ${req.city ?? req.zip}`, [
      `Hi ${p.contact_name || p.business_name},`, "",
      `A customer near ${req.city ?? req.zip} asked for quotes on ${svc?.name.toLowerCase() ?? "a job"}${req.preferred_date ? ` around ${req.preferred_date}` : ""}. Up to ${QUOTE_REQUEST.maxPros} pros are asked; the customer picks one.`, "",
      `"${String(req.description).slice(0, 600)}"`, "",
      `See the details${req.photos?.length ? " and photos" : ""} and send your firm price (what you want to earn) within ${QUOTE_REQUEST.replyHours} hours:`,
      `${siteUrl()}/quote/bid/${bid.token}`, "",
      "If they book your quote, you get the job first, at that pay. Not for you? Decline from the same link.", "",
      `— ${BRAND.name}`,
    ].join("\n")).catch(() => {});
    n++;
  }
  return n;
}

export async function createQuoteRequest(i: QuoteRequestInput, customerId: string | null): Promise<{ ok: boolean; token?: string; invited?: number; error?: string }> {
  if (!SERVICE_BY_SLUG[i.service_slug]) return { ok: false, error: "Pick a service" };
  const { data: r, error } = await db().from("quote_requests").insert({
    customer_id: customerId, contact_name: i.contact_name, contact_email: i.contact_email.toLowerCase(), contact_phone: i.contact_phone, service_slug: i.service_slug,
    description: i.description, zip: i.zip, city: i.city, preferred_date: i.preferred_date, photos: i.photos.filter(isPhotoPath).slice(0, 8),
    expires_at: new Date(Date.now() + QUOTE_REQUEST.openDays * 24 * HOUR).toISOString(),
  }).select("id, token").single();
  if (error || !r) return { ok: false, error: error?.message ?? "Couldn't save" };
  const invited = await invite(r.id, await prosFor(i, [], QUOTE_REQUEST.maxPros));
  const svc = SERVICE_BY_SLUG[i.service_slug];
  await sendEmail(i.contact_email, `${BRAND.name}: your quote request for ${svc.name.toLowerCase()}`, [
    `Hi ${i.contact_name.split(" ")[0]},`, "",
    invited ? `We sent your job to ${invited} vetted local pro${invited === 1 ? "" : "s"}. Firm quotes usually arrive within ${QUOTE_REQUEST.replyHours} hours, and each one is an all-in price — no surprises.` : "We're finding the right pros for your job and will be in touch shortly.", "",
    `See your quotes and book the one you like: ${siteUrl()}/quote/${r.token}`, "",
    `— The ${BRAND.name} team`,
  ].join("\n")).catch(() => {});
  if (!invited) await raiseAlert("sales", "warn", `Quote request with no matching pros: ${svc.name} in ${i.city ?? i.zip}`, `${i.contact_name} · ${i.contact_phone ?? i.contact_email}\n"${i.description.slice(0, 500)}"\n\nRecruit a pro for it or set up a free site visit.`);
  return { ok: true, token: r.token, invited };
}

export async function bidByToken(token: string) {
  if (!/^[a-z0-9]{12,40}$/.test(token)) return null;
  const { data: bid } = await db().from("quote_bids").select("*, quote_requests(*), contractors(business_name)").eq("token", token).maybeSingle();
  if (!bid) return null;
  const req = bid.quote_requests as Record<string, unknown> & { photos: string[] };
  return { bid, request: req, photoUrls: req.photos?.length ? await signedUrls(req.photos).catch(() => []) : [] };
}

export async function submitBid(token: string, a: { decline: boolean; pay: number | null; earliest_date: string | null; note: string | null }): Promise<{ ok: boolean; price?: number; error?: string }> {
  const found = await bidByToken(token);
  if (!found) return { ok: false, error: "This link isn't valid" };
  const { bid, request } = found;
  if (!["invited", "quoted"].includes(bid.status)) return { ok: false, error: "This request is closed" };
  if (!["open", "quoted"].includes(String(request.status)) || new Date(String(request.expires_at)) < new Date()) return { ok: false, error: "The customer's request has closed" };
  if (a.decline) { await db().from("quote_bids").update({ status: "declined", quoted_at: new Date().toISOString() }).eq("id", bid.id); return { ok: true }; }
  const pay = Math.round(Number(a.pay));
  if (!(pay >= QUOTE_REQUEST.minPay && pay <= QUOTE_REQUEST.maxPay)) return { ok: false, error: `Enter your price from ${money(QUOTE_REQUEST.minPay)}` };
  const price = quoteCustomerPrice(pay, String(request.service_slug));
  await db().from("quote_bids").update({ status: "quoted", pay, price, earliest_date: a.earliest_date || null, note: a.note?.slice(0, 1000) || null, quoted_at: new Date().toISOString() }).eq("id", bid.id);
  await db().from("quote_requests").update({ status: "quoted" }).eq("id", request.id).eq("status", "open");
  const name = (bid.contractors as { business_name?: string } | null)?.business_name ?? "A pro";
  await sendEmail(String(request.contact_email), `New quote: ${money(price)} from ${name}`, `${name} sent a firm, all-in quote of ${money(price)}${a.earliest_date ? ` (as soon as ${a.earliest_date})` : ""}.\n\nCompare your quotes and book: ${siteUrl()}/quote/${request.token}\n\n— The ${BRAND.name} team`).catch(() => {});
  return { ok: true, price };
}

/** The customer's view: the request and the quotes in so far (cheapest first). */
export async function requestByToken(token: string) {
  if (!/^[a-z0-9]{12,40}$/.test(token)) return null;
  const { data: req } = await db().from("quote_requests").select("*").eq("token", token).maybeSingle();
  if (!req) return null;
  const { data: bids } = await db().from("quote_bids").select("id, status, price, earliest_date, note, quoted_at, contractors(business_name, rating, jobs_completed)").eq("request_id", req.id);
  const all = (bids ?? []) as unknown as { id: string; status: string; price: number | null; earliest_date: string | null; note: string | null; contractors: { business_name: string; rating: number; jobs_completed: number } | null }[];
  return { request: req, quotes: all.filter((b) => b.status === "quoted" || b.status === "chosen").sort((a, b) => Number(a.price) - Number(b.price)), waiting: all.filter((b) => b.status === "invited").length };
}

/** A quote the customer can still book, for this service. */
export async function bookableQuoteBid(requestToken: string, bidId: string, slug: string) {
  const { data: req } = await db().from("quote_requests").select("id, service_slug, status, expires_at").eq("token", requestToken).maybeSingle();
  if (!req || req.service_slug !== slug || !["open", "quoted"].includes(req.status) || new Date(req.expires_at) < new Date()) return null;
  const { data: bid } = await db().from("quote_bids").select("id, request_id, contractor_id, price, status").eq("id", bidId).eq("request_id", req.id).eq("status", "quoted").maybeSingle();
  return bid && bid.price ? { id: bid.id as string, request_id: bid.request_id as string, contractor_id: bid.contractor_id as string, price: Number(bid.price) } : null;
}

export async function quoteBooked(requestId: string, bidId: string, jobId: string) {
  await db().from("quote_bids").update({ status: "chosen" }).eq("id", bidId);
  await db().from("quote_bids").update({ status: "lost" }).eq("request_id", requestId).eq("status", "quoted").neq("id", bidId);
  await db().from("quote_bids").update({ status: "expired" }).eq("request_id", requestId).eq("status", "invited");
  await db().from("quote_requests").update({ status: "booked", job_id: jobId }).eq("id", requestId);
}

/** Expire old invites and requests; ask the next pros once; alert the team when nobody quoted. */
export async function quoteSweep(): Promise<{ expired: number; reinvited: number }> {
  const cutoff = new Date(Date.now() - QUOTE_REQUEST.replyHours * HOUR).toISOString();
  const { data: old } = await db().from("quote_bids").update({ status: "expired" }).eq("status", "invited").lt("invited_at", cutoff).select("request_id");
  await db().from("quote_requests").update({ status: "expired" }).in("status", ["open", "quoted"]).lt("expires_at", new Date().toISOString());
  let reinvited = 0;
  for (const id of [...new Set((old ?? []).map((b) => b.request_id as string))]) {
    const { data: req } = await db().from("quote_requests").select("*").eq("id", id).single();
    if (!req || req.status !== "open") continue; // already has quotes, or closed
    const { data: bids } = await db().from("quote_bids").select("contractor_id, status").eq("request_id", id);
    if ((bids ?? []).some((b) => b.status === "invited")) continue;
    const asked = (bids ?? []).map((b) => b.contractor_id as string);
    const next = asked.length < QUOTE_REQUEST.maxPros * 2 ? await prosFor(req, asked, QUOTE_REQUEST.maxPros) : [];
    if (next.length) reinvited += await invite(id, next);
    else await raiseAlert("sales", "warn", `No quotes yet: ${SERVICE_BY_SLUG[req.service_slug]?.name ?? req.service_slug} in ${req.city ?? req.zip}`, `${req.contact_name} · ${req.contact_phone ?? req.contact_email}\nNo pro has quoted in ${QUOTE_REQUEST.replyHours} hours. Call them to set up a free site visit.`);
  }
  return { expired: (old ?? []).length, reinvited };
}
