/*
 * FILE    : apps/web/lib/iebc/gateway.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-01_1800 UTC
 * PURPOSE : Policy gateway for IEBC's AI employees. Authenticates the IEBC API key,
 *           checks the agent's scopes and autonomy, runs or queues the action, and
 *           writes every call to agent_actions.
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { adminClient } from "../supabase/server";
import { ACTIONS, effectiveRisk, type ActionCtx } from "./actions";

export interface Agent {
  id: string;
  iebc_employee_id: string;
  name: string;
  title: string;
  role_here: string;
  scopes: string[];
  autonomy: "suggest" | "approval" | "autonomous";
  active: boolean;
}

export function checkApiKey(req: Request): boolean {
  const key = process.env.IEBC_API_KEY;
  const got = req.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  if (!key || got.length !== key.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(key));
}

export async function loadAgent(employeeId: string | null): Promise<Agent | null> {
  if (!employeeId) return null;
  const { data } = await adminClient().from("iebc_agents").select("*").eq("iebc_employee_id", employeeId).maybeSingle();
  return (data as Agent) ?? null;
}

export function manifest(agent: Agent) {
  return Object.entries(ACTIONS)
    .filter(([, a]) => agent.scopes.includes(a.scope))
    .map(([name, a]) => ({
      name, description: a.description, write: a.write,
      runs: !a.write ? "immediately" : agent.autonomy === "autonomous" && a.risk === "low" ? "immediately" : "after human approval",
      params: z.toJSONSchema(a.params, { io: "input", unrepresentable: "any" }),
    }));
}

type Outcome = { status: "executed" | "pending_approval" | "denied" | "failed"; result?: unknown; error?: string; action_id?: string };

export async function invoke(agent: Agent, action: string, rawParams: unknown, reason: string | null): Promise<Outcome> {
  const db = adminClient();
  const log = async (status: Outcome["status"], params: unknown, result: unknown) => {
    const { data } = await db.from("agent_actions").insert({ agent_id: agent.id, action, params: params ?? {}, reason, status, result }).select("id").single();
    return data?.id as string | undefined;
  };
  await db.from("iebc_agents").update({ last_seen_at: new Date().toISOString() }).eq("id", agent.id);

  const def = ACTIONS[action];
  if (!agent.active) return { status: "denied", error: "Agent is paused", action_id: await log("denied", rawParams, { error: "paused" }) };
  if (!def) return { status: "denied", error: `Unknown action ${action}` };
  if (!agent.scopes.includes(def.scope))
    return { status: "denied", error: `${agent.name} is not assigned the "${def.scope}" scope`, action_id: await log("denied", rawParams, { error: "scope" }) };
  const parsed = def.params.safeParse(rawParams ?? {});
  if (!parsed.success) return { status: "failed", error: `Invalid params: ${parsed.error.message}` };
  const params = parsed.data as Record<string, unknown>;

  const needsApproval = def.write && (agent.autonomy !== "autonomous" || effectiveRisk(action, params) === "high");
  if (needsApproval) return { status: "pending_approval", action_id: await log("pending_approval", params, null) };
  return execute(action, params, (status, result) => log(status, params, result), { actor: `${agent.name} (IEBC)` });
}

export async function execute(action: string, params: unknown, record: (status: "executed" | "failed", result: unknown) => Promise<string | undefined>, ctx: ActionCtx = { actor: "IEBC" }): Promise<Outcome> {
  try {
    const result = await ACTIONS[action].run(params as never, ctx);
    return { status: "executed", result, action_id: await record("executed", result) };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { status: "failed", error, action_id: await record("failed", { error }) };
  }
}
