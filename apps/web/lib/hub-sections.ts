/*
 * FILE    : apps/web/lib/hub-sections.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0100 UTC
 * PURPOSE : One map of Mastermind (the Handled hub). The sidebar shows Daily Briefing, Dashboard and one link per
 *           section (Pros & recruiting, Jobs, Clients & sales, Money, Marketing & AI, Front Office); the pages inside a section show as tabs
 *           across the top (components/HubNav → SectionTabs). Add a page here and it appears in both places.
 *           Shared by the server layout and the client nav, so no server-only imports.
 * UPDATED : 2026-10-15_0200 UTC — four merges, each one tab with a two-way switch (components/ViewSwitch): Roster + Network
 *           health, Bids + Gov contracts, AI agents + IEBC Workforce, Market pricing + Pricing accuracy (/hub/pricing).
 * UPDATED : 2026-10-27_1700 UTC — Recruiting is its own section (the Recruiting division): Overview, Openings, Indeed, Pipeline,
 *           Client searches (Talent, moved from Growth), Supply gaps and Pro leads (moved from Pros), Interview packet.
 *           Tabs light up by the most specific match (activeTab), and detail pages can alias a tab. Onboarding (contracts,
 *           documents, activation) and the Contract library (moved from Settings) are part of the flow too.
 * UPDATED : 2026-10-27_2100 UTC — Money → Jobs & payouts (/hub/money, admins): each job's split and payout, and the Monday run.
 * UPDATED : 2026-10-27_2000 UTC — FIX: tab aliases are strings, not RegExp. A RegExp can't be passed from the server layout
 *           to the client nav, so every Hub page failed to render (looked like the Hub login was broken).
 * UPDATED : 2026-10-21_0030 UTC — Lead inbox and Marketplace & quotes (Clients), Social media (Growth). The Call desk lives
 *           under Business leads, Awards & recompetes under Gov contracts.
 * UPDATED : 2026-10-28_1735 UTC — Jobs: one "Jobs" tab (List | Schedule | Board); Money: one "Money" tab (Jobs & payouts | Money in & out |
 *           Unit economics); Contracts → Settings; Points → Growth; Interview packet is a link in Pipeline.
 * UPDATED : 2026-10-28_1828 UTC — Contract library is its own menu entry (was a tab under Settings).
 * UPDATED : 2026-11-05_0030 UTC — consolidated to six sections: Pros & recruiting (one section, built like a football
 *           team: Depth chart first, then Roster, Pipeline, Onboarding…), Jobs, Clients & sales, Money, Marketing & AI
 *           (Growth + AI team; Email moved here from Clients) and Front Office (was Settings: Team, Contract library,
 *           Go-live setup). Every page keeps its address, so links and bookmarks still work.
 * UPDATED : 2026-11-05_0100 UTC — merged tabs (groups): Pros & recruiting is five tabs — Depth chart (+ Supply gaps), Roster
 *           (+ Pro Program, Rewards), Pipeline (+ Openings, Indeed, Pro leads, Overview), Onboarding (+ Pro files) and
 *           Client searches; the merged pages show as a switch under the tabs (groupOf, components/HubNav).
 * UPDATED : 2026-11-06_1900 UTC — need-to-know: read on the server; money (pro pay, our take, payouts, partner splits) for admins only.
 */

export type HubLink = readonly [href: string, label: string];
export type HubSection = {
  id: string;
  icon: string;
  label: string;
  links: readonly HubLink[];
  /** Extra URL prefixes that belong to this section (detail pages that aren't tabs). */
  also?: readonly string[];
  /** Detail pages that should light up a given tab (e.g. a candidate page → Pipeline): [regex source, tab href]. Plain
   *  strings, not RegExp — sections are passed from the server layout to client components and must be serializable. */
  alias?: readonly (readonly [pattern: string, href: string])[];
  /** Merged tabs: a tab's href → the pages behind it, shown as a switch under the tabs (the first is the tab itself). */
  groups?: Readonly<Record<string, readonly HubLink[]>>;
};

/** Always at the top of the sidebar. */
export const HUB_TOP: readonly (readonly [href: string, icon: string, label: string])[] = [
  ["/hub/briefing", "☀️", "Daily Briefing"],
  ["/hub", "📊", "Dashboard"],
];

export const HUB_SECTIONS: readonly HubSection[] = [
  // Pros & recruiting, run like building a football team: the depth chart (every service is a position to fill) first,
  // then the roster, the pipeline that feeds it, onboarding, and the engines that find more players.
  { id: "pros", icon: "🏈", label: "Pros & recruiting", also: ["/hub/talent"], alias: [["^/hub/recruiting/[0-9a-f-]{36}", "/hub/recruiting/pipeline"], ["^/hub/recruiting/packet", "/hub/recruiting/pipeline"], ["^/hub/talent/[0-9a-f-]{36}", "/hub/talent"]],
    links: [
      ["/hub/depth", "Depth chart"],
      ["/hub/pros", "Roster"],
      ["/hub/recruiting/pipeline", "Pipeline"],
      ["/hub/recruiting/onboarding", "Onboarding"],
      ["/hub/talent", "Client searches"],
    ],
    groups: {
      "/hub/depth": [["/hub/depth", "Depth chart"], ["/hub/gaps", "Supply gaps"]],
      "/hub/pros": [["/hub/pros", "Roster"], ["/hub/pro-program", "Pro Program"], ["/hub/rewards", "Rewards"]],
      "/hub/recruiting/pipeline": [["/hub/recruiting/pipeline", "Pipeline"], ["/hub/recruiting/openings", "Openings"], ["/hub/recruiting/indeed", "Indeed"], ["/hub/leads", "Pro leads"], ["/hub/recruiting", "Overview"]],
      "/hub/recruiting/onboarding": [["/hub/recruiting/onboarding", "Onboarding"], ["/hub/recruiting/files", "Pro files"]],
    } },
  { id: "jobs", icon: "🗂️", label: "Jobs", links: [
    ["/hub/jobs", "Jobs"],
    ["/hub/roster", "Live map"],
    ["/hub/coverage", "Cancellations"],
    ["/hub/texts", "Texts"],
    ["/hub/checklists", "Checklists"],
  ] },
  { id: "clients", icon: "👥", label: "Clients & sales", also: ["/hub/business", "/hub/gov"], links: [
    ["/hub/customers", "Customers & B2B"],
    ["/hub/inbox", "Lead inbox"],
    ["/hub/biz-leads", "Business leads"],
    ["/hub/bids", "Bids & contracts"],
    ["/hub/quotes", "Marketplace & quotes"],
    ["/hub/partners", "Referral partners"],
  ] },
  { id: "money", icon: "💵", label: "Money", links: [
    ["/hub/money", "Money"],
    ["/hub/accounting", "Accounting (Xero)"],
    ["/hub/charges", "Quick Charge"],
    ["/hub/factoring", "Factoring"],
  ] },
  { id: "growth", icon: "📈", label: "Marketing & AI", links: [
    ["/hub/growth", "Growth"],
    ["/hub/social", "Social media"],
    ["/hub/email", "Email"],
    ["/hub/loyalty", "Points"],
    ["/hub/pricing", "Pricing"],
    ["/hub/cities", "City scorecard"],
    ["/hub/site", "Website look"],
    ["/hub/agents", "AI agents & IEBC"],
    ["/hub/assistant", "AI assistant"],
  ] },
  // the business itself: who works here, the contracts we use, and getting (and staying) ready to operate
  { id: "front-office", icon: "🏢", label: "Front Office", links: [
    ["/hub/team", "Team"],
    ["/hub/contracts", "Contract library"],
    ["/hub/setup", "Go-live setup"],
  ] },
];

/** Pages only admins can open — hidden from dispatchers (each page and its API check again). */
// need-to-know (2026-11-06): money pages and the partner program (commissions) are admin-only too
export const ADMIN_PAGES = new Set(["/hub/accounting", "/hub/charges", "/hub/factoring", "/hub/site", "/hub/setup", "/hub/money", "/hub/partners"]);

export const sectionsFor = (admin: boolean): HubSection[] =>
  HUB_SECTIONS.map((s) => (admin ? s : { ...s, links: s.links.filter(([href]) => !ADMIN_PAGES.has(href)) })).filter((s) => s.links.length);

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Whether a top link is the current page ("/hub" itself and its drill-downs only, not every hub page). */
export const topActive = (path: string, href: string) => (href === "/hub" ? path === "/hub" || path.startsWith("/hub/stats") : under(path, href));
export const linkActive = (path: string, href: string) => under(path, href);
/** Every page behind a tab: [page href, tab href] — the tab itself, plus the pages merged into it. */
const pagesOf = (s: HubSection) => [...s.links.map(([h]) => [h, h] as const), ...Object.entries(s.groups ?? {}).flatMap(([tab, list]) => list.map(([h]) => [h, tab] as const))];
/** The one tab to light up in a section: an alias for detail pages, else the tab of the most specific matching page. */
export const activeTab = (s: HubSection, path: string): string | null =>
  s.alias?.find(([re]) => new RegExp(re).test(path))?.[1] ?? pagesOf(s).filter(([h]) => under(path, h)).sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? null;
/** The switch to show under the tabs: the merged pages of the current tab, when this page is one of them. */
export const groupOf = (s: HubSection, path: string): readonly HubLink[] | null => {
  const tab = activeTab(s, path);
  const list = tab ? s.groups?.[tab] : null;
  return list && list.some(([h]) => h === path) ? list : null;
};
export const sectionOf = (sections: readonly HubSection[], path: string) =>
  sections.find((s) => pagesOf(s).some(([h]) => under(path, h)) || s.also?.some((p) => under(path, p)));
