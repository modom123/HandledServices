/*
 * FILE    : apps/web/app/hub/email/signature/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-12_0005 UTC
 * PURPOSE : Hub → Email → Email signature: make a Handled email signature for anyone on the team and copy it into
 *           Hostinger webmail, Gmail, Outlook or iPhone Mail (components/EmailSignature).
 */
import Link from "next/link";
import { BRAND, BRAND_STORY } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { siteUrl } from "@/lib/site-url";
import { EmailSignature } from "@/components/EmailSignature";

export const metadata = { title: "Email signature" };

export default async function SignaturePage() {
  const v = await getViewer();
  if (!v) return null;
  const site = siteUrl().replace(/\/$/, "");
  return (
    <div className="space-y-6">
      <div>
        <Link href="/hub/email" className="text-sm text-brand">← Email Center</Link>
        <h1 className="mt-1 text-2xl font-bold">Email signature</h1>
        <p className="max-w-2xl text-sm text-ink-soft">Fill in your details, check the preview, then copy it into your mail app. It works in every mail app (no special fonts or attachments), and the logo and links point to the live website.</p>
      </div>
      <EmailSignature defaults={{
        name: v.fullName ?? "", title: "", phone: BRAND.supportPhone, email: v.email ?? BRAND.supportEmail,
        site, booking: `${site}/book`, tagline: BRAND_STORY.slogan.en, logo: `${site}/icon.png`,
      }} />
    </div>
  );
}
