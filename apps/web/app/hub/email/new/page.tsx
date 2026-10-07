/*
 * FILE    : apps/web/app/hub/email/new/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0148 UTC
 * PURPOSE : Hub → Email Center → new campaign (blank, or ?template=<key> from the starter templates).
 */
import Link from "next/link";
import { EMAIL_TEMPLATES } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { CampaignEditor } from "@/components/EmailCenter";

export default async function NewCampaign({ searchParams }: { searchParams: Promise<{ template?: string }> }) {
  const { template } = await searchParams;
  const v = await getViewer();
  const t = EMAIL_TEMPLATES.find((x) => x.key === template);
  return (
    <div className="space-y-4">
      <Link href="/hub/email" className="text-sm text-brand underline">← Email Center</Link>
      <h1 className="text-2xl font-bold">New campaign{t ? `: ${t.name}` : ""}</h1>
      <CampaignEditor me={v?.email ?? "you"} initial={{
        name: t?.name ?? "", subject: t?.subject ?? "", preheader: t?.preheader ?? "", body: t?.body ?? "Hi {{first_name|there}},\n\n\n\n[Get my price]({{book_url}})\n\nThe {{brand}} team",
        subject_es: t?.subject_es ?? "", body_es: t?.body_es ?? "", audience: t?.audience ?? "customers", custom_list: "", custom_consent: false,
      }} />
    </div>
  );
}
