import { applyDecision } from "@/lib/decisions";
import { answerCallback } from "@/lib/telegram";

export const runtime = "nodejs";

type TelegramUpdate = { callback_query?: { id: string; from?: { id: number; username?: string }; data?: string } };

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-telegram-bot-api-secret-token") !== secret) return new Response("Ruxsat yo‘q", { status: 401 });
  const update = await request.json() as TelegramUpdate;
  const query = update.callback_query;
  if (!query?.data?.startsWith("decision:")) return Response.json({ ok: true });

  const [, decision, id] = query.data.split(":") as [string, "approved" | "rejected", string];
  const result = await applyDecision({ id, decision, channel: "telegram", actor: query.from?.username ?? String(query.from?.id ?? "telegram") });
  const message = !result.ok ? (result.error ?? "Xatolik")
    : result.alreadyDecided ? "Bu amal bo‘yicha qaror allaqachon qabul qilingan"
    : decision === "rejected" ? "Rad etildi"
    : result.delivery?.delivered ? "Tasdiqlandi va ijrochiga yuborildi"
    : "Tasdiqlandi (Telegramga yuborilmadi)";
  await answerCallback(query.id, message);
  return Response.json({ ok: true });
}
