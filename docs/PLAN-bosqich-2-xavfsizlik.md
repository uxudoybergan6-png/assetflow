# 2-bosqich — Xavfsizlik & yetuklik (implementatsiya rejasi)

*Manba: Texnik strategiya §②③⑩⑫ + Dizayn yo'l xaritasi 2-bosqich. Kodda tasdiqlangan.*
*Holat: REJA — kod yozilmaydi.*

To'rt bog'liq ish: typed bridge (injection xavfini yopadi), refresh token, Sentry monitoring, version-check/auto-update. Qo'shimcha: CORS/URL nomuvofiqligi (deploy-kritik, kichik).

---

## Kod tahlilidan tasdiqlangan holat

| Da'vo | Kodda haqiqat |
|---|---|
| Xom string evalScript ko'prik | `AssetFlow_Plugin.html`da 6 ta chaqiruv: `1889, 1968, 2933, 3719, 3954, 4265`. Argument `JSON.stringify` bilan o'raladi, lekin string-concat orqali. `4265` — `$.evalFile` fallback (limitdan oshganda) |
| Refresh token yo'q | `auth.ts`da `signToken`/`verifyToken` (JWT), `requireAuth`, `requireActiveSubscription` bor; refresh endpoint yo'q |
| Sentry yo'q | `apps/api/src`da Sentry import topilmadi; faqat `lib/audit-log.ts` + console |
| Version endpoint yo'q | `plugin.ts`da `/version` yo'q; manifest `1.1.1` statik |
| CORS nomuvofiqligi | `render.yaml` → `assetflow-studio-one.vercel.app`; `CLAUDE.md` → `assetflow-20j.pages.dev` |

---

## Ish 1 — `evalJSX` typed wrapper (injection + type-safety)

### Maqsad
6 ta xom `csInterface.evalScript(...)`ni bitta typed wrapper orqali o'tkazish; argumentlar faqat JSON sifatida uzatilsin, host.jsx ichida `JSON.parse` qilinsin (string-concat yo'q).

### O'zgartirishlar
1. **Yangi: `plugins/after-effects-cep/assetflow-bridge.js`** — `evalJSX(fnName, ...args)`:
   - argumentlarni `JSON.stringify` → `fnName + '(' + jsonArgs + ')'`,
   - `evalScript` natijasini `Promise`ga o'rab, `try/catch` + xato-normalizatsiya,
   - host.jsx funksiyasi nomini whitelist qilish (faqat ma'lum funksiyalar chaqirilsin).
2. **`AssetFlow_Plugin.html`** — 6 chaqiruvni `evalJSX(...)`ga ko'chirish: `1889 importAssetToProject`, `1968 importSingleSceneFromAep`, `2933 removeImportedTemplate`, `3719 pickDownloadFolder`, `3954`, `4265 $.evalFile`.
3. **`jsx/host.jsx`** — tegishli funksiyalar JSON-string qabul qilib `JSON.parse` qilishini ta'minlash (ko'pi allaqachon shunday).

### Tekshirish
- `grep -n "csInterface.evalScript" AssetFlow_Plugin.html` → faqat `assetflow-bridge.js` ichida (markup'da xom chaqiruv yo'q).
- Qo'lda AE'da: import / scene-extract / remove ishlashini sinash.

### Risk
O'rta — ko'prik mantig'i; har chaqiruvni alohida sinash kerak. Bolt CEP'ga ko'chsangiz bu wrapper tekin keladi (lekin 2-bosqich uchun migratsiya shart emas).

---

## Ish 2 — Refresh token

### Maqsad
PluginToken 30 kun tugaganda majburiy qayta-login o'rniga jim yangilash.

### O'zgartirishlar
- **`apps/api/src/routes/plugin.ts`** — yangi `POST /api/plugin/refresh`: amaldagi (muddati yaqin) tokenni tekshirib, yangi PluginToken beradi.
- **`apps/api/src/middleware/auth.ts`** — token muddati yaqinligini aniqlovchi yordamchi.
- **CEP** — `assetflow-client.js`da 401/yaqin-muddat holatida avtomatik refresh chaqiruvi; `prefs`ga yangi token yoziladi.

### Risk
Past–o'rta. Eski tokenni darhol bekor qilmaslik (grace) — ikki qurilma muammosini oldini oladi.

---

## Ish 3 — Sentry monitoring (server + panel)

### Maqsad
Production'da xatolarni stack-trace + breadcrumb bilan ko'rish (hozir 0 ko'rinish).

### O'zgartirishlar
1. **Server: `apps/api/src/index.ts`** — `@sentry/node` init + Express error handler. DSN → `SENTRY_DSN` env (`render.yaml`ga `sync:false`).
2. **Sensitive-data filter** — `beforeSend`da regex bilan tozalash: `/(authorization|token|secret|password|api[_-]?key)/i` (token leak'ni oldini oladi — HF naqshi).
3. **Panel: `AssetFlow_Plugin.html`** — `@sentry/browser` (yoki minimal CDN) + shu filter.
4. Bepul tier: 5k event/oy yetarli.

### Risk
Past. Faqat kuzatuv qatlami; mantiqqa tegmaydi.

---

## Ish 4 — Version-check + auto-update notifikatsiyasi

### Maqsad
Tuzatish/yangilikni foydalanuvchiga yetkazish (hozir ular o'rnatilgan versiyada qotib qoladi).

### O'zgartirishlar
1. **`apps/api/src/routes/plugin.ts`** — `GET /api/plugin/version` → `{ latest: "1.1.2", min: "1.1.0", zxpUrl }`.
2. **CEP** — panel ochilishida joriy (`manifest` ExtensionBundleVersion) bilan solishtirish; eski bo'lsa notifikatsiya + ZXP havola.
3. **Semver** — string solishtiruvi emas (`"1.10" < "1.9"` xatosi — MF bug'i), `semver` paket yoki to'g'ri taqqoslash.
4. To'liq avtomatik download+extract — keyinga (4-bosqich); 2-bosqichda notifikatsiya yetarli.

### Risk
Past.

---

## Ish 5 — CORS/URL nomuvofiqligini tuzatish (deploy-kritik, kichik)

### Muammo
`render.yaml`dagi `CORS_ORIGIN`/`ADMIN_URL` haqiqiy Studio domeni (`assetflow-20j.pages.dev`, CLAUDE.md) bilan mos kelmaydi → brauzer Admin/Studio'dan API chaqiruvlari CORS xatosi berishi mumkin.

### O'zgartirishlar
- Avval **haqiqiy joriy Studio domenini tasdiqlash** (CF Pages yoki Vercel — qaysi biri faol?).
- `render.yaml` `CORS_ORIGIN`/`ADMIN_URL`ni unga moslash; bir nechta origin kerak bo'lsa, API CORS'ni massiv qilib sozlash.
- `CLAUDE.md` bilan `render.yaml`ni bitta haqiqatga keltirish.

### Risk
Past, lekin **diagnostika talab qiladi** — qaysi domen faol ekanini aniqlamasdan o'zgartirmaslik.

---

## Taklif qilinadigan ketma-ketlik
Ish 5 (CORS — agar 0-bosqichda qilinmagan bo'lsa) → Ish 3 (Sentry, ko'rinishni darhol beradi) → Ish 1 (evalJSX) → Ish 4 (version) → Ish 2 (refresh).
