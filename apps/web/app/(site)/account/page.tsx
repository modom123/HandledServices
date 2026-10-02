/*
 * FILE    : apps/web/app/(site)/account/page.tsx
 * PROJECT : Handled — AI-run home & business services
 * CREATED : 2026-10-01_1723 UTC
 * UPDATED : 2026-10-02_0316 UTC — Handled Plus, refer-a-friend code, delete my account.
 * UPDATED : 2026-10-02_1412 UTC — English / Spanish and the language toggle.
 * PURPOSE : Customer portal — all jobs, recurring plans, quick rebook.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { HANDLED_PLUS, REFERRAL, getService, money, moneyRange, serviceText, t as tr, type Job, type Locale } from "@handled/core";
import { getLocale } from "@/lib/locale";
import { activeMembership, ensureReferralCode } from "@/lib/growth";
import { siteUrl } from "@/lib/notify";
import { CopyLink, DeleteAccount, LanguageToggle, PlusButton } from "@/components/AccountExtras";
import { getViewer } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Empty, NotConfigured, StatusBadge, fmtDate } from "@/components/ui";

export const metadata = { title: "My bookings" };
export const dynamic = "force-dynamic";

export default async function Account() {
  if (!supabaseConfigured) return <NotConfigured />;
  const v = await getViewer();
  if (!v) redirect("/login?next=/account");
  const [{ data: jobs }, { data: plans }] = await Promise.all([
    v.db.from("jobs").select("*").order("created_at", { ascending: false }),
    v.db.from("recurring_plans").select("*").eq("active", true),
  ]);
  const list = (jobs ?? []) as Job[];
  const l = await getLocale();
  const t = (s: string) => tr(l, s);
  const name = (slug: string) => { const s = getService(slug); return s ? serviceText(l, slug, s).name : slug; };
  return (
    <div className="wrap py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-extrabold tracking-tight">{t("My bookings")}</h1><p className="text-sm text-ink-soft">{v.email}</p></div>
        <div className="flex gap-2"><Link href="/book" className="btn-primary">{t("Book a service")}</Link><form action="/auth/signout" method="post"><button className="btn-ghost">{t("Sign out")}</button></form></div>
      </div>
      {(plans ?? []).length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {(plans ?? []).map((p: { id: string; service_slug: string; frequency: string; price: number; next_date: string }) => (
            <div key={p.id} className="card bg-brand-tint"><div className="text-sm font-semibold">{name(p.service_slug)} · {t(p.frequency)}</div><div className="text-sm text-ink-soft">{t("Next visit")} {fmtDate(p.next_date)} · {money(p.price)}</div></div>
          ))}
        </div>
      )}
      <div className="mt-8 space-y-3">
        {list.length === 0 && <Empty>{l === "es" ? `Aún no hay reservas. Todo lo que reserve con ${v.email} aparece aquí, con estado, facturas, mensajes y fotos.` : `No bookings yet. Anything you book with ${v.email} shows up here, with status, invoices, messages and photos.`}</Empty>}
        {list.map((j) => {
          const s = getService(j.service_slug);
          return (
            <Link key={j.id} href={`/account/jobs/${j.id}`} className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand">
              <div className="flex items-center gap-3"><span className="text-2xl">{s?.icon}</span><div><div className="font-semibold">{name(j.service_slug)} <span className="text-xs text-ink-soft">{j.ref}</span></div><div className="text-sm text-ink-soft">{fmtDate(j.scheduled_date)} · {j.address}</div></div></div>
              <div className="flex items-center gap-3"><span className="text-sm font-semibold">{j.price_final ? money(j.price_final) : moneyRange(j.estimate_low, j.estimate_high)}</span><StatusBadge status={j.status} /></div>
            </Link>
          );
        })}
      </div>
      <AccountExtras userId={v.userId} email={v.email} locale={l} />
    </div>
  );
}

async function AccountExtras({ userId, email, locale }: { userId: string; email: string; locale: Locale }) {
  const t = (s: string) => tr(locale, s);
  const es = locale === "es";
  const [member, code] = await Promise.all([activeMembership(email, userId).catch(() => null), ensureReferralCode(userId).catch(() => null)]);
  const link = code ? `${siteUrl()}/book?promo=${code}` : null;
  return (
    <div className="mt-12 grid gap-4 md:grid-cols-2">
      <div className={`card ${member ? "border-brand bg-brand-tint" : ""}`}>
        <div className="font-semibold">⭐ {HANDLED_PLUS.name}{member ? ` — ${t("you're a member")}` : ` — ${money(HANDLED_PLUS.monthly)}/${t("month")}`}</div>
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">{HANDLED_PLUS.perks.map((p) => <li key={p}>✓ {t(p)}</li>)}</ul>
        <div className="mt-3"><PlusButton member={Boolean(member)} locale={locale} /></div>
      </div>
      {link && (
        <div className="card">
          <div className="font-semibold">🎁 {es ? `Regale ${money(REFERRAL.friendOff)}, reciba ${money(REFERRAL.reward)}` : `Give ${money(REFERRAL.friendOff)}, get ${money(REFERRAL.reward)}`}</div>
          <p className="mt-1 text-sm text-ink-soft">{es ? `Sus amigos reciben ${money(REFERRAL.friendOff)} de descuento en su primer trabajo con su código ` : `Friends get ${money(REFERRAL.friendOff)} off their first job with your code `}<b className="font-mono text-ink">{code}</b>{es ? `. Cuando terminen su trabajo, usted recibe un crédito de ${money(REFERRAL.reward)}.` : `. When their job is done, you get a ${money(REFERRAL.reward)} credit.`}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2"><CopyLink url={link} locale={locale} /><span className="break-all text-xs text-ink-soft">{link}</span></div>
        </div>
      )}
      <div className="md:col-span-2"><LanguageToggle locale={locale} /></div>
      <div className="md:col-span-2"><DeleteAccount locale={locale} /></div>
    </div>
  );
}
