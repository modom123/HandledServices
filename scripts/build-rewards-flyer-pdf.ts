/*
 * FILE    : scripts/build-rewards-flyer-pdf.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-05_0418 UTC
 * PURPOSE : One-page Handled Pro Rewards flyer for recruiting (front: English, back: Spanish) →
 *           docs/PRO_REWARDS_FLYER_<timestamp>.pdf, from packages/core/src/rewards.ts.
 *           Run: node --experimental-strip-types scripts/build-rewards-flyer-pdf.ts (Chromium: CHROME_PATH)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATALOG_SEED, MILESTONES, REWARD_DEFAULTS as R, TENURE_TIERS } from "../packages/core/src/rewards.ts";
import { BRAND } from "../packages/core/src/brand.ts";

const ts = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "");
const out = `docs/PRO_REWARDS_FLYER_${ts}.pdf`;
const n = (x: number) => x.toLocaleString("en-US");
const picks = ["hoodie", "gas-50", "tools-100", "drill-kit", "tv-55", "game-day", "weekend-trip", "trip-for-two"].map((s) => CATALOG_SEED.find((c) => c.slug === s)!);
// example: a steady pro doing $2,000 of jobs a week ≈ $400/week of our take
const yearPts = Math.round(400 * 52 * R.earnRate);

const page = (es: boolean) => `
<section class="page">
  <div class="top"><div class="brand">${BRAND.name.toUpperCase()} PRO</div><div class="pill">${es ? "Para profesionales independientes" : "For independent pros"}</div></div>
  <h1>${es ? "Recompensas que crecen<br>mientras más se queda" : "Rewards that grow<br>the longer you stay"}</h1>
  <p class="lead">${es ? "Cada trabajo le da puntos. Cámbielos por artículos, herramientas, electrónicos y viajes." : "Every job earns points. Redeem them for gear, tools, electronics and trips."}</p>
  <div class="grid3">
    <div class="card"><div class="big">${R.earnRate}</div><div>${es ? "puntos por cada $1 que Handled gana en su trabajo" : "points for every $1 Handled earns on your job"}</div></div>
    <div class="card"><div class="big">×${R.qualityMultiplier}</div><div>${es ? `por un gran trabajo: pasa la revisión a la primera con ${R.minRatingForQuality}★+` : `for great work: passes review the first time with ${R.minRatingForQuality}★+`}</div></div>
    <div class="card"><div class="big">×1.5</div><div>${es ? "después de 2 años con nosotros" : "after 2 years with us"}</div></div>
  </div>
  <h2>${es ? "Quedarse paga más" : "Staying pays more"}</h2>
  <div class="tiers">${TENURE_TIERS.map((t) => `<div><b>×${t.multiplier}</b><span>${es ? t.es : t.en}</span></div>`).join("")}</div>
  <h2>${es ? "Lo que puede canjear" : "What you can redeem"}</h2>
  <table>${picks.map((c) => `<tr><td>${es ? c.name_es : c.name}</td><td class="r">${n(c.points)} pts</td></tr>`).join("")}</table>
  <div class="ex">${es ? `Ejemplo: un profesional constante con $2,000 en trabajos por semana gana unos <b>${n(yearPts)} puntos al año</b> antes de bonos, suficiente para una TV, un viaje de fin de semana y herramientas.` : `Example: a steady pro doing $2,000 of jobs a week earns about <b>${n(yearPts)} points a year</b> before bonuses — enough for a TV, a weekend trip and tools.`}</div>
  <h2>${es ? "Bonos por metas" : "Milestone bonuses"}</h2>
  <p class="small">${MILESTONES.map((m) => `${es ? m.es : m.en} +${n(m.points)}`).join(" · ")}</p>
  <div class="fine">${es
    ? `Los puntos nuevos se liberan a los ${R.pendingDays} días. Rechazar ofertas nunca le cuesta puntos. Los puntos no tienen valor en efectivo y no son pago ni participación en la empresa; los premios cuentan como ingreso y aparecen en su 1099. Vencen tras ${R.inactivityExpiryMonths} meses sin trabajos. Sujeto a los Términos de Recompensas; el catálogo puede cambiar. Valores de ejemplo, estimados.`
    : `New points unlock after ${R.pendingDays} days. Passing on offers never costs points. Points have no cash value and aren't pay or a share of the company; rewards count as income and appear on your 1099. Points expire after ${R.inactivityExpiryMonths} months with no jobs. Subject to the Rewards Terms; the catalog may change. Example figures are estimates.`}</div>
  <div class="cta">${es ? "Postúlese en" : "Apply at"} <b>handledsvc.com/pros</b></div>
</section>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>${BRAND.name} Pro Rewards flyer (${ts} UTC)</title>
<!-- Generated ${ts} UTC by scripts/build-rewards-flyer-pdf.ts -->
<style>
 @page { size: Letter; margin: 0.5in; }
 body { font-family: Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
 .page { height: 10in; display: flex; flex-direction: column; page-break-after: always; } .page:last-child { page-break-after: auto; }
 .top { display: flex; justify-content: space-between; align-items: center; } .brand { font-weight: 800; color: #0f766e; letter-spacing: 1px; } .pill { background: #ccfbf1; color: #115e59; border-radius: 12pt; padding: 3pt 10pt; font-size: 9pt; }
 h1 { font-size: 34pt; line-height: 1.05; margin: 22pt 0 8pt; color: #0f766e; } .lead { font-size: 14pt; margin: 0 0 14pt; color: #334155; }
 h2 { font-size: 13pt; margin: 14pt 0 6pt; }
 .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10pt; } .card { border: 1.5px solid #99f6e4; background: #f0fdfa; border-radius: 10pt; padding: 10pt; font-size: 10.5pt; } .big { font-size: 26pt; font-weight: 800; color: #0f766e; }
 .tiers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; } .tiers div { border: 1px solid #cbd5e1; border-radius: 8pt; padding: 8pt; text-align: center; } .tiers b { display: block; font-size: 18pt; color: #0f766e; } .tiers span { font-size: 9pt; color: #475569; }
 table { width: 100%; border-collapse: collapse; font-size: 11pt; } td { padding: 4pt 2pt; border-bottom: 1px dotted #cbd5e1; } .r { text-align: right; font-weight: 700; color: #0f766e; white-space: nowrap; }
 .ex { margin-top: 10pt; background: #fff7ed; border: 1px solid #fdba74; border-radius: 8pt; padding: 8pt 10pt; font-size: 10.5pt; }
 .small { font-size: 9pt; color: #334155; margin: 0; } .fine { margin-top: auto; font-size: 7.5pt; color: #64748b; } .cta { margin-top: 8pt; font-size: 15pt; text-align: center; background: #0f766e; color: #fff; border-radius: 10pt; padding: 10pt; }
</style></head><body>${page(false)}${page(true)}</body></html>`;

const dir = mkdtempSync(join(tmpdir(), "flyer-"));
writeFileSync(join(dir, "f.html"), html);
execFileSync(process.env.CHROME_PATH || "/opt/pw-browsers/chromium", ["--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${join(process.cwd(), out)}`, `file://${join(dir, "f.html")}`], { stdio: "ignore" });
console.log(`wrote ${out}`);
