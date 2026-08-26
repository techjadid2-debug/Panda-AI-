const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL;

if (!token || !secret || !appUrl) {
  console.error("TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET va APP_URL kerak. `.env.local` ga qo‘shing yoki `vercel env pull .env.local` ni bajaring.");
  process.exit(1);
}

const url = new URL("/api/telegram/webhook", appUrl).toString();
const call = async (method, body) =>
  (await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })).json();

// `allowed_updates` faqat tugma bosishlari: bot boshqa hech narsani olmaydi.
// `drop_pending_updates` — eski, allaqachon eskirgan tugma bosishlari qayta ishlanmasligi uchun.
const set = await call("setWebhook", { url, secret_token: secret, allowed_updates: ["callback_query"], drop_pending_updates: true });
if (!set.ok) {
  console.error(`Webhook o‘rnatilmadi: ${set.description ?? "noma’lum xato"}`);
  process.exit(1);
}
console.log(`✓ Webhook o‘rnatildi: ${url}`);

const info = await call("getWebhookInfo");
if (info.ok) {
  console.log(`· kutilayotgan yangilanishlar: ${info.result.pending_update_count ?? 0}`);
  if (info.result.last_error_message) console.log(`· Telegram oxirgi xato: ${info.result.last_error_message}`);
}
