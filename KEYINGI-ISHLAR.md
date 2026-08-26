# Keyingi ishlar

Holat: 2026-08-26. Kod tayyor, prodga deploy qilingan, lekin **tizim hali tirik emas** —
quyidagilar bajarilmaguncha panel hech kimga ochilmaydi, cron va Telegram ishlamaydi.

## 1. Deployment Protection'ni ochish

Hozir prodda hamma narsa Vercel SSO orqasida: `/` ham, `/api/*` ham `vercel.com/sso-api`
ga yo'naltiriladi. Telegram serverlari SSO'dan o'ta olmaydi — webhook shu holatda ishlamaydi.

**Vercel → Settings → Deployment Protection → «Only Preview Deployments».**

Prod ochilgani bilan himoyasiz qolmaydi: panel parol so'raydi (`AUTH_SECRET` +
`APP_PASSWORD`), cron `CRON_SECRET`, webhook esa `TELEGRAM_WEBHOOK_SECRET` talab qiladi.

## 2. Muhit o'zgaruvchilari

Prodda hozir faqat Neon integratsiyasining o'zgaruvchilari bor. Har biri uchun:
`vercel env add <NOM> production` (qiymatni interaktiv so'raydi).

| O'zgaruvchi | Qiymat | Bo'lmasa nima bo'ladi |
| --- | --- | --- |
| `AUTH_SECRET` | `openssl rand -base64 32` | Panelga hech kim kira olmaydi |
| `APP_PASSWORD` | CEO paroli (yoki `AUTH_ACCOUNTS` JSON) | Panelga hech kim kira olmaydi |
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan token | Hech qanday xabar ketmaydi |
| `TELEGRAM_CEO_CHAT_ID` | CEO chat ID | Kunlik brif va kritik ogohlantirish ketmaydi |
| `TELEGRAM_TEAM_CHAT_IDS` | Jamoalar JSON (README'da namuna) | Tasdiqlangan vazifa yuborilmaydi, panelda tugma chiqmaydi |
| `TELEGRAM_WEBHOOK_SECRET` | `openssl rand -base64 32` | Webhook yopiq — tugmalar jim qoladi |
| `CRON_SECRET` | `openssl rand -base64 32` | Cron yopiq — kunlik brif avtomatik yaratilmaydi |
| `APP_URL` | Prod manzili | Telegramdagi «Panelni ochish» tugmasi chiqmaydi |
| `INTERNAL_API_URL` | Ichki API manzili | Agentlar demo raqamlar ustida ishlaydi |
| `INTERNAL_API_TOKEN` | Ichki API tokeni | Yuqoridagi kabi |

Baza migratsiyasi kerak emas: lokal `.env.local` dagi `DATABASE_URL` prod bilan bir xil
Neon bazasi, `004_done_status` gacha hammasi qo'llangan.

## 3. Telegram webhook'ni ro'yxatdan o'tkazish

Env to'lgach **bir marta**. Busiz tasdiqlash va «Bajarildi» tugmalari bosilganda hech
narsa bo'lmaydi — Telegram xabarni qayerga yuborishni bilmaydi.

```bash
vercel env pull .env.local && npm run webhook
```

## 4. AI Gateway kartasi

Chaqiruvlar `AI Gateway requires a valid credit card on file to service requests` xatosi
bilan qaytmoqda. Shu sababli agentlar **hech qachon ishlamagan** — har bir brif zaxira
qoidalar bilan tayyorlanmoqda.

Hal qilish: Vercel hisobiga karta biriktirish (`vercel.com → AI → add card`) yoki
`AI_GATEWAY_API_KEY` berish. Tekshirish: panelda `AGENTLAR` yozuvi chiqsa — hal bo'lgan,
`ZAXIRA QOIDALAR` chiqsa — hali bloklangan.

## 5. Prodda tekshirish

Yuqoridagilar bajarilgach:

- Cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domen>/api/cron/daily`
  → javobda `delivery.delivered: true`, CEO chatiga brif keladi, jamoalarga digest ketadi.
- Telegram: brifdagi ✅ → ijrochi jamoaga vazifa boradi → jamoadagi «Bajarildi» → panelda
  holat `Bajarildi` ga o'zgaradi.
- Himoya: `curl -X POST https://<domen>/api/brief` va sirsiz `/api/cron/daily` — ikkalasi
  ham `401` qaytarishi kerak.

---

## Hali qilinmagan, lekin o'ylab ko'rishga arziydi

- **Testlar yo'q.** Loyihada test freymvorki umuman yo'q. Atomik qaror oqimi
  (`claimRecommendation`, `markDone`) va raqam grounding tekshiruvi
  (`hasUngroundedNumbers`) test bilan qoplashga eng arziydigan joylar.
- **Eski `agent_briefs` jadvali** ishlatilmaydi — ma'lumot kerak bo'lmasa
  `DROP TABLE agent_briefs`.
- **`resolveTeam` har chaqiruvda `listTeams()` ni qayta o'qiydi.** Kuniga bir marta,
  6 tagacha amal uchun sezilmaydi; digest ro'yxati kattalashsa optimizatsiya kerak.
- **Repo hozir Public.** Ichki CEO paneli uchun Private ma'qulroq (Settings → Danger Zone).
