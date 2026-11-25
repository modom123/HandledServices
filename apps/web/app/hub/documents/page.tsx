/*
 * FILE    : apps/web/app/hub/documents/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-25_2100 UTC
 * PURPOSE : Hub → Front Office → Documents: the office documents this team member can open (owner, 2026-11-25: upload
 *           documents in the office and assign team members to view them or have access). Admins see every office's
 *           documents; everyone else sees only what's shared with them (view only, or full access). Documents are
 *           uploaded from an office (/hub/office/odom, /hub/office/gulley). ?doc=<id> (the link in the share email)
 *           opens that document's details.
 */
import Link from "next/link";
import { getViewer, isAdmin } from "@/lib/auth";
import { OfficeDocuments } from "@/components/OfficeDocuments";

export const dynamic = "force-dynamic";

export default async function Documents({ searchParams }: { searchParams: Promise<{ doc?: string }> }) {
  const { doc } = await searchParams;
  const admin = isAdmin(await getViewer());
  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">📁 Documents</h1>
        <p className="text-sm text-ink-soft">{admin
          ? <>Every office document. Upload new ones from an office (<Link href="/hub/office/odom" className="underline">Mark Odom</Link> · <Link href="/hub/office/gulley" className="underline">Cecilia Gulley</Link>) and choose who on the team can view them or have full access.</>
          : "Documents the Front Office shared with you. View only means you can open and read it; full access also lets you download it and share it with others on the team."}</p>
      </div>
      <section className="card"><OfficeDocuments mine focus={doc ?? null} /></section>
    </div>
  );
}
