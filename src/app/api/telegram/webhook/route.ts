import { z } from "zod";
import { applyDecision, completeRecommendation } from "@/lib/decisions";
import { answerCallback } from "@/lib/telegram";

export const runtime = "nodejs";

const updateSchema = z.object({
  callback_query: z.object({
    id: z.string(),
    from: z.object({ id: z.number(), username: z.string().optional() }).optional(),
    data: z.string().optional(),
  }).optional(),
});

/** Ikki xil tugma keladi: CEO brifidagi `decision:<qaror>:<id>` va ijrochidagi `done:<id>`. */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("Ruxsat yo‘q", { status: 401 });

  // Buzuq yoki kutilmagan shakldagi update'ni 200 bilan yutamiz — Telegram uni qayta uravermasin.
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: true });
  const query = parsed.data.callback_query;
  if (!query?.data) return Response.json({ ok: true });

  const [action, ...rest] = query.data.split(":");
  const actor = query.from?.username ?? String(query.from?.id ?? "telegram");
  let message: string;

  // Ichki xato 500 qaytaradi — handlerlar idempotent, shuning uchun Telegram'ning qayta urinishi xavfsiz.
  try {
    if (action === "done") {
      const [id] = rest;
      if (!id) return Response.json({ ok: true });
      const result = await completeRecommendation({ id, channel: "telegram", actor });
      message = !result.ok ? (result.error ?? "Xatolik")
        : result.alreadyDecided ? "Bu vazifa allaqachon yakunlangan"
        : "Bajarildi deb belgilandi — rahmat!";
    } else if (action === "decision") {
      const [decision, id] = rest;
      if (!id || (decision !== "approved" && decision !== "rejected")) return Response.json({ ok: true });
      const result = await applyDecision({ id, decision, channel: "telegram", actor });
      message = !result.ok ? (result.error ?? "Xatolik")
        : result.alreadyDecided ? "Bu amal bo‘yicha qaror allaqachon qabul qilingan"
        : decision === "rejected" ? "Rad etildi"
        : result.delivery?.delivered ? "Tasdiqlandi va ijrochiga yuborildi"
        : "Tasdiqlandi (Telegramga yuborilmadi)";
    } else {
      return Response.json({ ok: true });
    }

    await answerCallback(query.id, message);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook yiqildi", error);
    return Response.json({ ok: false }, { status: 500 });
  }
}
