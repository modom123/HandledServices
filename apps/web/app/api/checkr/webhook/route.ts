/*
 * FILE    : apps/web/app/api/checkr/webhook/route.ts
 * PROJECT : Handled (HandledServices) — AI-run home & business services
 * CREATED : 2026-10-02_0006 UTC
 * PURPOSE : Background-check results from Checkr. A "clear" report marks the pro's check done
 *           (and activates them if everything else is complete); anything else goes to ops for
 *           review under the FCRA adverse-action process. Checkr signs each webhook with an
 *           HMAC-SHA256 of the raw body using your API key (X-Checkr-Signature) — confirm the
 *           scheme in your Checkr dashboard when you add the endpoint.
 * UPDATED : 2026-10-03_1311 UTC — crew members' checks come back here too (candidate not a pro → crew_members).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { adminClient } from "@/lib/supabase/server";
import { onBackgroundResult } from "@/lib/recruiting";
import { setCrewBackground } from "@/lib/crew";

/** A Checkr candidate that isn't a pro may be a crew member (crew.ts). */
async function crewOf(candidateId: string) {
  const { data } = await adminClient().from("crew_members").select("id").eq("background_provider_id", candidateId).maybeSingle();
  return data?.id as string | undefined;
}

export async function POST(req: Request) {
  const key = process.env.CHECKR_API_KEY;
  if (!key) return new Response("Checkr not configured", { status: 501 });
  const raw = await req.text();
  const sig = req.headers.get("x-checkr-signature") ?? "";
  const want = createHmac("sha256", key).update(raw).digest("hex");
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return new Response("Bad signature", { status: 400 });
  const event = JSON.parse(raw) as { type?: string; data?: { object?: { candidate_id?: string; status?: string; result?: string | null } } };
  const obj = event.data?.object;
  if (event.type === "report.completed" && obj?.candidate_id) {
    const { data: c } = await adminClient().from("contractors").select("id").eq("background_provider_id", obj.candidate_id).maybeSingle();
    if (c) {
      const result = (obj.result ?? obj.status ?? "consider") as string;
      await onBackgroundResult(c.id, result === "clear" ? "clear" : "consider");
    } else { const crew = await crewOf(obj.candidate_id); if (crew) await setCrewBackground(crew, (obj.result ?? obj.status) === "clear" ? "clear" : "consider"); }
  } else if ((event.type === "report.suspended" || event.type === "report.canceled") && obj?.candidate_id) {
    const { data: c } = await adminClient().from("contractors").select("id").eq("background_provider_id", obj.candidate_id).maybeSingle();
    if (c) await onBackgroundResult(c.id, event.type === "report.suspended" ? "suspended" : "canceled");
    else { const crew = await crewOf(obj.candidate_id); if (crew) await setCrewBackground(crew, event.type === "report.suspended" ? "suspended" : "canceled"); }
  } else if (event.type === "invitation.completed" && obj?.candidate_id) {
    await adminClient().from("contractors").update({ background_status: "pending" }).eq("background_provider_id", obj.candidate_id);
    await adminClient().from("crew_members").update({ background_status: "pending" }).eq("background_provider_id", obj.candidate_id);
  }
  return Response.json({ received: true });
}
