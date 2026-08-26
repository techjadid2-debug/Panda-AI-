import { formatDue } from "@/lib/time";
import type { Brief, Recommendation, Team } from "@/lib/types";

const esc = (value: string) => value.replace(/([_*`\[])/g, "\\$1");

async function call(method: string, body: unknown): Promise<{ ok: boolean; reason?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "TELEGRAM_BOT_TOKEN sozlanmagan" };
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) return { ok: true };
    return { ok: false, reason: `Telegram ${response.status}: ${(await response.text()).slice(0, 200)}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Telegram bilan bog‘lanib bo‘lmadi" };
  }
}

export async function sendTask(task: Recommendation, team: Team) {
  const text = `🎯 *Yangi tasdiqlangan vazifa*\n\n*${esc(task.title)}*\n\nKutilgan natija: ${esc(task.expectedResult)}\nMuddat: ${esc(formatDue(task.dueAt))}\nManba: ${task.owner} agent`;
  const result = await call("sendMessage", {
    chat_id: team.chatId, text, parse_mode: "Markdown",
    reply_markup: { inline_keyboard: [[{ text: "✅ Bajarildi", callback_data: `done:${task.id}` }]] },
  });
  return { delivered: result.ok, reason: result.reason };
}

export async function sendCriticalAlerts(items: Recommendation[]) {
  const chatId = process.env.TELEGRAM_CEO_CHAT_ID;
  if (!chatId || !items.length) return { delivered: false, reason: "TELEGRAM_CEO_CHAT_ID sozlanmagan" };
  const text = items.map((item) => `🚨 *KRITIK: ${esc(item.title)}*\n${esc(item.evidence)}\nQaror: ${esc(item.expectedResult)}`).join("\n\n");
  const result = await call("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown" });
  return { delivered: result.ok, reason: result.reason };
}

export async function sendDailyBrief(brief: Brief) {
  const chatId = process.env.TELEGRAM_CEO_CHAT_ID;
  if (!chatId) return { delivered: false, reason: "TELEGRAM_CEO_CHAT_ID sozlanmagan" };
  const pending = brief.recommendations.filter((item) => item.status === "draft" && item.notification !== "digest");
  const buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>> = pending.map((item) => [
    { text: `✅ ${item.owner}: tasdiqlash`, callback_data: `decision:approved:${item.id}` },
    { text: "✕", callback_data: `decision:rejected:${item.id}` },
  ]);
  if (process.env.APP_URL) buttons.push([{ text: "Panelni ochish", url: process.env.APP_URL }]);
  const text = `🧠 *CEO kunlik brifi*\n\n${esc(brief.executiveSummary)}\n\n${pending.length ? `${pending.length} ta qaror sizning tasdiqlashingizni kutmoqda.` : "Bugun alohida CEO qarori talab qilinmaydi."}`;
  const result = await call("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } });
  return { delivered: result.ok, reason: result.reason };
}

export async function answerCallback(callbackQueryId: string, text: string) {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}
