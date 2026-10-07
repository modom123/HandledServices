/*
 * FILE    : apps/web/app/api/gift-cards/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * PURPOSE : Buy a gift card ($25–$1,000) → Stripe Checkout; the code is emailed once paid.
 * UPDATED : 2026-10-03_0042 UTC — records the buyer's acceptance of the Plus, Gift Card & Promo Terms.
 */
import { z } from "zod";
import { buyGiftCard } from "@/lib/growth";
import { rateLimit } from "@/lib/ratelimit";
import { getViewer } from "@/lib/auth";
import { MEMBERSHIP_PROMO_TERMS } from "@/lib/contracts";
import { recordAcceptance, requestMeta } from "@/lib/contracts/record";
import { getLocale } from "@/lib/locale";

const Body = z.object({
  amount: z.coerce.number().min(25).max(1000),
  purchaser_email: z.string().email(), purchaser_name: z.string().max(120).optional(),
  recipient_email: z.string().email(), recipient_name: z.string().max(120).optional(),
  message: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  const limited = await rateLimit(req, "form");
  if (limited) return limited;
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ error: "Please check the form ($25–$1,000, valid emails)" }, { status: 400 });
  const r = await buyGiftCard({ amount: b.data.amount, purchaserEmail: b.data.purchaser_email, purchaserName: b.data.purchaser_name, recipientEmail: b.data.recipient_email, recipientName: b.data.recipient_name, message: b.data.message });
  if (r.url) {
    const v = await getViewer(req).catch(() => null);
    await recordAcceptance([MEMBERSHIP_PROMO_TERMS], { profileId: v?.userId ?? null, email: b.data.purchaser_email, signerName: b.data.purchaser_name ?? null, method: "checkout", locale: await getLocale(), ...requestMeta(req) });
  }
  return r.url ? Response.json(r) : Response.json({ error: r.error }, { status: 503 });
}
