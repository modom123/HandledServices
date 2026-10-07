/*
 * FILE    : apps/web/app/(site)/pay/[id]/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_1610 UTC
 * PURPOSE : The permanent pay link in every email, invoice and text (lib/stripe payLink). Stripe Checkout links expire after
 *           24 hours, so this opens the payment's current Checkout, or a fresh one when it has expired:
 *             already paid                   → the thank-you / confirmation page
 *             job already paid in full       → the job's confirmation (no second charge)
 *             open Checkout                  → straight to it
 *             expired                        → a new Checkout for what's still owed
 *           The id is the payment's random UUID (as unguessable as a Stripe link).
 */
import { NextResponse } from "next/server";
import { amountDue, getStripe, openCheckoutSession, successPathFor } from "@/lib/stripe";
import { adminClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs";
import type { Job } from "@handled/core";

const JOB_PAYMENT = ["upfront", "deposit", "balance"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const go = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return go("/");
  const db = adminClient();
  const { data: row } = await db.from("payments").select("id, job_id, kind, amount, status, description, customer_email, customer_name, stripe_session_id").eq("id", id).maybeSingle();
  if (!row) return go("/");
  const job = row.job_id ? ((await getJob(row.job_id)) as Job | null) : null;
  const done = successPathFor(row.kind, job);
  if (row.status === "paid") return go(done);
  if (row.status !== "pending") return go(job ? `/book/confirmed?ref=${job.ref}` : "/");
  const s = getStripe();
  if (!s) return go(job ? `/book/confirmed?ref=${job.ref}&unpaid=1` : "/");

  if (job && JOB_PAYMENT.includes(row.kind)) {
    // never charge twice: what's owed now decides (a deposit link after the deposit was paid → nothing, or the balance)
    const owed = amountDue(job, row.kind === "deposit" ? "deposit" : "full");
    if (owed <= 0) return go(`/book/confirmed?ref=${job.ref}&paid=1`);
    if (Math.abs(owed - Number(row.amount)) > 0.005) {
      await db.from("payments").update({ status: "failed" }).eq("id", row.id).eq("status", "pending"); // replaced by a link for the right amount
      const { paymentCheckoutUrl } = await import("@/lib/stripe");
      const url = await paymentCheckoutUrl(job);
      return url ? NextResponse.redirect(url, 303) : go(`/book/confirmed?ref=${job.ref}`);
    }
  }

  if (row.stripe_session_id?.startsWith("cs_")) {
    const cur = await s.checkout.sessions.retrieve(row.stripe_session_id).catch(() => null);
    if (cur?.status === "complete") return go(done); // paid; the webhook is recording it
    if (cur?.status === "open" && cur.url) return NextResponse.redirect(cur.url, 303);
  }
  const fresh = await openCheckoutSession(row, job).catch(() => null);
  return fresh?.url ? NextResponse.redirect(fresh.url, 303) : go(job ? `/book/confirmed?ref=${job.ref}&unpaid=1` : "/");
}
