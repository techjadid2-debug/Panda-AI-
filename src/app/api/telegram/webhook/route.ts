import { applyDecision, completeRecommendation } from "@/lib/decisions";
import { answerCallback } from "@/lib/telegram";

export const runtime = "nodejs";

type TelegramUpdate = { callback_query?: { id: string; from?: { id: number; username?: string }; data?: string } };

/** Ikki xil tugma keladi: CEO brifidagi `decision:<qaror>:<id>` va ijrochidagi `done:<id>`. */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("Ruxsat yo‘q", { status: 401 });
  const update = await request.json() as TelegramUpdate;
  const query = update.callback_query;
  if (!query?.data) return Response.json({ ok: true });

  const [action, ...rest] = query.data.split(":");
  const actor = query.from?.username ?? String(query.from?.id ?? "telegram");
  let message: string;

  if (action === "done") {
    const [id] = rest;
    if (!id) return Response.json({ ok: true });
    const result = await completeRecommendation({ id, channel: "telegram", actor });
    message = !result.ok ? (result.error ?? "Xatolik")
      : result.alreadyDecided ? "Bu vazifa allaqachon yakunlangan"
      : "Bajarildi deb belgilandi — rahmat!";
  } else if (action === "decision") {
    const [decision, id] = rest as ["approved" | "rejected", string];
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
}
