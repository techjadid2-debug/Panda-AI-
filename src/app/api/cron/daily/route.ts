import { notifyTeamDigests, runDailyBrief } from "@/lib/workflows/daily-brief";
import { sendDailyBrief } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Ruxsat yo‘q", { status: 401 });
  const brief = await runDailyBrief();
  return Response.json({ brief, delivery: await sendDailyBrief(brief), digests: await notifyTeamDigests(brief) });
}
