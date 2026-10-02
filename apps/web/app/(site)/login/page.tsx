/*
 * FILE    : apps/web/app/(site)/login/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 */
import { LoginForm } from "@/components/LoginForm";
import { NotConfigured } from "@/components/ui";
import { supabaseConfigured } from "@/lib/supabase/env";

export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; expired?: string }> }) {
  if (!supabaseConfigured) return <NotConfigured />;
  const { next, email, expired } = await searchParams;
  return <div className="wrap py-20"><LoginForm next={next?.startsWith("/") ? next : "/auth/home"} initialEmail={email ?? ""} expired={expired === "1"} /></div>;
}
