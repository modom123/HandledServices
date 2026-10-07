/*
 * FILE    : apps/mobile/lib/pay.web.ts
 * PROJECT : Handled (HandledServices)
 * CREATED : 2026-10-06_0708 UTC
 * PURPOSE : Web build of payForJob(): Stripe's mobile SDK has no web version, so pay through Checkout.
 */
import { api } from "./supabase";
import { openInApp } from "./browser";

export type PayResult = { status: "paid" | "canceled" | "checkout" | "error"; message?: string };

export async function payForJob(o: { jobId: string; email?: string | null; locale?: string; fallbackUrl?: string | null }): Promise<PayResult> {
  if (o.fallbackUrl) { await openInApp(o.fallbackUrl); return { status: "checkout" }; }
  const r = await api<{ mode: string; url?: string }>("/api/pay/sheet", { method: "POST", body: JSON.stringify({ job_id: o.jobId, email: o.email ?? undefined }) });
  if (r.ok && r.data.url) { await openInApp(r.data.url); return { status: "checkout" }; }
  return { status: "error", message: (r.data as { error?: string }).error ?? "Couldn't start the payment." };
}
