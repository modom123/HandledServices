/*
 * FILE    : packages/core/src/seo.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Cities we publish "<service> in <city>" pages for (search traffic). Launch metro is
 *           Detroit; add a city here when pros cover it and every service gets a page there.
 * UPDATED : 2026-10-06_0606 UTC — surrounding suburbs added (Wayne, Oakland, Macomb): 39 cities, for the cleaning push.
 * UPDATED : 2026-11-04_2230 UTC — SEO fixes: Washington cities get pages too (WA_SEO_CITIES, the same cities the business sales
 *           engine searches); CITY_PAGE_CITIES is every city with pages; only focus services' city pages are indexed
 *           (isFocusService in focus.ts) so Google doesn't see thousands of near-identical "doorway" pages; SERVICE_AREA states.
 *           SEO_CITIES stays Metro Detroit only (FOCUS_CITIES and the lead engines read it).
 * UPDATED : 2026-11-06_0500 UTC — New York, New Jersey and Las Vegas cities; SITE_MARKETS (a page per market at /areas/<slug>,
 *           each with the services it leads with); SERVICE_AREA now MI, NY, NJ, NV, WA; SERVED_AREAS_LABEL for customer messages.
 * UPDATED : 2026-11-10_0430 UTC — "insured pros" → "background-checked, vetted pros" (insurance is only required for services that need it).
 */
export interface SeoCity { slug: string; name: string; state: string; zip: string }

export const SEO_CITIES: SeoCity[] = [
  { slug: "detroit-mi", name: "Detroit", state: "MI", zip: "48226" },
  { slug: "royal-oak-mi", name: "Royal Oak", state: "MI", zip: "48067" },
  { slug: "troy-mi", name: "Troy", state: "MI", zip: "48084" },
  { slug: "birmingham-mi", name: "Birmingham", state: "MI", zip: "48009" },
  { slug: "bloomfield-hills-mi", name: "Bloomfield Hills", state: "MI", zip: "48304" },
  { slug: "southfield-mi", name: "Southfield", state: "MI", zip: "48075" },
  { slug: "farmington-hills-mi", name: "Farmington Hills", state: "MI", zip: "48334" },
  { slug: "novi-mi", name: "Novi", state: "MI", zip: "48375" },
  { slug: "livonia-mi", name: "Livonia", state: "MI", zip: "48152" },
  { slug: "dearborn-mi", name: "Dearborn", state: "MI", zip: "48124" },
  { slug: "ann-arbor-mi", name: "Ann Arbor", state: "MI", zip: "48104" },
  { slug: "grosse-pointe-mi", name: "Grosse Pointe", state: "MI", zip: "48230" },
  { slug: "sterling-heights-mi", name: "Sterling Heights", state: "MI", zip: "48310" },
  { slug: "warren-mi", name: "Warren", state: "MI", zip: "48093" },
  { slug: "west-bloomfield-mi", name: "West Bloomfield", state: "MI", zip: "48322" },
  { slug: "canton-mi", name: "Canton", state: "MI", zip: "48187" },
  { slug: "ferndale-mi", name: "Ferndale", state: "MI", zip: "48220" },
  { slug: "hamtramck-mi", name: "Hamtramck", state: "MI", zip: "48212" },
  { slug: "oak-park-mi", name: "Oak Park", state: "MI", zip: "48237" },
  { slug: "berkley-mi", name: "Berkley", state: "MI", zip: "48072" },
  { slug: "madison-heights-mi", name: "Madison Heights", state: "MI", zip: "48071" },
  { slug: "dearborn-heights-mi", name: "Dearborn Heights", state: "MI", zip: "48127" },
  { slug: "redford-mi", name: "Redford", state: "MI", zip: "48239" },
  { slug: "westland-mi", name: "Westland", state: "MI", zip: "48185" },
  { slug: "garden-city-mi", name: "Garden City", state: "MI", zip: "48135" },
  { slug: "taylor-mi", name: "Taylor", state: "MI", zip: "48180" },
  { slug: "allen-park-mi", name: "Allen Park", state: "MI", zip: "48101" },
  { slug: "southgate-mi", name: "Southgate", state: "MI", zip: "48195" },
  { slug: "wyandotte-mi", name: "Wyandotte", state: "MI", zip: "48192" },
  { slug: "plymouth-mi", name: "Plymouth", state: "MI", zip: "48170" },
  { slug: "northville-mi", name: "Northville", state: "MI", zip: "48167" },
  { slug: "rochester-hills-mi", name: "Rochester Hills", state: "MI", zip: "48307" },
  { slug: "auburn-hills-mi", name: "Auburn Hills", state: "MI", zip: "48326" },
  { slug: "st-clair-shores-mi", name: "St. Clair Shores", state: "MI", zip: "48080" },
  { slug: "eastpointe-mi", name: "Eastpointe", state: "MI", zip: "48021" },
  { slug: "roseville-mi", name: "Roseville", state: "MI", zip: "48066" },
  { slug: "clinton-township-mi", name: "Clinton Township", state: "MI", zip: "48038" },
  { slug: "shelby-township-mi", name: "Shelby Township", state: "MI", zip: "48315" },
  { slug: "harper-woods-mi", name: "Harper Woods", state: "MI", zip: "48225" },
];

/** Washington cities with pages (Seattle & Eastside, South Sound, North Sound, Olympia, Vancouver, Spokane). */
export const WA_SEO_CITIES: SeoCity[] = [
  { slug: "seattle-wa", name: "Seattle", state: "WA", zip: "98101" },
  { slug: "bellevue-wa", name: "Bellevue", state: "WA", zip: "98004" },
  { slug: "redmond-wa", name: "Redmond", state: "WA", zip: "98052" },
  { slug: "kirkland-wa", name: "Kirkland", state: "WA", zip: "98033" },
  { slug: "renton-wa", name: "Renton", state: "WA", zip: "98057" },
  { slug: "kent-wa", name: "Kent", state: "WA", zip: "98032" },
  { slug: "tacoma-wa", name: "Tacoma", state: "WA", zip: "98402" },
  { slug: "federal-way-wa", name: "Federal Way", state: "WA", zip: "98003" },
  { slug: "everett-wa", name: "Everett", state: "WA", zip: "98201" },
  { slug: "lynnwood-wa", name: "Lynnwood", state: "WA", zip: "98036" },
  { slug: "olympia-wa", name: "Olympia", state: "WA", zip: "98501" },
  { slug: "vancouver-wa", name: "Vancouver", state: "WA", zip: "98660" },
  { slug: "spokane-wa", name: "Spokane", state: "WA", zip: "99201" },
];

export const NY_SEO_CITIES: SeoCity[] = [
  { slug: "new-york-ny", name: "New York", state: "NY", zip: "10001" },
  { slug: "brooklyn-ny", name: "Brooklyn", state: "NY", zip: "11201" },
  { slug: "queens-ny", name: "Queens", state: "NY", zip: "11375" },
  { slug: "bronx-ny", name: "Bronx", state: "NY", zip: "10451" },
  { slug: "staten-island-ny", name: "Staten Island", state: "NY", zip: "10301" },
  { slug: "yonkers-ny", name: "Yonkers", state: "NY", zip: "10701" },
  { slug: "white-plains-ny", name: "White Plains", state: "NY", zip: "10601" },
  { slug: "hempstead-ny", name: "Hempstead", state: "NY", zip: "11550" },
];

export const NJ_SEO_CITIES: SeoCity[] = [
  { slug: "jersey-city-nj", name: "Jersey City", state: "NJ", zip: "07302" },
  { slug: "newark-nj", name: "Newark", state: "NJ", zip: "07102" },
  { slug: "hoboken-nj", name: "Hoboken", state: "NJ", zip: "07030" },
  { slug: "paterson-nj", name: "Paterson", state: "NJ", zip: "07505" },
  { slug: "elizabeth-nj", name: "Elizabeth", state: "NJ", zip: "07201" },
  { slug: "edison-nj", name: "Edison", state: "NJ", zip: "08817" },
  { slug: "trenton-nj", name: "Trenton", state: "NJ", zip: "08608" },
];

export const NV_SEO_CITIES: SeoCity[] = [
  { slug: "las-vegas-nv", name: "Las Vegas", state: "NV", zip: "89101" },
  { slug: "henderson-nv", name: "Henderson", state: "NV", zip: "89074" },
  { slug: "north-las-vegas-nv", name: "North Las Vegas", state: "NV", zip: "89030" },
  { slug: "summerlin-nv", name: "Summerlin", state: "NV", zip: "89135" },
  { slug: "paradise-nv", name: "Paradise", state: "NV", zip: "89109" },
  { slug: "spring-valley-nv", name: "Spring Valley", state: "NV", zip: "89117" },
];

/** Every city with "<service> in <city>" pages. */
export const CITY_PAGE_CITIES: SeoCity[] = [...SEO_CITIES, ...WA_SEO_CITIES, ...NY_SEO_CITIES, ...NJ_SEO_CITIES, ...NV_SEO_CITIES];

export const SEO_CITY_BY_SLUG: Record<string, SeoCity> = Object.fromEntries(CITY_PAGE_CITIES.map((c) => [c.slug, c]));

/** Where Handled works (structured data, llms.txt). */
export const SERVICE_AREA = [
  { name: "Michigan", code: "MI" }, { name: "New York", code: "NY" }, { name: "New Jersey", code: "NJ" }, { name: "Nevada", code: "NV" }, { name: "Washington", code: "WA" },
] as const;
export const STATE_NAME: Record<string, string> = Object.fromEntries(SERVICE_AREA.map((s) => [s.code, s.name]));

/** One line for customer messages: "Michigan, New York, New Jersey, Las Vegas and Washington". */
export const SERVED_AREAS_LABEL = { en: "Michigan, New York, New Jersey, Las Vegas and Washington", es: "Michigan, Nueva York, Nueva Jersey, Las Vegas y Washington" } as const;

/**
 * A market page (/areas/<slug>): one per place we serve, listing its cities and the services we lead with there.
 * `featured` services get their city pages indexed in this market (with the marketing focus services everywhere), so each
 * market ranks for what it actually sells without thousands of near-identical pages. Change what a market leads with here.
 */
export interface SiteMarket { slug: string; name: string; region: string; states: string[]; intro: string; cities: SeoCity[]; featured: string[] }

export const SITE_MARKETS: SiteMarket[] = [
  { slug: "michigan", name: "Michigan", region: "Metro Detroit and across Michigan", states: ["MI"], cities: SEO_CITIES, featured: ["house-cleaning", "carpet-cleaning", "window-cleaning", "unit-turnover", "handyman"],
    intro: "Where Handled started. Cleaning, repairs, lawn and snow, moving, hauling and 100+ more services from background-checked, vetted local pros across Metro Detroit and the rest of Michigan." },
  { slug: "new-york", name: "New York", region: "New York City, Westchester and Long Island", states: ["NY"], cities: NY_SEO_CITIES, featured: ["handyman", "house-cleaning", "furniture-assembly"],
    intro: "Apartment and home services across the five boroughs, Westchester and Long Island: repairs, mounting and assembly, cleaning and more, priced upfront and done by background-checked, vetted pros." },
  { slug: "new-jersey", name: "New Jersey", region: "North and Central Jersey", states: ["NJ"], cities: NJ_SEO_CITIES, featured: ["handyman", "house-cleaning", "furniture-assembly"],
    intro: "Home and business services from Jersey City and Hoboken to Newark, Edison and Trenton: repairs, assembly, cleaning and more, with your exact price before you book." },
  { slug: "las-vegas", name: "Las Vegas", region: "the Las Vegas Valley", states: ["NV"], cities: NV_SEO_CITIES, featured: ["handyman"],
    intro: "Handyman services across Las Vegas, Henderson, North Las Vegas and Summerlin: repairs, mounting, assembly, doors, drywall and the punch list, from background-checked, vetted local pros with an exact price in about a minute." },
  { slug: "washington", name: "Washington", region: "Seattle, the Eastside, Tacoma, Spokane and the rest of Washington", states: ["WA"], cities: WA_SEO_CITIES, featured: ["house-cleaning", "carpet-cleaning", "window-cleaning", "unit-turnover", "handyman"],
    intro: "Cleaning, repairs, yard work, moving and 100+ more services across Washington, from Seattle and Bellevue to Tacoma, Olympia and Spokane." },
];
export const SITE_MARKET_BY_SLUG: Record<string, SiteMarket> = Object.fromEntries(SITE_MARKETS.map((m) => [m.slug, m]));
/** The market a city page belongs to (by the city's state). */
export const marketForCity = (c: SeoCity) => SITE_MARKETS.find((m) => m.states.includes(c.state)) ?? null;
