/*
 * FILE    : apps/web/app/(site)/login/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-05_0431 UTC — sign in or create an account, starting with "Who are you?"; Spanish.
 * UPDATED : 2026-10-07_0300 UTC — already signed in → "You're signed in" with Continue and "Use a different account".
 */
import { LoginForm } from "@/components/LoginForm";
import { NotConfigured } from "@/components/ui";
import { supabaseConfigured } from "@/lib/supabase/env";
import { getLocale } from "@/lib/locale";
import { safeNext } from "@/lib/safe-redirect";
import { getViewer, isStaff } from "@/lib/auth";

export const metadata = { title: "Sign in or create an account" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; expired?: string }> }) {
  if (!supabaseConfigured) return <NotConfigured />;
  const { next, email, expired } = await searchParams;
  // already signed in → say so, with the way in (and a way to switch accounts)
  const v = await getViewer().catch(() => null);
  if (v && expired !== "1") {
    const es = (await getLocale()) === "es";
    const home = next && next !== "/auth/home" ? safeNext(next, "https://handled.local") : isStaff(v) ? "/hub" : v.contractorId ? "/pro" : "/account";
    return (
      <div className="wrap py-20"><div className="card mx-auto max-w-md text-center">
        <h1 className="text-xl font-bold">{es ? "Ya inició sesión" : "You're signed in"}</h1>
        <p className="mt-2 text-sm text-ink-soft">{v.email}</p>
        <a href={home} className="btn-primary mt-5 inline-block w-full">{es ? "Continuar" : "Continue"} →</a>
        <form action="/auth/signout" method="post" className="mt-3"><button className="text-sm text-ink-soft underline">{es ? "Usar otra cuenta" : "Use a different account"}</button></form>
      </div></div>
    );
  }
  return <div className="wrap py-20"><LoginForm next={safeNext(next, "https://handled.local")} initialEmail={email ?? ""} expired={expired === "1"} es={(await getLocale()) === "es"} /></div>;
}
