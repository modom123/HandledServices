/*
 * FILE    : apps/web/app/(site)/auth/confirm/page.tsx
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_2305 UTC
 * PURPOSE : Where the sign-in link in our emails lands. One tap on "Finish signing in" posts the one-time token to
 *           /auth/callback. The tap matters: email security scanners (Outlook Safe Links, Defender, Mimecast) open links
 *           to check them, and a link that signed in on open would be used up before the person got there.
 *           Works in any browser or phone — nothing has to be remembered from where the code was requested.
 */
import { getLocale } from "@/lib/locale";
import { safeNext } from "@/lib/safe-redirect";

export const metadata = { title: "Finish signing in" };

export default async function Confirm({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string; next?: string }> }) {
  const q = await searchParams;
  const es = (await getLocale()) === "es";
  const next = safeNext(q.next, "https://handled.local");
  if (!q.token_hash) return (
    <div className="wrap py-20"><div className="card mx-auto max-w-md text-center">
      <h1 className="text-xl font-bold">{es ? "Enlace incompleto" : "This link is incomplete"}</h1>
      <p className="mt-2 text-sm text-ink-soft">{es ? "Pida un código nuevo para entrar." : "Ask for a new sign-in code."}</p>
      <a className="btn-primary mt-4 inline-block" href={`/login?next=${encodeURIComponent(next)}`}>{es ? "Ir a iniciar sesión" : "Go to sign in"}</a>
    </div></div>
  );
  return (
    <div className="wrap py-20"><div className="card mx-auto max-w-md text-center">
      <h1 className="text-xl font-bold">{es ? "Termine de iniciar sesión" : "Finish signing in"}</h1>
      <p className="mt-2 text-sm text-ink-soft">{es ? "Toque el botón para entrar a su cuenta." : "Tap the button to open your account."}</p>
      <form method="post" action="/auth/callback" className="mt-5">
        <input type="hidden" name="token_hash" value={q.token_hash} />
        <input type="hidden" name="type" value={q.type === "email" ? "email" : "magiclink"} />
        <input type="hidden" name="next" value={next} />
        <button className="btn-primary w-full">{es ? "Entrar" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-xs text-ink-soft">{es ? "¿No funciona? Escriba el código del correo en la página de acceso." : "Not working? Type the code from the email on the sign-in page."} <a className="underline" href={`/login?next=${encodeURIComponent(next)}`}>{es ? "Iniciar sesión" : "Sign in"}</a></p>
    </div></div>
  );
}
