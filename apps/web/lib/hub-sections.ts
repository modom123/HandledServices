/*
 * FILE    : apps/web/lib/hub-sections.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-15_0100 UTC
 * PURPOSE : One map of Mastermind (the Handled hub). The sidebar shows Daily Briefing, Dashboard and one link per
 *           section (Jobs, Pros, Recruiting, Clients & Marketing, Partners, Money, Front Office); the pages inside a section show as tabs
 *           across the top (components/HubNav → SectionTabs). Add a page here and it appears everywhere: the sidebar, the
 *           tabs, and the tool lists in the Front Office offices (app/hub/office/[slug]).
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
 * UPDATED : 2026-11-10_0415 UTC — Pros & recruiting → Coverage map (/hub/map): pros and open services on a US map.
 * UPDATED : 2026-11-13_0715 UTC — Jobs → Job board (the internal job board).
 * UPDATED : 2026-11-17_2000 UTC — clearer sections (owner): Jobs, Pros, Recruiting, Clients, Partners, Money, Marketing & AI,
 *           Front Office. "Pros & recruiting" split in two — Pros = the people we have (Roster, Depth chart, Coverage map,
 *           Pro files); Recruiting = finding and signing new ones (Pipeline, Openings, Indeed, Pro leads, Onboarding, Client
 *           searches). Partners moved out of Clients into its own section. Jobs comes first (the day-to-day). Every page
 *           keeps its address.
 * UPDATED : 2026-11-17_2300 UTC — Front Office: Mark Odom's office (CEO: ops tools) and Cecilia Gulley's office (strategy &
 *           recruiting tools), each with email, Zoom and the to-do list shared between them. Admins only.
 * UPDATED : 2026-11-18_0215 UTC — Partners → AI vs Sales Force (/hub/scorecard, admins): the sales scorecard.
 * UPDATED : 2026-11-18_0105 UTC — Clients & sales → Sales Force (/hub/sales-force, admins).
 * UPDATED : 2026-11-20_0100 UTC — Clients and Marketing & AI combined into one section, Clients & Marketing (owner: they
 *           overlap): five tabs in the order a customer comes in — Leads (Lead inbox, Business leads, Walkthroughs),
 *           Campaigns (Email, Social media, Growth), Customers (Customers & B2B, Points), Quotes & bids, Markets & pricing
 *           (City scorecard, Pricing). The AI team and Website look moved to Front Office. Every page keeps its address.
 * UPDATED : 2026-11-17_2350 UTC — Clients & sales → Walkthroughs (/hub/walkthroughs): free walkthroughs businesses booked themselves.
 * UPDATED : 2026-11-20_0415 UTC — one Dashboard entry in the sidebar (Today | This month), instead of Daily Briefing + Dashboard.
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
// one Dashboard (owner, 2026-11-20: no bloat): opens on Today; This month is a switch at the top of the page
export const HUB_TOP: readonly (readonly [href: string, icon: string, label: string])[] = [
  ["/hub/briefing", "📊", "Dashboard"],
];

export const HUB_SECTIONS: readonly HubSection[] = [
  // the day-to-day: every job, who's on it and what's happening now
  { id: "jobs", icon: "🗂️", label: "Jobs", links: [
    ["/hub/jobs", "Jobs"],
    ["/hub/job-board", "Job board"],
    ["/hub/roster", "Live map"],
    ["/hub/coverage", "Cancellations"],
    ["/hub/texts", "Texts"],
    ["/hub/checklists", "Checklists"],
  ] },
  // the pros we have: who they are, which services each covers, where, and their files
  { id: "pros", icon: "🧰", label: "Pros",
    links: [
      ["/hub/pros", "Roster"],
      ["/hub/depth", "Depth chart"],
      ["/hub/map", "Coverage map"],
      ["/hub/recruiting/files", "Pro files"],
    ],
    groups: {
      "/hub/pros": [["/hub/pros", "Roster"], ["/hub/pro-program", "Pro Program"], ["/hub/rewards", "Rewards"]],
      "/hub/depth": [["/hub/depth", "Depth chart"], ["/hub/gaps", "Supply gaps"]],
    } },
  // finding and signing new pros, start to finish (and recruiting for client companies: Handled Talent)
  { id: "recruiting", icon: "🎯", label: "Recruiting", also: ["/hub/talent"],
    alias: [["^/hub/recruiting/[0-9a-f-]{36}", "/hub/recruiting/pipeline"], ["^/hub/recruiting/packet", "/hub/recruiting/pipeline"], ["^/hub/talent/[0-9a-f-]{36}", "/hub/talent"]],
    links: [
      ["/hub/recruiting/pipeline", "Pipeline"],
      ["/hub/recruiting/openings", "Openings"],
      ["/hub/recruiting/indeed", "Indeed"],
      ["/hub/leads", "Pro leads"],
      ["/hub/recruiting/onboarding", "Onboarding"],
      ["/hub/talent", "Client searches"],
    ],
    groups: {
      "/hub/recruiting/pipeline": [["/hub/recruiting/pipeline", "Pipeline"], ["/hub/recruiting", "Overview"]],
    } },
  // one funnel (owner, 2026-11-20): leads come in → campaigns reach them → they become customers → quotes and bids → which
  // markets to grow. Marketing and clients overlapped, so they're one section; the switch under each tab holds the rest.
  { id: "clients", icon: "👥", label: "Clients & Marketing", also: ["/hub/business", "/hub/gov"],
    links: [
      ["/hub/inbox", "Leads"],
      ["/hub/email", "Campaigns"],
      ["/hub/customers", "Customers"],
      ["/hub/quotes", "Quotes & bids"],
      ["/hub/cities", "Markets & pricing"],
    ],
    groups: {
      "/hub/inbox": [["/hub/inbox", "Lead inbox"], ["/hub/biz-leads", "Business leads"], ["/hub/walkthroughs", "Walkthroughs"]],
      "/hub/email": [["/hub/email", "Email"], ["/hub/social", "Social media"], ["/hub/growth", "Growth"]],
      "/hub/customers": [["/hub/customers", "Customers & B2B"], ["/hub/loyalty", "Points"]],
      "/hub/quotes": [["/hub/quotes", "Marketplace & quotes"], ["/hub/bids", "Bids & contracts"]],
      "/hub/cities": [["/hub/cities", "City scorecard"], ["/hub/pricing", "Pricing"]],
    } },
  // people who send us customers or sell for us (referrals, field sales tickets, commissions)
  { id: "partners", icon: "🤝", label: "Partners", links: [
    ["/hub/partners", "Referral & field sales partners"],
    ["/hub/sales-force", "Sales Force"],
    ["/hub/scorecard", "AI vs Sales Force"],
  ] },
  { id: "money", icon: "💵", label: "Money", links: [
    ["/hub/money", "Money"],
    ["/hub/accounting", "Accounting (Xero)"],
    ["/hub/charges", "Quick Charge"],
    ["/hub/factoring", "Factoring"],
  ] },
  // the business itself: who works here, the contracts we use, and getting (and staying) ready to operate
  { id: "front-office", icon: "🏢", label: "Front Office", alias: [["^/hub/office/odom", "/hub/office/odom"], ["^/hub/office/gulley", "/hub/office/gulley"]], links: [
    ["/hub/office/odom", "Mark Odom · CEO"],
    ["/hub/office/gulley", "Cecilia Gulley · Strategy & Recruiting"],
    ["/hub/team", "Team"],
    ["/hub/contracts", "Contract library"],
    ["/hub/agents", "AI agents & IEBC"],
    ["/hub/assistant", "AI assistant"],
    ["/hub/site", "Website look"],
    ["/hub/setup", "Go-live setup"],
  ] },
];

/** Pages only admins can open — hidden from dispatchers (each page and its API check again). */
// need-to-know (2026-11-06): money pages and the partner program (commissions) are admin-only too
export const ADMIN_PAGES = new Set(["/hub/office/odom", "/hub/office/gulley", "/hub/accounting", "/hub/charges", "/hub/factoring", "/hub/site", "/hub/setup", "/hub/money", "/hub/partners", "/hub/sales-force", "/hub/scorecard"]);

export const sectionsFor = (admin: boolean): HubSection[] =>
  HUB_SECTIONS.map((s) => (admin ? s : { ...s, links: s.links.filter(([href]) => !ADMIN_PAGES.has(href)) })).filter((s) => s.links.length);

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Whether a top link is the current page ("/hub" itself and its drill-downs only, not every hub page). */
export const topActive = (path: string, href: string) =>
  href === "/hub/briefing" ? path === "/hub" || path.startsWith("/hub/stats") || under(path, "/hub/briefing") : href === "/hub" ? path === "/hub" || path.startsWith("/hub/stats") : under(path, href);
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
/** The section a page belongs to: the one with the most specific matching page (e.g. /hub/recruiting/files → Pros,
 *  though /hub/recruiting is Recruiting's), else one that lists the prefix in `also`. */
export const sectionOf = (sections: readonly HubSection[], path: string) => {
  let best: HubSection | undefined, len = -1;
  for (const s of sections) for (const [h] of pagesOf(s)) if (under(path, h) && h.length > len) { best = s; len = h.length; }
  return best ?? sections.find((s) => s.also?.some((p) => under(path, p)));
};
