import { guard } from "@/lib/auth";
import { applyDecision, completeRecommendation } from "@/lib/decisions";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: RouteContext<"/api/recommendations/[id]/decision">) {
  const auth = await guard("ceo");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const body = await request.json() as { decision?: "approved" | "rejected" | "done"; teamKey?: string };

  if (body.decision === "done") {
    const done = await completeRecommendation({ id, channel: "panel", actor: auth.session.key });
    return Response.json(done, { status: done.ok ? 200 : done.recommendation ? 409 : 404 });
  }
  if (body.decision !== "approved" && body.decision !== "rejected") return Response.json({ error: "Qaror berilmagan" }, { status: 400 });

  const result = await applyDecision({ id, decision: body.decision, teamKey: body.teamKey, channel: "panel", actor: auth.session.key });
  return Response.json(result, { status: result.ok ? 200 : result.recommendation ? 409 : 404 });
}
