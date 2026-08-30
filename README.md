# Hazrat Panda AI

CEO uchun savdo, moliya va marketing agentlari boshqaruv markazi.

```bash
npm run dev
```

## Ishga tushirish

1. `vercel env pull .env.local` (yoki quyidagi o‘zgaruvchilarni qo‘lda yozing).
2. `npm run migrate` — Neon bazasida jadvallarni yaratadi. Ilova ishga tushganda ham migratsiyalar avtomatik qo‘llanadi.
3. `npm run dev`.
4. Deploydan keyin bir marta: `npm run webhook` — Telegram tugmalari (tasdiqlash, «Bajarildi») ishlashi uchun webhook’ni ro‘yxatdan o‘tkazadi. Talab qiladi: `APP_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. Bu qadamsiz tugmalar bosilganda hech narsa bo‘lmaydi.

## Muhit o‘zgaruvchilari

| O‘zgaruvchi | Nima uchun |
| --- | --- |
| `DATABASE_URL` | Neon Postgres. Berilmasa brif va qarorlar saqlanmaydi. |
| `AUTH_SECRET` | Sessiya cookie’sini imzolash uchun sir (`openssl rand -base64 32`). |
| `APP_PASSWORD` | CEO paroli. Bir nechta foydalanuvchi uchun `AUTH_ACCOUNTS` ishlating. |
| `AUTH_ACCOUNTS` | Ixtiyoriy JSON: `[{"key":"ceo","name":"CEO","role":"ceo","password":"…"},{"key":"savdo","name":"Savdo rahbari","role":"manager","password":"…"}]`. Faqat `ceo` roli qaror tasdiqlaydi. |
| `TELEGRAM_BOT_TOKEN` | Bot tokeni. |
| `TELEGRAM_CEO_CHAT_ID` | Kunlik brif va kritik ogohlantirishlar shu chatga boradi. |
| `TELEGRAM_TEAM_CHAT_IDS` | Ijrochi jamoalar JSON: `[{"key":"savdo","label":"Savdo jamoasi","chatId":"-100…"}]`. Kalit agent nomiga mos bo‘lsa (`savdo`, `moliya`, `marketing`), Telegramdagi tasdiqlash avtomatik shu jamoaga ketadi. |
| `TELEGRAM_DEFAULT_EXECUTOR_CHAT_ID` | Zaxira ijrochi (`asosiy` jamoa sifatida ko‘rinadi). |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook’ning `x-telegram-bot-api-secret-token` sarlavhasi. Berilmasa webhook yopiq. |
| `CRON_SECRET` | Kunlik cron himoyasi. Berilmasa cron yopiq. |
| `APP_URL` | Telegram xabaridagi «Panelni ochish» tugmasi uchun. |
| `INTERNAL_API_URL`, `INTERNAL_API_TOKEN` | Ichki API. Berilmasa ilova demo ma’lumotda ishlaydi. |
| `INTERNAL_API_SALES_PATH`, `INTERNAL_API_FINANCE_PATH` | Ichki API yo‘llarini almashtirish uchun (standart: `/analytics/sales`, `/analytics/finance`). |
| `AI_GATEWAY_API_KEY` | Lokalda AI Gateway uchun (Vercel’da OIDC token yetarli). |

`AUTH_SECRET`/`APP_PASSWORD` berilmasa, panel faqat lokal `next dev` da ochiq qoladi; deployda hamma narsa yopiladi.

## Ma’lumot manbai

Connector quyidagilarni kutadi: `GET /analytics/sales` → `pipeline`, `conversion`, `overdueFollowups`, `hotLeads`, `weeklyRevenue`; `GET /analytics/finance` → `revenue`, `expenses`, `cashBalance`, `planRevenue`, `overdueInvoices`. Hammasi **raqam** bo‘lishi shart.

Javob shu shaklga mos kelmasa, brif demo ma’lumot bilan tayyorlanadi va panelda `DEMO MA’LUMOT` deb ko‘rinadi; qaysi maydon noto‘g‘riligi server loglarida yoziladi. `INTERNAL_API_URL` yo‘l prefiksi bilan ham berilishi mumkin (`https://api.example.com/v1`).

## Ish jarayoni

- Cron 03:30 UTC (Toshkent 08:30) da agentlarni ishga tushiradi, CEO’ga brif va har bir jamoaga o‘z digestini yuboradi.
- Bir kunga bitta brif: kun davomida qayta ishga tushirilsa dalil va muddatlar yangilanadi, qabul qilingan qarorlar o‘z holicha qoladi. Jamoalarga digest kuniga bir marta ketadi (`agent_alerts` orqali).
- Qaror (panelda yoki Telegram tugmasida) atomik: faqat `draft` holatdagi amal egallanadi, har bir bosqich `decision_log` ga yoziladi.
- Tasdiqlangan amal ijrochi jamoaga yuboriladi va `sent` holatiga o‘tadi; yuborilmasa `approved` bo‘lib qoladi va sabab panelda ko‘rinadi.
- Ijrochi Telegramdagi «Bajarildi» tugmasini bossa (yoki CEO panelda belgilasa) amal `done` bo‘ladi. Yakunlangan ish `ochiqAmallar` tool’idan chiqib ketadi — agentlar uni ertasi kuni qayta taklif qilmaydi.

Panelda oxirgi brifdan tashqari **tarix** ham bor: sarlavhadagi sana tanlovchi orqali oldingi kunlarning brifi ochiladi (`?sana=YYYY-MM-DD`).


## Agentlar va workflow

Kunlik workflow: `src/lib/workflows/daily-brief.ts`

1. **Ma’lumot** — `getBusinessSnapshot()` ichki API yoki demo ma’lumotni oladi, natija `metric_snapshots` ga yoziladi (trend uchun).
2. **Bo‘lim agentlari** — Moliya, Savdo, Marketing agentlari **parallel** ishlaydi (`anthropic/claude-sonnet-5`). Har biri `ToolLoopAgent` + zod sxema bilan tipizatsiyalangan hisobot qaytaradi: bitta insight va 1–3 ta taklif.
3. **CEO agenti** — hisobotlarni yig‘adi (`anthropic/claude-opus-5`), har bir taklifga daraja beradi va CEO uchun xulosa yozadi.
4. **Yig‘ish** — `src/lib/agents/assemble.ts` brifni quradi: CEO stoliga eng ko‘pi **3 ta** amal chiqadi, qolgani digestga tushadi.
5. **Yetkazish** — brif saqlanadi, kritik amallar bo‘yicha Telegram ogohlantirish ketadi.

### Tool’lar (`src/lib/agents/tools.ts`)

| Tool | Nima beradi |
| --- | --- |
| `biznesKorsatkichlari` | Bugungi savdo va moliya ko‘rsatkichlari |
| `tarixiyTrend` | So‘nggi kunlar dinamikasi (`metric_snapshots`) |
| `ochiqAmallar` | Oldingi kunlardan qolgan yopilmagan amallar (`draft`/`approved`/`sent`) — takrorlanmaslik uchun |

### Raqam kafolati

Agentlarga matnda raqam yozish taqiqlangan; ular faqat ko‘rsatkich kalitlarini (`evidenceMetrics`, `metricKey`) ko‘rsatadi va raqamlarni tizim ma’lumotdan qo‘yadi. Model baribir raqam yozsa, u snapshot qiymatlariga solishtiriladi — mos kelmasa matn tashlanadi va o‘rniga faqat haqiqiy ko‘rsatkichlar qoladi (`hasUngroundedNumbers`).

### Zaxira rejim

Gateway kaliti bo‘lmasa yoki agentlar yiqilsa, brif qoidaga asoslangan zaxira bilan tayyorlanadi (`src/lib/agents/fallback.ts`) va panelda `ZAXIRA QOIDALAR` deb ko‘rinadi, sababi bilan birga. Bitta agent yiqilsa, qolganlari ishlashda davom etadi.

### Kuzatuv

Har bir agent chaqiruvi `agent_runs` jadvaliga yoziladi: model, holat, davomiylik, token soni, qadamlar va xato matni. Panel bugungi oxirgi xatoni ko‘rsatadi.

System promptlar `src/lib/agents/prompts.ts` da — agent xatti-harakatini o‘zgartirish uchun shu faylni tahrirlang.

> **AI Gateway hozir bloklangan.** Chaqiruvlar quyidagi xato bilan qaytmoqda: `AI Gateway requires a valid credit card on file to service requests`. Shu sababli brif hozir har doim zaxira qoidalar bilan tayyorlanmoqda. Yechish uchun Vercel hisobiga karta biriktiring (`vercel.com → AI → add card`) yoki `AI_GATEWAY_API_KEY` bering. Panelda `AGENTLAR` yozuvi chiqsa — hal bo‘lgan, `ZAXIRA QOIDALAR` chiqsa — hali bloklangan.

## Baza

Jadvallar: `briefs`, `recommendations`, `decision_log`, `teams`, `metric_snapshots`, `agent_runs`, `agent_alerts`. Migratsiyalar `src/db/migrations.ts` da, holat `_migrations` jadvalida.

Eski `agent_briefs` jadvali endi ishlatilmaydi — ma’lumot kerak bo‘lmasa `DROP TABLE agent_briefs` qilsangiz bo‘ladi.
