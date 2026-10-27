/*
 * FILE    : apps/web/lib/hub-sections.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0100 UTC
 * PURPOSE : One map of Mastermind (the Handled hub). The sidebar shows Daily Briefing, Dashboard and one link per
 *           section (Pros, Jobs, Clients, Money, Growth, AI team, Settings); the pages inside a section show as tabs
 *           across the top (components/HubNav → SectionTabs). Add a page here and it appears in both places.
 *           Shared by the server layout and the client nav, so no server-only imports.
 * UPDATED : 2026-10-15_0200 UTC — four merges, each one tab with a two-way switch (components/ViewSwitch): Roster + Network
 *           health, Bids + Gov contracts, AI agents + IEBC Workforce, Market pricing + Pricing accuracy (/hub/pricing).
 * UPDATED : 2026-10-27_1700 UTC — Recruiting is its own section (the Recruiting division): Overview, Openings, Indeed, Pipeline,
 *           Client searches (Talent, moved from Growth), Supply gaps and Pro leads (moved from Pros), Interview packet.
 *           Tabs light up by the most specific match (activeTab), and detail pages can alias a tab. Onboarding (contracts,
 *           documents, activation) and the Contract library (moved from Settings) are part of the flow too.
 * UPDATED : 2026-10-21_0030 UTC — Lead inbox and Marketplace & quotes (Clients), Social media (Growth). The Call desk lives
 *           under Business leads, Awards & recompetes under Gov contracts.
 */

export type HubLink = readonly [href: string, label: string];
export type HubSection = {
  id: string;
  icon: string;
  label: string;
  links: readonly HubLink[];
  /** Extra URL prefixes that belong to this section (detail pages that aren't tabs). */
  also?: readonly string[];
  /** Detail pages that should light up a given tab (e.g. a candidate page → Pipeline). */
  alias?: readonly (readonly [RegExp, string])[];
};

/** Always at the top of the sidebar. */
export const HUB_TOP: readonly (readonly [href: string, icon: string, label: string])[] = [
  ["/hub/briefing", "☀️", "Daily Briefing"],
  ["/hub", "📊", "Dashboard"],
];

export const HUB_SECTIONS: readonly HubSection[] = [
  // Recruiting division, top down: what we need (openings) → where they come from (Indeed first) → the pipeline → the
  // supporting engines. Fills our pro network, our own team and our clients' roles (Handled Talent).
  { id: "recruiting", icon: "🎯", label: "Recruiting", also: ["/hub/talent"], alias: [[/^\/hub\/recruiting\/[0-9a-f-]{36}/, "/hub/recruiting/pipeline"], [/^\/hub\/talent\/[0-9a-f-]{36}/, "/hub/talent"]], links: [
    ["/hub/recruiting", "Overview"],
    ["/hub/recruiting/openings", "Openings"],
    ["/hub/recruiting/indeed", "Indeed"],
    ["/hub/recruiting/pipeline", "Pipeline"],
    ["/hub/recruiting/onboarding", "Onboarding"],
    ["/hub/recruiting/files", "Pro files"],
    ["/hub/contracts", "Contracts"],
    ["/hub/talent", "Client searches"],
    ["/hub/gaps", "Supply gaps"],
    ["/hub/leads", "Pro leads"],
    ["/hub/recruiting/packet", "Interview packet"],
  ] },
  { id: "pros", icon: "🧰", label: "Pros", links: [
    ["/hub/pros", "Roster"],
    ["/hub/pro-program", "Pro Program"],
    ["/hub/rewards", "Rewards"],
  ] },
  { id: "jobs", icon: "🗂️", label: "Jobs", links: [
    ["/hub/dispatch", "Dispatch"],
    ["/hub/schedule", "Schedule"],
    ["/hub/jobs", "Jobs board"],
    ["/hub/roster", "Live map"],
    ["/hub/coverage", "Cancellations"],
    ["/hub/texts", "Texts"],
    ["/hub/checklists", "Checklists"],
  ] },
  { id: "clients", icon: "👥", label: "Clients", also: ["/hub/business", "/hub/gov"], links: [
    ["/hub/inbox", "Lead inbox"],
    ["/hub/customers", "Customers & B2B"],
    ["/hub/biz-leads", "Business leads"],
    ["/hub/bids", "Bids & contracts"],
    ["/hub/quotes", "Marketplace & quotes"],
    ["/hub/partners", "Referral partners"],
    ["/hub/loyalty", "Points"],
    ["/hub/email", "Email"],
  ] },
  { id: "money", icon: "💵", label: "Money", links: [
    ["/hub/payments", "Payments"],
    ["/hub/finance", "Finance"],
    ["/hub/accounting", "Accounting (Xero)"],
    ["/hub/charges", "Quick Charge"],
    ["/hub/factoring", "Factoring"],
  ] },
  { id: "growth", icon: "📈", label: "Growth & pricing", links: [
    ["/hub/growth", "Growth"],
    ["/hub/social", "Social media"],
    ["/hub/cities", "City scorecard"],
    ["/hub/pricing", "Pricing"],
    ["/hub/site", "Website look"],
  ] },
  { id: "ai", icon: "🤖", label: "AI team", links: [
    ["/hub/agents", "AI agents & IEBC"],
    ["/hub/assistant", "AI assistant"],
  ] },
  { id: "settings", icon: "⚙️", label: "Settings", links: [
    ["/hub/team", "Team"],
    ["/hub/setup", "Go-live setup"],
  ] },
];

/** Pages only admins can open — hidden from dispatchers (each page and its API check again). */
export const ADMIN_PAGES = new Set(["/hub/finance", "/hub/accounting", "/hub/charges", "/hub/factoring", "/hub/site", "/hub/setup"]);

export const sectionsFor = (admin: boolean): HubSection[] =>
  HUB_SECTIONS.map((s) => (admin ? s : { ...s, links: s.links.filter(([href]) => !ADMIN_PAGES.has(href)) })).filter((s) => s.links.length);

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Whether a top link is the current page ("/hub" itself and its drill-downs only, not every hub page). */
export const topActive = (path: string, href: string) => (href === "/hub" ? path === "/hub" || path.startsWith("/hub/stats") : under(path, href));
export const linkActive = (path: string, href: string) => under(path, href);
/** The one tab to light up in a section: an alias for detail pages, else the most specific matching tab. */
export const activeTab = (s: HubSection, path: string): string | null =>
  s.alias?.find(([re]) => re.test(path))?.[1] ?? s.links.map(([h]) => h).filter((h) => under(path, h)).sort((a, b) => b.length - a.length)[0] ?? null;
export const sectionOf = (sections: readonly HubSection[], path: string) =>
  sections.find((s) => s.links.some(([h]) => under(path, h)) || s.also?.some((p) => under(path, p)));
