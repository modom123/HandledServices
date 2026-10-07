/*
 * FILE    : apps/web/lib/growth.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0316 UTC
 * UPDATED : 2026-10-02_1412 UTC — Spanish versions of person-facing texts, emails and push.
 * PURPOSE : Customer money features, server side (rules in @handled/core growth.ts):
 *             Handled Plus  — startMembership(), syncSubscription(), activeMembership(), portal
 *             Promo codes   — previewBenefits() for the booking screen, priceBenefits() at booking
 *             Gift cards    — buyGiftCard() → Stripe → issueGiftCard(); redeemGift() at booking
 *             Referrals     — ensureReferralCode(), rewardReferral() when the friend's job is done
 *             Tips          — tipJob() (saved card or Checkout) → settleTip(): 100% to the pro
 *           Discounts come out of our share (capDiscount) — the pro's pay never changes.
 * UPDATED : 2026-10-07_0345 UTC — grand opening discount removed (owner decision).
 */
import "server-only";
import {
  BRAND, HANDLED_PLUS, REFERRAL, TIP_MAX, capDiscount, getService, makeCode, memberSaving, money, promoDiscount, serviceText, t,
  type Job, type PromoCode,
} from "@handled/core";
import { adminClient } from "./supabase/server";
import { createCheckout, getStripe } from "./stripe";
import { sendEmail, siteUrl } from "./notify";
import { notify } from "./push";
import { addEvent, raiseAlert } from "./jobs";

const db = () => adminClient();
const r2 = (n: number) => Math.round(n * 100) / 100;

// ─── Handled Plus ────────────────────────────────────────────────────────────

export async function activeMembership(email?: string | null, profileId?: string | null) {
  if (!email && !profileId) return null;
  let q = db().from("memberships").select("*").eq("status", "active");
  q = profileId && email ? q.or(`profile_id.eq.${profileId},email.ilike.${email.replace(/[,()]/g, "")}`) : profileId ? q.eq("profile_id", profileId) : q.ilike("email", email!);
  const { data } = await q.limit(1).maybeSingle();
  return data as { id: string; current_period_end: string | null; stripe_customer_id: string | null } | null;
}

export async function startMembership(o: { email: string; profileId: string | null; name?: string | null }) {
  const s = getStripe();
  if (!s) return { error: "Payments aren't set up yet" };
  if (await activeMembership(o.email, o.profileId)) return { error: `You're already a ${HANDLED_PLUS.name} member.` };
  const customer = (await s.customers.create({ email: o.email, name: o.name ?? undefined })).id;
  const { data: m } = await db().from("memberships").insert({ email: o.email.toLowerCase(), profile_id: o.profileId, stripe_customer_id: customer }).select("id").single();
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: HANDLED_PLUS.monthly * 100, recurring: { interval: "month" }, product_data: { name: HANDLED_PLUS.name, description: HANDLED_PLUS.perks.join(" · ") } } }],
    metadata: { membership_id: m!.id },
    subscription_data: { metadata: { membership_id: m!.id } },
    ...(process.env.STRIPE_TAX === "on" ? { automatic_tax: { enabled: true }, customer_update: { address: "auto" as const } } : {}),
    success_url: `${siteUrl()}/plus?joined=1`,
    cancel_url: `${siteUrl()}/plus`,
  });
  return { url: session.url };
}

export async function membershipPortal(email: string, profileId: string | null) {
  const s = getStripe();
  const m = await activeMembership(email, profileId);
  if (!s || !m?.stripe_customer_id) return null;
  return (await s.billingPortal.sessions.create({ customer: m.stripe_customer_id, return_url: `${siteUrl()}/account` })).url;
}

/** Stripe subscription → our membership row (by metadata id or subscription id). */
export async function syncSubscription(sub: { id: string; status: string; metadata?: Record<string, string> | null; customer: unknown; items?: { data?: { current_period_end?: number }[] }; cancel_at?: number | null }, membershipId?: string | null) {
  const id = membershipId ?? sub.metadata?.membership_id ?? null;
  const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "past_due" || sub.status === "unpaid" ? "past_due" : sub.status === "canceled" || sub.status === "incomplete_expired" ? "canceled" : "pending";
  const end = sub.items?.data?.[0]?.current_period_end;
  const patch = { status, stripe_subscription_id: sub.id, current_period_end: end ? new Date(end * 1000).toISOString() : null, ...(status === "canceled" ? { canceled_at: new Date().toISOString() } : {}) };
  const q = db().from("memberships").update(patch);
  const { data } = await (id ? q.eq("id", id) : q.eq("stripe_subscription_id", sub.id)).select("email, profile_id, status").maybeSingle();
  if (data && status === "active" && membershipId) // welcome once, from the completed checkout
    await notify(data.profile_id, { title: `Welcome to ${HANDLED_PLUS.name}`, body: "No priority fees and 10% off every job, starting now.", data: { type: "account" }, email: { to: data.email, subject: `Welcome to ${HANDLED_PLUS.name}`, text: `You're in. ${HANDLED_PLUS.perks.join("\n")}\n\nManage or cancel anytime: ${siteUrl()}/account\n\n— ${BRAND.name}` },
      es: { title: `Le damos la bienvenida a ${HANDLED_PLUS.name}`, body: "Sin cargos de prioridad y 10% de descuento en cada trabajo, desde ahora.",
        subject: `Le damos la bienvenida a ${HANDLED_PLUS.name}`, text: `Ya es miembro. ${HANDLED_PLUS.perks.map((x) => t("es", x)).join("\n")}\n\nAdministre o cancele su membresía cuando quiera: ${siteUrl()}/account\n\n— ${BRAND.name}` } });
}

// ─── Promo codes & gift cards ────────────────────────────────────────────────

export async function findPromo(code: string | null | undefined): Promise<PromoCode | null> {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,40}$/.test(c)) return null;
  const { data } = await db().from("promo_codes").select("*").eq("code", c).maybeSingle();
  return (data as PromoCode | null) ?? null;
}

export async function isFirstJob(email: string | null | undefined) {
  if (!email) return true;
  const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).ilike("contact_email", email).or("paid_at.not.is.null,deposit_paid_at.not.is.null");
  return !count;
}

/**
 * What the customer saves on this order: member saving (rush back + 10%) and/or a promo code,
 * both capped so we keep DISCOUNT_FLOOR after paying the pro. Gift cards are reported separately
 * (prepaid money, applied after the job is created).
 */
export async function priceBenefits(o: { slug: string; listPrice: number; payout: number; rushFee: number; email?: string | null; profileId?: string | null; code?: string | null }) {
  const member = Boolean(await activeMembership(o.email, o.profileId));
  const promo = o.code ? await findPromo(o.code) : null;
  const promoCheck = o.code ? promoDiscount(promo, o.listPrice, { firstJob: await isFirstJob(o.email) }) : null;
  const isGift = promo?.kind === "gift";
  const wantedMember = member ? memberSaving(o.listPrice, o.rushFee) : 0;
  const memberBenefit = capDiscount(o.listPrice, o.payout, wantedMember);
  const promoAmount = promoCheck?.ok && !isGift ? capDiscount(o.listPrice - memberBenefit, o.payout, promoCheck.amount) : 0;
  const price = r2(o.listPrice - memberBenefit - promoAmount);
  const gift = promoCheck?.ok && isGift ? Math.min(Number(promo!.balance ?? 0), price) : 0;
  return {
    member, memberBenefit, promoCode: promoCheck?.ok ? promo!.code : null, promoAmount, promoMessage: promoCheck?.message ?? null, promoOk: promoCheck?.ok ?? null,
    gift, isGift, price, dueNow: r2(price - gift),
  };
}

/** Use a gift card / referral credit on a booked job: draws the balance and records it as paid money. */
export async function redeemGift(job: Job, code: string) {
  const want = Math.max(0, Number(job.price_final ?? 0) - Number(job.amount_paid ?? 0));
  if (!want) return 0;
  const { data: took } = await db().rpc("draw_promo_balance", { p_code: code, p_amount: want });
  const amount = Number(took ?? 0);
  if (!amount) return 0;
  await db().from("promo_redemptions").insert({ code, job_id: job.id, email: job.contact_email, amount });
  await addEvent(job.id, "paid", `Gift card ${code.slice(0, 9)}… applied — ${money(amount)}.`, "system", true, `Tarjeta de regalo ${code.slice(0, 9)}… aplicada: ${money(amount)}.`);
  const { markPaid } = await import("./jobs");
  if (amount >= want - 0.005) await markPaid(job.id, { amount, via: "gift card" });
  else await db().from("jobs").update({ amount_paid: r2(Number(job.amount_paid ?? 0) + amount) }).eq("id", job.id);
  return amount;
}

export async function recordPromoUse(code: string, jobId: string, email: string, amount: number) {
  const p = await findPromo(code);
  if (!p) return;
  await db().from("promo_redemptions").insert({ code: p.code, job_id: jobId, email, amount });
  await db().from("promo_codes").update({ uses: (p.uses ?? 0) + 1 }).eq("code", p.code);
}

export async function buyGiftCard(o: { amount: number; purchaserEmail: string; purchaserName?: string | null; recipientEmail: string; recipientName?: string | null; message?: string | null }) {
  const code = makeCode("GIFT", 8);
  const r = await createCheckout({
    amount: o.amount, kind: "gift_card", name: `${BRAND.name} gift card — ${money(o.amount)}`, description: `For ${o.recipientName ?? o.recipientEmail}`,
    customerEmail: o.purchaserEmail, customerName: o.purchaserName ?? null, successPath: "/gift-cards?sent=1",
  });
  if (!r) return { error: "Payments aren't set up yet" };
  await db().from("promo_codes").insert({
    code, kind: "gift", value: o.amount, balance: o.amount, active: false, source: "gift_card", payment_id: r.paymentId,
    purchaser_email: o.purchaserEmail, recipient_email: o.recipientEmail, note: [o.recipientName && `To: ${o.recipientName}`, o.purchaserName && `From: ${o.purchaserName}`, o.message].filter(Boolean).join(" · ") || null,
  });
  return { url: r.url };
}

/** Paid → activate the code and email it to the recipient (copy to the buyer). */
export async function issueGiftCard(paymentId: string) {
  const { data: g } = await db().from("promo_codes").update({ active: true }).eq("payment_id", paymentId).eq("active", false).select("*").maybeSingle();
  if (!g) return;
  // the buyer and recipient may have no account and we don't know their language → both, English first
  const v = money(Number(g.value));
  const en = `You've received a ${v} ${BRAND.name} gift card${g.note ? ` (${g.note})` : ""}.\n\nYour code: ${g.code}\n\nUse it for cleaning, repairs, lawn care, rides, events and more: ${siteUrl()}/book — enter the code at checkout.`;
  const es = `Recibió una tarjeta de regalo de ${BRAND.name} por ${v}${g.note ? ` (${g.note})` : ""}.\n\nSu código: ${g.code}\n\nÚsela para limpieza, reparaciones, jardinería, transporte, eventos y más: ${siteUrl()}/book — ingrese el código al pagar.`;
  const text = `${en}\n\n— Español —\n\n${es}\n\n— ${BRAND.name}`;
  if (g.recipient_email) await sendEmail(g.recipient_email, `A ${v} ${BRAND.name} gift card for you · Una tarjeta de regalo de ${v} para usted`, text);
  if (g.purchaser_email) await sendEmail(g.purchaser_email, `Your gift card was sent · Su tarjeta de regalo fue enviada — ${g.code}`,
    `Thanks! We emailed the gift card to ${g.recipient_email}.\n\n${en}\n\n— Español —\n\n¡Gracias! Enviamos la tarjeta de regalo por correo a ${g.recipient_email}.\n\n${es}\n\n— ${BRAND.name}`);
}

// ─── Referrals: give $25, get $25 ────────────────────────────────────────────

export async function ensureReferralCode(profileId: string) {
  const { data: have } = await db().from("promo_codes").select("code").eq("owner_profile_id", profileId).eq("source", "referral").maybeSingle();
  if (have) return have.code as string;
  for (let i = 0; i < 5; i++) {
    const code = makeCode("REF", 6).replace(/-(\w{4})-(\w+)/, "-$1$2");
    const { error } = await db().from("promo_codes").insert({ code, kind: "amount", value: REFERRAL.friendOff, first_job_only: true, source: "referral", owner_profile_id: profileId, max_uses: 100, note: "Friend referral" });
    if (!error) return code;
  }
  return null;
}

/** The friend's first job is done → the referrer gets a credit code (once per friend). */
export async function rewardReferral(job: Job) {
  if (!job.promo_code?.startsWith("REF-")) return;
  const p = await findPromo(job.promo_code);
  if (!p || p.source !== "referral") return;
  const { data: code } = await db().from("promo_codes").select("owner_profile_id").eq("code", p.code).single();
  const owner = code?.owner_profile_id as string | undefined;
  if (!owner) return;
  const year = new Date(Date.now() - 365 * 86400000).toISOString();
  const { count } = await db().from("promo_codes").select("code", { count: "exact", head: true }).eq("owner_profile_id", owner).eq("source", "referral_reward").gte("created_at", year);
  if ((count ?? 0) >= REFERRAL.maxRewardsPerYear) return;
  const { data: dup } = await db().from("promo_codes").select("code").eq("source", "referral_reward").eq("note", `Referral reward · job ${job.id}`).maybeSingle();
  if (dup) return;
  const reward = makeCode("CREDIT", 8);
  await db().from("promo_codes").insert({ code: reward, kind: "gift", value: REFERRAL.reward, balance: REFERRAL.reward, source: "referral_reward", owner_profile_id: owner, note: `Referral reward · job ${job.id}` });
  const { data: who } = await db().from("profiles").select("email").eq("id", owner).maybeSingle();
  await notify(owner, {
    title: `You earned ${money(REFERRAL.reward)}`, body: "A friend you referred just had their first job done. Your credit code is in your email.", data: { type: "account" },
    email: who?.email ? { to: who.email, subject: `${money(REFERRAL.reward)} credit — thanks for the referral`, text: `Your friend's first ${BRAND.name} job is done. Here's ${money(REFERRAL.reward)} toward your next one.\n\nCredit code: ${reward}\nUse it at checkout: ${siteUrl()}/book\n\n— ${BRAND.name}` } : null,
    es: {
      title: `Ganó ${money(REFERRAL.reward)}`, body: "Un amigo que usted refirió acaba de completar su primer trabajo. Su código de crédito está en su correo.",
      subject: `Crédito de ${money(REFERRAL.reward)}: gracias por su referido`, text: `El primer trabajo de su amigo con ${BRAND.name} está terminado. Aquí tiene ${money(REFERRAL.reward)} para su próximo servicio.\n\nCódigo de crédito: ${reward}\nÚselo al pagar: ${siteUrl()}/book\n\n— ${BRAND.name}`,
    },
  });
}

// ─── Tips: 100% to the pro ───────────────────────────────────────────────────

export async function tipJob(jobId: string, amount: number, customerId: string | null) {
  const amt = r2(amount);
  if (!(amt >= 1) || amt > TIP_MAX) return { error: `Tips can be $1–$${TIP_MAX}` };
  const { data: job } = await db().from("jobs").select("*").eq("id", jobId).single();
  if (!job || (customerId && job.customer_id !== customerId)) return { error: "Job not found" };
  if (job.status !== "completed" || !job.contractor_id) return { error: "You can tip once the job is done." };
  const { data: tip } = await db().from("tips").insert({ job_id: job.id, contractor_id: job.contractor_id, amount: amt }).select("id").single();
  const s = getStripe();
  // one tap with the card on file
  if (s && job.stripe_customer_id && job.stripe_payment_method) {
    try {
      const pi = await s.paymentIntents.create({
        amount: Math.round(amt * 100), currency: "usd", customer: job.stripe_customer_id, payment_method: job.stripe_payment_method, off_session: true, confirm: true,
        description: `${BRAND.name} ${job.ref} — tip for your pro`, metadata: { job_id: job.id, kind: "tip", tip_id: tip!.id },
      }, { idempotencyKey: `tip-${tip!.id}` });
      if (pi.status === "succeeded") {
        const { data: pay } = await db().from("payments").insert({ job_id: job.id, kind: "tip", amount: amt, status: "paid", paid_at: new Date().toISOString(), stripe_session_id: pi.id, description: `Tip ${job.ref}` }).select("id").single();
        await db().from("tips").update({ payment_id: pay!.id }).eq("id", tip!.id);
        await settleTip(pay!.id);
        return { ok: true, charged: true };
      }
    } catch { /* fall through to Checkout */ }
  }
  const r = await createCheckout({ amount: amt, kind: "tip", name: `Tip for your pro — ${job.ref}`, customerEmail: job.contact_email, customerName: job.contact_name, job: job as Job, successPath: `/account/jobs/${job.id}?tipped=1` });
  if (!r) return { error: "Payments aren't set up yet" };
  await db().from("tips").update({ payment_id: r.paymentId }).eq("id", tip!.id);
  return { ok: true, url: r.url };
}

/** Tip paid → pro payout (approved, goes out on the next weekly run) and a thank-you. */
export async function settleTip(paymentId: string) {
  const { data: tip } = await db().from("tips").update({ status: "paid" }).eq("payment_id", paymentId).eq("status", "pending").select("*").maybeSingle();
  if (!tip) return;
  await db().from("payouts").insert({ contractor_id: tip.contractor_id, job_id: tip.job_id, amount: tip.amount, status: "approved", kind: "tip", reason: "Customer tip (100% to you)" });
  const { data: job } = await db().from("jobs").select("ref, service_slug, tip_total").eq("id", tip.job_id).single();
  await db().from("jobs").update({ tip_total: r2(Number(job?.tip_total ?? 0) + Number(tip.amount)) }).eq("id", tip.job_id);
  await addEvent(tip.job_id, "tip", `Tip of ${money(Number(tip.amount))} sent to your pro — thank you!`, "customer", true, `Propina de ${money(Number(tip.amount))} enviada a su profesional. ¡Gracias!`);
  const { data: pro } = await db().from("contractors").select("profile_id, email, phone").eq("id", tip.contractor_id).maybeSingle();
  if (pro) await notify(pro.profile_id, {
    title: `💚 ${money(Number(tip.amount))} tip`, body: `Your customer on ${job?.ref} tipped you. 100% is yours — it's on your next payout.`, data: { type: "earnings" },
    email: { to: pro.email, subject: `You got a ${money(Number(tip.amount))} tip — ${job?.ref}`, text: `Your customer on ${job?.ref} (${getService(job?.service_slug ?? "")?.name ?? "job"}) sent a ${money(Number(tip.amount))} tip. 100% goes to you on your next payout.` },
    es: {
      title: `💚 Propina de ${money(Number(tip.amount))}`, body: `Su cliente de ${job?.ref} le dejó una propina. El 100% es suyo: llega en su próximo pago.`,
      subject: `Recibió una propina de ${money(Number(tip.amount))} — ${job?.ref}`,
      text: `Su cliente de ${job?.ref} (${job?.service_slug && getService(job.service_slug) ? serviceText("es", job.service_slug, getService(job.service_slug)!).name : "trabajo"}) le envió una propina de ${money(Number(tip.amount))}. El 100% es para usted en su próximo pago.`,
    },
  });
}

/** Ops can see when promo use looks abusive (many first-job codes to one address). */
export async function flagPromoAbuse(code: string, address: string, jobId: string) {
  const { count } = await db().from("jobs").select("id", { count: "exact", head: true }).eq("promo_code", code).ilike("address", address);
  if ((count ?? 0) >= 3) await raiseAlert("promo", "warn", `Promo ${code} used ${count}× at one address`, address, jobId);
}
