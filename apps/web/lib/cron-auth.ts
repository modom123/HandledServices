/*
 * FILE    : apps/web/lib/cron-auth.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-06_0726 UTC
 * PURPOSE : Who may run the scheduled jobs (/api/cron/*): only Vercel Cron or the GitHub Action, which send
 *           "Authorization: Bearer <CRON_SECRET>". Fails closed: with CRON_SECRET missing or shorter than
 *           16 characters nothing runs (before, a missing secret let anyone in with "Bearer undefined").
 *           Constant-time comparison.
 * UPDATED : 2026-11-05_1240 UTC — githubActionsAuthorized(): the GitHub dispatch workflow can sign in with a GitHub
 *           Actions token (OIDC) instead of CRON_SECRET, so nothing has to be copied into GitHub.
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";

export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (secret.length < 16) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── GitHub Actions without a shared secret (OIDC) ─────────────────────────
// The 10-minute dispatch workflow asks GitHub for a short-lived signed token (audience "handled-cron") and sends it as
// the bearer. We check GitHub's signature (its public keys), the issuer, the audience, the expiry and that it came from
// THIS repository — so nobody has to copy CRON_SECRET into GitHub. Fails closed on anything unexpected.

const ISSUER = "https://token.actions.githubusercontent.com";
export const OIDC_AUDIENCE = "handled-cron";
let jwks: { at: number; keys: (JsonWebKey & { kid?: string })[] } | null = null;

/** The repository allowed to run the job: GITHUB_CRON_REPO, else the one Vercel deploys from, else ours. */
const cronRepo = () =>
  (process.env.GITHUB_CRON_REPO?.trim() ||
    (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : "modom123/HandledServices")).toLowerCase();

const b64u = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function githubKeys(force = false) {
  if (!force && jwks && Date.now() - jwks.at < 3600_000) return jwks.keys;
  const r = await fetch(`${ISSUER}/.well-known/jwks`, { cache: "no-store" });
  if (!r.ok) throw new Error(`GitHub keys ${r.status}`);
  jwks = { at: Date.now(), keys: ((await r.json()).keys ?? []) as (JsonWebKey & { kid?: string })[] };
  return jwks.keys;
}

/** True when the request carries a valid GitHub Actions token from this repository. */
export async function githubActionsAuthorized(req: Request): Promise<boolean> {
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/)?.[1];
    if (!token) return false;
    const [h, p, sig] = token.split(".");
    const header = JSON.parse(b64u(h).toString("utf8")) as { alg?: string; kid?: string };
    if (header.alg !== "RS256" || !header.kid) return false;
    let jwk = (await githubKeys()).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await githubKeys(true)).find((k) => k.kid === header.kid); // keys rotate
    if (!jwk) return false;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(sig), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return false;
    const c = JSON.parse(b64u(p).toString("utf8")) as { iss?: string; aud?: string | string[]; exp?: number; nbf?: number; repository?: string };
    const now = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    return c.iss === ISSUER && aud.includes(OIDC_AUDIENCE) && typeof c.exp === "number" && c.exp > now && (!c.nbf || c.nbf <= now + 60)
      && (c.repository ?? "").toLowerCase() === cronRepo();
  } catch (e) {
    console.error("[cron-auth] github token", e instanceof Error ? e.message : e);
    return false;
  }
}
