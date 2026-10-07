/*
 * FILE    : scripts/smoke-test.mjs
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2000 UTC
 * PURPOSE : Launch smoke test — hits every public page and API on a deployed site and prints
 *           PASS/FAIL. Run after every deploy:
 *             node scripts/smoke-test.mjs https://your-domain
 */
const base = (process.argv[2] ?? process.env.SITE ?? "http://localhost:3000").replace(/\/$/, "");
const checks = [
  ["Home page", "GET", "/", (r, t) => r.ok && t.includes("Handled")],
  ["Services page lists new services", "GET", "/services", (r, t) => r.ok && ["Organizing", "Water Heater", "Power Washing", "Interior Painting", "Exterior Painting", "Errands"].every((x) => t.includes(x))],
  ["Painting booking page", "GET", "/book?service=interior-painting", (r) => r.ok],
  ["Junk container page", "GET", "/services/junk-container", (r, t) => r.ok && t.includes("Drop-off")],
  ["Transportation pages", "GET", "/services/limousine", (r, t) => r.ok && t.includes("Limousine")],
  ["Party bus quote", "POST", "/api/quote", (r, t) => r.ok && JSON.parse(t).baseline?.point > 0, { service_slug: "party-bus", answers: { size: "30", hours: 4 } }],
  ["Large item quote by weight", "POST", "/api/quote", (r, t) => r.ok && JSON.parse(t).baseline?.point > 0, { service_slug: "large-item-removal", answers: { heavy: 1, heaviest: 250, flights: 1 } }],
  ["Painting quote API", "POST", "/api/quote", (r, t) => r.ok && JSON.parse(t).baseline?.point > 0, { service_slug: "exterior-painting", answers: { sqft: 1800, stories: "2", siding: "vinyl" } }],
  ["Events page", "GET", "/events", (r, t) => r.ok && t.includes("Plan by budget")],
  ["Booking page", "GET", "/book?service=house-cleaning", (r) => r.ok],
  ["Service Agreement", "GET", "/terms/service-agreement", (r, t) => r.ok && t.includes("Service Agreement")],
  ["Privacy policy", "GET", "/privacy", (r) => r.ok],
  ["Health: site + database", "GET", "/api/health", (r, t) => r.ok && JSON.parse(t).db === "ok"],
  ["Instant quote API", "POST", "/api/quote", (r, t) => r.ok && JSON.parse(t).baseline?.point > 0, { service_slug: "house-cleaning", answers: { sqft: 2000, bedrooms: 3, bathrooms: 2, level: "standard" } }],
  ["Booking calendar API", "GET", "/api/availability?service=house-cleaning&zip=48226", (r, t) => r.ok && JSON.parse(t).days?.length > 0],
  ["IEBC API rejects missing key", "GET", "/api/iebc/v1", (r) => r.status === 401],
  ["Hub requires sign-in", "GET", "/hub", (r) => r.ok || r.status === 307 || r.status === 302],
  ["Security headers", "GET", "/", (r) => r.headers.get("x-content-type-options") === "nosniff"],
];

let failed = 0;
console.log(`Smoke test → ${base}\n`);
for (const [name, method, path, ok, body] of checks) {
  let pass = false, note = "";
  try {
    const r = await fetch(base + path, { method, redirect: "manual", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
    const t = await r.text();
    pass = Boolean(ok(r, t));
    note = `${r.status}`;
    if (!pass && path === "/api/health") note += ` ${t.slice(0, 80)}`;
  } catch (e) {
    note = String(e).slice(0, 80);
  }
  if (!pass) failed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name.padEnd(36)} ${note}`);
}
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed ? 1 : 0);
