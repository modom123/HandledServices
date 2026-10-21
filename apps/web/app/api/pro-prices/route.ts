/*
 * FILE    : apps/web/app/api/pro-prices/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-20_0200 UTC
 * PURPOSE : Booking page: the pros a customer can choose for this job and how each prices it (as a % of Handled's
 *           suggested pay — the browser turns it into the all-in price with core proPrice(), the same function the
 *           server uses at booking). GET ?service=&zip=&date=&window=. Business names and ratings only.
 */
import { proRatesFor } from "@/lib/pro-prices";
import { rateLimit } from "@/lib/ratelimit";

export async function GET(req: Request) {
  const limited = await rateLimit(req, "pro_prices");
  if (limited) return limited;
  const p = new URL(req.url).searchParams;
  const rows = await proRatesFor({ slug: p.get("service") ?? "", zip: p.get("zip") ?? "", date: p.get("date"), window: p.get("window") }).catch(() => []);
  return Response.json({ pros: rows }, { headers: { "Cache-Control": "private, max-age=60" } });
}
