import { deliverBrief, runDailyBrief } from "@/lib/workflows/daily-brief";
import { guard } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const auth = await guard();
  if ("response" in auth) return auth.response;
  try {
    const brief = await runDailyBrief();
    // Paneldan yangilanganda ham xabarlar ketadi; kunlik qulf takror yuborishdan saqlaydi.
    const { delivery, digests } = await deliverBrief(brief);
    return Response.json({ brief, delivery, digests });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Brif yaratilmadi" }, { status: 500 });
  }
}
