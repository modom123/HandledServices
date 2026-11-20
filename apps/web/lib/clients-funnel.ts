/*
 * FILE    : apps/web/lib/clients-funnel.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-11-20_0100 UTC
 * PURPOSE : The Clients & Marketing funnel in one line (owner: clients and marketing must be connected): new leads →
 *           business leads talking to us → walkthroughs booked → campaigns going out → open quotes → business clients.
 *           Shown above every Clients & Marketing page (components/HubNav → SectionTabs), each number a link to its page.
 *           Head-only counts (cheap); a table that isn't set up yet just shows "—".
 */
import "server-only";
import { adminClient } from "./supabase/server";

export type FunnelStep = { href: string; label: string; n: number | null; hint: string };

export async function clientsFunnel(): Promise<FunnelStep[]> {
  const db = adminClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const now = new Date().toISOString();
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => { try { const r = await q; return r.error ? null : r.count ?? 0; } catch { return null; } };
  const head = { count: "exact" as const, head: true };
  const [leads, talking, walks, campaigns, quotes, accounts] = await Promise.all([
    count(db.from("leads").select("id", head).gte("created_at", since)),
    count(db.from("biz_leads").select("id", head).in("status", ["clicked", "replied", "call"])),
    count(db.from("walkthroughs").select("id", head).eq("status", "booked").gte("starts_at", now)),
    count(db.from("email_campaigns").select("id", head).in("status", ["scheduled", "sending"])),
    count(db.from("quote_requests").select("id", head).gte("created_at", since)),
    count(db.from("business_accounts").select("id", head)),
  ]);
  return [
    { href: "/hub/inbox", label: "New leads", n: leads, hint: "last 30 days" },
    { href: "/hub/biz-leads", label: "Businesses talking", n: talking, hint: "clicked, replied or call" },
    { href: "/hub/walkthroughs", label: "Walkthroughs", n: walks, hint: "booked, upcoming" },
    { href: "/hub/email", label: "Campaigns", n: campaigns, hint: "scheduled or sending" },
    { href: "/hub/quotes", label: "Quotes", n: quotes, hint: "requested, last 30 days" },
    { href: "/hub/customers", label: "Business clients", n: accounts, hint: "accounts" },
  ];
}
