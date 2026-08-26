import { runDailyBrief } from "@/lib/workflows/daily-brief";
import { guard } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const auth = await guard();
  if ("response" in auth) return auth.response;
  try {
    return Response.json(await runDailyBrief());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Brif yaratilmadi" }, { status: 500 });
  }
}
