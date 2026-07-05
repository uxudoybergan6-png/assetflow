# FrameFlow Plugin — QA Audit Sweep

**Fayl:** `plugins/after-effects-cep/AssetFlow_Plugin.html` (14 110 qator, ~792 KB, self-contained CEP HTML — inline JS/CSS)
**Dizayn referensi:** `packages/assetflow-studio/platform/_frameflow-redesign-mockup.html`
**Usul:** statik parse (skript + 2 subagent chuqur tahlil) + dinamik headless-Chrome harness (`cep-plugin-preview`, port 8976), `cep-mode`, 380px **va** 900px.
**Sana:** 2026-07-05 · **Muhim:** bu FAQAT hisobot — hech qanday plagin kodi o'zgartirilmadi. Ba'zi topilmalar ataylab qoldirilgan bo'lishi mumkin (deferred cleanup) — shunday belgilandi.

> **Harness cheklovi:** brauzerda jonli API yo'q (`Failed to fetch`). Shu sababli katalog grid/detali, import, MOGRT, kutubxona (real ma'lumot), AI model-katalogi (pill popover, R2V/i2v rejim, tarix ma'lumoti, lightbox media, kredit consume/refund) va barcha `evalScript`/AE-import yo'llari brauzerda TO'LIQ sinovdan o'tkazilmaydi — pastda "AE-only / jonli test kerak" deb belgilangan.

---

## Xulosa

**Jami: 27 topilma** — P0: **0** · P1: **1** (latent) · P2: **26**
**Brauzerda aniqlangan:** 12 · **AE-only / jonli test kerak:** 6 · **Statik-tasdiqlangan:** 9

### Kategoriyalar bo'yicha
| Kategoriya | Soni |
|---|---|
| Dead code (o'lik/orphan) | 8 |
| Inconsistency (nomuvofiqlik / leftover) | 7 |
| Layout / overflow | 5 |
| Broken state | 3 |
| Broken handler (latent) | 1 |
| Mockup deviation | 1 |
| Console error/warn | 1 |
| AE-only (jonli test kerak) | 1 (jamlangan) |

### Eng avval tuzatiladigan ~10 ta
1. **F-01 (P1, latent)** — `go(id)` L10732 da `getElementById('v-'+id)` guardsiz → mavjud bo'lmagan view id uchun TypeError. Hozir o'lik kod niqoblab turibdi; 2 qatorli guard yeching.
2. **F-13 (P2, aktiv)** — L6751 `applyNavSwitch` har AI-tab kirishда o'lik `aiStudioMode`/`aiLoadModels` chaqiradi → keraksiz `/api/studio/gen/models` so'rovi + orphan `af_ai` mutatsiyasi.
3. **F-14 (P2, aktiv)** — jonli kod mavjud bo'lmagan id'larni o'qiydi (funksiya "hech narsaga ulangan"): `orientDrop`/`resDrop` (format/sifat dropdown yashirish no-op), `catPillLabel`, `catMenu`, `featuredWrap`, `clearFiltersPill`, `clearFiltersCount`, `orientPillLabel`, `resPillLabel`, `searchToggleBtn`, `.env-pill`.
4. **F-02 (P2)** — butun `mf-*`/`ai*` V4 AI-tools avlodi o'lik: ~7041–8986 (jonli orollardan tashqari). ~25+ o'lik funksiya. Batch-cleanup nomzodi.
5. **F-03 (P2)** — Script-C tool-pane builderlari (`initImg`/`initVid`/`init3d`/audio/edit/`op`/`openSpecial`/`renderRecent`, ~10799–10885, 10953) + `go()` o'lik shoxlari (10735–10737) o'lik.
6. **F-20 (P2, layout)** — AI Tools panellari kenglikni cheklamaydi → keng viewportда (900px: app 876px) cho'zilib ketadi.
7. **F-21 (P2, layout)** — doimiy offline banner ("Internetga ulanib bo'lmadi") video/rasm tool pastidagi SO'NGGI kontent ustiga chiqadi.
8. **F-19 (P2, layout)** — Toast (z 9997–9999) ochiq lightbox (#afLightbox z 9992) ustidan chiqadi.
9. **F-18 (P2)** — takroriy DOM id `#opBar` (L10866 & L10882) — o'lik `op()`/`openSpecial()` ichida (jonli bug emas, ammo tozalash kerak).
10. **F-15 (P2)** — takroriy funksiya nomlari: `go` (6374 & 10725), `openSheet` (10973 & 11542) — turli IIFE scope; nomlash chalkashligi.

---

## To'liq topilmalar

Ustunlar: **ID · Kat. · Sev. · Joy · Tavsif · Taklif · Aniqlanishi**
Aniqlanishi: 🌐 brauzerda · 🔎 statik · 🎬 AE-only jonli test kerak

---

### Broken handler (latent)

**F-01 · P1 (latent) · `go(id)` L10732** 🌐(manba tasdiqlandi)
`document.getElementById('v-'+id).classList.add('on')` — null-guard yo'q. Faqat 6 ta view mavjud (`v-launcher, v-aicat, v-imggen, v-vidgen, v-history, v-settings`). `go('genimage'|'genvideo'|'editimage'|'editvideo'|'gen3d'|'op'|'gentts'|'genmusic'|'gensfx'|'genstt'|'genavatar')` → `null` → **TypeError** (router qulaydi). **Hozir xavfsiz:** bu id'larni chaqiradigan hamma yo'l o'lik kod (10735–10737 shoxlari, o'lik `op`/`renderRecent`). `go('main'|'home')` esa L10729 da to'g'ri maxsus ishlov (`goHome()`) — Katalog tab XAVFSIZ (tasdiqlandi). **Taklif:** `var _v=document.getElementById('v-'+id); if(!_v)return; _v.classList.add('on');` — routerni kelajakdagi/o'lik chaqiruvlardan himoyalash.

---

### Dead code (o'lik / orphan)

**F-02 · P2 · ~7041–8986** 🔎 *(ehtimol ataylab — deferred, oldingi auditda qayd etilgan)*
Butun eski `mf-*` + `ai*` V4 AI-tools avlodi o'lik. `aiInit()` (8985) yuklanishda o'zini to'xtatadi: L8970 `if(!document.getElementById('aiComposer'))return;` — `#aiComposer` endi yo'q. Yagona runtime kirish — F-13 dagi eskirgan chaqiruv. **O'lik funksiyalar (tasdiqlangan, self-ref yoki faqat o'lik-o'lik):** `mfSwitchTool`(7078), `mfSetCtx`(7077), `mfPickSource`(7102), `mfPaneGen`(7104), `mfWirePane`(7112), `aiLauncherShow`(7129), `aiBackToLauncher`(7177), `aiDestPick`(7179), `aiLaunchFilter`(7243), `aiProjectRef`(7652), `aiPickDescribe`(7711), `aiSfxExportTest`(7974), `aiSetView`(8004), `aiFocus`(8010), `aiToJson`(8360), `aiSoon`(8986), `aiComingSoon`(9277), `toggleSearchBar`(8995) + butun `aiLauncherRenderRecent/aiOpenTool/aiCtxChipsShow/aiAutoLoad*/aiRange*/aiInitSel/aiGenParams/aiRenderInputs/aiBuildSettingsMenu/aiPickRef/aiDescribeFrom/aiSfx*/aiZoom/aiToggleMenu/aiOpenModelsModal/aiRenderModelsModal/aiSetMedia/aiSetModel/aiEnhancePrompt/aiShot*/aiGenerate/aiRunStudioGen/aiPollJob/aiRenderResult/aiHist*/aiLoadHistory/aiRenderCards/aiInit` oilasi. **Taklif:** batch o'chirish — LEKIN pastdagi jonli orollarni SAQLA (F-16).

**F-03 · P2 · ~10799–10885, 10953 (Script C, jonli skript ichida)** 🔎 *(ehtimol ataylab — deferred)*
Jonli `.ax` router ichidagi o'lik tool-pane builderlari: `initImg`(10799), `initVid`(10806), `init3d`(10818), `buildAudioBar/initTTS/initMusic/initSFX/initSTT/initAvatar`(10822–28), `initEditImage/initEditVideo/trHTML/buildEditBar`(10835–45), `run`(10847), `op`(10856), `openSpecial`(10879), `renderRecent`(10953). `go()` shoxlari 10735–10737 (`if(id==='genimage')initImg()…`) o'lik. Bu panellar hech qachon renderlanmaydi (launcher faqat `go('imggen')`/`go('vidgen')` ga yo'naltiradi). **Ogohlantirish:** shu blokdagi `estimate`(10752), `openSelect`(10763), `buildBar`(10771), `renderCtrls`(10793) JONLI — o'chirishdan avval tekshir.

**F-04 · P2 · Script A tarqoq o'lik yordamchilar** 🔎
`sceneThumbRatioClass`(5457), `importSceneByIdx`(5888), `downloadScene`(5990), `renderNoticeItem`(6269), `playSpotlightPreview`(6287), `pauseSpotlightPreview`(6293), `downloadAsset`(6727) — hammasi self-ref, jonli funksiyalar orasida joylashgan (birma-bir o'chir, blok emas).

**F-05 · P2 · Orphan getElementById id'lar (faqat o'lik `ai*` klaster o'qiydi)** 🔎
`id="X"` hech qayerda yaratilmagan (20 ta tasdiqlandi): `aiWrap, aiPrompt, aiComposer, aiToolTitle, aiRefBtn, aiInputs, aiSettingMenu, aiModelLabel, aiDescBtn, aiRefBar, aiViewGrid, aiCharCount, aiResultArea, aiModelsModal, aiMediaMenu, aiModelMenu, aiGenBtn, aiLaunch, aiHistory, aiCards`. Hammasi 7041–8986 ichida o'qiladi → inert, crash yo'q.

**F-06 · P2 · Orphan getElementById id'lar (o'lik Script-C tool-pane)** 🔎
`imgRef`(10800), `imgBar`(10804), `td3Ref`(10820), `sttRef`(10827), `eiSrc`(10836), `evSrc`(10840), `opInputs`(10864), `opTr`(10865), `opPin`(10866), `recentStrip`(10953). Hammasi null-guarded no-op.

**F-07 · P2 · Orphan querySelector klasslar (o'lik)** 🔎
`.spotlight-vid`(6288/6294 o'lik), `.mf-genbtn`(7115), `.mf-imgslot`(7121/7238), `.ail-dopt`(7181). Faqat CSS'da + o'lik JS'da. **YOLG'ON signal (TEGMA — runtime'da yaratiladi):** `.monitor-poster`(5151 jonli), `.server-nav-badge`(6791 jonli), `.sendbtn`(10788 jonli buildBar), `.reftile`(11713 jonli axRefRender).

**F-08 · P2 · `.resultArea` / `.proc` — effektiv o'lik** 🔎
Hech bir elementда bu klass yo'q. Jonli `go()` tozalash sikllari (10733–10734) hech nima bilan mos kelmaydi (zararsiz no-op); asl foydalanuvchi o'lik `run()`(10849) edi.

---

### Inconsistency (nomuvofiqlik / leftover)

**F-13 · P2 (aktiv) · L6751 `applyNavSwitch`** 🔎
Jonli navigatsiya har AI-tab kirishда o'lik-avlod `aiStudioMode(af_ai.media)` + `aiLoadModels(af_ai.media)` chaqiradi → keraksiz `/api/studio/gen/models` tarmoq so'rovi + orphan `af_ai` holatini o'zgartiradi. Fatal emas (`aiLoadModels` har DOM yozuvni `if(el)` bilan guard qiladi), ammo har safar bekorga ishlaydi. **Taklif:** o'lik klaster o'chirilganда bu chaqiruvni ham olib tashla.

**F-14 · P2 (aktiv) · Jonli kod mavjud bo'lmagan id/klassni o'qiydi (feature "hech narsaga ulangan")** 🔎
Hammasi null-guarded (crash yo'q), lekin tegishli UI jimgina ishlamaydi:
`catMenu`(5206/9341), `catPillLabel`(5221), `orientPillLabel`(5244), `resPillLabel`(5245), `featuredWrap`(6302), `clearFiltersPill`(6441), `clearFiltersCount`(6449), `orientDrop`(6769), `resDrop`(6770), `searchToggleBtn`(8996), `.env-pill`(`closeAllDropdowns` 9298 / `toggleDrop` 9309). **Eng muhimi** `orientDrop`/`resDrop`: `applyNavSwitch` luts/graphics uchun format/sifat dropdownlarini yashirmoqchi, ammo elementlar yo'q → yashirish no-op.

**F-15 · P2 · Takroriy funksiya nomlari (turli IIFE scope)** 🔎
`function go(...)` 6374 (katalog) va 10725 (`.ax` router); `function openSheet(...)` 10973 (`.ax`) va 11542 (`ig`). Scope ajratilgan → bug emas, lekin o'qishda chalkashlik. **Taklif:** prefiksla (`axGo`/`axOpenSheet` ichkarida).

**F-16 · P2 (eslatma, bug emas) · O'lik oralig'idagi JONLI orollar — O'CHIRMA** 🔎
`studioGet`(7351), `studioPost`(7358), `studioPostForm`(7365), `studioDelete`(7396) — Script C/E/F bo'ylab ishlatiladigan jonli Studio-API yordamchilari. `aiImportMedia`(8910) + `aiDownloadToTemp`(8933) — jonli AE-import yo'li (11208/11330/12088/12152/13760/13784). F-02 batch-cleanup shu funksiyalar atrofida BO'LINISHI shart.

**F-17 · P2 · `renderHistory()` parametri e'tiborsiz** 🔎
`renderHistory()` (10955) parametrsiz, lekin arg bilan chaqiriladi (10738 `'all'`, 11097, `axRenderHistory(f)` 11256). Arg jimgina tashlanadi (doim `scope:'all'`). Kosmetik.

**F-18 · P2 · Takroriy DOM id `#opBar`** 🔎
L10866 va L10882 — ikkalasi ham `id="opBar"`, ammo o'zaro-eksklyuziv o'lik `op()`/`openSpecial()` ichida (`op()` `lipsync|motion|sfx` ni `openSpecial()` ga yo'naltirib return qiladi). Bir vaqtda faqat bittasi DOM'da → jonli bug emas. O'lik kod tozalanganда yo'qoladi.

---

### Layout / overflow

**F-19 · P2 · Toast lightbox ustida · L3000 (#afLightbox z 9992) vs toast z 9999 (1762), banner 9997 (1783), dl-badge 9998 (1850)** 🔎
Lightbox ochiqligida toast/badge (9997–9999) lightbox chrome ustidan chiqadi. Kichik vizual. **Taklif:** lightbox z-ni 99990+ ga ko'tar yoki lightbox ochiqда toastни pauza qil.

**F-20 · P2 · AI Tools panellari kenglikni cheklamaydi** 🌐 (900px)
`.axroot .app` `max-width:100%` (392px width mensimaydi cep-mode'da) → 900px'da app 876px, `#v-imggen` 852px, launcher `.cats` grid + kartalar to'liq cho'ziladi. Overflow YO'Q. Odatdagi AE dok-panel torда muammo emas; suzuvchi/keng panelда AI tool haddan cho'ziladi. **Taklif:** ichki `max-width` (masalan 520–640px) + markazlash.

**F-21 · P2 · Offline banner kontent ustiga chiqadi** 🌐 (380px)
Doimiy fiksatsiyalangan pastki banner "Internetga ulanib bo'lmadi — tarmoq yoki API ni tekshiring" video/rasm tool pastidagi SO'NGGI blok kontenti bilan qoplanadi (skrinshotда "So'nggi yuklanmadi" ustiga chiqqan). **Taklif:** banner balandligini kontent pastki padding'iga qo'sh.

**F-22 · P2 · Tarix filtr qatorida klipping** 🌐 (380px)
`v-history` filtr qatori: "Video" chip va zoom (−|+) boshqaruvi orasida so'nib ketuvchi ajratuvchi glif ("(" kabi ko'rinadi) qisman kesilgan. Kosmetik. **Taklif:** ajratuvchi elementни tekshir / olib tashla.

**F-23 · P2 · Publish sheet keng bo'sh joy** 🌐 (900px)
Publish modal (g3) markazlashgan, ammo balandligi kontentга nisbatan katta (skanlash tugmasidan pastда keng bo'shliq). Kosmetik.

---

### Broken state

**F-24 · P2 · Offline: MODEL "…" + qattiq narx** 🌐 (380px) / 🎬 to'liq tasdiq uchun
Katalog yuklanmagan (offline) holatда: MODEL pill "…" ko'rsatadi, "Rasm yaratish +4" / "Video yaratish +32 (~4s)" default narxni model yuklanmasдан ko'rsatadi. Settings pill'ni bosish hech narsa qilmaydi (toast/feedback yo'q) — model-aware variantlar yuklanmagan katalogга bog'liq. AE'da katalog yuklansa hal bo'ladi. **Taklif:** model yuklanmaguncha CTA'ni disable qil / "Model yuklanmoqda…" holati.

**F-25 · P2 · R2V rejimga offline kirib bo'lmaydi** 🌐 (380px) / 🎬
Video tool "R2V — referenslar" segmentini bosish → "R2V model topilmadi" toast (offline, katalog yo'q). Fast rejimда qoladi. Kutilgan offline xatti-harakat; jonli katalog bilan tasdiqlash kerak. Model-aware xatti-harakat (Fast=kadr start/end, R2V=referens) tasdiqlandi.

**F-26 · P2 · DEV·DEMO tog'lari settingsда ko'rinadi** 🌐 *(ehtimol ataylab — dev build)*
AI Settings (b) pastida "DEV · DEMO" bo'lim: "Demo: media tanlanmagan (empty)", "Demo: kam kredit (5)", "Demo: keyingi gen xato" tog'lari + `build: dev` ko'rinadi. Dev build uchun foydali; **production build'da yashirilishi kerakmi tekshiring** (`__AF_BUILD__` gate).

---

### Console error / warn

**F-27 · P2 · Offline `Failed to fetch` warn/toast takrori** 🌐
Boot'да `console.warn('Server katalog', TypeError: Failed to fetch)` (assetflow-catalog.js:48 → bootPlugin 10397) va takroriy "Failed to fetch" toast/banner. Bu KUTILGAN offline xatolik ishlovi (`console.warn`, `console.error` emas). Barcha boshqa `console.error`/`throw` (5971, 6145, 6187, 9984, 10005, 10342, 10434, 10476 + tool skriptlari) faqat haqiqiy `try/catch` istisnolarда ishga tushadi — normal happy-path'да emas (tasdiqlandi). Aksiya shart emas; offline retry toastlarини debounce qilish mumkin.

---

### Mockup deviation

**F-12 · P2 · Struktura mockupга mos; no-bottom-sheet idiomi hurmat qilingan** 🌐 (qisman)
Tekshirilgan ekranlar redesign mockupга strukturaviy mos: Home/Katalog (a1), filtr (a2, markaz modal), PRO (a5), limit (a5), account/login (g1/g2 + Standart/Liquid Glass/Light Glass mavzu), AI launcher (b1), rasm tool (b2), video tool (Fast/R2V), settings (kredit+paketlar), tarix (bo'sh), publish (g3). "Bottom-sheet taqiq" idiomi saqlangan (sheet'lar = markaz modal, pill = popover). **Jiddiy strukturaviy og'ish topilmadi.** ⚠️ To'liq 1:1 piksel-taqqoslash (a3 detal, a4 import/MOGRT, a6 kutubxona real ma'lumot, b3–b12 to'liq oqim) offline ma'lumot yo'qligi sababли amalga oshmadi — jonli API bilan tekshirish kerak.

---

## AE-only / jonli test kerak (jamlangan)

Quyidagilar brauzer harness'да TO'LIQ sinovdan o'tkazilmaydi — foydalanuvchining jonli AE + API testini talab qiladi:
- **Katalog:** grid to'ldirilgan holat, shablon detali (a3), import oqimi + progress + MOGRT sheet (a4), kutubxona real ma'lumot (a6 Sevimli/Yuklab olingan), limit real hisoblash.
- **AI Tools:** haqiqiy generatsiya, model-aware pill popover'lar (offline ochilmadi), R2V/i2v/t2v/frames-only rejimlar to'liq, tarix real ma'lumot bilan, lightbox media (video/audio/rasm) + counter/nav/scrubber, kredit consume/refund, low-credit/session-ended bannerlari.
- **AE-integratsiya:** `evalScript` orqali import, Publish "Ochiq loyihani skanlash" (g3), auto-load (Project tanlovi), Google device-code login, kadr picker (`listProjectFootage`/`exportTimelineFrame`).

---

*Hisobot generatsiya: statik skript + 2 subagent (dead-code mapping, live correctness) + dinamik harness (380px & 900px, cep-mode). Plagin kodi o'zgartirilmadi.*
