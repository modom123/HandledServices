/*
 * FILE    : apps/web/app/(site)/auth/check/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-07_0145 UTC
 * PURPOSE : Sign-in check anyone can open (no sign-in needed, no secrets shown): is everything in place for Handled to
 *           send its own sign-in email (code + any-device link)? Server key, email provider, the sender's domain verified
 *           in Resend, the site address. Each red line says exactly what to set.
 */
import { adminClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";
import { emailFrom, siteUrl } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign-in check" };

type Row = { label: string; ok: boolean | "warn"; detail: string; fix?: string };

async function checks(): Promise<Row[]> {
  const rows: Row[] = [];
  const has = (k: string) => Boolean(process.env[k]?.trim());
  // 1. server key + it works
  if (!supabaseConfigured || !has("SUPABASE_SERVICE_ROLE_KEY")) rows.push({ label: "Supabase server key", ok: false, detail: "SUPABASE_SERVICE_ROLE_KEY is not set", fix: "Supabase → Project Settings → API → copy the service_role key into Vercel as SUPABASE_SERVICE_ROLE_KEY, then Redeploy" });
  else {
    const { error } = await adminClient().auth.admin.listUsers({ page: 1, perPage: 1 }).catch((e) => ({ error: e as Error }));
    rows.push(error ? { label: "Supabase server key", ok: false, detail: `rejected: ${error.message}`, fix: "Re-copy the service_role key (not the anon key) into SUPABASE_SERVICE_ROLE_KEY, then Redeploy" } : { label: "Supabase server key", ok: true, detail: "works" });
  }
  // 2. email provider
  const resend = has("RESEND_API_KEY"), smtp = has("SMTP_USER") && has("SMTP_PASSWORD");
  rows.push(resend || smtp ? { label: "Email provider", ok: true, detail: [resend && "Resend", smtp && "company mailbox (backup)"].filter(Boolean).join(" + ") } : { label: "Email provider", ok: false, detail: "none", fix: "Set RESEND_API_KEY in Vercel" });
  // 3. sender domain verified in Resend
  const from = emailFrom();
  const domain = from.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "";
  if (resend) {
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, cache: "no-store" }).catch(() => null);
    if (r?.ok) {
      const list = ((await r.json()).data ?? []) as { name: string; status: string }[];
      const d = list.find((x) => x.name.toLowerCase() === domain);
      rows.push(d?.status === "verified" ? { label: `Sender domain (${domain})`, ok: true, detail: `verified in Resend · sending as ${from}` }
        : { label: `Sender domain (${domain})`, ok: false, detail: d ? `in Resend but "${d.status}"` : `not added in Resend (domains there: ${list.map((x) => `${x.name} ${x.status}`).join(", ") || "none"})`, fix: d ? "Resend → Domains → open it → add the DNS records it shows at your domain host, then Verify" : `Resend → Domains → Add domain → ${domain} → add the DNS records at your domain host → Verify. Or set EMAIL_FROM to an address on a verified domain.` });
    } else rows.push({ label: `Sender domain (${domain})`, ok: "warn", detail: r?.status === 401 || r?.status === 403 ? "can't check: the Resend key is send-only (that's fine)" : "couldn't reach Resend", fix: `Make sure ${domain} shows "Verified" in Resend → Domains` });
  }
  // 4. site address used in links
  const site = siteUrl();
  rows.push(/localhost/.test(site) ? { label: "Site address in emails", ok: false, detail: site, fix: "Set NEXT_PUBLIC_SITE_URL=https://your-domain in Vercel, then Redeploy" } : { label: "Site address in emails", ok: has("NEXT_PUBLIC_SITE_URL") ? true : "warn", detail: site, fix: has("NEXT_PUBLIC_SITE_URL") ? undefined : "Set NEXT_PUBLIC_SITE_URL to your domain so links don't use the .vercel.app address" });
  return rows;
}

export default async function SignInCheck() {
  const rows = await checks();
  const allOk = rows.every((r) => r.ok === true);
  return (
    <div className="wrap py-14"><div className="card mx-auto max-w-2xl">
      <h1 className="text-xl font-bold">Sign-in check</h1>
      <p className="mt-1 text-sm text-ink-soft">{allOk ? "Everything's in place: sign-in emails come from Handled with a code and a link that works on any device." : "Fix the red lines below. Until then, sign-in uses Supabase's backup email, which has no code and whose link only works in the browser that asked for it."}</p>
      <ul className="mt-5 space-y-3">{rows.map((r) => (
        <li key={r.label} className="rounded-xl border border-line p-3 text-sm">
          <div className="flex items-start gap-2"><span>{r.ok === true ? "✅" : r.ok === "warn" ? "⚠️" : "❌"}</span><div><div className="font-semibold">{r.label}</div><div className="text-ink-soft">{r.detail}</div>{r.fix && r.ok !== true && <div className="mt-1"><b>Fix:</b> {r.fix}</div>}</div></div>
        </li>
      ))}</ul>
      <p className="mt-5 text-xs text-ink-soft">After changing anything in Vercel, Redeploy, reload this page, then ask for a new code on the sign-in page.</p>
    </div></div>
  );
}
