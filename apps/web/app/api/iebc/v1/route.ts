/*
 * FILE    : apps/web/app/api/iebc/v1/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : IEBC Workforce API. IEBC's AI employees call this from the IEBC MasterHub.
 *           Auth:   Authorization: Bearer $IEBC_API_KEY   +   X-IEBC-Agent: <employee id, e.g. arthur>
 *           GET     → the agent's assignment + the actions it may use (JSON Schema params)
 *           POST    { action, params, reason } → executed | pending_approval | denied | failed
 */
import { checkApiKey, invoke, loadAgent, manifest } from "@/lib/iebc/gateway";
import { BRAND } from "@handled/core";

const cors = () => ({
  "Access-Control-Allow-Origin": process.env.IEBC_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-iebc-agent",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
});
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors() });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function GET(req: Request) {
  if (!checkApiKey(req)) return json({ error: "Invalid IEBC API key" }, 401);
  const agent = await loadAgent(req.headers.get("x-iebc-agent") ?? new URL(req.url).searchParams.get("agent"));
  if (!agent) return json({ error: "Agent is not assigned to this business" }, 403);
  return json({
    business: BRAND.name,
    agent: { id: agent.iebc_employee_id, name: agent.name, title: agent.title, role_here: agent.role_here, autonomy: agent.autonomy, active: agent.active, scopes: agent.scopes },
    actions: manifest(agent),
  });
}

export async function POST(req: Request) {
  if (!checkApiKey(req)) return json({ error: "Invalid IEBC API key" }, 401);
  const agent = await loadAgent(req.headers.get("x-iebc-agent"));
  if (!agent) return json({ error: "Agent is not assigned to this business" }, 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return json({ error: "Body must be { action, params, reason }" }, 400);
  const out = await invoke(agent, body.action, body.params, typeof body.reason === "string" ? body.reason.slice(0, 2000) : null);
  const code = { executed: 200, pending_approval: 202, denied: 403, failed: 422 }[out.status];
  return json(out, code);
}
