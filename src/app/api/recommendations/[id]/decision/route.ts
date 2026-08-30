import { z } from "zod";
import { guard } from "@/lib/auth";
import { applyDecision, completeRecommendation, resendTask } from "@/lib/decisions";

export const runtime = "nodejs";

const bodySchema = z.object({
  decision: z.enum(["approved", "rejected", "done", "resend"]),
  teamKey: z.string().trim().min(1).optional(),
});

export async function POST(request: Request, { params }: RouteContext<"/api/recommendations/[id]/decision">) {
  const auth = await guard("ceo");
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "So‘rov tanasi noto‘g‘ri: decision approved/rejected/done bo‘lishi kerak." }, { status: 400 });
  const body = parsed.data;

  try {
    if (body.decision === "done") {
      const done = await completeRecommendation({ id, channel: "panel", actor: auth.session.key });
      return Response.json(done, { status: done.ok ? 200 : done.recommendation ? 409 : 404 });
    }
    if (body.decision === "resend") {
      const resent = await resendTask({ id, channel: "panel", actor: auth.session.key });
      return Response.json(resent, { status: resent.ok ? 200 : resent.recommendation ? 409 : 404 });
    }

    const result = await applyDecision({ id, decision: body.decision, teamKey: body.teamKey, channel: "panel", actor: auth.session.key });
    return Response.json(result, { status: result.ok ? 200 : result.recommendation ? 409 : 404 });
  } catch (error) {
    console.error("Qaror marshrutida xato", error);
    return Response.json({ error: error instanceof Error ? error.message : "Qarorni saqlab bo‘lmadi" }, { status: 500 });
  }
}
