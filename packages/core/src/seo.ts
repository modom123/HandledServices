/*
 * FILE    : packages/core/src/seo.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Cities we publish "<service> in <city>" pages for (search traffic). Launch metro is
 *           Detroit; add a city here when pros cover it and every service gets a page there.
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
];

export const SEO_CITY_BY_SLUG: Record<string, SeoCity> = Object.fromEntries(SEO_CITIES.map((c) => [c.slug, c]));
