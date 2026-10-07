/*
 * FILE    : packages/core/src/seo.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_1329 UTC
 * PURPOSE : Cities we publish "<service> in <city>" pages for (search traffic). Launch metro is
 *           Detroit; add a city here when pros cover it and every service gets a page there.
 * UPDATED : 2026-10-06_0606 UTC — surrounding suburbs added (Wayne, Oakland, Macomb): 39 cities, for the cleaning push.
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

export const SEO_CITY_BY_SLUG: Record<string, SeoCity> = Object.fromEntries(SEO_CITIES.map((c) => [c.slug, c]));
