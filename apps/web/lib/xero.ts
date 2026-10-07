/*
 * FILE    : apps/web/lib/xero.ts
 * PROJECT : Handled (myhumanai) — AI-run home & business services
 * CREATED : 2026-10-06_2200 UTC
 * PURPOSE : Xero connection. OAuth 2.0 (authorization code) for ONE Xero organisation, tokens encrypted at rest
 *           (AES-256-GCM, key from XERO_TOKEN_KEY or the client secret), automatic refresh (access tokens last
 *           30 minutes; the refresh token rotates and lasts 60 days of disuse), and a small Accounting API client
 *           with retry on 429 and an Idempotency-Key on every write.
 *           Scopes are Xero's granular scopes (required for apps created after 2 March 2026). Override with
 *           XERO_SCOPES only if your Xero app is older and still on the broad accounting.transactions scope.
 *           The account mapping (which Xero account each kind of money goes to) and its defaults live here too.
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { adminClient } from "./supabase/server";
import { siteUrl } from "./notify";

const AUTHORIZE = "https://login.xero.com/identity/connect/authorize";
const TOKEN = "https://identity.xero.com/connect/token";
const REVOKE = "https://identity.xero.com/connect/revocation";
const CONNECTIONS = "https://api.xero.com/connections";
const API = "https://api.xero.com/api.xro/2.0";

export const XERO_SCOPES = process.env.XERO_SCOPES?.trim() ||
  "openid profile email offline_access accounting.settings accounting.contacts accounting.invoices accounting.payments accounting.banktransactions";

export const xeroConfigured = () => Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
export const xeroRedirectUri = () => process.env.XERO_REDIRECT_URI?.trim() || `${siteUrl()}/api/xero/callback`;

// ─── Account mapping ─────────────────────────────────────────────────────────

export type AccountKey =
  | "stripe_bank" | "checking_bank" | "service_revenue" | "membership_revenue" | "talent_revenue" | "instant_pay_fees" | "refunds"
  | "subcontractors" | "pro_incentives" | "referral_commissions" | "tips" | "gift_cards" | "sales_tax" | "materials" | "stripe_fees" | "chargebacks" | "adjustments";

/** The chart Handled needs in Xero. "Create missing accounts" adds any code that isn't there yet (not checking_bank). */
export const DEFAULT_ACCOUNTS: Record<AccountKey, { code: string; name: string; type: string; help: string }> = {
  stripe_bank: { code: "1090", name: "Stripe", type: "BANK", help: "Money sitting in Stripe. Every Stripe sale, fee, refund and pro transfer lands here; payouts move it to your checking account." },
  checking_bank: { code: "", name: "Business checking", type: "BANK", help: "Your real bank account in Xero (with its bank feed). Stripe payouts are recorded as transfers into it. Enter its account code." },
  service_revenue: { code: "4100", name: "Service revenue", type: "REVENUE", help: "Full price customers pay for jobs (upfront, deposits, balances, change orders, Quick Charge)." },
  membership_revenue: { code: "4110", name: "Handled Plus memberships", type: "REVENUE", help: "Handled Plus subscription charges." },
  talent_revenue: { code: "4120", name: "Talent placement revenue", type: "REVENUE", help: "Handled Talent placement fees and retainers." },
  instant_pay_fees: { code: "4130", name: "Instant pay fees", type: "OTHERINCOME", help: "The fee a pro pays to cash out instantly (kept from the transfer)." },
  refunds: { code: "4190", name: "Customer refunds", type: "REVENUE", help: "Refunds to customers (reduces revenue)." },
  subcontractors: { code: "5100", name: "Pro payouts (subcontractors)", type: "DIRECTCOSTS", help: "What pros earn for jobs, show-up pay, guarantee top-ups and recruiter shares, minus deductions." },
  pro_incentives: { code: "5110", name: "Pro bonuses & stipends", type: "DIRECTCOSTS", help: "Referral bonuses and insurance stipends paid to pros." },
  referral_commissions: { code: "6130", name: "Referral commissions", type: "EXPENSE", help: "What referral partners earn: 10% of our fee on jobs from customers they sent (Partner Program)." },
  tips: { code: "2100", name: "Tips owed to pros", type: "CURRLIAB", help: "Tips are the pro's money: in when the customer tips, out when the pro is paid. Should net to ~0." },
  gift_cards: { code: "2110", name: "Gift cards outstanding", type: "CURRLIAB", help: "Gift cards sold and not yet used." },
  sales_tax: { code: "2120", name: "Sales tax collected", type: "CURRLIAB", help: "Sales tax Stripe Tax collected on top of the price. Clear it when you file and pay the tax." },
  materials: { code: "2130", name: "Materials pass-through", type: "CURRLIAB", help: "Materials customers pay at cost, then reimbursed to the pro. Should net to ~0." },
  stripe_fees: { code: "6100", name: "Payment processing fees", type: "EXPENSE", help: "Stripe card/ACH fees and other Stripe fees (Tax, Identity, Connect)." },
  chargebacks: { code: "6110", name: "Chargebacks", type: "EXPENSE", help: "Disputed payments taken back by the card network (and returned when won)." },
  adjustments: { code: "6120", name: "Stripe adjustments", type: "EXPENSE", help: "Anything else Stripe moved (reserves, corrections), so the Stripe account in Xero always matches Stripe." },
};
export const ACCOUNT_KEYS = Object.keys(DEFAULT_ACCOUNTS) as AccountKey[];

export type XeroSettings = {
  accounts: Partial<Record<AccountKey, string>>;  // Xero account codes (or AccountIDs for bank accounts without a code)
  sync_from?: string | null;                       // first business day to send (YYYY-MM-DD)
  reconciled?: boolean;                             // mark Stripe-account transactions reconciled (Stripe is the source of truth)
  timezone?: string;                                // business day boundaries
  stripe_contact_id?: string | null;                // the "Stripe" contact in Xero
};

export const accountCode = (s: XeroSettings, k: AccountKey) => (s.accounts?.[k] ?? DEFAULT_ACCOUNTS[k].code).trim();
export const BUSINESS_TZ = "America/Detroit";

// ─── Token storage (encrypted) ───────────────────────────────────────────────

function key() {
  const secret = process.env.XERO_TOKEN_KEY || process.env.XERO_CLIENT_SECRET || "";
  if (!secret) throw new Error("XERO_CLIENT_SECRET is not set");
  return createHash("sha256").update(`handled-xero:${secret}`).digest();
}
function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64")}.${c.getAuthTag().toString("base64")}.${ct.toString("base64")}`;
}
function open(sealed: string | null) {
  if (!sealed) return null;
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch {
    return null; // key changed → reconnect
  }
}

export type XeroConnection = {
  tenant_id: string | null; tenant_name: string | null; connection_id: string | null; expires_at: string | null;
  scopes: string | null; settings: XeroSettings; connected_by: string | null; connected_at: string | null;
};

/** The saved connection without tokens (safe to show staff). null = migration not run. */
export async function getConnection(): Promise<XeroConnection | null> {
  const { data, error } = await adminClient().from("xero_connection").select("tenant_id, tenant_name, connection_id, expires_at, scopes, settings, connected_by, connected_at").eq("id", 1).maybeSingle();
  if (error) return null;
  return { tenant_id: null, tenant_name: null, connection_id: null, expires_at: null, scopes: null, connected_by: null, connected_at: null, ...(data ?? {}), settings: { ...((data?.settings ?? {}) as XeroSettings), accounts: { ...((data?.settings as XeroSettings | undefined)?.accounts ?? {}) } } };
}

export async function saveSettings(patch: Partial<XeroSettings>) {
  const cur = (await getConnection())?.settings ?? { accounts: {} };
  const settings = { ...cur, ...patch, accounts: { ...cur.accounts, ...(patch.accounts ?? {}) } };
  const { error } = await adminClient().from("xero_connection").upsert({ id: 1, settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  return settings;
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export function authorizeUrl(state: string) {
  const q = new URLSearchParams({ response_type: "code", client_id: process.env.XERO_CLIENT_ID!, redirect_uri: xeroRedirectUri(), scope: XERO_SCOPES, state });
  return `${AUTHORIZE}?${q}`;
}

type TokenSet = { access_token: string; refresh_token: string; expires_in: number; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenSet> {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(TOKEN, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Xero token error: ${j.error_description ?? j.error ?? r.status}`);
  return j as TokenSet;
}

async function storeTokens(t: TokenSet, extra: Record<string, unknown> = {}) {
  const { error } = await adminClient().from("xero_connection").upsert({
    id: 1, access_token: seal(t.access_token), refresh_token: seal(t.refresh_token),
    expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString(), ...(t.scope ? { scopes: t.scope } : {}),
    updated_at: new Date().toISOString(), ...extra,
  });
  if (error) throw new Error(error.message);
}

/** Finish the OAuth flow: swap the code for tokens and remember which organisation was picked. */
export async function completeConnect(code: string, who: string) {
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: xeroRedirectUri() });
  const r = await fetch(CONNECTIONS, { headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json" }, cache: "no-store" });
  const list = ((await r.json().catch(() => [])) as { id: string; tenantId: string; tenantType: string; tenantName: string }[]).filter((c) => c.tenantType === "ORGANISATION");
  if (!list.length) throw new Error("No Xero organisation was authorised. Try again and pick your organisation.");
  const want = process.env.XERO_TENANT_ID?.trim();
  const org = (want && list.find((c) => c.tenantId === want)) || list[0];
  await storeTokens(t, { tenant_id: org.tenantId, tenant_name: org.tenantName, connection_id: org.id, connected_by: who, connected_at: new Date().toISOString() });
  return { tenantName: org.tenantName, others: list.length - 1 };
}

/** Disconnect: revoke the refresh token at Xero and forget the tokens (settings are kept). */
export async function disconnect() {
  const { data } = await adminClient().from("xero_connection").select("refresh_token").eq("id", 1).maybeSingle();
  const refresh = open(data?.refresh_token ?? null);
  if (refresh) {
    const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
    await fetch(REVOKE, { method: "POST", headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refresh }) }).catch(() => null);
  }
  await adminClient().from("xero_connection").update({ access_token: null, refresh_token: null, expires_at: null, tenant_id: null, tenant_name: null, connection_id: null, updated_at: new Date().toISOString() }).eq("id", 1);
}

/** A valid access token + tenant, refreshing when it's about to expire. */
async function session(force = false): Promise<{ token: string; tenant: string }> {
  if (!xeroConfigured()) throw new Error("Xero isn't configured (XERO_CLIENT_ID / XERO_CLIENT_SECRET)");
  const db = adminClient();
  const { data, error } = await db.from("xero_connection").select("tenant_id, access_token, refresh_token, expires_at").eq("id", 1).maybeSingle();
  if (error) throw new Error("Run the Xero accounting migration first");
  if (!data?.tenant_id || !data.refresh_token) throw new Error("Xero isn't connected — Hub → Accounting → Connect Xero");
  const access = open(data.access_token);
  if (!force && access && data.expires_at && new Date(data.expires_at).getTime() > Date.now()) return { token: access, tenant: data.tenant_id };
  const refresh = open(data.refresh_token);
  if (!refresh) throw new Error("Saved Xero login can't be read (the key changed) — reconnect Xero");
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  await storeTokens(t);
  return { token: t.access_token, tenant: data.tenant_id };
}

// ─── API client ──────────────────────────────────────────────────────────────

export class XeroError extends Error {
  constructor(message: string, public status: number, public body: unknown) { super(message); }
}

/** Pull the first useful validation message out of a Xero error body. */
function xeroMessage(body: unknown, status: number): string {
  const b = body as { Message?: string; Detail?: string; Elements?: { ValidationErrors?: { Message: string }[] }[]; Title?: string } | null;
  const v = b?.Elements?.flatMap((e) => e.ValidationErrors ?? []).map((e) => e.Message).filter(Boolean);
  return v?.length ? v.join("; ") : b?.Detail || b?.Message || b?.Title || `Xero returned ${status}`;
}

export async function xero<T = Record<string, unknown>>(method: "GET" | "PUT" | "POST" | "DELETE", path: string, body?: unknown, opts: { idempotencyKey?: string; query?: Record<string, string> } = {}): Promise<T> {
  let s = await session();
  const url = `${API}${path}${opts.query ? `?${new URLSearchParams(opts.query)}` : ""}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, {
      method, cache: "no-store",
      headers: {
        Authorization: `Bearer ${s.token}`, "xero-tenant-id": s.tenant, Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(opts.idempotencyKey ? { "Idempotency-Key": createHash("sha256").update(opts.idempotencyKey).digest("hex").slice(0, 64) } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401 && attempt === 0) { s = await session(true); continue; }
    if (r.status === 429 || r.status === 503) {
      const wait = Math.min(Number(r.headers.get("retry-after") ?? 2), 30);
      await new Promise((res) => setTimeout(res, wait * 1000));
      continue;
    }
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new XeroError(xeroMessage(j, r.status), r.status, j);
    return j as T;
  }
  throw new XeroError("Xero is rate-limiting us — try again in a minute", 429, null);
}

export type XeroAccount = { AccountID: string; Code?: string; Name: string; Type: string; Status: string; BankAccountNumber?: string };

export async function listAccounts(): Promise<XeroAccount[]> {
  return (await xero<{ Accounts: XeroAccount[] }>("GET", "/Accounts")).Accounts ?? [];
}

export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Xero account reference for a code or (for bank accounts with no code) an AccountID. */
export const accountRef = (v: string) => (isUuid(v) ? { AccountID: v } : { Code: v });

/** Which mapped accounts exist in Xero, which are missing, and which have an unexpected type. */
export async function checkAccounts(settings: XeroSettings) {
  const all = await listAccounts();
  return ACCOUNT_KEYS.map((k) => {
    const code = accountCode(settings, k);
    const a = code ? all.find((x) => (isUuid(code) ? x.AccountID === code : x.Code === code)) : undefined;
    const want = DEFAULT_ACCOUNTS[k].type;
    return { key: k, code, found: a ? { name: a.Name, type: a.Type, status: a.Status } : null, typeOk: !a || (want === "BANK") === (a.Type === "BANK") }; // bank accounts must be bank accounts, and nothing else may be
  });
}

/** Create every mapped account that isn't in Xero yet (never the checking account — that one must already exist). */
export async function ensureAccounts(settings: XeroSettings) {
  const all = await listAccounts();
  const created: string[] = [], skipped: string[] = [];
  for (const k of ACCOUNT_KEYS) {
    const def = DEFAULT_ACCOUNTS[k];
    const code = accountCode(settings, k);
    if (k === "checking_bank" || !code || isUuid(code)) { skipped.push(k); continue; }
    if (all.some((a) => a.Code === code)) continue;
    await xero("PUT", "/Accounts", {
      Code: code, Name: def.name, Type: def.type, Description: `Handled — ${def.help}`.slice(0, 4000),
      ...(def.type === "BANK" ? { BankAccountNumber: "STRIPE-BALANCE", CurrencyCode: "USD" } : {}),
    }, { idempotencyKey: `account-${code}` });
    created.push(`${code} ${def.name}`);
  }
  return { created, skipped };
}

/** Find a contact by exact name, or create it. */
export async function findOrCreateContact(c: { name: string; email?: string | null; isSupplier?: boolean; isCustomer?: boolean }): Promise<string> {
  const name = c.name.trim().slice(0, 255) || "Unknown";
  const found = await xero<{ Contacts: { ContactID: string }[] }>("GET", "/Contacts", undefined, { query: { where: `Name=="${name.replace(/["\\]/g, "")}"`, summaryOnly: "true" } });
  if (found.Contacts?.[0]) return found.Contacts[0].ContactID;
  const made = await xero<{ Contacts: { ContactID: string }[] }>("PUT", "/Contacts", { Contacts: [{ Name: name, ...(c.email ? { EmailAddress: c.email } : {}) }] }, { idempotencyKey: `contact-${name}` });
  return made.Contacts[0].ContactID;
}

/** Deep links into Xero for the log. */
export function xeroLink(kind: string, id: string | null) {
  if (!id) return null;
  if (kind === "invoice" || kind === "invoice_void") return `https://go.xero.com/AccountsReceivable/View.aspx?InvoiceID=${id}`;
  if (kind === "bank_payout") return `https://go.xero.com/Bank/ViewTransfer.aspx?bankTransferID=${id}`;
  if (kind === "invoice_payment") return null;
  return `https://go.xero.com/Bank/ViewTransaction.aspx?bankTransactionID=${id}`;
}
