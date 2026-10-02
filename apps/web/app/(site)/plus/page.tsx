/*
 * FILE    : apps/web/app/(site)/plus/page.tsx
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Handled Plus — the membership: no priority fees, 10% off every job, first pick of
 *           same-day slots. Join (signed in) → Stripe subscription; manage from My account.
 */
import Link from "next/link";
import { BRAND, HANDLED_PLUS, money } from "@handled/core";
import { getViewer } from "@/lib/auth";
import { activeMembership } from "@/lib/growth";
import { PlusButton } from "@/components/AccountExtras";

export const metadata = { title: `${HANDLED_PLUS.name} membership`, description: `No priority fees and 10% off every ${BRAND.name} job for ${money(HANDLED_PLUS.monthly)} a month.` };

const EXAMPLES = [
  ["Monthly house cleaning ($180)", 18],
  ["Same-day junk pickup ($300 + priority fee)", 75],
  ["Lawn care, 4 visits ($55 each)", 22],
] as const;

export default async function PlusPage({ searchParams }: { searchParams: Promise<{ joined?: string }> }) {
  const { joined } = await searchParams;
  const v = await getViewer().catch(() => null);
  const member = v ? Boolean(await activeMembership(v.email, v.userId).catch(() => null)) : false;
  return (
    <div className="wrap py-14">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Membership</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">⭐ {HANDLED_PLUS.name}</h1>
          <p className="mt-4 text-lg text-ink-soft">Everything on your to-do list, for less. {money(HANDLED_PLUS.monthly)} a month, cancel anytime.</p>
          <ul className="mt-6 space-y-2">{HANDLED_PLUS.perks.map((p) => <li key={p} className="flex gap-2"><span className="text-brand">✓</span>{p}</li>)}</ul>
          <div className="mt-8">
            {joined ? <p className="rounded-xl bg-brand-tint p-4 font-semibold text-brand-dark">Welcome to {HANDLED_PLUS.name}! Your savings apply to your next booking.</p>
              : v ? <PlusButton member={member} />
              : <Link href="/login?next=/plus" className="btn-primary px-6 py-3">Sign in to join</Link>}
          </div>
        </div>
        <div className="card">
          <div className="font-semibold">What members typically save</div>
          <table className="mt-3 w-full text-sm"><tbody>
            {EXAMPLES.map(([l, s]) => <tr key={l} className="border-t border-line"><td className="py-2">{l}</td><td className="py-2 text-right font-semibold text-brand">save {money(s)}</td></tr>)}
          </tbody></table>
          <p className="mt-3 text-xs text-ink-soft">Savings apply automatically at checkout when you book signed in with your member email. Pros are paid the same — the discount comes from our share.</p>
        </div>
      </section>
    </div>
  );
}
