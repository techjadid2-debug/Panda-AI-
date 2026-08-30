import { formatDue } from "@/lib/time";
import type { Brief, Recommendation, Team } from "@/lib/types";

export type Delivery = { delivered: boolean; reason?: string; skipped?: boolean };

// HTML rejimida faqat shu uch belgi maxsus — Markdown'dagi kabi `]()~` tufayli xabar yiqilmaydi.
export const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

export async function sendTask(task: Recommendation, team: Team): Promise<Delivery> {
  const text = `🎯 <b>Yangi tasdiqlangan vazifa</b>\n\n<b>${esc(task.title)}</b>\n\nKutilgan natija: ${esc(task.expectedResult)}\nMuddat: ${esc(formatDue(task.dueAt))}\nManba: ${task.owner} agent`;
  const result = await call("sendMessage", {
    chat_id: team.chatId, text, parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: "✅ Bajarildi", callback_data: `done:${task.id}` }]] },
  });
  return { delivered: result.ok, reason: result.reason };
}

export async function sendCriticalAlerts(items: Recommendation[]): Promise<Delivery> {
  const chatId = process.env.TELEGRAM_CEO_CHAT_ID;
  if (!chatId || !items.length) return { delivered: false, reason: "TELEGRAM_CEO_CHAT_ID sozlanmagan" };
  const text = items.map((item) => `🚨 <b>KRITIK: ${esc(item.title)}</b>\n${esc(item.evidence)}\nQaror: ${esc(item.expectedResult)}`).join("\n\n");
  const result = await call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
  return { delivered: result.ok, reason: result.reason };
}

export async function sendDailyBrief(brief: Brief): Promise<Delivery> {
  const chatId = process.env.TELEGRAM_CEO_CHAT_ID;
  if (!chatId) return { delivered: false, reason: "TELEGRAM_CEO_CHAT_ID sozlanmagan" };
  const pending = brief.recommendations.filter((item) => item.status === "draft" && item.notification !== "digest");
  const buttons: Array<Array<{ text: string; callback_data?: string; url?: string }>> = pending.map((item) => [
    { text: `✅ ${item.owner}: tasdiqlash`, callback_data: `decision:approved:${item.id}` },
    { text: "✕", callback_data: `decision:rejected:${item.id}` },
  ]);
  if (process.env.APP_URL) buttons.push([{ text: "Panelni ochish", url: process.env.APP_URL }]);
  const text = `🧠 <b>CEO kunlik brifi</b>\n\n${esc(brief.executiveSummary)}\n\n${pending.length ? `${pending.length} ta qaror sizning tasdiqlashingizni kutmoqda.` : "Bugun alohida CEO qarori talab qilinmaydi."}`;
  const result = await call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  return { delivered: result.ok, reason: result.reason };
}

export async function answerCallback(callbackQueryId: string, text: string) {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

export async function sendTeamDigest(items: Recommendation[], team: Team): Promise<Delivery> {
  if (!items.length) return { delivered: false, reason: "Digest bo‘sh" };
  const lines = items.map((item) => `• <b>${esc(item.title)}</b>\n${esc(item.evidence)}\nNatija: ${esc(item.expectedResult)} · Muddat: ${esc(formatDue(item.dueAt))}`);
  const text = `📋 <b>Bugungi bo‘lim ishlari</b>\n\n${lines.join("\n\n")}\n\nBu ishlar CEO tasdig‘ini talab qilmaydi — o‘zingiz bajaring.`;
  // Har bir band uchun «Bajarildi» tugmasi — jamoa vazifani yopishi bilan panelda ham holat o‘zgaradi.
  const buttons = items.map((item) => [{ text: `✅ ${item.title.length > 30 ? `${item.title.slice(0, 30)}…` : item.title}`, callback_data: `done:${item.id}` }]);
  const result = await call("sendMessage", { chat_id: team.chatId, text, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } });
  return { delivered: result.ok, reason: result.reason };
}
