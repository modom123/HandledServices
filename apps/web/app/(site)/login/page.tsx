/*
 * FILE    : apps/web/app/(site)/login/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-05_0431 UTC — sign in or create an account, starting with "Who are you?"; Spanish.
 */
import { LoginForm } from "@/components/LoginForm";
import { NotConfigured } from "@/components/ui";
import { supabaseConfigured } from "@/lib/supabase/env";
import { getLocale } from "@/lib/locale";
import { safeNext } from "@/lib/safe-redirect";

export const metadata = { title: "Sign in or create an account" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; expired?: string }> }) {
  if (!supabaseConfigured) return <NotConfigured />;
  const { next, email, expired } = await searchParams;
  return <div className="wrap py-20"><LoginForm next={safeNext(next, "https://handled.local")} initialEmail={email ?? ""} expired={expired === "1"} es={(await getLocale()) === "es"} /></div>;
}
