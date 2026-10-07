/*
 * FILE    : apps/mobile/lib/pay.ts
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-06_0708 UTC
 * PURPOSE : Pay for a booking without leaving the app: Apple Pay, Google Pay or a card in Stripe's
 *           PaymentSheet (one tap on phones with a wallet). The server decides the amount (deposit,
 *           balance or full price) and saves the card for later visits. If the sheet isn't available
 *           (sales tax on, keys missing, an old build) it opens Stripe Checkout in an in-app sheet instead.
 *             const r = await payForJob({ jobId, email, locale });  // "paid" | "canceled" | "checkout" | "error"
 *           Web builds use pay.web.ts (Checkout only).
 */
import { initPaymentSheet, initStripe, presentPaymentSheet } from "@stripe/stripe-react-native";
import { api } from "./supabase";
import { openInApp } from "./browser";

export type PayResult = { status: "paid" | "canceled" | "checkout" | "error"; message?: string };

type Sheet =
  | { mode: "sheet"; clientSecret: string; publishableKey: string; amount: number; merchantName: string }
  | { mode: "checkout"; url: string; amount: number };

let initializedKey: string | null = null;

export async function payForJob(o: { jobId: string; email?: string | null; locale?: string; fallbackUrl?: string | null }): Promise<PayResult> {
  const r = await api<Sheet>("/api/pay/sheet", { method: "POST", body: JSON.stringify({ job_id: o.jobId, email: o.email ?? undefined }) });
  if (!r.ok) {
    if (o.fallbackUrl) { await openInApp(o.fallbackUrl); return { status: "checkout" }; }
    return { status: "error", message: r.data.error ?? "Couldn't start the payment. Please try again." };
  }
  if (r.data.mode === "checkout") { await openInApp(r.data.url); return { status: "checkout" }; }
  const sheet = r.data;
  try {
    if (initializedKey !== sheet.publishableKey) {
      await initStripe({ publishableKey: sheet.publishableKey, merchantIdentifier: "merchant.com.handled.app", urlScheme: "handled" });
      initializedKey = sheet.publishableKey;
    }
    const init = await initPaymentSheet({
      merchantDisplayName: sheet.merchantName,
      paymentIntentClientSecret: sheet.clientSecret,
      applePay: { merchantCountryCode: "US" },
      googlePay: { merchantCountryCode: "US", currencyCode: "USD", testEnv: sheet.publishableKey.startsWith("pk_test") },
      returnURL: "handled://stripe-redirect",
      defaultBillingDetails: o.email ? { email: o.email } : undefined,
      allowsDelayedPaymentMethods: false,
      appearance: { colors: { primary: "#0e7c66" }, shapes: { borderRadius: 14 }, primaryButton: { shapes: { borderRadius: 999 } } },
    });
    if (init.error) throw new Error(init.error.message);
    const done = await presentPaymentSheet();
    if (done.error) {
      if (done.error.code === "Canceled") return { status: "canceled" };
      return { status: "error", message: done.error.message };
    }
    return { status: "paid" };
  } catch (e) {
    // the sheet couldn't open (old build without the native module, misconfigured wallet): Checkout still works
    if (o.fallbackUrl) { await openInApp(o.fallbackUrl); return { status: "checkout" }; }
    return { status: "error", message: e instanceof Error ? e.message : "Couldn't start the payment." };
  }
}
