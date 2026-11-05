/*
 * FILE    : apps/web/app/api/iebc/v1/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : IEBC Workforce API. IEBC's AI employees call this from the IEBC MasterHub.
 *           Auth:   Authorization: Bearer $IEBC_API_KEY   +   X-IEBC-Agent: <employee id, e.g. arthur>
 *           GET     → the agent's assignment + the actions it may use (JSON Schema params)
 *           POST    { action, params, reason } → executed | pending_approval | denied | failed
 * UPDATED : 2026-11-05_1240 UTC — IEBC_ALLOWED_ORIGIN takes a comma-separated list (e.g. "https://modom123.github.io, null"
 *           — GitHub Pages and the MasterHub file opened from a computer); the calling origin is echoed back when it's on
 *           the list, so the browser lets MasterHub read the answer. Unset = any origin (the key still protects it).
 */
import { checkApiKey, invoke, loadAgent, manifest } from "@/lib/iebc/gateway";
import { BRAND } from "@handled/core";

const allowed = () => (process.env.IEBC_ALLOWED_ORIGIN ?? "*").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean);
/** CORS for the MasterHub: echo the caller's origin when it's allowed (browsers accept one origin per answer). */
const cors = (req?: Request) => {
  const list = allowed();
  const origin = req?.headers.get("origin") ?? "";
  const allow = list.includes("*") ? "*" : list.includes(origin) ? origin : list[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type, x-iebc-agent",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...(allow === "*" ? {} : { Vary: "Origin" }),
  };
};
const json = (req: Request, body: unknown, status = 200) => Response.json(body, { status, headers: cors(req) });

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function GET(req: Request) {
  if (!checkApiKey(req)) return json(req, { error: "Invalid IEBC API key" }, 401);
  const agent = await loadAgent(req.headers.get("x-iebc-agent") ?? new URL(req.url).searchParams.get("agent"));
  if (!agent) return json(req, { error: "Agent is not assigned to this business" }, 403);
  return json(req, {
    business: BRAND.name,
    agent: { id: agent.iebc_employee_id, name: agent.name, title: agent.title, role_here: agent.role_here, autonomy: agent.autonomy, active: agent.active, scopes: agent.scopes },
    actions: manifest(agent),
  });
}

export async function POST(req: Request) {
  if (!checkApiKey(req)) return json(req, { error: "Invalid IEBC API key" }, 401);
  const agent = await loadAgent(req.headers.get("x-iebc-agent"));
  if (!agent) return json(req, { error: "Agent is not assigned to this business" }, 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return json(req, { error: "Body must be { action, params, reason }" }, 400);
  const out = await invoke(agent, body.action, body.params, typeof body.reason === "string" ? body.reason.slice(0, 2000) : null);
  const code = { executed: 200, pending_approval: 202, denied: 403, failed: 422 }[out.status];
  return json(req, out, code);
}
