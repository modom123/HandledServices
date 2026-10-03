/*
 * FILE    : apps/web/app/api/unsubscribe/route.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-03_0027 UTC
 * UPDATED : 2026-10-03_0324 UTC — also blocks the address in Instantly (pro lead invitations).
 * PURPOSE : One-click unsubscribe from reminder emails (seasonal reminders, saved-price
 *           follow-ups). GET from the link in the email shows a confirmation page; POST is the
 *           mail app's one-click (List-Unsubscribe-Post). Signed per address — no login.
 *           Booking messages (payment links, schedule changes, receipts) still go.
 */
import { BRAND } from "@handled/core";
import { validUnsubscribeToken } from "@/lib/invoice";
import { blockInInstantly } from "@/lib/instantly";
import { adminClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

async function optOut(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  if (!email.includes("@") || !validUnsubscribeToken(email, url.searchParams.get("t"))) return false;
  if (supabaseConfigured && process.env.SUPABASE_SERVICE_ROLE_KEY) await adminClient().from("email_optouts").upsert({ email });
  await blockInInstantly(email); // pro lead invitations stop too
  return true;
}

const page = (ok: boolean) => new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND.name}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#0f172a;line-height:1.5}a{color:#0f766e}</style></head><body>
${ok ? `<h1>You're unsubscribed</h1><p>No more reminder emails from ${BRAND.name}. You'll still get messages about bookings you make.</p><p lang="es"><b>Suscripción cancelada.</b> No recibirá más recordatorios. Seguirá recibiendo mensajes sobre sus reservas.</p>`
      : `<h1>That link didn't work</h1><p>Reply to any of our emails and we'll take you off the list.</p>`}
<p><a href="/home">${BRAND.name}</a></p></body></html>`, { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } });

export async function GET(req: Request) { return page(await optOut(req)); }
export async function POST(req: Request) { return (await optOut(req)) ? new Response(null, { status: 204 }) : new Response("Bad link", { status: 400 }); }
