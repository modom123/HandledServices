/*
 * FILE    : apps/web/app/pro/layout.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * PURPOSE : Pro portal shell. Pros mostly use the mobile app; this is the web twin.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/site";
import { NotConfigured } from "@/components/ui";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function ProLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseConfigured) return <NotConfigured />;
  const v = await getViewer();
  if (!v) redirect("/login?next=/pro");
  if (!v.contractorId)
    return (
      <div className="wrap py-20"><div className="card max-w-lg"><h1 className="text-xl font-bold">No pro account for {v.email}</h1><p className="mt-2 text-sm text-ink-soft">Sign in with the email on your approved application, or <Link href="/pros" className="text-brand underline">apply to become a pro</Link>.</p></div></div>
    );
  return (
    <>
      <header className="border-b border-line bg-white"><div className="wrap flex h-14 items-center justify-between"><Logo /><div className="flex items-center gap-4 text-sm"><Link href="/pro" className="font-semibold">Jobs</Link><Link href="/pro/earnings">Earnings</Link><Link href="/pro/onboarding">Setup & documents</Link><form action="/auth/signout" method="post"><button className="text-ink-soft">Sign out</button></form></div></div></header>
      <main className="wrap py-8">{children}</main>
    </>
  );
}
