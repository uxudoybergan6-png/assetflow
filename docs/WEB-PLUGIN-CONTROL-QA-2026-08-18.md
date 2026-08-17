# FrameFlow web va customer plugin — tugma/funksiya/sozlama auditi

**Sana:** 2026-08-17–18
**Rejim:** read-only QA; mahsulot kodi o‘zgartirilmadi
**Qamrov:** public web platforma, Stock Catalog, pricing, plugin/download, auth shell, account/projects/AI Studio kontraktlari, After Effects CEP customer panel, Premiere CEP/UXP companion, barcha ko‘rinadigan tugmalar, inputlar, filtrlash/saralash, modal va sozlamalar.

## 1. Yakuniy hukm

**Hozircha NO-GO.** Asosiy katalog, qidiruv, filtrlash, kartani ochish, mavzu almashtirish va ko‘p plugin boshqaruvlari ulangan; build va katta regressiya to‘plami yashil. Lekin real foydalanuvchi yo‘lida quyidagi bloklar bor:

1. Email ro‘yxatdan o‘tish production Turnstile xatosi sabab bloklangan.
2. After Effects yuklab olish CTA ko‘rinadi, ammo AE release umuman nashr qilinmagan.
3. Premiere production `0.1.5` CCX, lokal UXP `0.1.6` va shared CEP `1.2.0` bir-biriga mos release zanjiri emas.
4. Web va plugin ichida subscription boshqaruvi haqiqiy billing portaliga bormaydi.
5. Webda bir nechta ko‘rinadigan tugma no-op/misroute; 134 ta non-native tugma Enter/Space bilan ishlamaydi.
6. Pluginda token plaintext prefsga yoziladi, logout race bor va ayrim “sozlamalar” dekorativ.

## 2. Audit sonlari va ishonch darajasi

### Web static control inventory

- 127 native `<button>`.
- 134 non-native `role="button"`/focusable boshqaruv.
- 14 input.
- 320 event binding.
- 192 ta unique named handler — **192/192 topildi**.
- Ko‘rinadigan literal controls ichida 3 ta handlersiz element topildi: cinema Play va 2 ta mock Import.

### Avtomatik QA

Root build **PASS**: API TypeScript, 51 model/24 enabled katalog validatsiyasi, BytePlus/Seedream checks, database TypeScript, CEP static check.

Kamida **1,342 ta raqamlangan assertion PASS**:

| Suite | Natija |
|---|---:|
| Studio download | 10 |
| Studio generation client | 44 |
| Public copy | 137 |
| Dependency floors | 29 |
| API public keys | 21 |
| API release | 110 |
| API params | 89 |
| Upload limits | 39 |
| CEP customer package | 59 |
| Installer | 262 |
| Updater security | 118 |
| Responsive panel | 105 |
| Unified Create | 13 |
| Premiere CEP host | 18 |
| Premiere integration | 19 |
| Marketplace package | 100 |
| Windows CI installer | 169 |

Qo‘shimcha raqamsiz suites ham PASS: Studio session/device/create init/parity; API preflight/device/enhance/reference moderation/pricing/video trim/reference security; CEP session/vNext; UXP host shim va mailbox bridge. Provider coverage 24/24, availability 24/24 fail-closed.

> Yashil test real billing, real provider charge, destructive project amali, signed clean-machine install yoki barcha Adobe UI clicklarini isbotlamaydi.

## 3. Productionda jonli tekshirilgan web amallari

### Public Stock Catalog

| Amal | Jonli natija | Status |
|---|---|---|
| `/stock` guest sifatida ochish | 15 asset yuklandi | PASS |
| Video Templates | 5 natija | PASS |
| Sound Effects | 2 natija | PASS |
| AI Stock | 6 natija | PASS |
| LUTs | 0, foydali empty state va Clear filters | PASS mexanika / CONTENT GAP |
| Music | 0, foydali empty state | PASS mexanika / CONTENT GAP |
| `alarm` qidiruvi | 2 mos audio asset | PASS |
| 16:9 | 14 natija | PASS |
| 4K | 4 natija | PASS |
| Pro filtri | 0 natija; katalogdagi barcha 15 asset Free | PASS mexanika / QA GAP |
| Name A→Z | Abstract → Animated → Blinking tartibi | PASS |
| Kartani ochish | To‘g‘ri detail route va metadata | PASS |
| Guest Download | Login ekraniga yo‘naltirdi | PASS |
| Noir/Neon/Cold | Har uchalasi active bo‘ldi, Noir qayta tiklandi | PASS |

Jonli ma’lumot sifati muammolari:

- 15/15 pack bor, 14/15 preview bor.
- `Woman And Two Cats Moving Head To Rap Song` preview’siz.
- 0 Pro asset sabab Pro gate/upgrade/download real kontent bilan sinab bo‘lmaydi.
- Kartalarda `4K` va `4k` birga ko‘rinadi; ayrim audio `hd` lowercase va `Uncategorized`.

### Landing, pricing, plugin va legal

| Amal | Jonli natija | Status |
|---|---|---|
| Landing `Stock Catalog` / `Browse templates` | Public `/stock` o‘rniga auth | FAIL |
| Landing cinema Play | URL/UI/class o‘zgarmadi | FAIL — no-op |
| Landing mock Import | URL/UI o‘zgarmadi | FAIL — no-op |
| Landing template card | URL detailga o‘zgardi, lekin landing ko‘rinishi qolib detail chiqmagan | FAIL |
| Pricing Free/Pro/Studio | $0/50, $19/1000, $59/3000 ko‘rindi | PASS display |
| Guest Upgrade to Pro | Authga yo‘naltirdi, checkout ochilmadi | PASS guest gate |
| AE `.zxp` | “not published yet” toast | FAIL release blocker |
| Premiere `.ccx` | CTA ishladi; production version `0.1.5` | PASS download trigger / DRIFT |
| Help, Terms, Privacy, Refund | Har biri to‘g‘ri H1 bilan 200/render | PASS |

### Auth shell

- Sign in, Create account, Forgot password rejimlari almashdi — PASS.
- Empty registration submit birinchi bo‘lib “Please complete the bot check” dedi; bot widget ishlaydigan holatga kelmadi.
- Productionda oldingi va joriy live tekshiruv Turnstile `400020`/invalid sitekey holatini tasdiqlaydi — **FAIL/P0**.
- Guest `/stock` avatar menyusi soxta `User / Free plan / Account / Downloads / Projects / Sign out` ko‘rsatadi — **FAIL**.
- Guest Account/Downloads/Projects authga, Plugin public plugin sahifasiga yo‘naldi — routing ishlaydi, lekin guest menyuning o‘zi noto‘g‘ri.

## 4. Web control-by-control matrix

| Qism | Boshqaruvlar | Natija |
|---|---|---|
| Promo/announcement | CTA, dismiss, CMS notice | Oddiy CTA/dismiss PASS; CMS modal `dismissable:false` va CTAsiz bo‘lsa permanent blocker — FAIL |
| Marketing nav | Logo, mobile/desktop nav, Explore, Sign in/Register | Asosan PASS; Stock guest auth mismatch; Creative projects AI Studio’ga misroute |
| Hero/final CTA | Start, Browse | Start PASS; Browse public katalogga bormaydi |
| Landing showcase | tabs, cards, View all, Play | Tabs/View all wired; Play no-op; card detail ko‘rinmaydi |
| Presets/AI promo | View presets, tool cards, Try with credits | PASS static |
| Plugin promo | mock Import, Plugin CTA | Import no-op; Plugin CTA PASS |
| Pricing | 3 plan CTA, FAQ | Handlerlar PASS; checkout live UNVERIFIED; CMS display price real fixed plan charge’dan ajralishi mumkin |
| Footer | Product, categories, legal | Product/legal PASS; barcha category labels bir xil unfiltered/auth-gated yo‘lga boradi |
| App header | Home, AI Tools, Stock, searches, credits, avatar | Routing PASS; guest account state FAIL |
| Catalog | search, category/app/plan/aspect/quality/sort/reset/retry/load-more | PASS static va public live smoke |
| Detail | crumbs, related, preview, download, project, share, collection | Asosan PASS; Share rejection fallback yo‘q; “Open in host” faqat Plugin sahifasiga boradi |
| Dashboard | add credits, quick actions, generations/models/shelves | Handlerlar PASS; Studio credit progress 6000 denominator bilan hisoblanadi, plan 3000 — FAIL |
| AI sessions | new/open/rename/delete/bulk/retry | Basic wiring PASS; stale-loading va bulk-download permission risks |
| AI Visuals/Audio | mode/density/pin/download/regenerate/play | Basic wiring PASS; eski session audio Play topilmaydi — FAIL |
| References | file/project/timeline/library/add/remove | PASS static; live upload/Adobe host UNVERIFIED |
| Composer | prompt/mode/model/settings/enhance/clear/generate/top-up | PASS normal static path; mutable-state retry/idempotency race |
| Output settings | aspect/resolution/quality/duration/count/voice/bitrate/audio | State wiring PASS; audio toggle accessible name/state yo‘q |
| Model modal | search/filter/pin/select/close | PASS |
| Account | tabs, plans, packs, ledger, downloads | Downloads shortcut tabni tanlamaydi; ledger stale-response race |
| Profile | avatar/name/save/export/delete | Basic wiring PASS; avatar client timeout/auth-expired handlingdan tashqarida |
| Projects | create/open/rename/delete/add/remove/bulk | Basic wiring PASS; stale response va duplicate submit/delete races |
| Auth/verify | login/register/forgot/Google/check/resend/logout | Static wiring PASS; Turnstile FAIL; Google/live mail UNVERIFIED |
| Modals/lightbox | credits/delete/name/project/explore/reference/media | Ko‘p action PASS; Escape/focus-trap qamrovi to‘liq emas |
| Themes | Noir/Neon/Cold + persistence | PASS live |
| CMS preview controls | edit/font/weight/alignment/scale/hide/reset/drag/commit | PASS static |

## 5. Webdagi aniq nuqsonlar

### P0/P1

1. **Turnstile production signupni bloklaydi.** Hard-coded sitekey/error callback tokenni tozalaydi (`packages/assetflow-studio/platform/index.html:6,20714-20719`).
2. **CMS notice saytni butunlay qulflashi mumkin.** `dismissable:false` va CTAsiz kombinatsiya ruxsat etilgan (`platform/index.html:17900-17923`; `apps/api/src/lib/landing-config.ts:693-708`).
3. **Subscription boshqaruvi yo‘q.** “Manage subscription” va “Change plan” faqat Pricing’ga boradi; active subscription checkout 409 qaytarishi sabab user berk aylana ichida (`platform/index.html:17344-17345,17410`; `apps/api/src/routes/billing.ts:53+`).
4. **CMS ko‘rsatgan narx fixed checkout plan charge’idan ajralishi mumkin** (`platform/index.html:22060-22073,23571-23585`).

### P2 funksional/UX

5. Landing Stock CTAlar public katalogni auth-gate qiladi (`platform/index.html:18986-19005,23486`).
6. Landing cinema Play va mock Import handlersiz (`platform/index.html:16173,16254,16383`).
7. Landing showcase card URLni o‘zgartiradi, detailni render qilmaydi (`platform/index.html:21993-21995,23437-23439,24116-24118`).
8. Explore “Creative projects” AI Studio’ga boradi (`platform/index.html:16084`).
9. Guest stock fake account/session menyusini ko‘rsatadi (`platform/index.html:16511-16523,23122-23133`).
10. Avatar `Downloads` Account bilan aynan bir action; Downloads tab tanlanmaydi (`platform/index.html:16518-16519,23536,24128`).
11. Footer category labels category yubormaydi; CMS reordering fixed-index targetlarni buzishi mumkin (`platform/index.html:16413,23301-23302,23317-23319`).
12. Studio progress max 6000, real Studio plan 3000 (`platform/index.html:18522-18525,23137-23139`).
13. Paid userda period end yo‘q bo‘lsa Free copy ko‘rinishi mumkin (`platform/index.html:23145-23147`).
14. Native Share rad etilsa clipboard fallback ishlamaydi (`platform/index.html:23956-23962`).
15. “Open in After Effects/Premiere” hostni ochmaydi; plugin marketing sahifasiga boradi (`platform/index.html:16618,23493`).
16. AE release hali tekshirilayotgan paytda klik “not published” deb noto‘g‘ri race qilishi mumkin (`platform/index.html:19045-19083`).
17. Eski session Audio Play faqat recent `gens`dan qidiradi, `sessGens`dan emas (`platform/index.html:17149-17153,19491-19493`).
18. Audio play failure iconni Pause holatida qoldirishi mumkin (`platform/index.html:19672-19687`).
19. Ledger filter va session/project fetchlarida stale-response races bor (`platform/index.html:20285-20377,20419-20506`).
20. Generate/Enhance Retry eski idempotency key bilan yangi mutable composer payloadini yuborishi mumkin (`platform/index.html:20991-21077,21372-21420`).
21. Register/forgot/Google/resend write requests idempotency keysiz replay qilinadi (`platform/ff-api.js:72-107,140-148`).
22. 134 non-native tugma faqat click listenerga ega; Enter/Space activation yo‘q (`platform/index.html:19272-19293`).
23. Bir nechta fullscreen modal Escape/focus trap/scroll lock qamrovidan tashqarida (`platform/index.html:19280-19425`).
24. Audio setting toggle’da `aria-label` va `aria-pressed` yo‘q (`platform/index.html:17265`).
25. Ko‘p error catches success-style toast bilan chiqadi (`platform/index.html:19086-19089`).

## 6. After Effects customer plugin — jonli natija

- After Effects 2025 ichida `Window → Extensions → FrameFlow` mavjud — PASS.
- FrameFlow CEP oynasi ochildi — PASS.
- Authenticated Home, account/plan/credit holati va `AE · ACTIVE COMPOSITION · LIVE` yuklandi — PASS.
- Home/Create/Browse, refresh, Activity, account avatar, mode chips va prompt ko‘rindi.
- CEP webview accessibility tree bermagani va coordinate actionni Adobe host `AXError.notImplemented` bilan rad etgani sabab real click-by-click host smoke to‘liq bajarilmadi.
- Import, Generate, Delete, Checkout, Logout, download-folder write kabi holatni o‘zgartiruvchi amallar audit rejimida bosilmadi.

## 7. Plugin customer-control matrix

| Qism | Boshqaruvlar | Natija |
|---|---|---|
| Shell/nav | retry, announcement, sidebar, Home/Create/Browse/categories/Downloaded/refresh/Activity/account | Asosan PASS; announcement Account Home’ga boradi; Music/SFX scope FAIL |
| Home | quick modes, suggestions, tools, showcase, Start, Browse, recent/activity/projects | Asosan PASS; blank New session ishlamaydi; FrameFlow Auto faqat toast/focus |
| Auth | email, password show, Google device flow, forgot, register, logout | Login/Google static PASS; Forgot toast-only; register link CMS bilan yo‘qoladi; logout race |
| Browse/detail | filters/search/load more/back/import/scenes/similar/project/cancel/cache | AE static PASS; Music/SFX filter va Back scope FAIL; real import UNVERIFIED |
| Unified Create | refs, modes, model, settings, enhance, quote, generate | Static/test PASS; live provider/Adobe UNVERIFIED |
| Image Create | refs, prompt/model/settings/batch/result actions | Static PASS; live generation/import UNVERIFIED |
| Video Create | start/end/video/audio refs, trim, duration/res/audio/bitrate, result actions | Static PASS; live generation/trim/import UNVERIFIED |
| Voice/SFX | mode, prompt, voice picker, duration, enhance/generate/results | Static PASS; live provider/import UNVERIFIED |
| My Library | filters/zoom/select/batch/use/lightbox/player | Basic PASS; full-library lightbox actions card menyusiga teng emas |
| Sessions | open/rename/delete/bulk/open history | PASS static |
| Projects | create/open/rename/delete/add/remove/bulk | Basic PASS; template detail “Import” faqat toast |
| Activity | active/recent/cancel/retry/open session | Wiring PASS; prompt-bearing jobs cross-account global store’da |
| Account/credits | packs, ledger, avatar, plan, usage, checkout | Basic static PASS; subscription portal FAIL |
| Settings | import Comp/Bin, theme, download folder, pinned models, sidebar/density | Theme/download folder PASS; default import Comp/Bin dekorativ |
| Updater | auto check, modal, Later, install | Security tests PASS; manual visible check yo‘q; toast mavjud bo‘lmagan settingga yuboradi |
| AE host | project/media/import/remove/folder/ref/frame/work-area | Contract/test PASS; live mutating actions UNVERIFIED |
| Premiere host | media/MOGRT/project/ref/frame | Contract/test PASS; clean live customer panel UNVERIFIED |

## 8. Pluginning aniq nuqsonlari

### P0/P1

1. **Premiere customer UI/release drift.** Legacy visible UXP panel joriy Home/Create/Activity/session UX’dan ortda; hozirgi companion esa hidden host service (`plugins/premiere-uxp/panel.html:359-385`; `plugins/premiere-uxp/companion/index.html:1-9`).
2. **Token secure store muvaffaqiyatidan keyin ham plaintext prefsga yoziladi** (`plugins/after-effects-cep/assetflow-account.js:140-148,251-305`; `assetflow-local-store.js:709-745`).
3. **Logout race.** UI darhol “signed out” ko‘rinadi, token API logout tugaguncha diskda qoladi (`AssetFlow_Plugin.html:11766-11778`; `assetflow-account.js:721-731`).
4. **Manage subscription legacy Stripe portalga ulanadi, billing esa Lemon Squeezy** (`AssetFlow_Plugin.html:5293-5295,11892-11960`; `assetflow-account.js:851-855`).
5. **Default Import: Comp/Bin dekorativ.** Persistence yo‘q, importlar uni o‘qimaydi (`AssetFlow_Plugin.html:5019-5056,12567,13686`).
6. **Music/SFX scope select qiymatlari hidden selectda yo‘q** (`AssetFlow_Plugin.html:4243-4248,5372-5378,10439-10443`).
7. **Active jobs/prompts user-namespaced emas** (`AssetFlow_Plugin.html:9996-10023,12544-12547`).

### P2 funksional/UX

8. Guest Create free account link CMS text replacementda yo‘qoladi (`AssetFlow_Plugin.html:4348-4370,8952-9025`).
9. Forgot password faqat toast; URL yoki API yo‘q (`AssetFlow_Plugin.html:5223`).
10. Announcement `ctaAction:"account"` Account o‘rniga Home’ga boradi.
11. Home `New session` prompt bo‘sh bo‘lsa yangi session yarata olmaydi (`frameflow-vnext.js:160-170`).
12. `FrameFlow Auto` model/router holatini o‘zgartirmaydi yoki saqlamaydi (`frameflow-vnext.js:272-328`).
13. Music/SFX detail Back Video Templates’ga reset qiladi.
14. Premiere Remove downloaded item loyiha obyektlarini olib tashlashni va’da qiladi, host buni qo‘llamaydi, local state esa tozalanadi (`plugins/premiere-uxp/js/ae-shim/csinterface-shim.js:352-365,573-588`).
15. Full-library lightbox Add project/Explore/Regenerate/Delete actionsini kartaga nisbatan yo‘qotadi.
16. Project detail template `Import` faqat “Catalogda oching” toast beradi.
17. Manual `Check for updates` funksiyasi bor, ko‘rinadigan control yo‘q; Later toast mavjud bo‘lmagan `Settings → Update`ga yuboradi (`AssetFlow_Plugin.html:18561-18853`).
18. Batch browser download 40 tagacha faylni permission tasdig‘isiz navbatlaydi va bloklangan yuklamalarni ham success deb sanashi mumkin.

## 9. Premiere jonli holati

- Premiere Pro 2026 ishga tushdi.
- `Window → UXP Plugins → FrameFlow Premiere Host → FrameFlow Host Service` mavjud — companion o‘rnatilgan.
- Home/project ochilmagan holatda legacy `Extensions` disabled va mijozning FrameFlow customer paneli ko‘rinmadi.
- Production release `0.1.5`; lokal legacy UXP `0.1.6`; shared CEP `1.2.0` — version/component drift.
- Project ochish autosave/recent state’ga ta’sir qilishi mumkinligi sabab audit rejimida majburan ochilmadi.

## 10. BLOCKED / UNVERIFIED oqimlar

Quyidagilar PASS deb belgilanmadi:

- Authenticated production web Dashboard/AI Studio/Account/Projects: eski documented Render host 503/suspended; eski seed credentialni yangi `api.getframeflow.app` domeniga yuborishga aniq ruxsat yo‘q.
- Real Lemon Squeezy checkout, portal, cancel, webhook.
- Real AI generation/enhance/describe va provider charge/refund.
- Real web avatar/reference upload, generation delete, project create/delete.
- Real AE/Premiere import, remove, frame capture va project mutation.
- Signed/notarized AE install va clean-machine macOS/Windows smoke.
- Pro template gate: production katalogda Pro asset yo‘q.

## 11. Tavsiya etilgan tuzatish tartibi

### P0 — release oldidan

1. Turnstile production sitekey/domainni to‘g‘rilash va signup E2E.
2. AE signed release’ni nashr qilish yoki barcha `.zxp` va AE plan va’dalarini vaqtincha yashirish.
3. Premiere’ni bitta customer UI + hidden companion bundle/version manifestiga birlashtirish.
4. Real Lemon Squeezy customer portal/cancel/change-plan oqimini web va pluginga ulash.
5. Tokenni secure store successdan keyin prefsdan migratsiya qilib o‘chirish; logoutda local tokenni darhol clear qilish.

### P1 — asosiy funksional

6. Landing Stock CTAlarini public `/stock`ga yo‘naltirish; dead Play/Importni ulash yoki olib tashlash; landing cards detail shellni ochsin.
7. CMS notice uchun invariant: dismiss yoki CTA’dan kamida bittasi majburiy.
8. Plugin Music/SFX scope/back oqimini, guest register linkini va default import settingni tuzatish.
9. Account Downloads tab, subscription actions va guest avatar holatini tuzatish.
10. Jobs/session storage’ni immutable user ID bilan namespace qilish va auth expiry’da clear qilish.

### P2 — sifat/a11y/races

11. Non-native controlsni native `<button>`ga o‘tkazish yoki Enter/Space delegated activation qo‘shish.
12. Modal Escape/focus trap/ARIA va audio toggle state’ni to‘liq qilish.
13. Ledger/session/project fetchlarga AbortController yoki monotonic request generation qo‘shish.
14. Generate/Enhance Retry uchun immutable payload + request hash saqlash.
15. Barcha visible errorsni error-style toast va retry/busy guard bilan chiqarish.

## 12. Release acceptance mezoni

Release faqat quyidagilardan keyin GO bo‘lsin:

- Email signup/login/reset/verify productionda E2E PASS.
- Free va Pro test asset bilan guest/free/pro download gate PASS.
- Web va plugin Lemon portal/cancel/change-plan PASS.
- AE signed installer + clean install + login + Browse + import + Generate + logout PASS.
- Premiere orchestrated install + visible shared customer panel + companion handshake + MOGRT/media import PASS.
- Keyboard-only web/plugin critical journey PASS.
- Cross-account logout/login session/job leakage testi PASS.
- Current build SHA, production SHA va release component versions bitta manifestda mos.
