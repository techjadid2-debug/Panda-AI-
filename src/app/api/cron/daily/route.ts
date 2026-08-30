import { deliverBrief, runDailyBrief } from "@/lib/workflows/daily-brief";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Ruxsat yo‘q", { status: 401 });
  try {
    const brief = await runDailyBrief();
    return Response.json({ brief, ...(await deliverBrief(brief)) });
  } catch (error) {
    console.error("Kunlik cron yiqildi", error);
    return Response.json({ error: error instanceof Error ? error.message : "Kunlik brif yaratilmadi" }, { status: 500 });
  }
}
