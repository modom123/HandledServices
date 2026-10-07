/*
 * FILE    : scripts/build-setup-sql.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_2230 UTC
 * PURPOSE : Builds ONE file that sets up a brand-new Supabase project from the SQL editor:
 *           every migration in order + the production seed. (CLI users run `supabase db push`
 *           instead.) Run: node --experimental-strip-types scripts/build-setup-sql.ts
 * UPDATED : 2026-10-06_1956 UTC — only replaces older full setup files; keeps the ASCII copy and the split parts.
 */
import { readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";

const root = new URL("../supabase/", import.meta.url);
const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
const migrations = readdirSync(new URL("migrations/", root)).filter((f) => f.endsWith(".sql")).sort();
// replace only older full setup files (HANDLED_SETUP_YYYY-…); the ASCII copy and the split parts are kept
for (const old of readdirSync(new URL("setup/", root))) if (/^HANDLED_SETUP_\d{4}-/.test(old)) rmSync(new URL(`setup/${old}`, root));

const parts = [
  `-- ============================================================================
-- FILE    : supabase/setup/HANDLED_SETUP_${stamp}.sql   (generated — do not hand edit)
-- PROJECT : Handled (HandledServices)
-- CREATED : ${stamp} UTC
-- PURPOSE : One-paste setup for a NEW Supabase project: ${migrations.length} migrations + production seed.
--           Supabase → SQL Editor → New query → paste this whole file → Run.
--           Then sign in once on the website and run:
--             update public.profiles set role = 'admin' where email = 'YOU@YOURCOMPANY.COM';
-- ============================================================================
`,
  ...migrations.map((f) => `\n-- >>> migration ${f}\n${readFileSync(new URL(`migrations/${f}`, root), "utf8")}`),
  `\n-- >>> seed.sql\n${readFileSync(new URL("seed.sql", root), "utf8")}`,
];
writeFileSync(new URL(`setup/HANDLED_SETUP_${stamp}.sql`, root), parts.join("\n"));
console.log(`wrote supabase/setup/HANDLED_SETUP_${stamp}.sql (${migrations.length} migrations + seed)`);
