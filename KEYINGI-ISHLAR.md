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
Neon bazasi; migratsiyalar (jumladan yangi `005_drop_agent_briefs`) birinchi so'rovda
avtomatik qo'llanadi.

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

## Kod bo'yicha qolgan ishlar (ulanishlardan tashqari hammasi)

Kod bazasi to'liq tekshirildi (2026-08-30). Quyidagi ro'yxat ustuvorlik tartibida:
A guruhi — Telegram jonli bo'lishi bilan otiladigan xatolar, E guruhi — uzoq muddatli
infratuzilma. Bajarilgan band checkbox bilan belgilanadi.

### A. Telegram jonli bo'lishidan OLDIN tuzatish shart

Bu xatolar hozir sezilmaydi, chunki Telegram hali ulanmagan. Ulanishlar ochilgan
zahoti birinchi kundanoq otadi.

- [x] **Digest yuborilmasa ham qulf band bo'lib qoladi.** `claimAlert` 12 soatlik
  qulfni yuborishdan _oldin_ oladi; Telegram 429/5xx qaytarsa digest yo'qoladi va
  12 soat qayta urinilmaydi (`src/lib/db.ts:181`, `src/lib/telegram.ts`). Qulfni
  faqat muvaffaqiyatli yuborishda tasdiqlash yoki xatoda bo'shatish kerak.
- [x] **Paneldagi «Brifni yangilash» hech narsa yubormaydi.** `sendDailyBrief()` va
  `notifyTeamDigests()` faqat cron marshrutida chaqiriladi (`src/app/api/cron/daily/route.ts`);
  `POST /api/brief` brifni qayta yaratadi, lekin CEO xabari ham, digest ham ketmaydi.
  Yetkazishni bitta umumiy funksiyaga chiqarish.
- [x] **Telegram Markdown escape to'liq emas.** `esc()` faqat `` _ * ` [ `` ni qochiradi;
  sarlavhada `]`, `(`, `)` yoki `~` bo'lsa xabar 400 bilan yiqiladi (`src/lib/telegram.ts:4`).
  MarkdownV2 to'liq to'plami yoki HTML'ga o'tish.
- [x] **Webhook va decision body validatsiyasiz.** Ikkalasida `as` type-assertion:
  buzuq JSON 500 beradi va Telegram update'ni qayta uravermaydi
  (`src/app/api/telegram/webhook/route.ts:12`,
  `src/app/api/recommendations/[id]/decision/route.ts:10`). Zod allaqachon dependency.
- [x] **Noma'lum `teamKey` indamay boshqa jamoaga ketadi.** `resolveTeam` topilmagan
  kalitda owner jamoa → `asosiy` → `teams[0]` ga tushib boraveradi — xato kalit vazifani
  noto'g'ri chatga yuboradi (`src/lib/teams.ts:39`).
- [x] **Ichki API xatosida butun brif yiqiladi.** Sxema mos kelmasa demo fallback bor,
  lekin non-2xx yoki tarmoq xatosida `throw` — cron to'liq to'xtaydi; fetch'larda
  timeout ham yo'q (`src/lib/business.ts:21-24`).
- [x] **5 marshrutdan 3 tasida try/catch yo'q** (cron, decision, webhook) — cron yiqilsa
  hech kimga hech qanday xabar bormaydi.

### B. Agent va zaxira qoidalar sifati

Gateway bloklanganda har kuni aynan zaxira yo'l ishlaydi — bu repodagi eng yupqa kod.

- [x] **Marketing fallback — qotib qolgan matn.** Doim «Kontent paketi tayyor», signal
  doim `neytral`, snapshot'ga umuman qaramaydi (`src/lib/agents/fallback.ts:15`).
  Moliya/Savdo kabi qoida mantig'i yozish.
- [x] **Fallback tavsiyalari doim bir xil 3 band.** Ma'lumotdan qat'i nazar bir xil
  `dedupeKey`lar; ochiq tavsiyalar tekshirilmaydi, shuning uchun kechagi ochiq ishlar
  takrorlanadi (`src/lib/agents/fallback.ts:23-30`). Kassa xavfi, konversiya tushishi,
  pipeline to'xtashi qoidalarini qo'shish.
- [x] **`aiAvailable()` circuit breaker emas.** Faqat kalit borligini tekshiradi —
  Gateway bloklanganda ham har brifda 3 ta agent chaqiruvi + 3 ta xato yozuvi, keyin
  fallback (`src/lib/agents/run.ts:15`). Keshlangan «gateway bloklangan» holati yoki
  arzon probe kerak.
- [x] **Qisman brif ham `AGENTLAR` deb belgilanadi.** 1–2 agent yiqilsa yoki CEO agent
  ishlamasa ham `engine: "agentlar"` qotirilgan — `"qisman"` qiymati yo'q
  (`src/lib/agents/assemble.ts:69`, `src/lib/types.ts:8`).
- [x] **Agent chaqiruvlarida retry/timeout yo'q.** Bitta o'tkinchi xato butun bo'lim
  hisobotini fallbackka tushiradi (`src/lib/agents/run.ts:43,71`).
- [x] **Raqam-grounding zaif.** `allowedNumbers()` har metrikaning xom/yaxlitlangan/mln
  shaklini qo'shadi — kichik sonlar (0, 3, 9, 14…) keng oq ro'yxatda, gallyutsinatsiya
  o'tib ketadi; `money()` 500 mingdan kichik qiymatni «0 mln so'm» qiladi
  (`src/lib/agents/metrics.ts:12,43-58`).
- [x] **`tarixiyTrend` xom qatorlarni to'kadi.** 30 kun × 12 metrika promptga kiradi,
  delta/agregatsiya yo'q — «dinamika»ni model o'zi hisoblashi kutiladi
  (`src/lib/agents/tools.ts:16-27`).

### C. Panel / UI

- [x] **«Tizim ishlamoqda» indikatori soxta.** Hech qanday tekshiruvsiz doim yashil —
  Gateway bloklanganda ham, baza yiqilganda ham (`src/components/dashboard.tsx:60`).
- [x] **Fallback banneri noto'g'ri shartda.** `agent_runs`da bitta xato bo'lsa ham
  «zaxira qoidalar bilan tayyorlandi» chiqadi, `brief.engine` tekshirilmaydi; aksincha,
  `engine === "qoidalar"` bo'lsa-yu xato yozuvi bo'lmasa banner umuman chiqmaydi
  (`src/components/dashboard.tsx:81`).
- [x] **Digest bandlariga amal yo'q.** «Bo'lim digesti» faqat o'qish uchun: «Bajarildi»
  ham, qayta biriktirish ham, CEO stoliga ko'tarish ham yo'q; `completeRecommendation`
  `draft`ni rad etadi — digest ishi hech qachon `done` bo'lolmaydi
  (`src/components/dashboard.tsx:139-162`, `src/lib/decisions.ts:39`). Telegram digest
  xabarlarida ham «Bajarildi» tugmasi yo'q (`src/lib/telegram.ts:53-58`).
- [x] **`impact`, `sentAt`, `doneAt` ko'rsatilmaydi.** Agentlar ishlab chiqaradi, zod
  tekshiradi, baza saqlaydi — UI tashlab yuboradi (`src/lib/types.ts:6`).
- [x] **Tasdiqlash/rad tugmalarida pending holat yo'q.** `decide()` da loading flag ham,
  disable ham yo'q — ikki marta bosish mumkin (server atomik, lekin UI jim)
  (`src/components/dashboard.tsx:42-55`).
- [x] **`loading.tsx` / `error.tsx` / `not-found.tsx` yo'q.** Bosh sahifa 5 ta DB
  so'rovini Suspense'siz qiladi, xato chegarasi umuman yo'q (`src/app/`).
- [x] **Login'da urinishlar cheklovi yo'q.** Taqqoslash constant-time, lekin bitta
  umumiy parolga cheksiz urinish mumkin (`src/app/actions.ts:6-13`).
- [x] **Mayda tozalash:** `CEO` owner o'lik branch (`src/components/dashboard.tsx:14`,
  `src/lib/agents/assemble.ts:8`); `public/` da standart Next.js shablon assetlari;
  `next.config.ts` bo'sh skaffold.

### D. Ma'lumotlar qatlami va tozalash

- [x] **`decision_log` faqat yoziladi.** Har qaror actor/kanal/izoh bilan loglanadi,
  lekin hech narsa o'qimaydi — panelda audit/tarix ko'rinishi yo'q (`src/lib/db.ts:164`).
- [x] **`agent_runs` telemetriyasi ko'rsatilmaydi.** Token, davomiylik, qadamlar
  yig'iladi; faqat `latestAgentIssue` xato matnini o'qiydi (`src/lib/db.ts:233`).
- [x] **`recipient_chat_id` yoziladi, o'qilmaydi.** Qayta yuborish (resend) uchun
  kerak bo'ladi (`src/lib/db.ts:138`).
- [x] **Retention/tozalash yo'q.** `agent_runs`, `metric_snapshots`, `decision_log`,
  `agent_alerts` cheksiz o'sadi.
- [x] **Eski `agent_briefs` jadvali uchun `005` migratsiyasi yo'q.** Hujjatda qo'lda
  `DROP TABLE` deb turibdi — migratsiya qilib rasmiylashtirsa bo'ladi.
- [x] **`resolveTeam` har chaqiruvda `listTeams()` ni qayta o'qiydi.** Digest tsiklida
  har band uchun bitta so'rov; ro'yxat kattalashsa keshlash kerak (`src/lib/teams.ts:39`,
  `src/lib/workflows/daily-brief.ts:54`).
- [x] **O'lik kod:** `tashkentDueAt` eksport qilingan, hech qayerda chaqirilmaydi
  (`src/lib/time.ts:13`); `/api/teams` marshrutini hech kim ishlatmaydi — panel
  jamoalarni server prop orqali oladi (`src/app/api/teams/route.ts`).
- [x] **Hujjat bo'shlig'i:** `INTERNAL_API_SALES_PATH` / `INTERNAL_API_FINANCE_PATH`
  o'zgaruvchilarini kod o'qiydi, README'da yo'q (`src/lib/business.ts:21-22`).

### E. Testlar, CI va repo

- [x] **Test freymvorki umuman yo'q.** Vitest o'rnatildi (`npm test`), 19 ta test:
  `hasUngroundedNumbers`, `metricTable` yaxlitlash, `esc()`, `assembleBrief` 3-band
  chegarasi va engine, `fallbackRecommendations` qoidalari. Hali qolgan nishon:
  `claimRecommendation`/`markDone` atomikligi — real baza talab qiladi
  (integratsion test).
- [x] **CI yo'q.** `.github/workflows/ci.yml` qo'shildi: lint → typecheck → test →
  build; `npm run typecheck` skripti ham bor (`next typegen && tsc --noEmit`).
- [ ] **Repo hozir Public.** Ichki CEO paneli uchun Private ma'qulroq — GitHub'da
  qo'lda: `techjadid2-debug/Panda-AI-` → Settings → Danger Zone → Change visibility
  (yoki `gh auth login` dan keyin
  `gh repo edit techjadid2-debug/Panda-AI- --visibility private --accept-visibility-changes`).
